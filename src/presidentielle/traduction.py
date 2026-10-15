"""Traduction anglaise des tweets affichés par le site (version anglaise).

Seuls les tweets dont le site montre le texte sont traduits : les tweets écologie (onglet Tweets,
exemples des graphiques), avec leur résumé et leurs présupposés. Les tweets des jeux ont leur propre
traduction, faite lors de l'anonymisation (games.py). Le texte original reste la référence de
l'analyse ; la traduction n'est qu'une aide à la lecture, signalée comme automatique sur le site.

Une traduction est refaite si le texte français dont elle part change (résumé recodé par Claude, etc.).
"""

from __future__ import annotations

import hashlib
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field

from . import config
from .storage import append_jsonl, read_jsonl

log = logging.getLogger(__name__)

DAILY_LIMIT = 300
WORKERS = 6


class Translation(BaseModel):
    texte_en: str = Field(description="Faithful English translation of the tweet.")
    resume_en: str = Field(description="English translation of the summary, or an empty string if there is none.")
    implicites_en: str = Field(description="English translation of the presuppositions, or an empty string if there are none.")


PROMPT = """Tu traduis en anglais des tweets de candidats à l'élection présidentielle française de 2027, pour la version anglaise d'un site pédagogique sur l'analyse du discours écologique.

- Traduis fidèlement : garde le ton, le registre, l'ironie, la ponctuation expressive, les emojis et la longueur. N'atténue ni n'explicite rien.
- Garde tels quels les noms propres, les @comptes, les #hashtags, les liens et les chiffres.
- Les formules du débat français (« écologie punitive », « planification écologique », « sobriété », « décroissance », « souveraineté énergétique »…) restent en français, suivies de leur traduction entre parenthèses à leur première apparition : “écologie punitive” (punitive ecology).
- Les sigles français (RN, LFI, ZFE, PPE, EDF…) restent tels quels.
- Traduis aussi le résumé et les présupposés quand ils sont fournis ; sinon, renvoie une chaîne vide.

Réponds uniquement avec l'objet JSON demandé."""


def source_hash(text: str, resume: Optional[str], implicites: Optional[str]) -> str:
    raw = "\x1f".join([text or "", resume or "", implicites or ""])
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:16]


def load() -> dict[str, dict]:
    """Dernière traduction connue de chaque tweet."""
    return {r["id"]: r for r in read_jsonl(config.TRANSLATIONS_FILE)}


def displayed(tweets: list[dict], rows: dict[str, dict]) -> list[dict]:
    """Tweets dont le site affiche le texte : ceux qui parlent d'écologie, avec leurs champs français."""
    out = []
    for t in tweets:
        r = rows.get(t["id"])
        if not r or not r.get("parle_ecologie") or not t.get("text"):
            continue
        out.append({"id": t["id"], "text": t["text"], "resume": r.get("resume"), "implicites": r.get("implicites")})
    return out


def todo(items: list[dict], done: dict[str, dict]) -> list[dict]:
    return [it for it in items if (done.get(it["id"]) or {}).get("src") != source_hash(it["text"], it["resume"], it["implicites"])]


def translate(items: list[dict], *, model: Optional[str] = None, limit: Optional[int] = None) -> int:
    """Traduit les tweets à jour de rien ou dont le texte source a changé (appels immédiats)."""
    import anthropic

    items = todo(items, load())[: limit or None]
    if not items:
        log.info("Traduction : rien à traduire.")
        return 0
    model = model or config.claude_model()
    client = config.anthropic_client(max_retries=4)

    def call(it: dict):
        parts = [f"Tweet :\n\"\"\"\n{it['text']}\n\"\"\""]
        if it["resume"]:
            parts.append(f"Résumé :\n\"\"\"\n{it['resume']}\n\"\"\"")
        if it["implicites"]:
            parts.append(f"Présupposés :\n\"\"\"\n{it['implicites']}\n\"\"\"")
        return client.messages.parse(
            model=model, max_tokens=4096,
            system=[{"type": "text", "text": PROMPT, "cache_control": {"type": "ephemeral"}}],
            messages=[{"role": "user", "content": "\n\n".join(parts)}],
            output_format=Translation, output_config={"effort": "low"},
        )

    n = 0
    # appels en parallèle ; l'écriture reste dans ce fil, au fil des réponses
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futures = {pool.submit(call, it): it for it in items}
        for fut in as_completed(futures):
            it = futures[fut]
            try:
                resp = fut.result()
            except (anthropic.AuthenticationError, anthropic.PermissionDeniedError, anthropic.BadRequestError):
                for f in futures:
                    f.cancel()
                raise  # erreur de configuration (clé, espace de travail) : inutile de continuer tweet par tweet
            except anthropic.APIError as e:
                log.error("[Traduction] %s : %s", it["id"], e)
                continue
            if resp.stop_reason != "end_turn" or resp.parsed_output is None:
                log.error("[Traduction] %s : stop_reason=%s", it["id"], resp.stop_reason)
                continue
            n += _save(it, resp.parsed_output, model)
    log.info("Traduction : %d tweets traduits par Claude", n)
    return n


def _save(it: dict, out: Translation, model: str) -> int:
    append_jsonl(config.TRANSLATIONS_FILE, [{
        "id": it["id"], "src": source_hash(it["text"], it["resume"], it["implicites"]), "model": model,
        "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "t": out.texte_en, "rs": (out.resume_en or None) if it["resume"] else None,
        "im": (out.implicites_en or None) if it["implicites"] else None,
    }])
    return 1


def run(*, model: Optional[str] = None, limit: Optional[int] = None) -> int:
    rows = {r["id"]: r for r in read_jsonl(config.CLASSIFICATIONS_FILE)}
    return translate(displayed(list(read_jsonl(config.RAW_TWEETS_FILE)), rows), model=model, limit=limit)


def current(items_by_id: dict[str, dict]) -> dict[str, dict]:
    """Traductions encore valides (texte source inchangé), par identifiant de tweet."""
    done = load()
    out = {}
    for i, it in items_by_id.items():
        tr = done.get(i)
        if tr and tr.get("src") == source_hash(it["text"], it.get("resume"), it.get("implicites")):
            out[i] = tr
    return out
