"""CLI : python -m presidentielle <commande>. Voir `--help`."""

from __future__ import annotations

import argparse
import logging
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from . import classify as classify_mod
from . import config


def _date(s: str) -> datetime:
    return datetime.fromisoformat(s).replace(tzinfo=timezone.utc)


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="presidentielle",
                                description="L'écologie dans les tweets des candidats 2027 : collecte, codage (Jev, Claude), analyses et site.")
    p.add_argument("-v", "--verbose", action="store_true")
    sub = p.add_subparsers(dest="cmd", required=True)

    f = sub.add_parser("fetch", help="Collecter les tweets (rattrapage depuis le début de l'étude, puis incrémental)")
    f.add_argument("--days", type=int, help="Fenêtre glissante en jours, au lieu du début de l'étude")
    f.add_argument("--since", type=_date, help="Date de début (AAAA-MM-JJ)")
    f.add_argument("--until", type=_date, help="Date de fin (AAAA-MM-JJ)")
    f.add_argument("--max-pages", type=int, help="Plafond de pages par candidat")
    f.add_argument("--candidate", help="Handle ou nom d'un seul candidat")
    f.add_argument("--backfill", action="store_true", help="Refaire le rattrapage complet (doublons ignorés)")

    c = sub.add_parser("classify", help="Coder les tweets : Jev par défaut, Claude à la demande")
    c.add_argument("--engine", choices=["jev", "claude"], default="jev")
    c.add_argument("--scope", choices=classify_mod.CLAUDE_SCOPES, default="ecologie_et_incertains", help="Portée de Claude")
    c.add_argument("--sample-size", type=int, default=300, help="Taille de l'échantillon de validation")
    c.add_argument("--mode", choices=["sync", "batch"], default="batch", help="Appels Claude immédiats ou par lot (moitié prix)")
    c.add_argument("--limit", type=int)
    c.add_argument("--candidate")
    c.add_argument("--model", help=f"Modèle Claude (défaut : {config.DEFAULT_MODEL})")
    c.add_argument("--workers", type=int, default=4)
    c.add_argument("--no-wait", action="store_true", help="Lot : soumettre sans attendre")
    c.add_argument("--timeout-minutes", type=int, default=90, help="Lot : attente maximale")
    c.add_argument("--collect-pending", action="store_true", help="Lot : récupérer les lots terminés")
    c.add_argument("--dry-run", action="store_true", help="Compter les tweets concernés sans appel")

    g = sub.add_parser("games", help="Préparer les tweets des jeux avec Claude (anonymisation fine et indices)")
    g.add_argument("--limit", type=int)
    g.add_argument("--model")

    sub.add_parser("photos", help="Rafraîchir les photos des candidats (Wikipédia et Commons)")
    sub.add_parser("validate", help="Accord Jev / Claude")
    sub.add_parser("export", help="Export CSV du codage dans le dépôt de données")
    for name, help_ in (("site", "Construire le site"), ("publish", "validate + export + site"),
                        ("daily", "Tâche quotidienne : fetch + Jev + lots Claude terminés + publish")):
        s = sub.add_parser(name, help=help_)
        s.add_argument("--out", type=Path, default=config.ROOT / "_site")
    return p


def _select(cands, needle):
    if not needle:
        return cands
    n = needle.lstrip("@").lower()
    sel = [c for c in cands if (c.handle or "").lower() == n or c.name.lower() == n]
    if not sel:
        raise SystemExit(f"Candidat inconnu : {needle}")
    return sel


def _classify(args) -> int:
    if args.collect_pending:
        return classify_mod.collect_pending(wait=not args.no_wait)
    if args.engine == "claude":
        tweets = classify_mod.claude_targets(args.scope, limit=args.limit, candidate=args.candidate, sample_size=args.sample_size)
        label = f"Claude, portée {args.scope}"
    else:
        tweets = classify_mod.pending_tweets("jev", limit=args.limit, candidate=args.candidate)
        label = "Jev"
    print(f"{len(tweets)} tweet(s) à coder ({label})")
    if args.dry_run or not tweets:
        return 0
    if args.engine == "jev":
        return classify_mod.classify_jev(tweets, workers=args.workers)
    if args.mode == "batch":
        return classify_mod.classify_claude_batch(tweets, model=args.model, wait=not args.no_wait, timeout_minutes=args.timeout_minutes)
    return classify_mod.classify_claude_sync(tweets, model=args.model, workers=args.workers)


def _publish(out: Path) -> None:
    from . import export, site, validate
    if config.CLASSIFICATIONS_FILE.exists():
        validate.run()
        export.run()
    site.build(out)


def main(argv=None) -> int:
    args = build_parser().parse_args(argv)
    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO,
                        format="%(asctime)s %(levelname)s %(message)s", datefmt="%H:%M:%S")
    for noisy in ("httpx2", "httpx", "typesafe_sdk", "urllib3"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
    config.load_env()

    if args.cmd in ("fetch", "daily"):
        from . import fetch
        from .x_client import XClient
        cands = _select(config.load_candidates(), getattr(args, "candidate", None))
        client = XClient(config.x_bearer_token())
        if args.cmd == "fetch":
            fetch.fetch(client, cands, days=args.days, since=args.since, until=args.until,
                        max_pages=args.max_pages, backfill=args.backfill)
            return 0
        fetch.fetch(client, cands)
        classify_mod.classify_jev(classify_mod.pending_tweets("jev"))
        if os.environ.get("ANTHROPIC_API_KEY"):
            try:
                classify_mod.collect_pending()
            except Exception as e:  # noqa: BLE001 - la récupération Claude ne doit pas bloquer la tâche quotidienne
                logging.getLogger(__name__).warning("Récupération des lots Claude impossible : %s", e)
        _publish(args.out)
        return 0
    if args.cmd == "classify":
        _classify(args)
        return 0
    if args.cmd == "games":
        from . import games
        games.run_claude(model=args.model, limit=args.limit)
        return 0
    if args.cmd == "photos":
        from . import photos
        photos.run()
        return 0
    if args.cmd == "validate":
        from . import validate
        validate.run()
        return 0
    if args.cmd == "export":
        from . import export
        export.run()
        return 0
    if args.cmd == "site":
        from . import site
        site.build(args.out)
        return 0
    if args.cmd == "publish":
        _publish(args.out)
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())
