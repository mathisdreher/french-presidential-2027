"""Moteur de décision Jev (TypeSafe) : « System One ».

Un appel par tweet, toutes les questions en parallèle (fan-out). Jev renvoie pour chaque
question une décision typée, une distribution de probabilités et une confiance calibrée.
Pas de texte libre : le résumé et l'analyse lexicale restent du ressort de Claude.
"""

from __future__ import annotations

import logging
import os
from typing import Any

from typesafe_sdk import Choice, Noul, Score, TypeSafeClient

from . import codebook as cb

log = logging.getLogger(__name__)

DEFAULT_JEV_MODEL = "jev-latest"
NOUL_THRESHOLD = 0.5


def jev_model() -> str:
    return os.environ.get("JEV_MODEL", DEFAULT_JEV_MODEL).strip() or DEFAULT_JEV_MODEL


def build_questions() -> dict[str, Any]:
    """Questions Jev générées depuis le codebook (ordre stable)."""
    q: dict[str, Any] = {}
    for var in cb.VARIABLES:
        if var.kind == "noul":
            q[var.key] = Noul(instructions=var.instructions)
        elif var.kind == "choice":
            q[var.key] = Choice(instructions=var.instructions,
                                criteria={o.key: o.description for o in var.options})
        elif var.kind == "score":
            q[var.key] = Score(instructions=var.instructions, criteria=list(var.levels))
    for theme in cb.THEMES:
        q[f"theme_{theme.key}"] = Noul(
            instructions=f"The tweet addresses the following ecological theme: {theme.label}. {theme.description}.",
        )
    return q


def build_state(tweet: dict) -> dict:
    return {
        "platform": "X (Twitter)",
        "context": "Tweet posted by a candidate in the 2027 French presidential election. The text is in French.",
        "author": tweet.get("candidate"),
        "party": tweet.get("party"),
        "date": tweet.get("created_at"),
        "tweet": tweet.get("text", ""),
    }


def _level_from_score(var: cb.Variable, probabilities: dict) -> str:
    best = max(probabilities.items(), key=lambda kv: kv[1])[0]
    return var.level_keys[int(best)]


def flatten(response) -> dict:
    """Convertit la réponse Jev en valeurs finales + probabilités/confiances."""
    answers = response.answers
    probs: dict[str, Any] = {}
    conf: dict[str, float] = {}
    values: dict[str, Any] = {}

    for var in cb.VARIABLES:
        a = answers[var.key]
        if var.kind == "noul":
            probs[var.key] = round(a.noul, 4)
            values[var.key] = a.noul >= NOUL_THRESHOLD
        elif var.kind == "choice":
            probs[var.key] = {k: round(v, 4) for k, v in a.probabilities.items()}
            conf[var.key] = round(a.confidence, 4)
            values[var.key] = a.choice
        elif var.kind == "score":
            probs[var.key] = {str(k): round(v, 4) for k, v in a.probabilities.items()}
            conf[var.key] = round(a.confidence, 4)
            values[var.key] = _level_from_score(var, a.probabilities)
            values[f"{var.key}_score"] = round(a.score, 3)

    theme_probs = {t.key: round(answers[f"theme_{t.key}"].noul, 4) for t in cb.THEMES}
    probs["themes"] = theme_probs
    values["themes"] = [k for k, p in theme_probs.items() if p >= NOUL_THRESHOLD]

    if not values["parle_ecologie"]:
        values.update(cb.NON_ECOLOGIE_DEFAULTS)
    elif not values["themes"]:
        # parle d'écologie mais aucun thème au-dessus du seuil : garder le plus probable
        values["themes"] = [max(theme_probs.items(), key=lambda kv: kv[1])[0]]

    return {
        "values": values,
        "probabilities": probs,
        "confidence": conf,
        "model": response.model,
        "usage": {"input_tokens": response.usage.input_tokens, "output_tokens": response.usage.output_tokens},
    }


class JevClassifier:
    def __init__(self, client: TypeSafeClient | None = None, model: str | None = None):
        self.model = model or jev_model()
        self.client = client or TypeSafeClient(model=self.model)
        self.questions = build_questions()

    def classify(self, tweet: dict) -> dict:
        response = self.client.system_one(state=build_state(tweet), questions=self.questions, model=self.model)
        return flatten(response)

    def close(self) -> None:
        self.client.close()


def low_confidence(result: dict, threshold: float = 0.6) -> bool:
    """Vrai si la décision écologie ou une décision de contenu est peu sûre (routage vers Claude)."""
    p = result["probabilities"]["parle_ecologie"]
    if 0.3 <= p <= 0.7:
        return True
    if result["values"]["parle_ecologie"]:
        for key in ("position", "cadrage", "niveau"):
            if result["confidence"].get(key, 1.0) < threshold:
                return True
    return False
