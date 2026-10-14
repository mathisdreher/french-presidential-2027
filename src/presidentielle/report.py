"""Agrégation des classifications : CSV détaillé, synthèse par candidat, rapport Markdown."""

from __future__ import annotations

import logging
from collections import Counter
from pathlib import Path

import pandas as pd

from . import config
from .storage import read_jsonl

log = logging.getLogger(__name__)

EXPORT_COLUMNS = [
    "id", "candidate", "party", "handle", "created_at", "text", "likes", "retweets", "replies",
    "quotes", "impressions", "url", "parle_ecologie", "niveau", "themes", "position", "resume",
    "confiance", "model",
]


def build_dataframe(raw_path: Path = config.RAW_TWEETS_FILE,
                    cls_path: Path = config.CLASSIFICATIONS_FILE) -> pd.DataFrame:
    tweets = pd.DataFrame(list(read_jsonl(raw_path)))
    cls = pd.DataFrame(list(read_jsonl(cls_path)))
    if tweets.empty:
        return pd.DataFrame(columns=EXPORT_COLUMNS)
    if cls.empty:
        raise SystemExit("Aucune classification : lancez d'abord `classify`.")
    cls = cls.drop_duplicates("id", keep="last").drop(columns=["usage", "classified_at"], errors="ignore")
    df = tweets.merge(cls, on="id", how="inner")
    df["created_at"] = pd.to_datetime(df["created_at"], utc=True, errors="coerce")
    df = df.sort_values(["candidate", "created_at"], ascending=[True, False])
    return df


def summary_by_candidate(df: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for (cand, party), g in df.groupby(["candidate", "party"], sort=True):
        eco = g[g["parle_ecologie"]]
        themes = Counter(t for ts in eco["themes"] for t in ts)
        positions = eco["position"].value_counts()
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
    return pd.DataFrame(rows).sort_values("tweets", ascending=False)


def write_markdown(df: pd.DataFrame, cands: pd.DataFrame, themes: pd.DataFrame, path: Path) -> None:
    eco = df[df["parle_ecologie"]]
    lines = [
        "# Présidentielle 2027 : l'écologie dans les tweets des candidats",
        "",
        f"Tweets analysés : {len(df)} | tweets parlant d'écologie : {len(eco)} "
        f"({100 * len(eco) / len(df):.1f} %)" if len(df) else "Aucun tweet.",
        "",
        "## Par candidat",
        "",
        _md_table(cands[["candidate", "party", "tweets", "tweets_ecologie", "part_ecologie_pct",
                          "ecologie_centrale", "favorable_transition", "critique_ecologie", "top_themes"]]),
        "",
        "## Par thème",
        "",
        _md_table(themes) if not themes.empty else "_Aucun thème détecté._",
        "",
        "## Tweets écologie les plus engageants",
        "",
    ]
    top = eco.sort_values("likes", ascending=False).head(15)
    for _, r in top.iterrows():
        date = r["created_at"].strftime("%Y-%m-%d") if pd.notna(r["created_at"]) else ""
        lines.append(f"- **{r['candidate']}** ({date}, {r['likes']} likes, {r['position']}) : "
                     f"{r['resume']} [lien]({r['url']})")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def _md_table(df: pd.DataFrame) -> str:
    if df.empty:
        return "_Aucune donnée._"
    cols = list(df.columns)
    out = ["| " + " | ".join(cols) + " |", "| " + " | ".join("---" for _ in cols) + " |"]
    for _, r in df.iterrows():
        out.append("| " + " | ".join("" if pd.isna(v) else str(v) for v in r.tolist()) + " |")
    return "\n".join(out)


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
    detail = detail[[c for c in EXPORT_COLUMNS if c in detail.columns]]

    paths = {
        "detail": out_dir / "tweets_classifies.csv",
        "candidats": out_dir / "synthese_candidats.csv",
        "themes": out_dir / "synthese_themes.csv",
        "markdown": out_dir / "synthese.md",
    }
    detail.to_csv(paths["detail"], index=False)
    cands.to_csv(paths["candidats"], index=False)
    themes.to_csv(paths["themes"], index=False)
    write_markdown(df, cands, themes, paths["markdown"])
    for p in paths.values():
        log.info("Écrit %s", p)
    return paths
