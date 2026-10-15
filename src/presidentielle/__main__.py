"""CLI : python -m presidentielle {fetch,classify,report,run}"""

from __future__ import annotations

import argparse
import logging
import sys
from datetime import datetime, timezone

from . import classify as classify_mod
from . import config, fetch as fetch_mod, report as report_mod


def _date(s: str) -> datetime:
    return datetime.fromisoformat(s).replace(tzinfo=timezone.utc)


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="presidentielle",
                                description="Tweets des candidats 2027 : extraction X, classification écologie (Jev + Claude), synthèse.")
    p.add_argument("-v", "--verbose", action="store_true")
    sub = p.add_subparsers(dest="cmd", required=True)

    f = sub.add_parser("fetch", help="Extraire les tweets via l'API X")
    f.add_argument("--days", type=int, help="Fenêtre glissante en jours (ignoré si --since)")
    f.add_argument("--since", type=_date, help="Date de début (YYYY-MM-DD, UTC)")
    f.add_argument("--until", type=_date, help="Date de fin (YYYY-MM-DD, UTC)")
    f.add_argument("--max-pages", type=int, help="Pages de 100 tweets max par candidat")
    f.add_argument("--candidate", help="Handle ou nom d'un seul candidat")
    f.add_argument("--include-replies", action="store_true")
    f.add_argument("--include-retweets", action="store_true")
    f.add_argument("--full", action="store_true", help="Ignorer les since_id (ré-extraction complète de la fenêtre)")

    c = sub.add_parser("classify", help="Classifier les tweets non encore traités")
    c.add_argument("--engine", choices=["hybrid", "jev", "claude"], default="hybrid")
    c.add_argument("--mode", choices=["sync", "batch"], default="sync", help="Mode des appels Claude")
    c.add_argument("--limit", type=int, help="Nombre max de tweets à traiter")
    c.add_argument("--candidate", help="Handle ou nom d'un seul candidat")
    c.add_argument("--model", help=f"Modèle Claude (défaut : {config.DEFAULT_MODEL} ou CLAUDE_MODEL)")
    c.add_argument("--workers", type=int, default=4, help="Appels parallèles")
    c.add_argument("--no-wait", action="store_true", help="Mode batch : soumettre sans attendre")
    c.add_argument("--collect", metavar="BATCH_ID", help="Mode batch : récupérer un batch déjà soumis")
    c.add_argument("--dry-run", action="store_true", help="Afficher le nombre de tweets en attente")

    sub.add_parser("report", help="Générer CSV, synthèse Markdown et JSON du site")

    a = sub.add_parser("run", help="fetch + classify + report")
    a.add_argument("--days", type=int, default=7)
    a.add_argument("--engine", choices=["hybrid", "jev", "claude"], default="hybrid")
    a.add_argument("--mode", choices=["sync", "batch"], default="sync")
    a.add_argument("--model")
    return p


def _select(cands, needle):
    if not needle:
        return cands
    n = needle.lstrip("@").lower()
    sel = [c for c in cands if c.handle.lower() == n or c.name.lower() == n]
    if not sel:
        raise SystemExit(f"Candidat inconnu : {needle}")
    return sel


def _classify(engine: str, tweets: list[dict], *, mode: str, model, workers: int = 4, wait: bool = True) -> int:
    if engine == "jev":
        return classify_mod.classify_jev(tweets, workers=workers)
    if engine == "claude":
        if mode == "batch":
            return classify_mod.classify_claude_batch(tweets, model=model, wait=wait)
        return classify_mod.classify_claude_sync(tweets, model=model, workers=workers)
    return classify_mod.classify_hybrid(tweets, mode=mode, model=model, workers=workers, wait=wait)


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
                        include_retweets=args.include_retweets, incremental=not args.full)
        return 0

    if args.cmd == "classify":
        if args.collect:
            classify_mod.collect_batch(args.collect)
            return 0
        tweets = classify_mod.pending_tweets(args.engine, limit=args.limit, candidate=args.candidate)
        print(f"{len(tweets)} tweet(s) à classifier (moteur {args.engine})")
        if args.dry_run or not tweets:
            return 0
        _classify(args.engine, tweets, mode=args.mode, model=args.model, workers=args.workers, wait=not args.no_wait)
        return 0

    if args.cmd == "report":
        paths = report_mod.run()
        print("\n".join(f"{k}: {v}" for k, v in paths.items()))
        return 0

    if args.cmd == "run":
        from .x_client import XClient
        cands = config.load_candidates()
        fetch_mod.fetch(XClient(config.x_bearer_token()), cands, days=args.days)
        tweets = classify_mod.pending_tweets(args.engine)
        _classify(args.engine, tweets, mode=args.mode, model=args.model)
        report_mod.run()
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())
