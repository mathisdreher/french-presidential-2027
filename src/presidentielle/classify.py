"""Classification des tweets.

Moteurs :
  - jev     : modèle de décision Jev (TypeSafe), un appel par tweet, probabilités calibrées.
              Moteur par défaut, exécuté chaque jour sur tous les nouveaux tweets.
  - claude  : Claude en sortie structurée (mêmes variables + champs textuels), déclenché à la
              demande sur une portée choisie :
                incertains              décisions Jev peu sûres
                ecologie_et_incertains  tweets écologie (lexique, implicites) + incertains
                echantillon             échantillon de validation (double codage Jev/Claude)
                tous                    tous les tweets non encore codés par Claude

Modes Claude : sync (appels immédiats) ou batch (API Batches, -50 %).
Les résultats sont ajoutés à data/classified/classifications.jsonl ; un tweet déjà
traité par un moteur n'est pas renvoyé à ce moteur.
"""

from __future__ import annotations

import logging
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from typing import Optional

import anthropic
from anthropic.types.message_create_params import MessageCreateParamsNonStreaming
from anthropic.types.messages.batch_create_params import Request

from . import codebook as cb
from . import config
from .prompts import SYSTEM_PROMPT, user_message
from .schema import TweetClassification, json_schema
from .storage import append_jsonl, load_json, read_jsonl, save_json

log = logging.getLogger(__name__)

MAX_TOKENS = 2048
FLUSH_EVERY = 200  # écriture intermédiaire pendant les longs rattrapages
EFFORT = "low"  # grille de codage courte : effort bas suffit et réduit le coût
CATEGORICAL = tuple(v.key for v in cb.VARIABLES)
TEXTUAL = tuple(cb.TEXT_FIELDS)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


# ------------------------------------------------------------------ état des tweets
def load_rows() -> dict[str, dict]:
    """Dernière ligne connue par tweet id."""
    rows: dict[str, dict] = {}
    for row in read_jsonl(config.CLASSIFICATIONS_FILE):
        rows[row["id"]] = row
    return rows


CLAUDE_SCOPES = ("incertains", "ecologie_et_incertains", "echantillon", "tous")


def _match_candidate(tweet: dict, candidate: Optional[str]) -> bool:
    return not candidate or candidate.lower().lstrip("@") in (tweet["handle"].lower(), tweet["candidate"].lower())


def pending_tweets(engine: str = "jev", limit: Optional[int] = None, candidate: Optional[str] = None) -> list[dict]:
    """Tweets sans codage du moteur demandé."""
    key = "claude" if engine == "claude" else "jev"
    rows = load_rows()
    out = []
    for tweet in read_jsonl(config.RAW_TWEETS_FILE):
        if (rows.get(tweet["id"]) or {}).get(key):
            continue
        if not _match_candidate(tweet, candidate):
            continue
        out.append(tweet)
        if limit and len(out) >= limit:
            break
    return out


def ensure_validation_sample(size: int = 300, seed: int = 2027, ecology_share: float = 0.25) -> list[str]:
    """Échantillon de validation persistant (data/state/validation_sample.json).

    Strate « aleatoire » : tirage aléatoire stratifié par candidat (allocation égale) parmi les
    tweets codés par Jev. Strate « ecologie » : sur-échantillon de tweets classés écologie par Jev,
    pour disposer d'assez de cas sur les variables propres à l'écologie (position, cadrage).
    L'échantillon n'est jamais retiré : un appel avec une taille plus grande le complète.
    """
    import random

    state = load_json(config.VALIDATION_SAMPLE_FILE, {"seed": seed, "items": []})
    items: list[dict] = state.get("items", [])
    if len(items) >= size:
        return [it["id"] for it in items]

    rows = load_rows()
    rng = random.Random(f"{state.get('seed', seed)}-{len(items)}")
    taken = {it["id"] for it in items}
    pool_by_cand: dict[str, list[str]] = {}
    eco_pool: list[str] = []
    for tweet in read_jsonl(config.RAW_TWEETS_FILE):
        row = rows.get(tweet["id"]) or {}
        if not row.get("jev") or tweet["id"] in taken:
            continue
        pool_by_cand.setdefault(tweet["handle"].lower(), []).append(tweet["id"])
        if row["jev"]["values"].get("parle_ecologie"):
            eco_pool.append(tweet["id"])

    missing = size - len(items)
    n_eco = round(missing * ecology_share)
    n_main = missing - n_eco

    main: list[str] = []
    cands = sorted(pool_by_cand)
    for pool in pool_by_cand.values():
        rng.shuffle(pool)

    def draw(target: int) -> None:
        while len(main) < target and any(pool_by_cand[c] for c in cands):
            for c in cands:
                if pool_by_cand[c] and len(main) < target:
                    main.append(pool_by_cand[c].pop())

    draw(n_main)
    chosen = set(main)
    eco_left = [i for i in eco_pool if i not in chosen]
    rng.shuffle(eco_left)
    eco = eco_left[:n_eco]
    if len(eco) < n_eco:  # pas assez de tweets écologie : compléter par la strate aléatoire
        for c in cands:
            pool_by_cand[c] = [i for i in pool_by_cand[c] if i not in set(eco)]
        draw(n_main + n_eco - len(eco))

    if not main and not eco:
        return [it["id"] for it in items]
    items += [{"id": i, "strate": "aleatoire"} for i in main] + [{"id": i, "strate": "ecologie"} for i in eco]
    state.update({"seed": state.get("seed", seed), "items": items, "updated_at": _now()})
    save_json(config.VALIDATION_SAMPLE_FILE, state)
    log.info("Échantillon de validation : %d tweets (%d aléatoires, %d sur-échantillon écologie)",
             len(items), sum(it["strate"] == "aleatoire" for it in items), sum(it["strate"] == "ecologie" for it in items))
    return [it["id"] for it in items]


def claude_targets(scope: str, *, limit: Optional[int] = None, candidate: Optional[str] = None,
                   sample_size: int = 300) -> list[dict]:
    """Tweets à envoyer à Claude selon la portée choisie (jamais deux fois le même)."""
    if scope not in CLAUDE_SCOPES:
        raise ValueError(f"Portée inconnue : {scope} (attendu : {', '.join(CLAUDE_SCOPES)})")
    rows = load_rows()
    sample = set(ensure_validation_sample(sample_size)) if scope == "echantillon" else set()
    out = []
    for tweet in read_jsonl(config.RAW_TWEETS_FILE):
        row = rows.get(tweet["id"]) or {}
        if row.get("claude") or not _match_candidate(tweet, candidate):
            continue
        jev = row.get("jev")
        if scope == "incertains":
            keep = bool(row.get("needs_claude"))
        elif scope == "ecologie_et_incertains":
            keep = bool(jev) and (jev["values"]["parle_ecologie"] or bool(row.get("needs_claude")))
        elif scope == "echantillon":
            keep = tweet["id"] in sample
        else:
            keep = True
        if keep:
            out.append(tweet)
            if limit and len(out) >= limit:
                break
    return out


def merge(tweet_id: str, jev: Optional[dict], claude: Optional[dict], existing: Optional[dict] = None) -> dict:
    """Construit la ligne finale : valeurs catégorielles de Jev sauf décision peu sûre, texte de Claude."""
    row = dict(existing or {})
    row["id"] = tweet_id
    row["classified_at"] = _now()
    if jev:
        row["jev"] = jev
    if claude:
        row["claude"] = claude
    jev = row.get("jev")
    claude = row.get("claude")

    from .jev_client import low_confidence
    needs_claude = bool(jev) and low_confidence(jev)
    row["needs_claude"] = needs_claude and not claude

    if jev and claude:
        source = "claude" if needs_claude else "jev"
    elif jev:
        source = "jev"
    elif claude:
        source = "claude"
    else:
        raise ValueError("Aucun résultat à fusionner")
    row["final_source"] = source

    values = (jev["values"] if source == "jev" else claude["values"])
    for key in CATEGORICAL:
        row[key] = values.get(key)
    if claude:
        for key in TEXTUAL:
            row[key] = claude["values"].get(key)
    if jev and claude:
        row["accord_ecologie"] = jev["values"]["parle_ecologie"] == claude["values"]["parle_ecologie"]
        row["accord_position"] = jev["values"]["position"] == claude["values"]["position"]
    return row


def _write(rows: dict[str, dict], updated: list[dict]) -> None:
    """Réécrit le fichier en remplaçant les lignes mises à jour (une ligne par tweet)."""
    for row in updated:
        rows[row["id"]] = row
    config.CLASSIFICATIONS_FILE.parent.mkdir(parents=True, exist_ok=True)
    tmp = config.CLASSIFICATIONS_FILE.with_suffix(".tmp")
    if tmp.exists():
        tmp.unlink()
    append_jsonl(tmp, rows.values())
    tmp.replace(config.CLASSIFICATIONS_FILE)


# ---------------------------------------------------------------------------- Jev
def classify_jev(tweets: list[dict], *, workers: int = 4, model: Optional[str] = None) -> int:
    if not tweets:
        log.info("Aucun tweet à classifier (Jev).")
        return 0
    from .jev_client import JevClassifier
    config.load_env()
    clf = JevClassifier(model=model)
    rows = load_rows()
    done, errors, updated = 0, 0, []
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(clf.classify, t): t for t in tweets}
        for fut in as_completed(futures):
            tweet = futures[fut]
            try:
                result = fut.result()
            except Exception as e:  # noqa: BLE001 - erreurs SDK TypeSafe variées
                errors += 1
                log.error("[Jev] échec sur %s : %s", tweet["id"], e)
                continue
            result["classified_at"] = _now()
            updated.append(merge(tweet["id"], result, None, rows.get(tweet["id"])))
            done += 1
            if done % FLUSH_EVERY == 0:
                _write(rows, updated)
                updated = []
                log.info("[Jev] %d/%d", done, len(tweets))
    clf.close()
    _write(rows, updated)
    log.info("[Jev] terminé : %d ok, %d erreurs", done, errors)
    return done


# --------------------------------------------------------------------- Claude sync
def _system_blocks() -> list[dict]:
    return [{"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}]


def _claude_result(parsed: TweetClassification, model: str, usage=None) -> dict:
    values = parsed.model_dump()
    if not values["parle_ecologie"]:
        values.update(cb.NON_ECOLOGIE_DEFAULTS)
    return {
        "model": model,
        "classified_at": _now(),
        "values": values,
        "usage": {
            "input_tokens": getattr(usage, "input_tokens", None),
            "output_tokens": getattr(usage, "output_tokens", None),
            "cache_read_input_tokens": getattr(usage, "cache_read_input_tokens", None),
        },
    }


def classify_claude_one(client: anthropic.Anthropic, tweet: dict, model: str) -> dict:
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
    return _claude_result(response.parsed_output, model, response.usage)


def classify_claude_sync(tweets: list[dict], *, model: Optional[str] = None, workers: int = 4) -> int:
    if not tweets:
        log.info("Aucun tweet à classifier (Claude).")
        return 0
    model = model or config.claude_model()
    client = anthropic.Anthropic(max_retries=4)
    rows = load_rows()
    done, errors, updated = 0, 0, []
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(classify_claude_one, client, t, model): t for t in tweets}
        for fut in as_completed(futures):
            tweet = futures[fut]
            try:
                result = fut.result()
            except anthropic.RateLimitError as e:
                errors += 1
                log.error("[Claude] rate limit sur %s : %s", tweet["id"], e.message)
                continue
            except anthropic.APIStatusError as e:
                errors += 1
                log.error("[Claude] erreur API %s sur %s : %s", e.status_code, tweet["id"], e.message)
                continue
            except (anthropic.APIConnectionError, RuntimeError) as e:
                errors += 1
                log.error("[Claude] échec sur %s : %s", tweet["id"], e)
                continue
            updated.append(merge(tweet["id"], None, result, rows.get(tweet["id"])))
            done += 1
            if done % FLUSH_EVERY == 0:
                _write(rows, updated)
                updated = []
                log.info("[Claude] %d/%d", done, len(tweets))
    _write(rows, updated)
    log.info("[Claude] terminé : %d ok, %d erreurs", done, errors)
    return done


# -------------------------------------------------------------------- Claude batch
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
        log.info("Aucun tweet à classifier (Claude batch).")
        return None
    model = model or config.claude_model()
    client = anthropic.Anthropic()
    batch = client.messages.batches.create(requests=[_batch_request(t, model) for t in tweets])
    state = load_json(config.BATCHES_STATE_FILE, {})
    state[batch.id] = {"created_at": _now(), "model": model, "count": len(tweets),
                       "tweet_ids": [t["id"] for t in tweets], "collected": False}
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
            log.warning("Délai dépassé, relancez `classify --collect %s` plus tard.", batch_id)
            return False
        time.sleep(poll_seconds)


def collect_batch(batch_id: str) -> int:
    client = anthropic.Anthropic()
    state = load_json(config.BATCHES_STATE_FILE, {})
    meta = state.get(batch_id)
    if not meta:
        raise SystemExit(f"Batch {batch_id} inconnu dans {config.BATCHES_STATE_FILE}")
    model = meta["model"]
    rows = load_rows()
    updated, errors = [], 0
    for result in client.messages.batches.results(batch_id):
        tweet_id = result.custom_id.removeprefix("tweet-")
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
        updated.append(merge(tweet_id, None, _claude_result(parsed, model, msg.usage), rows.get(tweet_id)))
    _write(rows, updated)
    meta["collected"] = True
    meta["collected_at"] = _now()
    save_json(config.BATCHES_STATE_FILE, state)
    log.info("Batch %s collecté : %d classifications, %d erreurs", batch_id, len(updated), errors)
    return len(updated)


def collect_pending(*, wait: bool = False) -> int:
    """Collecte les batches Claude soumis mais pas encore récupérés (ex. délai d'attente dépassé)."""
    state = load_json(config.BATCHES_STATE_FILE, {})
    pending = [bid for bid, meta in state.items() if not meta.get("collected")]
    if not pending:
        return 0
    client = anthropic.Anthropic()
    n = 0
    for bid in pending:
        status = client.messages.batches.retrieve(bid).processing_status
        if status == "ended":
            n += collect_batch(bid)
        elif wait and wait_batch(bid, timeout_minutes=90):
            n += collect_batch(bid)
        else:
            log.info("Batch %s encore en cours (%s)", bid, status)
    return n


def classify_claude_batch(tweets: list[dict], *, model: Optional[str] = None, wait: bool = True,
                          timeout_minutes: Optional[int] = 90) -> int:
    batch_id = submit_batch(tweets, model=model)
    if not batch_id or not wait:
        return 0
    if wait_batch(batch_id, timeout_minutes=timeout_minutes):
        return collect_batch(batch_id)
    return 0
