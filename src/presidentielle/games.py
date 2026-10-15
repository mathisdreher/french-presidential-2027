"""Préparation des tweets des jeux du site.

Sélection : tweets écologie assez longs, codés avec confiance, répartis entre candidats.
Anonymisation en deux niveaux :
  - automatique (toujours) : liens, mentions, noms des candidats, partis, hashtags non génériques ;
  - Claude (à la demande) : réécriture minimale qui retire les indices trop reconnaissables
    (slogans, fonctions, lieux personnels) en conservant les procédés du discours, rédaction
    de deux ou trois indices pédagogiques expliquant ce qui trahit le camp de l'auteur, et
    traduction anglaise du tweet et des indices pour la version anglaise du site.
"""

from __future__ import annotations

import logging
import random
import re
from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field

from . import config
from .storage import append_jsonl, read_jsonl

log = logging.getLogger(__name__)

PER_CANDIDATE = 12
MIN_CHARS = 90
PARTIES = [
    "Rassemblement national", "Front national", "La France insoumise", "France insoumise", "Parti socialiste",
    "Les Républicains", "Renaissance", "Horizons", "Reconquête", "Place publique", "Parti communiste",
    "Les Écologistes", "Europe Écologie", "Debout la France", "Les Patriotes", "Union populaire républicaine",
    "Lutte ouvrière", "Révolution permanente", "Nouveau Front populaire", "Ensemble", "Modem", "MoDem",
    r"\bRN\b", r"\bLFI\b", r"\bPS\b", r"\bLR\b", r"\bPCF\b", r"\bEELV\b", r"\bNFP\b", r"\bDLF\b", r"\bUPR\b", r"\bNPA\b", r"\bLO\b",
]
GENERIC_HASHTAGS = {
    "climat", "ecologie", "écologie", "energie", "énergie", "nucleaire", "nucléaire", "cop31", "biodiversite",
    "biodiversité", "agriculture", "agriculteurs", "eau", "zfe", "transition", "environnement", "electricite",
    "électricité", "pollution", "secheresse", "sécheresse", "canicule", "inondations",
}


def anonymize(text: str, candidates: list[config.Candidate]) -> str:
    out = re.sub(r"https?://\S+", "", text)
    out = re.sub(r"@\w+", "@…", out)
    for c in candidates:
        parts = [c.name] + [p for p in c.name.split() if len(p) > 3]
        if c.handle:
            parts.append(c.handle)
        for p in sorted(set(parts), key=len, reverse=True):
            out = re.sub(rf"\b{re.escape(p)}\b", "[candidat]", out, flags=re.IGNORECASE)
    for p in PARTIES:
        pattern = p if p.startswith(r"\b") else rf"\b{re.escape(p)}\b"
        out = re.sub(pattern, "[parti]", out, flags=0 if p.startswith(r"\b") else re.IGNORECASE)
    out = re.sub(r"#(\w+)", lambda m: m.group(0) if m.group(1).lower() in GENERIC_HASHTAGS else "#…", out)
    out = re.sub(r"(\[candidat\]\s*){2,}", "[candidat] ", out)
    return re.sub(r"[ \t]+", " ", out).strip()


def select(tweets: list[dict], rows: dict[str, dict], per_candidate: int = PER_CANDIDATE, seed: int = 2027) -> list[dict]:
    """Tweets candidats aux jeux, au plus `per_candidate` par compte, les plus récents d'abord."""
    by_cand: dict[str, list[dict]] = {}
    for t in tweets:
        r = rows.get(t["id"]) or {}
        if not r.get("parle_ecologie") or len(t.get("text", "")) < MIN_CHARS:
            continue
        p = ((r.get("jev") or {}).get("probabilities") or {}).get("parle_ecologie")
        if p is not None and p < 0.75:
            continue
        by_cand.setdefault(t["handle"].lower(), []).append(t)
    rng = random.Random(seed)
    out = []
    for cand, items in sorted(by_cand.items()):
        items.sort(key=lambda t: t.get("created_at") or "", reverse=True)
        recent = items[: per_candidate * 3]
        rng.shuffle(recent)
        out += recent[:per_candidate]
    return out


# ------------------------------------------------------------------------- passe Claude
class GameRewrite(BaseModel):
    texte_anonymise: str = Field(description="The tweet rewritten minimally in French, without any clue that identifies the author or the party.")
    indices: list[str] = Field(description="Two or three short French sentences explaining which discourse features hint at the author's political camp.")
    texte_en: str = Field(description="Faithful English translation of the anonymised tweet, keeping the placeholders.")
    indices_en: list[str] = Field(description="The same clues, translated into English.")
    reconnaissable: bool = Field(description="True if the author would still be easy to recognise after anonymisation.")


GAMES_PROMPT = """Tu prépares des tweets pour un jeu pédagogique sur l'analyse critique du discours : le joueur doit deviner de quel camp politique vient un tweet d'un candidat à la présidentielle 2027.

1. Réécris le tweet le moins possible. Retire ou remplace tout ce qui identifie directement l'auteur : noms, prénoms, partis, slogans et hashtags de campagne, fonctions (« maire de… », « ancien Premier ministre »), lieux personnels, références à sa propre biographie. Remplace-les par [candidat], [parti], [ville] ou une formule neutre. Garde le vocabulaire, le ton, les procédés, les chiffres et les arguments : ce sont eux que le joueur doit apprendre à lire.
2. Rédige deux ou trois indices courts, en français, qui expliquent ce qui dans le discours oriente vers un camp, en nommant le concept quand c'est utile : cadrage, carré idéologique (nous / eux), topos, procédé, vision de l'écologie, ethos. N'écris jamais le nom du candidat ni de son parti.
3. Traduis fidèlement en anglais le tweet anonymisé (texte_en), en gardant le ton et les procédés ; les marqueurs deviennent [candidate], [party], [town]. Traduis aussi les indices (indices_en). Les citations de formules du débat français, comme « écologie punitive », restent en français suivies de leur traduction entre parenthèses.
4. Indique si l'auteur reste facile à reconnaître malgré tout.

Réponds uniquement avec l'objet JSON demandé."""


def claude_rewrite(tweets: list[dict], *, model: Optional[str] = None, limit: Optional[int] = None) -> int:
    """Passe Claude sur les tweets de jeu pas encore traités (appels immédiats, quelques centaines au plus)."""
    import anthropic

    # un tweet préparé avant l'ajout de la traduction anglaise est repris
    done = {r["id"] for r in read_jsonl(config.GAMES_FILE) if r.get("texte_en")}
    todo = [t for t in tweets if t["id"] not in done][: limit or None]
    if not todo:
        log.info("Jeux : aucun tweet à préparer.")
        return 0
    model = model or config.claude_model()
    client = config.anthropic_client(max_retries=4)
    candidates = config.load_candidates(only_enabled=False)
    n = 0
    for t in todo:
        try:
            resp = client.messages.parse(
                model=model, max_tokens=2048,
                system=[{"type": "text", "text": GAMES_PROMPT, "cache_control": {"type": "ephemeral"}}],
                messages=[{"role": "user", "content": f"Tweet (pré-anonymisé automatiquement) :\n\"\"\"\n{anonymize(t['text'], candidates)}\n\"\"\""}],
                output_format=GameRewrite, output_config={"effort": "low"},
            )
        except (anthropic.AuthenticationError, anthropic.PermissionDeniedError, anthropic.BadRequestError):
            raise  # erreur de configuration (clé, espace de travail) : inutile de continuer tweet par tweet
        except anthropic.APIError as e:
            log.error("[Jeux] %s : %s", t["id"], e)
            continue
        if resp.stop_reason != "end_turn" or resp.parsed_output is None:
            log.error("[Jeux] %s : stop_reason=%s", t["id"], resp.stop_reason)
            continue
        out = resp.parsed_output
        append_jsonl(config.GAMES_FILE, [{"id": t["id"], "model": model, "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                                          "texte": out.texte_anonymise, "indices": out.indices, "texte_en": out.texte_en,
                                          "indices_en": out.indices_en, "reconnaissable": out.reconnaissable}])
        n += 1
    log.info("Jeux : %d tweets préparés par Claude", n)
    return n


def run_claude(*, model: Optional[str] = None, limit: Optional[int] = None) -> int:
    rows = {r["id"]: r for r in read_jsonl(config.CLASSIFICATIONS_FILE)}
    return claude_rewrite(select(list(read_jsonl(config.RAW_TWEETS_FILE)), rows), model=model, limit=limit)
