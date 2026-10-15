"""CLI : python -m presidentielle {fetch,classify,validate,report,site,daily}"""

from __future__ import annotations

import argparse
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path

from . import classify as classify_mod
from . import config, fetch as fetch_mod, report as report_mod


def _date(s: str) -> datetime:
    return datetime.fromisoformat(s).replace(tzinfo=timezone.utc)


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="presidentielle",
                                description="Tweets des candidats 2027 : extraction X, codage écologie (Jev, puis Claude à la demande), synthèse et site.")
    p.add_argument("-v", "--verbose", action="store_true")
    sub = p.add_subparsers(dest="cmd", required=True)

    f = sub.add_parser("fetch", help="Extraire les tweets via l'API X (rattrapage depuis le début de l'étude, puis incrémental)")
    f.add_argument("--days", type=int, help="Fenêtre glissante en jours, au lieu du début de l'étude")
    f.add_argument("--since", type=_date, help="Date de début (YYYY-MM-DD, UTC), au lieu du début de l'étude")
    f.add_argument("--until", type=_date, help="Date de fin (YYYY-MM-DD, UTC)")
    f.add_argument("--max-pages", type=int, help="Plafond de pages par candidat (aucun par défaut)")
    f.add_argument("--candidate", help="Handle ou nom d'un seul candidat")
    f.add_argument("--include-replies", action="store_true")
    f.add_argument("--include-retweets", action="store_true")
    f.add_argument("--backfill", action="store_true", help="Refaire le rattrapage full-archive (doublons ignorés)")

    c = sub.add_parser("classify", help="Coder les tweets (Jev par défaut ; Claude à la demande)")
    c.add_argument("--engine", choices=["jev", "claude", "hybrid"], default="jev")
    c.add_argument("--scope", choices=classify_mod.CLAUDE_SCOPES, default="ecologie_et_incertains",
                   help="Portée des appels Claude (moteur claude uniquement)")
    c.add_argument("--sample-size", type=int, default=300, help="Taille de l'échantillon de validation (scope echantillon)")
    c.add_argument("--mode", choices=["sync", "batch"], default="sync", help="Mode des appels Claude")
    c.add_argument("--limit", type=int, help="Nombre max de tweets à traiter")
    c.add_argument("--candidate", help="Handle ou nom d'un seul candidat")
    c.add_argument("--model", help=f"Modèle Claude (défaut : {config.DEFAULT_MODEL} ou CLAUDE_MODEL)")
    c.add_argument("--workers", type=int, default=4, help="Appels parallèles")
    c.add_argument("--no-wait", action="store_true", help="Mode batch : soumettre sans attendre")
    c.add_argument("--collect", metavar="BATCH_ID", help="Mode batch : récupérer un batch déjà soumis")
    c.add_argument("--collect-pending", action="store_true", help="Mode batch : récupérer tous les batches terminés non collectés")
    c.add_argument("--timeout-minutes", type=int, default=90, help="Mode batch : attente maximale avant de rendre la main")
    c.add_argument("--dry-run", action="store_true", help="Afficher le nombre de tweets concernés sans appeler l'API")

    sub.add_parser("validate", help="Accord Jev / Claude (kappa, alpha de Krippendorff, calibration)")
    sub.add_parser("report", help="Générer les CSV et la synthèse Markdown")

    s = sub.add_parser("site", help="Construire le site statique (site/ + data.json)")
    s.add_argument("--out", type=Path, default=config.ROOT / "_site")

    pu = sub.add_parser("publish", help="validate + report + site")
    pu.add_argument("--out", type=Path, default=config.ROOT / "_site")

    d = sub.add_parser("daily", help="Tâche quotidienne : fetch + Jev (+ batches Claude terminés) + publish")
    d.add_argument("--out", type=Path, default=config.ROOT / "_site")
    return p


def _select(cands, needle):
    if not needle:
        return cands
    n = needle.lstrip("@").lower()
    sel = [c for c in cands if c.handle.lower() == n or c.name.lower() == n]
    if not sel:
        raise SystemExit(f"Candidat inconnu : {needle}")
    return sel


def _classify(args) -> int:
    if args.collect:
        return classify_mod.collect_batch(args.collect)
    if args.collect_pending:
        return classify_mod.collect_pending(wait=not args.no_wait)
    if args.engine == "claude":
        tweets = classify_mod.claude_targets(args.scope, limit=args.limit, candidate=args.candidate,
                                             sample_size=args.sample_size)
        label = f"Claude, portée {args.scope}"
    else:
        tweets = classify_mod.pending_tweets(args.engine, limit=args.limit, candidate=args.candidate)
        label = args.engine
    print(f"{len(tweets)} tweet(s) à coder ({label})")
    if args.dry_run or not tweets:
        return 0
    if args.engine == "jev":
        return classify_mod.classify_jev(tweets, workers=args.workers)
    if args.engine == "claude":
        if args.mode == "batch":
            return classify_mod.classify_claude_batch(tweets, model=args.model, wait=not args.no_wait,
                                                      timeout_minutes=args.timeout_minutes)
        return classify_mod.classify_claude_sync(tweets, model=args.model, workers=args.workers)
    return classify_mod.classify_hybrid(tweets, mode=args.mode, model=args.model, workers=args.workers,
                                        wait=not args.no_wait)


def _finalize(out: Path) -> None:
    from . import site, validate
    if any(True for _ in classify_mod.read_jsonl(config.CLASSIFICATIONS_FILE)):
        validate.run()
        report_mod.run()
    site.build(out)


def main(argv=None) -> int:
    args = build_parser().parse_args(argv)
    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO,
                        format="%(asctime)s %(levelname)s %(message)s", datefmt="%H:%M:%S")
    for noisy in ("httpx2", "httpx", "typesafe_sdk"):
        logging.getLogger(noisy).setLevel(logging.WARNING)

    if args.cmd == "fetch":
        from .x_client import XClient
        cands = _select(config.load_candidates(), args.candidate)
        client = XClient(config.x_bearer_token())
        fetch_mod.fetch(client, cands, days=args.days, since=args.since, until=args.until,
                        max_pages=args.max_pages, include_replies=args.include_replies,
                        include_retweets=args.include_retweets, backfill=args.backfill)
        return 0

    if args.cmd == "classify":
        config.load_env()
        _classify(args)
        return 0

    if args.cmd == "validate":
        from . import validate
        validate.run()
        return 0

    if args.cmd == "report":
        paths = report_mod.run()
        print("\n".join(f"{k}: {v}" for k, v in paths.items()))
        return 0

    if args.cmd == "site":
        from . import site
        site.build(args.out)
        return 0

    if args.cmd == "publish":
        _finalize(args.out)
        return 0

    if args.cmd == "daily":
        from .x_client import XClient
        config.load_env()
        import os
        fetch_mod.fetch(XClient(config.x_bearer_token()), config.load_candidates())
        classify_mod.classify_jev(classify_mod.pending_tweets("jev"))
        if os.environ.get("ANTHROPIC_API_KEY"):
            try:
                classify_mod.collect_pending()
            except Exception as e:  # noqa: BLE001 - la collecte Claude ne doit pas bloquer la tâche quotidienne
                logging.getLogger(__name__).warning("Collecte des batches Claude impossible : %s", e)
        _finalize(args.out)
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())
