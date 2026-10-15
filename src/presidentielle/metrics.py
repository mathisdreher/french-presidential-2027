"""Mesures d'engagement : métriques relevées sur des tweets d'au moins 48 heures.

Les métriques publiques d'un tweet (j'aime, reposts, réponses, citations, signets, vues) montent
pendant un à deux jours. La collecte ne lit que des tweets d'au moins 48 heures : la mesure prise à
la collecte est donc la mesure de référence, sans seconde lecture. Seuls les tweets collectés trop
jeunes (avant ce fonctionnement, ou par une collecte manuelle --fresh) sont relus une fois, à 48 h
(« h48 »).

Une réactualisation manuelle (« maj ») relit une période choisie, par exemple pour suivre un
tweet devenu viral, sans toucher à la mesure de référence.

Coût : chaque relecture est une lecture de post facturée par l'API X.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from . import config
from .fetch import age_at_fetch
from .storage import load_json, read_jsonl
from .x_client import MAX_RESULTS, XClient

log = logging.getLogger(__name__)

MIN_AGE_HOURS = 48
DAILY_MAX_READS = 5000   # garde-fou de coût par passage quotidien (environ 25 $ au tarif X à l'usage)
FIELDS = {"like_count": "likes", "retweet_count": "retweets", "reply_count": "replies", "quote_count": "quotes",
          "bookmark_count": "bookmarks", "impression_count": "impressions"}


def _parse(ts: str) -> datetime:
    return datetime.fromisoformat(ts.replace("Z", "+00:00"))


def _stamp(now: datetime) -> str:
    return now.strftime("%Y-%m-%dT%H:%M:%SZ")


def save(store: dict) -> None:
    """Une ligne par tweet : fichier compact et lisible dans l'historique git."""
    config.METRICS_FILE.parent.mkdir(parents=True, exist_ok=True)
    lines = ",\n".join(f"{json.dumps(k)}: {json.dumps(v, ensure_ascii=False, separators=(',', ':'))}" for k, v in sorted(store.items()))
    config.METRICS_FILE.write_text("{\n" + lines + "\n}\n" if store else "{}\n", encoding="utf-8")


def measure(public_metrics: dict, created_at: Optional[str], now: datetime) -> dict:
    out = {name: public_metrics.get(key) for key, name in FIELDS.items()}
    out["at"] = _stamp(now)
    if created_at:
        out["age_h"] = round((now - _parse(created_at)).total_seconds() / 3600)
    return out


def mature_at_collection(row: dict) -> bool:
    age = age_at_fetch(row)
    return age is not None and age >= MIN_AGE_HOURS


def due(tweets: list[dict], store: dict, now: datetime) -> list[str]:
    """Tweets collectés trop jeunes, qui ont maintenant 48 heures et pas encore de mesure de référence."""
    limit = now - timedelta(hours=MIN_AGE_HOURS)
    return [t["id"] for t in tweets
            if t.get("created_at") and _parse(t["created_at"]) <= limit and not mature_at_collection(t)
            and "h48" not in store.get(t["id"], {})]


def _read(client: XClient, ids: list[str], slot: str, store: dict, created: dict[str, str], now: datetime) -> int:
    n = 0
    for i in range(0, len(ids), MAX_RESULTS):
        chunk = ids[i:i + MAX_RESULTS]
        found, missing = client.get_tweets(chunk)
        for t in found:
            store.setdefault(t["id"], {})[slot] = measure(t.get("public_metrics") or {}, t.get("created_at") or created.get(t["id"]), now)
            n += 1
        for tid in missing:  # supprimé ou devenu privé : on ne le relira plus
            store.setdefault(tid, {})[slot] = {"absent": True, "at": _stamp(now)}
        save(store)
    return n


def run_h48(client: XClient, *, max_reads: Optional[int] = DAILY_MAX_READS, now: Optional[datetime] = None) -> int:
    """Tâche quotidienne : mesure de référence des tweets qui ont passé 48 heures."""
    now = now or datetime.now(timezone.utc)
    tweets = list(read_jsonl(config.RAW_TWEETS_FILE))
    store = load_json(config.METRICS_FILE, {})
    ids = due(tweets, store, now)
    if max_reads and len(ids) > max_reads:
        log.warning("Mesures à 48 h : %d tweets en attente, plafond de %d par passage ; la suite au prochain passage.", len(ids), max_reads)
        ids = ids[:max_reads]
    if not ids:
        log.info("Mesures à 48 h : rien à relire.")
        return 0
    n = _read(client, ids, "h48", store, {t["id"]: t.get("created_at") for t in tweets}, now)
    log.info("Mesures à 48 h : %d tweets relus sur %d demandés", n, len(ids))
    return n


def refresh(client: XClient, *, days: Optional[int] = None, candidate: Optional[str] = None,
            max_reads: Optional[int] = None, now: Optional[datetime] = None) -> int:
    """Réactualisation manuelle : relit les tweets publiés dans les N derniers jours (tous si N est vide)."""
    now = now or datetime.now(timezone.utc)
    since = now - timedelta(days=days) if days else None
    who = (candidate or "").lstrip("@").lower()
    tweets = [t for t in read_jsonl(config.RAW_TWEETS_FILE)
              if t.get("created_at") and (not since or _parse(t["created_at"]) >= since) and (not who or t["handle"].lower() == who)]
    store = load_json(config.METRICS_FILE, {})
    ids = [t["id"] for t in tweets if not (store.get(t["id"], {}).get("h48") or {}).get("absent")][: max_reads or None]
    n = _read(client, ids, "maj", store, {t["id"]: t.get("created_at") for t in tweets}, now)
    log.info("Réactualisation : %d tweets relus", n)
    return n
