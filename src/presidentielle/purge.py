"""Retire des données les comptes qui ne figurent plus dans config/candidates.yaml.

Un candidat retiré de la liste (compte erroné, candidat qui quitte X ou la course) disparaît
ainsi de toutes les analyses : tweets bruts, codage, jeux, mesures et états de collecte. Un
candidat désactivé (enabled: false) reste dans la liste et n'est pas concerné. Le dépôt de
données étant versionné, une suppression se rattrape dans son historique git.
"""

from __future__ import annotations

import json
import logging

from . import config
from . import metrics as metrics_mod
from .storage import load_json, read_jsonl, save_json

log = logging.getLogger(__name__)


def _rewrite_jsonl(path, keep) -> int:
    if not path.exists():
        return 0
    rows = list(read_jsonl(path))
    kept = [r for r in rows if keep(r)]
    if len(kept) != len(rows):
        path.write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in kept), encoding="utf-8")
    return len(rows) - len(kept)


def run() -> dict:
    known = {c.slug for c in config.load_candidates(only_enabled=False)}
    tweets = list(read_jsonl(config.RAW_TWEETS_FILE))
    gone = {t["id"] for t in tweets if (t.get("handle") or "").lower() not in known}
    out = {"comptes": sorted({t["handle"] for t in tweets if t["id"] in gone}), "tweets": len(gone)}
    if gone:
        _rewrite_jsonl(config.RAW_TWEETS_FILE, lambda r: r["id"] not in gone)
        out["codes"] = _rewrite_jsonl(config.CLASSIFICATIONS_FILE, lambda r: r["id"] not in gone)
        _rewrite_jsonl(config.GAMES_FILE, lambda r: r["id"] not in gone)
        metrics = load_json(config.METRICS_FILE, {})
        if any(i in metrics for i in gone):
            metrics_mod.save({k: v for k, v in metrics.items() if k not in gone})
        sample = load_json(config.VALIDATION_SAMPLE_FILE, None)
        if sample and any(it["id"] in gone for it in sample.get("items", [])):
            sample["items"] = [it for it in sample["items"] if it["id"] not in gone]
            save_json(config.VALIDATION_SAMPLE_FILE, sample)
    for path in (config.USERS_STATE_FILE, config.SINCE_STATE_FILE):
        state = load_json(path, {})
        if set(state) - known:
            save_json(path, {k: v for k, v in state.items() if k in known})
    if gone:
        log.warning("Purge : %d tweets retirés (comptes absents de candidates.yaml : %s)", len(gone), ", ".join(out["comptes"]))
    return out
