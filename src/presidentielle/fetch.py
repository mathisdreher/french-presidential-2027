"""Extraction des tweets des candidats vers data/raw/tweets.jsonl (incrémental)."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from . import config
from .storage import append_jsonl, load_json, read_jsonl, save_json
from .x_client import XClient, XApiError, full_text

log = logging.getLogger(__name__)


def resolve_users(client: XClient, candidates: list[config.Candidate]) -> dict[str, dict]:
    """Résout handle -> user id, avec cache dans data/state/users.json."""
    cache: dict[str, dict] = load_json(config.USERS_STATE_FILE, {})
    for cand in candidates:
        if cand.slug in cache:
            continue
        try:
            user = client.get_user_by_username(cand.handle)
        except XApiError as e:
            raise SystemExit(f"[{cand.name}] {e}\nCorrigez le handle dans config/candidates.yaml.") from e
        cache[cand.slug] = {"id": user["id"], "username": user["username"], "name": user.get("name")}
        log.info("Résolu @%s -> %s", user["username"], user["id"])
        save_json(config.USERS_STATE_FILE, cache)
    return cache


def normalize(tweet: dict, cand: config.Candidate) -> dict:
    metrics = tweet.get("public_metrics", {}) or {}
    return {
        "id": tweet["id"],
        "candidate": cand.name,
        "party": cand.party,
        "handle": cand.handle,
        "created_at": tweet.get("created_at"),
        "lang": tweet.get("lang"),
        "text": full_text(tweet),
        "is_long": bool(tweet.get("note_tweet")),
        "likes": metrics.get("like_count", 0),
        "retweets": metrics.get("retweet_count", 0),
        "replies": metrics.get("reply_count", 0),
        "quotes": metrics.get("quote_count", 0),
        "impressions": metrics.get("impression_count"),
        "url": f"https://x.com/{cand.handle}/status/{tweet['id']}",
    }


def fetch(client: XClient, candidates: list[config.Candidate], *, days: Optional[int] = None,
          since: Optional[datetime] = None, until: Optional[datetime] = None,
          max_pages: Optional[int] = None, include_replies: bool = False,
          include_retweets: bool = False, incremental: bool = True) -> int:
    config.ensure_dirs()
    users = resolve_users(client, candidates)
    since_ids: dict[str, str] = load_json(config.SINCE_STATE_FILE, {}) if incremental else {}
    known_ids = {row["id"] for row in read_jsonl(config.RAW_TWEETS_FILE)}

    start_time = since
    if days and not since:
        start_time = datetime.now(timezone.utc) - timedelta(days=days)

    total = 0
    for cand in candidates:
        user_id = users[cand.slug]["id"]
        new_rows = []
        newest_id = since_ids.get(cand.slug)
        try:
            for tweet in client.iter_user_tweets(
                user_id, start_time=start_time, end_time=until,
                since_id=since_ids.get(cand.slug), exclude_replies=not include_replies,
                exclude_retweets=not include_retweets, max_pages=max_pages,
            ):
                if tweet["id"] in known_ids:
                    continue
                new_rows.append(normalize(tweet, cand))
                known_ids.add(tweet["id"])
                if newest_id is None or int(tweet["id"]) > int(newest_id):
                    newest_id = tweet["id"]
        except XApiError as e:
            log.error("[%s] arrêt de l'extraction : %s", cand.name, e)
        n = append_jsonl(config.RAW_TWEETS_FILE, new_rows)
        total += n
        if newest_id:
            since_ids[cand.slug] = newest_id
            save_json(config.SINCE_STATE_FILE, since_ids)
        log.info("[%s] %d nouveaux tweets", cand.name, n)
    log.info("Total : %d nouveaux tweets dans %s", total, config.RAW_TWEETS_FILE)
    return total
