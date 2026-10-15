import json
from pathlib import Path

from presidentielle import config, site

SAMPLE = Path(__file__).resolve().parents[1] / "data" / "sample"
CANDS = [config.Candidate(name=f"Candidat {x}", party=f"Parti {x}", handle=f"candidat_{x.lower()}", bloc="centre") for x in "ABC"]


def test_payload_from_sample(tmp_path):
    data = site.payload(raw_path=SAMPLE / "tweets.jsonl", cls_path=SAMPLE / "classifications.jsonl",
                        validation_path=tmp_path / "absent.json", candidates=CANDS)
    assert len(data["tweets"]) == 6 and data["validation"] is None
    eco = [t for t in data["tweets"] if t["e"]]
    non = [t for t in data["tweets"] if not t["e"]]
    assert len(eco) == 3 and all("t" in t and t["th"] for t in eco)
    assert all("t" not in t for t in non)  # le texte n'est publié que pour les tweets écologie
    first = next(t for t in data["tweets"] if t["i"] == "1001")
    assert first["c"] == "candidat_a" and first["po"] == "favorable_transition" and first["p"] == 0.97 and first["s"] == "j"
    assert data["study"]["start"] == "2026-09-01" and data["study"]["phases"]
    assert {v["key"] for v in data["codebook"]["variables"]} >= {"cadrage", "polarisation", "registre"}


def test_build_writes_site(tmp_path):
    out = tmp_path / "_site"
    site.build(out, raw_path=SAMPLE / "tweets.jsonl", cls_path=SAMPLE / "classifications.jsonl",
               validation_path=tmp_path / "absent.json", candidates=CANDS)
    assert (out / "index.html").exists() and (out / "app.js").exists() and (out / "style.css").exists()
    assert json.loads((out / "data.json").read_text(encoding="utf-8"))["tweets"]


def test_build_with_no_data(tmp_path):
    out = tmp_path / "_site"
    site.build(out, raw_path=tmp_path / "none.jsonl", cls_path=tmp_path / "none2.jsonl",
               validation_path=tmp_path / "absent.json", candidates=CANDS)
    assert json.loads((out / "data.json").read_text(encoding="utf-8"))["tweets"] == []
