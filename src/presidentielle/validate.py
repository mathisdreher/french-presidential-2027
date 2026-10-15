"""Fiabilité du codage : accord entre Jev et Claude sur les tweets codés par les deux moteurs.

Métriques par variable : taux d'accord, kappa de Cohen, alpha de Krippendorff (nominal, ou
ordinal pour les échelles), matrice de confusion ; pour les variables à choix multiples,
alpha binaire par catégorie et indice de Jaccard moyen. Calibration de la
probabilité p(écologie) de Jev, en prenant le codage de Claude comme référence.

Deux périmètres :
  - echantillon : l'échantillon de validation (strate aléatoire), non biaisé par le routage ;
  - double_code : tous les tweets codés par les deux moteurs (inclut les tweets routés vers
    Claude parce qu'ils sont écologie ou incertains, donc plus difficiles que la moyenne).

L'accord entre deux modèles mesure leur convergence, pas la validité du codage : une
validation par codeurs humains reste nécessaire pour publier.
"""

from __future__ import annotations

import logging
from collections import Counter
from typing import Hashable, Optional, Sequence

from . import codebook as cb
from . import config
from .storage import load_json, read_jsonl, save_json

log = logging.getLogger(__name__)

CONFUSION_VARS = ("parle_ecologie", "position", "cadrage", "vision")


# ----------------------------------------------------------------------------- métriques
def percent_agreement(a: Sequence[Hashable], b: Sequence[Hashable]) -> Optional[float]:
    if not a:
        return None
    return sum(x == y for x, y in zip(a, b)) / len(a)


def cohen_kappa(a: Sequence[Hashable], b: Sequence[Hashable]) -> Optional[float]:
    n = len(a)
    if n == 0:
        return None
    po = percent_agreement(a, b)
    ca, cb_ = Counter(a), Counter(b)
    pe = sum(ca[k] * cb_.get(k, 0) for k in ca) / (n * n)
    if pe == 1:
        return 1.0 if po == 1 else None
    return (po - pe) / (1 - pe)


def krippendorff_alpha(a: Sequence[Hashable], b: Sequence[Hashable], order: Optional[Sequence[Hashable]] = None) -> Optional[float]:
    """Alpha de Krippendorff pour deux codeurs sans valeur manquante.

    order : liste ordonnée des valeurs pour la métrique ordinale ; None -> métrique nominale.
    """
    if not a:
        return None
    values = list(order) if order else sorted({*a, *b}, key=str)
    idx = {v: i for i, v in enumerate(values)}
    k = len(values)
    o = [[0.0] * k for _ in range(k)]
    for x, y in zip(a, b):
        o[idx[x]][idx[y]] += 1
        o[idx[y]][idx[x]] += 1
    n_c = [sum(row) for row in o]
    n = sum(n_c)
    if n <= 1:
        return None

    def delta2(c: int, kk: int) -> float:
        if c == kk:
            return 0.0
        if not order:
            return 1.0
        lo, hi = min(c, kk), max(c, kk)
        return (sum(n_c[lo:hi + 1]) - (n_c[c] + n_c[kk]) / 2) ** 2

    d_o = sum(o[c][kk] * delta2(c, kk) for c in range(k) for kk in range(k)) / n
    d_e = sum(n_c[c] * n_c[kk] * delta2(c, kk) for c in range(k) for kk in range(k)) / (n * (n - 1))
    if d_e == 0:
        return 1.0 if d_o == 0 else None
    return 1 - d_o / d_e


def confusion(a: Sequence[Hashable], b: Sequence[Hashable]) -> dict:
    labels = sorted({*map(str, a), *map(str, b)})
    m = {x: {y: 0 for y in labels} for x in labels}
    for x, y in zip(a, b):
        m[str(x)][str(y)] += 1
    return {"lignes": "jev", "colonnes": "claude", "labels": labels, "matrice": m}


def calibration(probs: Sequence[float], truth: Sequence[bool], bins: int = 10) -> dict:
    rows = []
    for i in range(bins):
        lo, hi = i / bins, (i + 1) / bins
        sel = [t for p, t in zip(probs, truth) if lo <= p < hi or (i == bins - 1 and p == 1.0)]
        sel_p = [p for p in probs if lo <= p < hi or (i == bins - 1 and p == 1.0)]
        if sel:
            rows.append({"bin": f"{lo:.1f}-{hi:.1f}", "n": len(sel), "p_moyenne": round(sum(sel_p) / len(sel_p), 3),
                         "frequence_observee": round(sum(sel) / len(sel), 3)})
    brier = sum((p - float(t)) ** 2 for p, t in zip(probs, truth)) / len(probs) if probs else None
    return {"bins": rows, "brier": round(brier, 4) if brier is not None else None, "n": len(probs)}


def _r(x: Optional[float]) -> Optional[float]:
    return None if x is None else round(x, 3)


# --------------------------------------------------------------------------- évaluation
def _in_scope(var: cb.Variable, j: dict, c: dict) -> bool:
    return var.scope != "ecologie" or bool(j.get("parle_ecologie") and c.get("parle_ecologie"))


def evaluate(pairs: list[tuple[dict, dict, Optional[float]]]) -> dict:
    """pairs : (valeurs Jev, valeurs Claude, p(écologie) Jev)."""
    out: dict = {"n": len(pairs), "variables": [], "multi": {}, "confusions": {}}
    if not pairs:
        return out
    for var in cb.VARIABLES:
        scoped = [(j, c) for j, c, _ in pairs if _in_scope(var, j, c)]
        if var.kind == "multi":
            jaccards, options = [], []
            for j, c in scoped:
                a, b = set(j.get(var.key) or []), set(c.get(var.key) or [])
                if a or b:
                    jaccards.append(len(a & b) / len(a | b))
            for opt in var.option_keys:
                a = [opt in (j.get(var.key) or []) for j, _ in scoped]
                b = [opt in (c.get(var.key) or []) for _, c in scoped]
                if any(a) or any(b):
                    options.append({"option": opt, "n": len(a), "accord": _r(percent_agreement(a, b)),
                                    "alpha": _r(krippendorff_alpha(a, b))})
            alphas = [o["alpha"] for o in options if o["alpha"] is not None]
            out["multi"][var.key] = {"n": len(scoped), "jaccard_moyen": _r(sum(jaccards) / len(jaccards)) if jaccards else None,
                                     "alpha_moyen": _r(sum(alphas) / len(alphas)) if alphas else None, "options": options}
            continue
        keep = [(j.get(var.key), c.get(var.key)) for j, c in scoped if j.get(var.key) is not None and c.get(var.key) is not None]
        a, b = [x for x, _ in keep], [y for _, y in keep]
        order = var.option_keys if var.kind == "score" else None
        out["variables"].append({
            "variable": var.key, "metrique": "ordinale" if order else "nominale", "n": len(a),
            "accord": _r(percent_agreement(a, b)), "kappa": _r(cohen_kappa(a, b)), "alpha": _r(krippendorff_alpha(a, b, order)),
        })
        if var.key in CONFUSION_VARS:
            out["confusions"][var.key] = confusion(a, b)
    probs = [(p, bool(c.get("parle_ecologie"))) for _, c, p in pairs if p is not None]
    out["calibration_ecologie"] = calibration([x for x, _ in probs], [t for _, t in probs])
    return out


def by_confidence(rows: list[dict]) -> dict:
    """Accord Jev / Claude selon le niveau de confiance de Jev (0 faible, 1 moyenne, 2 élevée).

    Si la confiance de Jev est bien calibrée, l'accord doit croître avec elle.
    """
    from .jev_client import level

    out = {}
    for var in cb.VARIABLES:
        if var.kind == "multi":
            continue
        bins: dict[int, list[bool]] = {0: [], 1: [], 2: []}
        for r in rows:
            j, c = r["jev"]["values"], r["claude"]["values"]
            if not _in_scope(var, j, c) or j.get(var.key) is None or c.get(var.key) is None:
                continue
            raw = (r["jev"].get("probabilities") or {}).get(var.key) if var.kind == "noul" else (r["jev"].get("confidence") or {}).get(var.key)
            lv = level(var.kind, raw)
            if lv is not None:
                bins[lv].append(j.get(var.key) == c.get(var.key))
        if any(bins.values()):
            out[var.key] = [{"niveau": k, "n": len(v), "accord": _r(sum(v) / len(v)) if v else None} for k, v in bins.items()]
    return out


def run() -> dict:
    rows = {r["id"]: r for r in read_jsonl(config.CLASSIFICATIONS_FILE)}
    sample = load_json(config.VALIDATION_SAMPLE_FILE, {"items": []}).get("items", [])
    strata = {it["id"]: it["strate"] for it in sample}

    def pair(row: dict):
        return (row["jev"]["values"], row["claude"]["values"], (row["jev"].get("probabilities") or {}).get("parle_ecologie"))

    double = [r for r in rows.values() if r.get("jev") and r.get("claude")]
    in_sample = [r for r in double if strata.get(r["id"]) == "aleatoire"]
    in_sample_all = [r for r in double if r["id"] in strata]
    result = {
        "echantillon": {
            "taille_prevue": len(sample),
            "codes": len(in_sample_all),
            "aleatoire": evaluate([pair(r) for r in in_sample]),
            "complet": evaluate([pair(r) for r in in_sample_all]),
        },
        "double_code": evaluate([pair(r) for r in double]),
        "par_confiance": by_confidence(double),
        "routage": {
            "tweets_codes_jev": sum(1 for r in rows.values() if r.get("jev")),
            "tweets_codes_claude": sum(1 for r in rows.values() if r.get("claude")),
            "incertains_en_attente": sum(1 for r in rows.values() if r.get("needs_claude")),
            "source_finale": dict(Counter(r.get("final_source") for r in rows.values())),
        },
        "modeles": {
            "jev": sorted({r["jev"].get("model") for r in rows.values() if r.get("jev")} - {None}),
            "claude": sorted({r["claude"].get("model") for r in rows.values() if r.get("claude")} - {None}),
        },
    }
    config.REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    save_json(config.VALIDATION_FILE, result)
    _write_markdown(result)
    log.info("Validation : %d tweets double-codés, dont %d dans l'échantillon", len(double), len(in_sample_all))
    return result


def _write_markdown(result: dict) -> None:
    def table(ev: dict) -> list[str]:
        if not ev.get("n"):
            return ["_Aucun tweet double-codé._", ""]
        lines = ["| Variable | Métrique | n | Accord | Kappa | Alpha |", "|---|---|---|---|---|---|"]
        for v in ev["variables"]:
            lines.append(f"| {v['variable']} | {v['metrique']} | {v['n']} | {v['accord']} | {v['kappa']} | {v['alpha']} |")
        for key, m in ev["multi"].items():
            lines.append(f"| {key} (multiple, alpha moyen par catégorie) | binaire | {m['n']} | Jaccard {m['jaccard_moyen']} | | {m['alpha_moyen']} |")
        lines += ["", f"Calibration p(écologie), score de Brier : {ev['calibration_ecologie']['brier']}", ""]
        return lines

    r = result["routage"]
    lines = ["# Fiabilité du codage : accord Jev / Claude", "",
             "Claude sert de second codeur. L'accord mesure la convergence des deux moteurs, pas la validité du codage.", "",
             f"Tweets codés par Jev : {r['tweets_codes_jev']} | par Claude : {r['tweets_codes_claude']} | "
             f"incertains en attente de Claude : {r['incertains_en_attente']}", "",
             f"## Échantillon de validation, strate aléatoire ({result['echantillon']['aleatoire']['n']} tweets)", ""]
    lines += table(result["echantillon"]["aleatoire"])
    lines += [f"## Tous les tweets double-codés ({result['double_code']['n']} tweets, biaisés vers les cas difficiles)", ""]
    lines += table(result["double_code"])
    (config.REPORTS_DIR / "validation.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
