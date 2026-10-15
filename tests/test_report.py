from pathlib import Path

from presidentielle import report

SAMPLE = Path(__file__).resolve().parents[1] / "data" / "sample"


def test_report_from_sample(tmp_path):
    paths = report.run(out_dir=tmp_path, raw_path=SAMPLE / "tweets.jsonl", cls_path=SAMPLE / "classifications.jsonl")
    assert all(p.exists() for p in paths.values())
    df = report.build_dataframe(SAMPLE / "tweets.jsonl", SAMPLE / "classifications.jsonl")
    cands = report.summary_by_candidate(df).set_index("candidate")
    assert cands.loc["Candidat A", "tweets"] == 2
    assert cands.loc["Candidat A", "part_ecologie_pct"] == 50.0
    assert cands.loc["Candidat B", "critique_ecologie"] == 1
    assert cands.loc["Candidat B", "cadrage_dominant"] == "contrainte_punitive"
    assert cands.loc["Candidat B", "adversaire_principal"] == "ecologistes_gauche"
    assert "energie_nucleaire" in cands.loc["Candidat A", "top_themes"]
    themes = report.summary_by_theme(df).set_index("theme")
    assert themes.loc["energie_nucleaire", "tweets"] == 1
    md = (tmp_path / "synthese.md").read_text(encoding="utf-8")
    assert "## Par candidat" in md and "Cadrage des tweets" in md
    weekly = report.weekly_series(df)
    assert set(weekly["candidate"]) == {"Candidat A", "Candidat B", "Candidat C"}
