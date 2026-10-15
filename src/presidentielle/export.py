"""Export CSV du codage final (dans le dépôt de données privé), pour analyse dans un tableur."""

from __future__ import annotations

import csv
import logging

from . import codebook as cb
from . import config
from .jev_client import tweet_level
from .storage import load_json, read_jsonl

log = logging.getLogger(__name__)


def run() -> int:
    rows = {r["id"]: r for r in read_jsonl(config.CLASSIFICATIONS_FILE)}
    measures = load_json(config.METRICS_FILE, {})
    engagement = ["likes", "retweets", "replies", "quotes", "bookmarks", "impressions"]
    keys = [v.key for v in cb.VARIABLES] + list(cb.TEXT_FIELDS)
    config.EXPORTS_DIR.mkdir(parents=True, exist_ok=True)
    path = config.EXPORTS_DIR / "tweets_codes.csv"
    n = 0
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["id", "candidat", "handle", "date", "texte", "url", "source_finale", "p_ecologie", "confiance_jev",
                    *[f"{k}_48h" for k in engagement], "age_mesure_h", *[f"{k}_maj" for k in engagement], "date_maj", *keys])
        for t in read_jsonl(config.RAW_TWEETS_FILE):
            r = rows.get(t["id"])
            if not r:
                continue
            p = ((r.get("jev") or {}).get("probabilities") or {}).get("parle_ecologie")
            vals = ["|".join(v) if isinstance(v, list) else ("" if v is None else v) for v in (r.get(k) for k in keys)]
            m = measures.get(t["id"]) or {}
            h48, maj = m.get("h48") or {}, m.get("maj") or {}
            level = tweet_level(r["jev"]) if r.get("jev") else None
            w.writerow([t["id"], t["candidate"], t["handle"], (t.get("created_at") or "")[:10], t.get("text", ""),
                        t.get("url", ""), r.get("final_source", ""), p, "" if level is None else ("faible", "moyenne", "elevee")[level],
                        *[h48.get(k, "") for k in engagement], h48.get("age_h", ""), *[maj.get(k, "") for k in engagement],
                        (maj.get("at") or "")[:10], *vals])
            n += 1
    log.info("Export : %d tweets dans %s", n, path)
    return n
