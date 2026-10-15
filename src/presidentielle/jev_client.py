"""Jev (TypeSafe), modèle de décision « System One ».

Un appel par tweet : toutes les questions du livre de codes en parallèle (fan-out). Chaque
réponse porte une distribution de probabilités et une confiance calibrée. Les variables à choix
multiples sont posées comme une question oui/non par catégorie.
"""

from __future__ import annotations

import os
from typing import Any, Optional

from typesafe_sdk import Choice, Noul, Score, TypeSafeClient

from . import codebook as cb

DEFAULT_JEV_MODEL = "jev-latest"
NOUL_THRESHOLD = 0.5
SEP = "__"


def jev_model() -> str:
    return os.environ.get("JEV_MODEL", "").strip() or DEFAULT_JEV_MODEL


def build_questions() -> dict[str, Any]:
    q: dict[str, Any] = {}
    for var in cb.VARIABLES:
        if var.kind == "noul":
            q[var.key] = Noul(instructions=var.instructions)
        elif var.kind == "choice":
            q[var.key] = Choice(instructions=var.instructions, criteria={o.key: o.description for o in var.options})
        elif var.kind == "score":
            q[var.key] = Score(instructions=var.instructions, criteria=[o.description for o in var.options])
        else:
            for o in var.options:
                q[f"{var.key}{SEP}{o.key}"] = Noul(instructions=f"{var.instructions} {o.description}.")
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


def flatten(response) -> dict:
    """Réponse Jev -> valeurs finales, probabilités et confiances."""
    answers = response.answers
    probs: dict[str, Any] = {}
    conf: dict[str, float] = {}
    values: dict[str, Any] = {}
    for var in cb.VARIABLES:
        if var.kind == "noul":
            p = answers[var.key].noul
            probs[var.key] = round(p, 4)
            values[var.key] = p >= NOUL_THRESHOLD
        elif var.kind == "choice":
            a = answers[var.key]
            probs[var.key] = {k: round(v, 4) for k, v in a.probabilities.items()}
            conf[var.key] = round(a.confidence, 4)
            values[var.key] = a.choice
        elif var.kind == "score":
            a = answers[var.key]
            probs[var.key] = {str(k): round(v, 4) for k, v in a.probabilities.items()}
            conf[var.key] = round(a.confidence, 4)
            best = max(a.probabilities.items(), key=lambda kv: kv[1])[0]
            values[var.key] = var.options[int(best)].key
            values[f"{var.key}_score"] = round(a.score, 3)
        else:
            per = {o.key: round(answers[f"{var.key}{SEP}{o.key}"].noul, 4) for o in var.options}
            probs[var.key] = per
            values[var.key] = [k for k, p in per.items() if p >= NOUL_THRESHOLD]

    if not values["parle_ecologie"]:
        values.update(cb.NON_ECOLOGIE_DEFAULTS)
    elif not values["themes"]:
        # écologie sans thème au-dessus du seuil : garder le plus probable
        values["themes"] = [max(probs["themes"].items(), key=lambda kv: kv[1])[0]]

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
        return flatten(self.client.system_one(state=build_state(tweet), questions=self.questions, model=self.model))

    def close(self) -> None:
        self.client.close()


# Niveaux de confiance affichés sur le site : 0 faible, 1 moyenne, 2 élevée. Le niveau faible
# correspond exactement à la règle qui confie une décision à Claude (low_confidence).
NOUL_GREY = (0.3, 0.7)


def level(kind: str, value: Optional[float]) -> Optional[int]:
    """Niveau d'une décision : probabilité pour oui/non, confiance calibrée pour un choix ou un score."""
    if value is None:
        return None
    if kind == "noul":
        if NOUL_GREY[0] <= value <= NOUL_GREY[1]:
            return 0
        return 1 if 0.1 < value < 0.9 else 2
    return 0 if value < 0.6 else 1 if value < 0.8 else 2


def tweet_level(result: dict) -> Optional[int]:
    """Niveau le plus bas parmi les décisions qui orientent le codage : écologie, puis position, cadrage, niveau."""
    levels = [level("noul", (result.get("probabilities") or {}).get("parle_ecologie"))]
    if (result.get("values") or {}).get("parle_ecologie"):
        levels += [level("choice", (result.get("confidence") or {}).get(k)) for k in ("position", "cadrage", "niveau")]
    levels = [x for x in levels if x is not None]
    return min(levels) if levels else None


def low_confidence(result: dict, threshold: float = 0.6) -> bool:
    """Décision peu sûre : à confier à Claude quand il est lancé."""
    p = result["probabilities"]["parle_ecologie"]
    if 0.3 <= p <= 0.7:
        return True
    if result["values"]["parle_ecologie"]:
        for key in ("position", "cadrage", "niveau"):
            if result["confidence"].get(key, 1.0) < threshold:
                return True
    return False
