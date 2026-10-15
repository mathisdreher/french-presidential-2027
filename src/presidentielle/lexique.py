"""Lexicométrie, sans modèle de langage : vocabulaire spécifique et suivi des formules.

Vocabulaire spécifique : rapport de vraisemblance de Dunning (G²) entre les tweets écologie
d'un candidat (ou d'une famille politique) et ceux de tous les autres. Seuls les mots
sur-employés, au moins 3 fois et significatifs au seuil de 0,1 % (G² > 10,83), sont retenus.

Formules (Krieg-Planque) : repérage des variantes de config/formules.yaml dans tous les
tweets, première occurrence, diffusion par candidat et par semaine, mots associés.
"""

from __future__ import annotations

import math
import re
import unicodedata
from collections import Counter, defaultdict
from datetime import date, timedelta

import yaml

from . import config

G2_MIN = 10.83
MIN_FREQ = 3
TOP = 15

STOPWORDS = set("""
a à afin ai aie aient aies ait alors as au aucun aucune aujourd aujourdhui auprès aura aurai auraient aurais aurait
aussi autre autres aux avaient avais avait avant avec avez aviez avions avoir avons ayant bah bien bon c ça car ce ceci
cela celle celles celui cent cependant certain certaines certains ces cet cette ceux chaque chez ci comme comment
contre d dans de des deux devant doit donc dont du elle elles en encore entre es est et étaient étais était étant
été être eu eux fait faire fais faut fois font hier ici il ils j je jamais jusqu l la là le les leur leurs lors lui m ma
mais me même mêmes merci mes moi moins mon n ne ni non nos notre nous on ont ou où par parce pas peu peut peuvent plus
pour pourquoi puis qu quand que quel quelle quelles quels qui quoi s sa sans se sera serait ses si sien son sont sous
soyez suis sur t ta tant te tes toi ton tous tout toute toutes très tu un une va vers veut via voici voilà vont vos
votre vous vu y ans an jour jours rt amp https http www com fr cest jai quil quelle ceux ici déjà ainsi après depuis
dire dit doit font chez être avoir faire aller veux voulons voulez demain soir matin heure heures
""".split())
WORD = re.compile(r"[a-zàâäçéèêëîïôöùûüÿœæ]+(?:-[a-zàâäçéèêëîïôöùûüÿœæ]+)*")
URL = re.compile(r"https?://\S+")
MENTION = re.compile(r"@\w+")


def fold(text: str) -> str:
    """Minuscules sans accents, pour le repérage des formules."""
    return "".join(c for c in unicodedata.normalize("NFD", text.lower()) if unicodedata.category(c) != "Mn")


def tokens(text: str) -> list[str]:
    text = MENTION.sub(" ", URL.sub(" ", text.lower())).replace("#", " ").replace("’", "'")
    return [w for w in WORD.findall(text) if len(w) > 2 and w not in STOPWORDS]


def g2(a: int, b: int, n1: int, n2: int) -> float:
    """Rapport de vraisemblance de Dunning : fréquence a sur n1 contre b sur n2."""
    e1 = n1 * (a + b) / (n1 + n2)
    e2 = n2 * (a + b) / (n1 + n2)
    return 2 * ((a * math.log(a / e1) if a else 0) + (b * math.log(b / e2) if b else 0))


def keywords(target: Counter, rest: Counter, top: int = TOP) -> list[list]:
    n1, n2 = sum(target.values()), sum(rest.values())
    if not n1 or not n2:
        return []
    out = []
    for w, a in target.items():
        if a < MIN_FREQ:
            continue
        b = rest.get(w, 0)
        if a / n1 <= b / n2:
            continue
        score = g2(a, b, n1, n2)
        if score >= G2_MIN:
            out.append([w, a, round(score, 1)])
    return sorted(out, key=lambda x: -x[2])[:top]


def load_formules() -> list[dict]:
    if not config.FORMULES_FILE.exists():
        return []
    raw = yaml.safe_load(config.FORMULES_FILE.read_text(encoding="utf-8")) or {}
    out = []
    for f in raw.get("formules", []):
        out.append({**f, "regex": re.compile("|".join(f"(?:{v})" for v in f["variantes"]))})
    return out


def _week(day: str) -> str:
    d = date.fromisoformat(day)
    return (d - timedelta(days=d.weekday())).isoformat()


def analyse(tweets: list[dict], eco_ids: set[str], bloc_of: dict[str, str]) -> dict:
    """tweets : lignes brutes (id, handle, created_at, text)."""
    by_cand: dict[str, Counter] = defaultdict(Counter)
    by_bloc: dict[str, Counter] = defaultdict(Counter)
    toks: dict[str, list[str]] = {}
    for t in tweets:
        toks[t["id"]] = tokens(t.get("text", ""))
        if t["id"] in eco_ids:
            c = t["handle"].lower()
            by_cand[c].update(toks[t["id"]])
            by_bloc[bloc_of.get(c, "")].update(toks[t["id"]])
    total = Counter()
    for cnt in by_cand.values():
        total.update(cnt)

    def vs_rest(groups: dict[str, Counter]) -> dict:
        return {k: keywords(cnt, total - cnt) for k, cnt in groups.items() if k}

    formules = []
    all_tokens = Counter(w for ts in toks.values() for w in ts)
    for f in load_formules():
        hits = [t for t in tweets if f["regex"].search(fold(t.get("text", "")))]
        if not hits:
            formules.append({"key": f["key"], "label": f["label"], "total": 0})
            continue
        hits.sort(key=lambda t: (t.get("created_at") or "", t["id"]))
        first = hits[0]
        by_c = Counter(t["handle"].lower() for t in hits)
        by_w: dict[str, Counter] = defaultdict(Counter)
        for t in hits:
            by_w[_week((t.get("created_at") or "")[:10])][bloc_of.get(t["handle"].lower(), "")] += 1
        inside = Counter(w for t in hits for w in toks[t["id"]])
        own = set(tokens(f["label"]))
        assoc = [k for k in keywords(inside, all_tokens - inside, top=TOP + len(own)) if k[0] not in own][:10]
        formules.append({
            "key": f["key"], "label": f["label"], "total": len(hits),
            "premiere": {"date": (first.get("created_at") or "")[:10], "c": first["handle"].lower(), "id": first["id"]},
            "par_candidat": dict(by_c.most_common()),
            "par_semaine": {w: dict(v) for w, v in sorted(by_w.items())},
            "mots_associes": assoc,
        })
    return {"candidats": vs_rest(by_cand), "blocs": vs_rest(by_bloc), "formules": formules,
            "corpus": {"tweets_ecologie": len(eco_ids), "mots": sum(total.values())}}
