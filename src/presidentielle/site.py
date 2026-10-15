"""Construction du site statique (GitHub Pages) : copie de site/ et export de data.json.

Le site agrège côté navigateur à partir des tweets codés, ce qui permet de filtrer par
période et par bloc politique. Le texte n'est exporté que pour les tweets écologie.
"""

from __future__ import annotations

import json
import logging
import shutil
from datetime import datetime, timezone
from pathlib import Path

from . import codebook as cb
from . import config
from .storage import load_json, read_jsonl

log = logging.getLogger(__name__)

SHORT = {
    "niveau": "n", "position": "po", "cadrage": "ca", "polarisation": "pl", "adversaire": "ad",
    "victime": "vi", "acte_discursif": "ac", "registre": "re",
}


def _codebook() -> dict:
    variables = []
    for v in cb.VARIABLES:
        item = {"key": v.key, "label": v.label, "kind": v.kind, "block": v.block, "instructions": v.instructions}
        if v.kind == "choice":
            item["options"] = [{"key": o.key, "label": o.label, "description": o.description} for o in v.options]
        elif v.kind == "score":
            item["options"] = [{"key": k, "label": k.replace("_", " ").capitalize(), "description": d}
                               for k, d in zip(v.level_keys, v.levels)]
        variables.append(item)
    themes = [{"key": t.key, "label": t.label, "description": t.description} for t in cb.THEMES]
    return {"variables": variables, "themes": themes}


def payload(raw_path: Path = config.RAW_TWEETS_FILE, cls_path: Path = config.CLASSIFICATIONS_FILE,
            validation_path: Path = config.VALIDATION_FILE, candidates: list[config.Candidate] | None = None) -> dict:
    study = config.load_study()
    candidates = candidates if candidates is not None else config.load_candidates()
    rows = {r["id"]: r for r in read_jsonl(cls_path)}
    tweets = []
    for t in read_jsonl(raw_path):
        r = rows.get(t["id"])
        if not r or r.get("parle_ecologie") is None:
            continue
        eco = bool(r["parle_ecologie"])
        item = {
            "i": t["id"],
            "c": t["handle"].lower(),
            "d": (t.get("created_at") or "")[:10],
            "e": 1 if eco else 0,
            "l": t.get("likes", 0),
            "rt": t.get("retweets", 0),
            "s": (r.get("final_source") or "")[:1],  # j = Jev, c = Claude
        }
        p = ((r.get("jev") or {}).get("probabilities") or {}).get("parle_ecologie")
        if p is not None:
            item["p"] = round(p, 3)
        for key, short in SHORT.items():
            if r.get(key) is not None:
                item[short] = r[key]
        if eco:
            item["th"] = r.get("themes") or []
            item["t"] = t.get("text", "")
            for key, short in (("resume", "rs"), ("lexique", "lx"), ("implicites", "im")):
                if r.get(key):
                    item[short] = r[key]
        tweets.append(item)
    tweets.sort(key=lambda x: x["d"])
    return {
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "study": {k: study.get(k) for k in ("start", "phases", "events", "blocs")},
        "candidates": [{"key": c.slug, "name": c.name, "party": c.party, "bloc": c.bloc, "handle": c.handle,
                        "status": c.status} for c in candidates],
        "codebook": _codebook(),
        "validation": load_json(validation_path, None),
        "tweets": tweets,
    }


def build(out_dir: Path, **kwargs) -> Path:
    if out_dir.exists():
        shutil.rmtree(out_dir)
    shutil.copytree(config.SITE_SRC_DIR, out_dir)
    data = payload(**kwargs)
    target = out_dir / "data.json"
    target.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    log.info("Site construit dans %s (%d tweets, %.1f Mo)", out_dir, len(data["tweets"]), target.stat().st_size / 1e6)
    return target
