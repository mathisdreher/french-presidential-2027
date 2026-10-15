"""Construction du site statique : copie de site/, puis data.json et games.json.

data.json : candidats (photos, statut du compte X), cadres théoriques et livre de codes,
tweets codés en colonnes compactes, texte des seuls tweets écologie, lexicométrie, validation.
games.json : tweets anonymisés pour les jeux, avec leur codage et les probabilités de Jev.
Le site agrège dans le navigateur, ce qui permet de filtrer par période et famille politique.
"""

from __future__ import annotations

import json
import logging
import shutil
from dataclasses import asdict
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Optional

from . import codebook as cb
from . import config, games, lexique, photos
from .fetch import account_status
from .storage import load_json, read_jsonl

log = logging.getLogger(__name__)

INACTIVE_DAYS = 30
# Colonnes compactes : clé courte -> variable du livre de codes
COLUMNS = {v.key: k for k, v in zip(
    ["n", "th", "po", "ca", "pl", "ad", "vi", "pr", "to", "lg", "rd", "vs", "et", "ag", "mo", "ac", "re", "rx"],
    [cb.NIVEAU, cb.THEMES, cb.POSITION, cb.CADRAGE, cb.POLARISATION, cb.ADVERSAIRE, cb.VICTIME, cb.PROCEDES, cb.TOPOI,
     cb.LEGITIMATION, cb.RETARDEMENT, cb.VISION, cb.ETHOS, cb.AGENTIVITE, cb.MODALITE, cb.ACTE, cb.REGISTRE, cb.REACTIVITE])}


def _encode(var: cb.Variable, value):
    """Valeur -> entier : index d'option, masque de bits pour les choix multiples, 0/1 pour oui/non."""
    if value is None:
        return None
    if var.kind == "noul":
        return 1 if value else 0
    keys = var.option_keys
    if var.kind == "multi":
        return sum(1 << keys.index(k) for k in value if k in keys)
    return keys.index(value) if value in keys else None


def _codebook() -> dict:
    def fw(f: cb.Framework) -> dict:
        d = asdict(f)
        d["refs"] = [asdict(r) for r in f.refs]
        return d
    variables = []
    for v in cb.VARIABLES:
        variables.append({"key": v.key, "short": COLUMNS.get(v.key, "e"), "kind": v.kind, "label": v.label,
                          "framework": v.framework, "scope": v.scope,
                          "options": [{"key": o.key, "label": o.label, "fr": o.fr, "description": o.description} for o in v.options]})
    return {"frameworks": [fw(f) for f in cb.FRAMEWORKS], "engines": [fw(f) for f in cb.ENGINES], "variables": variables}


def _account(cand: config.Candidate, users: dict, last_day: Optional[str], today: date) -> str:
    if not cand.handle:
        return "sans_compte"
    status = account_status(users.get(cand.slug))
    if status in ("introuvable", "protege"):
        return status
    if status == "inconnu":
        return "en_attente"
    if not last_day or (today - date.fromisoformat(last_day)).days > INACTIVE_DAYS:
        return "peu_actif"
    return "actif"


def payload(raw_path: Path | None = None, cls_path: Path | None = None, validation_path: Path | None = None,
            candidates: list[config.Candidate] | None = None, users: dict | None = None) -> dict:
    raw_path = raw_path or config.RAW_TWEETS_FILE
    cls_path = cls_path or config.CLASSIFICATIONS_FILE
    validation_path = validation_path or config.VALIDATION_FILE
    study = config.load_study()
    candidates = candidates if candidates is not None else config.load_candidates(only_enabled=False)
    candidates = [c for c in candidates if c.enabled or c.note]
    users = users if users is not None else load_json(config.USERS_STATE_FILE, {})
    pics = photos.load()
    index = {c.slug: i for i, c in enumerate(candidates)}
    rows = {r["id"]: r for r in read_jsonl(cls_path)}
    raw = list(read_jsonl(raw_path))

    cols = ["i", "c", "d", "e", "p", "s", "l", "rt", *COLUMNS.values()]
    out_rows, texts, last_day, eco_ids = [], {}, {}, set()
    for t in raw:
        slug = t["handle"].lower()
        day = (t.get("created_at") or "")[:10]
        if day and day > last_day.get(slug, ""):
            last_day[slug] = day
        r = rows.get(t["id"])
        if not r or r.get("parle_ecologie") is None or slug not in index:
            continue
        eco = bool(r["parle_ecologie"])
        p = ((r.get("jev") or {}).get("probabilities") or {}).get("parle_ecologie")
        row = [t["id"], index[slug], day, 1 if eco else 0, None if p is None else round(p, 3),
               (r.get("final_source") or "j")[:1], t.get("likes", 0), t.get("retweets", 0)]
        row += [_encode(cb.VARIABLE_BY_KEY[k], r.get(k)) for k in COLUMNS]
        out_rows.append(row)
        if eco:
            eco_ids.add(t["id"])
            texts[t["id"]] = {k: v for k, v in (("t", t.get("text", "")), ("rs", r.get("resume")), ("lx", r.get("lexique")),
                                                 ("im", r.get("implicites"))) if v}
    out_rows.sort(key=lambda x: x[2])

    generated = datetime.now(timezone.utc)
    cand_out = []
    for c in candidates:
        user = users.get(c.slug) or {}
        cand_out.append({
            "key": c.slug, "name": c.name, "party": c.party, "bloc": c.bloc, "handle": c.handle, "status": c.status,
            "enabled": c.enabled, "note": c.note, "compte": _account(c, users, last_day.get(c.slug), generated.date()),
            "dernier_tweet": last_day.get(c.slug), "abonnes": user.get("followers"),
            "photo": pics.get(c.slug) or ({"url": user["image"], "source": f"https://x.com/{c.handle}", "auteur": "Photo de profil X", "licence": ""}
                                          if user.get("image") else None),
        })
    bloc_of = {c.slug: c.bloc for c in candidates}
    return {
        "generated_at": generated.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "study": {k: study.get(k) for k in ("start", "phases", "events", "blocs", "questions")},
        "candidates": cand_out,
        "codebook": _codebook(),
        "tweets": {"cols": cols, "rows": out_rows},
        "texts": texts,
        "lexique": lexique.analyse(raw, eco_ids, bloc_of) if raw else None,
        "validation": load_json(validation_path, None),
    }


def games_payload(raw_path: Path | None = None, cls_path: Path | None = None, games_path: Path | None = None,
                  candidates: list[config.Candidate] | None = None) -> dict:
    rows = {r["id"]: r for r in read_jsonl(cls_path or config.CLASSIFICATIONS_FILE)}
    rewritten = {g["id"]: g for g in read_jsonl(games_path or config.GAMES_FILE)}
    candidates = candidates if candidates is not None else config.load_candidates(only_enabled=False)
    known = {c.slug for c in candidates}
    items = []
    for t in games.select(list(read_jsonl(raw_path or config.RAW_TWEETS_FILE)), rows):
        slug = t["handle"].lower()
        g = rewritten.get(t["id"])
        if slug not in known or (g and g.get("reconnaissable")):
            continue
        r = rows[t["id"]]
        jev = r.get("jev") or {}
        probs = jev.get("probabilities") or {}
        items.append({
            "i": t["id"], "c": slug, "d": (t.get("created_at") or "")[:10],
            "t": g["texte"] if g else games.anonymize(t.get("text", ""), candidates),
            "m": "claude" if g else "auto", "ind": (g or {}).get("indices", []),
            "codes": {k: r.get(k) for k in ("position", "cadrage", "vision", "procedes", "topoi", "retardement", "polarisation", "ethos")},
            "jev": {k: probs.get(k) for k in ("position", "cadrage", "procedes")} if probs else None,
            "claude": {k: (r.get("claude") or {}).get("values", {}).get(k) for k in ("position", "cadrage", "procedes")} if r.get("claude") else None,
        })
    return {"items": items}


def build(out_dir: Path, **kwargs) -> Path:
    if out_dir.exists():
        shutil.rmtree(out_dir)
    shutil.copytree(config.SITE_SRC_DIR, out_dir)
    data = payload(**kwargs)
    target = out_dir / "data.json"
    target.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    gkw = {k: kwargs[k] for k in ("raw_path", "cls_path", "candidates") if k in kwargs}
    (out_dir / "games.json").write_text(json.dumps(games_payload(**gkw), ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    log.info("Site construit dans %s (%d tweets, %.1f Mo)", out_dir, len(data["tweets"]["rows"]), target.stat().st_size / 1e6)
    return target
