"""Agrégation : CSV détaillé, synthèses par candidat et par thème, dimensions CDA,
rapport Markdown et export JSON pour le site."""

from __future__ import annotations

import json
import logging
from collections import Counter
from pathlib import Path

import pandas as pd

from . import codebook as cb
from . import config
from .storage import read_jsonl

log = logging.getLogger(__name__)

EXPORT_COLUMNS = [
    "id", "candidate", "party", "handle", "created_at", "text", "likes", "retweets", "replies",
    "quotes", "impressions", "url", "parle_ecologie", "niveau", "themes", "position", "cadrage",
    "polarisation", "adversaire", "victime", "acte_discursif", "registre", "chiffres", "reactivite",
    "autorite", "nous", "eux", "lexique", "implicites", "resume", "confiance", "final_source",
    "p_ecologie", "accord_ecologie", "accord_position",
]
CDA_CHOICES = ("cadrage", "polarisation", "adversaire", "victime", "acte_discursif", "registre")


def build_dataframe(raw_path: Path = config.RAW_TWEETS_FILE,
                    cls_path: Path = config.CLASSIFICATIONS_FILE) -> pd.DataFrame:
    tweets = pd.DataFrame(list(read_jsonl(raw_path)))
    cls_rows = list(read_jsonl(cls_path))
    if tweets.empty:
        return pd.DataFrame(columns=EXPORT_COLUMNS)
    if not cls_rows:
        raise SystemExit("Aucune classification : lancez d'abord `classify`.")
    for row in cls_rows:
        jev = row.get("jev") or {}
        row["p_ecologie"] = (jev.get("probabilities") or {}).get("parle_ecologie")
    cls = pd.DataFrame(cls_rows).drop_duplicates("id", keep="last")
    cls = cls.drop(columns=[c for c in ("jev", "claude", "classified_at", "needs_claude", "engine") if c in cls.columns])
    df = tweets.merge(cls, on="id", how="inner")
    df["created_at"] = pd.to_datetime(df["created_at"], utc=True, errors="coerce")
    df["themes"] = df["themes"].apply(lambda v: v if isinstance(v, list) else [])
    df["parle_ecologie"] = df["parle_ecologie"].astype(bool)
    return df.sort_values(["candidate", "created_at"], ascending=[True, False])


def summary_by_candidate(df: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for (cand, party), g in df.groupby(["candidate", "party"], sort=True):
        eco = g[g["parle_ecologie"]]
        themes = Counter(t for ts in eco["themes"] for t in ts)
        positions = eco["position"].value_counts()
        cadrages = eco["cadrage"].value_counts() if "cadrage" in eco else pd.Series(dtype=int)
        polar = g["polarisation"].value_counts() if "polarisation" in g else pd.Series(dtype=int)
        adv = g["adversaire"].value_counts() if "adversaire" in g else pd.Series(dtype=int)
        adv = adv.drop("aucun", errors="ignore")
        n_polar = int(polar.get("presentation_negative_autrui", 0) + polar.get("les_deux", 0))
        rows.append({
            "candidate": cand,
            "party": party,
            "tweets": len(g),
            "tweets_ecologie": len(eco),
            "part_ecologie_pct": round(100 * len(eco) / len(g), 1) if len(g) else 0.0,
            "ecologie_centrale": int((eco["niveau"] == "central").sum()),
            "favorable_transition": int(positions.get("favorable_transition", 0)),
            "critique_ecologie": int(positions.get("critique_ecologie", 0)),
            "neutre": int(positions.get("neutre", 0)),
            "top_themes": ", ".join(f"{t} ({n})" for t, n in themes.most_common(3)),
            "cadrage_dominant": cadrages.drop("non_applicable", errors="ignore").idxmax() if len(cadrages.drop("non_applicable", errors="ignore")) else "",
            "part_negative_autrui_pct": round(100 * n_polar / len(g), 1) if len(g) else 0.0,
            "adversaire_principal": adv.idxmax() if len(adv) else "",
            "registre_alarmiste_pct": round(100 * (g["registre"] == "alarmiste_indigne").mean(), 1) if "registre" in g else None,
            "likes_moyens_ecologie": round(eco["likes"].mean(), 1) if len(eco) else None,
            "likes_moyens_autres": round(g[~g["parle_ecologie"]]["likes"].mean(), 1) if (~g["parle_ecologie"]).any() else None,
            "periode": f"{g['created_at'].min():%Y-%m-%d} -> {g['created_at'].max():%Y-%m-%d}" if g["created_at"].notna().any() else "",
        })
    return pd.DataFrame(rows).sort_values("part_ecologie_pct", ascending=False)


def summary_by_theme(df: pd.DataFrame) -> pd.DataFrame:
    eco = df[df["parle_ecologie"]]
    rows = []
    for theme in sorted({t for ts in eco["themes"] for t in ts}):
        sub = eco[eco["themes"].apply(lambda ts: theme in ts)]
        by_cand = sub["candidate"].value_counts()
        rows.append({
            "theme": theme,
            "tweets": len(sub),
            "candidats": len(by_cand),
            "principaux_candidats": ", ".join(f"{c} ({n})" for c, n in by_cand.head(3).items()),
        })
    return pd.DataFrame(rows).sort_values("tweets", ascending=False) if rows else pd.DataFrame(columns=["theme", "tweets", "candidats", "principaux_candidats"])


def crosstab(df: pd.DataFrame, column: str, ecology_only: bool = True) -> pd.DataFrame:
    """Répartition (%) d'une variable CDA par candidat."""
    sub = df[df["parle_ecologie"]] if ecology_only else df
    if sub.empty or column not in sub:
        return pd.DataFrame()
    ct = pd.crosstab(sub["candidate"], sub[column], normalize="index").mul(100).round(1)
    ct["n"] = sub["candidate"].value_counts()
    return ct.reset_index()


def weekly_series(df: pd.DataFrame) -> pd.DataFrame:
    d = df.dropna(subset=["created_at"]).copy()
    d["semaine"] = d["created_at"].dt.tz_convert(None).dt.to_period("W").dt.start_time.dt.strftime("%Y-%m-%d")
    g = d.groupby(["candidate", "semaine"]).agg(tweets=("id", "count"), tweets_ecologie=("parle_ecologie", "sum")).reset_index()
    g["part_ecologie_pct"] = (100 * g["tweets_ecologie"] / g["tweets"]).round(1)
    return g


def write_markdown(df: pd.DataFrame, cands: pd.DataFrame, themes: pd.DataFrame, path: Path) -> None:
    eco = df[df["parle_ecologie"]]
    lines = [
        "# Présidentielle 2027 : l'écologie dans les tweets des candidats",
        "",
        (f"Tweets analysés : {len(df)} | tweets parlant d'écologie : {len(eco)} "
         f"({100 * len(eco) / len(df):.1f} %)") if len(df) else "Aucun tweet.",
        "",
        "## Par candidat",
        "",
        _md_table(cands[["candidate", "party", "tweets", "tweets_ecologie", "part_ecologie_pct", "ecologie_centrale",
                          "favorable_transition", "critique_ecologie", "cadrage_dominant",
                          "part_negative_autrui_pct", "adversaire_principal", "top_themes"]]),
        "",
        "## Par thème",
        "",
        _md_table(themes),
        "",
    ]
    for col in ("cadrage", "polarisation", "adversaire"):
        ct = crosstab(df, col, ecology_only=(col == "cadrage"))
        if not ct.empty:
            title = {"cadrage": "Cadrage des tweets écologie (%)", "polarisation": "Polarisation Nous/Eux, tous tweets (%)",
                     "adversaire": "Adversaire désigné, tous tweets (%)"}[col]
            lines += [f"## {title}", "", _md_table(ct), ""]
    lines += ["## Tweets écologie les plus engageants", ""]
    for _, r in eco.sort_values("likes", ascending=False).head(15).iterrows():
        date = r["created_at"].strftime("%Y-%m-%d") if pd.notna(r["created_at"]) else ""
        resume = r.get("resume") or ""
        lines.append(f"- **{r['candidate']}** ({date}, {r['likes']} likes, {r['position']}, {r.get('cadrage', '')}) : "
                     f"{resume} [lien]({r['url']})")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def _md_table(df: pd.DataFrame) -> str:
    if df.empty:
        return "_Aucune donnée._"
    cols = list(df.columns)
    out = ["| " + " | ".join(str(c) for c in cols) + " |", "| " + " | ".join("---" for _ in cols) + " |"]
    for _, r in df.iterrows():
        out.append("| " + " | ".join("" if pd.isna(v) else str(v) for v in r.tolist()) + " |")
    return "\n".join(out)


def site_data(df: pd.DataFrame, cands: pd.DataFrame, themes: pd.DataFrame) -> dict:
    """JSON consommé par le site de visualisation."""
    eco = df[df["parle_ecologie"]].copy()
    eco["created_at"] = eco["created_at"].dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    tweet_cols = ["id", "candidate", "party", "handle", "created_at", "text", "likes", "retweets", "url",
                  "niveau", "themes", "position", "cadrage", "polarisation", "adversaire", "victime",
                  "acte_discursif", "registre", "lexique", "resume", "final_source", "p_ecologie"]
    return {
        "generated_at": pd.Timestamp.now("UTC").strftime("%Y-%m-%dT%H:%M:%SZ"),
        "totals": {"tweets": int(len(df)), "tweets_ecologie": int(len(eco)),
                   "part_ecologie_pct": round(100 * len(eco) / len(df), 1) if len(df) else 0.0},
        "codebook": {
            "themes": [{"key": t.key, "label": t.label} for t in cb.THEMES],
            **{v.key: [{"key": o.key, "label": o.label} for o in v.options] for v in cb.CHOICE_VARS},
            "registre": [{"key": k, "label": k} for k in cb.REGISTRE.level_keys],
        },
        "candidates": json.loads(cands.to_json(orient="records", force_ascii=False)),
        "themes": json.loads(themes.to_json(orient="records", force_ascii=False)),
        "weekly": json.loads(weekly_series(df).to_json(orient="records", force_ascii=False)),
        "crosstabs": {col: json.loads(crosstab(df, col, ecology_only=(col == "cadrage")).to_json(orient="records", force_ascii=False))
                      for col in CDA_CHOICES},
        "ecology_tweets": json.loads(eco[[c for c in tweet_cols if c in eco.columns]].to_json(orient="records", force_ascii=False)),
    }


def run(out_dir: Path = config.REPORTS_DIR, raw_path: Path = config.RAW_TWEETS_FILE,
        cls_path: Path = config.CLASSIFICATIONS_FILE) -> dict[str, Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    df = build_dataframe(raw_path, cls_path)
    if df.empty:
        raise SystemExit("Aucun tweet classifié à agréger.")
    cands = summary_by_candidate(df)
    themes = summary_by_theme(df)

    detail = df.copy()
    detail["themes"] = detail["themes"].apply(lambda ts: "|".join(ts))
    if "lexique" in detail:
        detail["lexique"] = detail["lexique"].apply(lambda v: "|".join(v) if isinstance(v, list) else "")
    detail = detail[[c for c in EXPORT_COLUMNS if c in detail.columns]]

    paths = {
        "detail": out_dir / "tweets_classifies.csv",
        "candidats": out_dir / "synthese_candidats.csv",
        "themes": out_dir / "synthese_themes.csv",
        "hebdo": out_dir / "serie_hebdomadaire.csv",
        "markdown": out_dir / "synthese.md",
        "site": out_dir / "site_data.json",
    }
    detail.to_csv(paths["detail"], index=False)
    cands.to_csv(paths["candidats"], index=False)
    themes.to_csv(paths["themes"], index=False)
    weekly_series(df).to_csv(paths["hebdo"], index=False)
    write_markdown(df, cands, themes, paths["markdown"])
    paths["site"].write_text(json.dumps(site_data(df, cands, themes), ensure_ascii=False, indent=1), encoding="utf-8")
    for p in paths.values():
        log.info("Écrit %s", p)
    return paths
