"""Réseau « qui nomme qui » : les candidats cités dans un tweet, par leur compte X ou par leur nom.

Calcul sans modèle, sur le texte brut : un candidat est nommé si son @compte ou l'une de ses façons d'être
nommé (champ `noms` de candidates.yaml, par défaut nom complet et patronyme) apparaît comme mot entier,
sans tenir compte des accents ni des majuscules. Un candidat qui se nomme lui-même n'est pas compté.
"""
from __future__ import annotations

import re
import unicodedata

from . import config


def fold(text: str) -> str:
    """Minuscules sans accents, longueur conservée lettre à lettre pour les mots usuels."""
    return "".join(ch for ch in unicodedata.normalize("NFKD", text.lower()) if not unicodedata.combining(ch))


def surname(name: str) -> str:
    """Patronyme d'un nom complet : « Le Pen » garde son article, « de Villepin » perd sa particule."""
    words = name.split()
    if len(words) >= 3 and words[-2].lower() in ("le", "la"):
        return " ".join(words[-2:])
    return words[-1]


def pattern(cand: config.Candidate) -> re.Pattern:
    names = cand.noms or [cand.name, surname(cand.name)]
    alts = sorted({fold(n) for n in names if n}, key=len, reverse=True)
    parts = [rf"(?<![\w@]){re.escape(a)}(?!\w)" for a in alts]
    if cand.handle:
        parts.append(rf"@{re.escape(cand.handle.lower())}(?!\w)")
    return re.compile("|".join(parts))


def matcher(candidates: list[config.Candidate]):
    """Fonction texte, auteur -> indices (dans `candidates`) des autres candidats nommés."""
    compiled = [(i, c.slug, pattern(c)) for i, c in enumerate(candidates)]

    def named(text: str, author: str) -> list[int]:
        folded = fold(text or "")
        return [i for i, slug, rx in compiled if slug != author and rx.search(folded)]

    return named
