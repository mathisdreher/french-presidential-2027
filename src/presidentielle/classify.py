"""Classification des tweets avec Claude (sorties structurées).

Deux modes :
  - sync  : appels immédiats (petits volumes, usage n8n/cron quotidien)
  - batch : API Batches, -50 % de coût, résultats sous ~1 h (volumes importants)

Les résultats sont ajoutés à data/classified/classifications.jsonl ; un tweet
déjà classifié n'est jamais renvoyé à l'API.
"""

from __future__ import annotations

import logging
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from typing import Iterable, Optional

import anthropic
from anthropic.types.message_create_params import MessageCreateParamsNonStreaming
from anthropic.types.messages.batch_create_params import Request

from . import config
from .prompts import SYSTEM_PROMPT, user_message
from .schema import TweetClassification, json_schema
from .storage import append_jsonl, load_json, read_jsonl, save_json

log = logging.getLogger(__name__)

MAX_TOKENS = 1024
EFFORT = "low"  # classification courte : effort bas suffit et réduit le coût


def _system_blocks() -> list[dict]:
    return [{"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}]


def _result_row(tweet: dict, parsed: TweetClassification, model: str, usage=None) -> dict:
    row = {"id": tweet["id"], "model": model,
           "classified_at": datetime.now(timezone.utc).isoformat(timespec="seconds")}
    row.update(parsed.model_dump())
    if usage is not None:
        row["usage"] = {
            "input_tokens": getattr(usage, "input_tokens", None),
            "output_tokens": getattr(usage, "output_tokens", None),
            "cache_read_input_tokens": getattr(usage, "cache_read_input_tokens", None),
        }
    return row


def pending_tweets(limit: Optional[int] = None, candidate: Optional[str] = None) -> list[dict]:
    done = {row["id"] for row in read_jsonl(config.CLASSIFICATIONS_FILE)}
    out = []
    for tweet in read_jsonl(config.RAW_TWEETS_FILE):
        if tweet["id"] in done:
            continue
        if candidate and candidate.lower() not in (tweet["handle"].lower(), tweet["candidate"].lower()):
            continue
        out.append(tweet)
        if limit and len(out) >= limit:
            break
    return out


# ------------------------------------------------------------------ mode sync
def classify_one(client: anthropic.Anthropic, tweet: dict, model: str) -> dict:
    response = client.messages.parse(
        model=model,
        max_tokens=MAX_TOKENS,
        system=_system_blocks(),
        messages=[{"role": "user", "content": user_message(tweet)}],
        output_format=TweetClassification,
        output_config={"effort": EFFORT},
    )
    if response.stop_reason == "refusal":
        details = getattr(response, "stop_details", None)
        raise RuntimeError(f"Refus du modèle ({getattr(details, 'category', None)}) pour le tweet {tweet['id']}")
    if response.stop_reason == "max_tokens":
        raise RuntimeError(f"Réponse tronquée (max_tokens) pour le tweet {tweet['id']}")
    return _result_row(tweet, response.parsed_output, model, response.usage)


def classify_sync(tweets: list[dict], *, model: Optional[str] = None, workers: int = 4) -> int:
    if not tweets:
        log.info("Aucun tweet à classifier.")
        return 0
    model = model or config.claude_model()
    client = anthropic.Anthropic(max_retries=4)
    config.ensure_dirs()
    done = 0
    errors = 0
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(classify_one, client, t, model): t for t in tweets}
        for fut in as_completed(futures):
            tweet = futures[fut]
            try:
                row = fut.result()
            except anthropic.RateLimitError as e:
                errors += 1
                log.error("Rate limit Anthropic sur %s : %s", tweet["id"], e.message)
                continue
            except anthropic.APIStatusError as e:
                errors += 1
                log.error("Erreur API %s sur %s : %s", e.status_code, tweet["id"], e.message)
                continue
            except (anthropic.APIConnectionError, RuntimeError) as e:
                errors += 1
                log.error("Échec sur %s : %s", tweet["id"], e)
                continue
            append_jsonl(config.CLASSIFICATIONS_FILE, [row])
            done += 1
            if done % 25 == 0:
                log.info("%d/%d classifiés", done, len(tweets))
    log.info("Classification terminée : %d ok, %d erreurs", done, errors)
    return done


# ----------------------------------------------------------------- mode batch
def _batch_request(tweet: dict, model: str) -> Request:
    return Request(
        custom_id=f"tweet-{tweet['id']}",
        params=MessageCreateParamsNonStreaming(
            model=model,
            max_tokens=MAX_TOKENS,
            system=_system_blocks(),
            messages=[{"role": "user", "content": user_message(tweet)}],
            output_config={"effort": EFFORT, "format": {"type": "json_schema", "schema": json_schema()}},
        ),
    )


def submit_batch(tweets: list[dict], *, model: Optional[str] = None) -> Optional[str]:
    if not tweets:
        log.info("Aucun tweet à classifier.")
        return None
    model = model or config.claude_model()
    client = anthropic.Anthropic()
    batch = client.messages.batches.create(requests=[_batch_request(t, model) for t in tweets])
    state = load_json(config.BATCHES_STATE_FILE, {})
    state[batch.id] = {
        "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "model": model,
        "count": len(tweets),
        "tweets": {f"tweet-{t['id']}": t for t in tweets},
        "collected": False,
    }
    save_json(config.BATCHES_STATE_FILE, state)
    log.info("Batch %s soumis (%d requêtes).", batch.id, len(tweets))
    return batch.id


def wait_batch(batch_id: str, *, poll_seconds: int = 60, timeout_minutes: Optional[int] = None) -> bool:
    client = anthropic.Anthropic()
    started = time.time()
    while True:
        batch = client.messages.batches.retrieve(batch_id)
        counts = batch.request_counts
        log.info("Batch %s : %s (en cours %d, ok %d, erreurs %d)", batch_id, batch.processing_status,
                 counts.processing, counts.succeeded, counts.errored)
        if batch.processing_status == "ended":
            return True
        if timeout_minutes and (time.time() - started) > timeout_minutes * 60:
            log.warning("Délai d'attente dépassé, relancez `classify --collect %s` plus tard.", batch_id)
            return False
        time.sleep(poll_seconds)


def collect_batch(batch_id: str) -> int:
    client = anthropic.Anthropic()
    state = load_json(config.BATCHES_STATE_FILE, {})
    meta = state.get(batch_id)
    if not meta:
        raise SystemExit(f"Batch {batch_id} inconnu dans {config.BATCHES_STATE_FILE}")
    tweets = meta["tweets"]
    model = meta["model"]
    already = {row["id"] for row in read_jsonl(config.CLASSIFICATIONS_FILE)}
    rows = []
    errors = 0
    for result in client.messages.batches.results(batch_id):
        tweet = tweets.get(result.custom_id)
        if tweet is None or tweet["id"] in already:
            continue
        if result.result.type != "succeeded":
            errors += 1
            log.error("[%s] %s", result.custom_id, result.result.type)
            continue
        msg = result.result.message
        if msg.stop_reason != "end_turn":
            errors += 1
            log.error("[%s] stop_reason=%s", result.custom_id, msg.stop_reason)
            continue
        text = next((b.text for b in msg.content if b.type == "text"), "")
        try:
            parsed = TweetClassification.model_validate_json(text)
        except Exception as e:  # noqa: BLE001
            errors += 1
            log.error("[%s] JSON invalide : %s", result.custom_id, e)
            continue
        rows.append(_result_row(tweet, parsed, model, msg.usage))
    n = append_jsonl(config.CLASSIFICATIONS_FILE, rows)
    meta["collected"] = True
    meta["collected_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    save_json(config.BATCHES_STATE_FILE, state)
    log.info("Batch %s collecté : %d classifications, %d erreurs", batch_id, n, errors)
    return n


def classify_batch(tweets: list[dict], *, model: Optional[str] = None, wait: bool = True,
                   timeout_minutes: Optional[int] = 90) -> int:
    batch_id = submit_batch(tweets, model=model)
    if not batch_id or not wait:
        return 0
    if wait_batch(batch_id, timeout_minutes=timeout_minutes):
        return collect_batch(batch_id)
    return 0
