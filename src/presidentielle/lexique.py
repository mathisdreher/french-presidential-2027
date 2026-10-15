"""Lexicométrie, sans modèle de langage : vocabulaire spécifique et suivi des formules.

Vocabulaire spécifique : rapport de vraisemblance de Dunning (G²) entre les tweets écologie
d'un candidat (ou d'une famille politique) et ceux de tous les autres. Seuls les mots
sur-employés, au moins 3 fois, dans au moins 2 tweets différents et significatifs au seuil de
0,1 % (G² > 10,83), sont retenus. Les tweets rédigés dans une autre langue que le français sont
écartés, comme les mots vides français et anglais, les nombres en lettres et le nom du candidat
lui-même ; un même mot compte au plus 3 fois par tweet, pour qu'un long texte n'écrase pas tout ;
un pluriel est fondu dans son singulier quand celui-ci apparaît dans le corpus (logements -> logement).

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
MIN_DOCS = 2      # un mot répété dans un seul tweet ne caractérise pas un locuteur
PER_TWEET_MAX = 3 # un long texte ne compte pas plus de 3 fois le même mot
TOP = 15
# Langues détectées par X qui restent analysées : français, indéterminé, hashtags ou médias seuls
KEEP_LANGS = {"fr", "und", "qht", "qme", "qam", "qct", "zxx", "art", ""}

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
toujours rien chose choses puisque plusieurs lorsque vraiment pourtant selon tandis certes beaucoup trop
tellement autant dès lors afin quelque quelques chacun chacune aucuns plutôt surtout notamment
trois quatre cinq six sept huit neuf dix onze douze treize quinze seize vingt trente quarante cinquante soixante mille
""".split())
# Mots vides anglais : certains tweets mêlent les deux langues
STOPWORDS |= set("""
the and of to in for our will with that this is are be we it on as by an at from or not have has had all own let
can more their they you your its was were been but so if about into than then them these those what which who
how why when where there here also just now out up one would should could may must do does did get got make made
very most over such only any each other some yes my he she his her him i am
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


def keywords(target: Counter, rest: Counter, top: int = TOP, docs: Counter | None = None) -> list[list]:
    """[mot, emplois, G², nombre de tweets] ; docs : nombre de tweets du groupe où le mot apparaît."""
    n1, n2 = sum(target.values()), sum(rest.values())
    if not n1 or not n2:
        return []
    out = []
    for w, a in target.items():
        if a < MIN_FREQ or (docs is not None and docs[w] < MIN_DOCS):
            continue
        b = rest.get(w, 0)
        if a / n1 <= b / n2:
            continue
        score = g2(a, b, n1, n2)
        if score >= G2_MIN:
            out.append([w, a, round(score, 1)] + ([docs[w]] if docs is not None else []))
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


def singulars(vocab) -> dict[str, str]:
    """Pluriel -> singulier, quand le singulier est attesté dans le corpus (logements -> logement)."""
    return {w: w[:-1] for w in vocab if len(w) > 4 and w[-1] in "sx" and w[:-1] in vocab}


def analyse(tweets: list[dict], eco_ids: set[str], bloc_of: dict[str, str]) -> dict:
    """tweets : lignes brutes (id, handle, created_at, text, lang)."""
    toks: dict[str, list[str]] = {}
    foreign = 0
    for t in tweets:
        keep = (t.get("lang") or "") in KEEP_LANGS
        toks[t["id"]] = tokens(t.get("text", "")) if keep else []
        foreign += (not keep) and t["id"] in eco_ids
    merge = singulars({w for ts in toks.values() for w in ts})
    for k, ts in toks.items():
        toks[k] = [merge.get(w, w) for w in ts]
    by_cand: dict[str, Counter] = defaultdict(Counter)
    by_bloc: dict[str, Counter] = defaultdict(Counter)
    docs_cand: dict[str, Counter] = defaultdict(Counter)
    docs_bloc: dict[str, Counter] = defaultdict(Counter)
    for t in tweets:
        if t["id"] in eco_ids:
            c = t["handle"].lower()
            b = bloc_of.get(c, "")
            own_name = set(tokens(t.get("candidate", ""))) | set(fold(t.get("candidate", "")).split())
            counts = Counter({w: min(n, PER_TWEET_MAX) for w, n in Counter(toks[t["id"]]).items()
                              if w not in own_name and fold(w) not in own_name})
            by_cand[c].update(counts)
            by_bloc[b].update(counts)
            docs_cand[c].update(counts.keys())
            docs_bloc[b].update(counts.keys())
    total = Counter()
    for cnt in by_cand.values():
        total.update(cnt)

    def vs_rest(groups: dict[str, Counter], docs: dict[str, Counter]) -> dict:
        return {k: keywords(cnt, total - cnt, docs=docs[k]) for k, cnt in groups.items() if k}

    formules = []
    all_tokens = Counter(w for ts in toks.values() for w in ts)
    for f in load_formules():
        hits = [t for t in tweets if f["regex"].search(fold(t.get("text", "")))]
        if not hits:
            formules.append({"key": f["key"], "label": f["label"], "en": f.get("en", ""), "total": 0})
            continue
        hits.sort(key=lambda t: (t.get("created_at") or "", t["id"]))
        first = hits[0]
        by_c = Counter(t["handle"].lower() for t in hits)
        by_w: dict[str, Counter] = defaultdict(Counter)
        for t in hits:
            by_w[_week((t.get("created_at") or "")[:10])][bloc_of.get(t["handle"].lower(), "")] += 1
        inside = Counter(w for t in hits for w in toks[t["id"]])
        inside_docs = Counter(w for t in hits for w in set(toks[t["id"]]))
        own = {merge.get(w, w) for w in tokens(f["label"])}
        assoc = [k for k in keywords(inside, all_tokens - inside, top=TOP + len(own), docs=inside_docs) if k[0] not in own][:10]
        formules.append({
            "key": f["key"], "label": f["label"], "en": f.get("en", ""), "total": len(hits),
            "premiere": {"date": (first.get("created_at") or "")[:10], "c": first["handle"].lower(), "id": first["id"]},
            "par_candidat": dict(by_c.most_common()),
            "par_semaine": {w: dict(v) for w, v in sorted(by_w.items())},
            "mots_associes": assoc,
        })
    return {"candidats": vs_rest(by_cand, docs_cand), "blocs": vs_rest(by_bloc, docs_bloc), "formules": formules,
            "corpus": {"tweets_ecologie": len(eco_ids), "mots": sum(total.values()), "tweets_autre_langue": foreign}}
