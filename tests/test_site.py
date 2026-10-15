import json
from pathlib import Path

from presidentielle import codebook as cb
from presidentielle import config, site

FIX = Path(__file__).resolve().parent / "fixtures"
CANDS = [config.Candidate(name=f"Candidat {x}", party=f"Parti {x}", handle=f"candidat_{x.lower()}", bloc="centre") for x in "ABC"]
CANDS.append(config.Candidate(name="Candidat D", party="Parti D", handle=None, bloc="droite", note="Pas sur X"))
KW = dict(raw_path=FIX / "tweets.jsonl", cls_path=FIX / "classifications.jsonl", candidates=CANDS)


def _decode(data):
    cols = data["tweets"]["cols"]
    return [dict(zip(cols, r)) for r in data["tweets"]["rows"]]


def test_payload(tmp_path):
    data = site.payload(validation_path=tmp_path / "absent.json", users={"candidat_a": {"status": "ok", "id": "1"}, "candidat_b": {"status": "introuvable"}}, **KW)
    rows = _decode(data)
    assert len(rows) == 6 and data["validation"] is None
    first = next(r for r in rows if r["i"] == "1001")
    assert data["candidates"][first["c"]]["key"] == "candidat_a" and first["e"] == 1 and first["p"] == 0.97 and first["s"] == "j"
    assert cb.POSITION.option_keys[first["po"]] == "favorable_transition"
    themes = [k for i, k in enumerate(cb.THEME_KEYS) if first["th"] & (1 << i)]
    assert themes == ["energie_nucleaire", "prix_energie_reseau"]
    assert set(data["texts"]) == {"1001", "1003", "1005"}  # texte publié pour les seuls tweets écologie
    assert data["texts"]["1003"]["lx"] == ["écologie punitive"]
    comptes = {c["key"]: c["compte"] for c in data["candidates"]}
    assert comptes["candidat_b"] == "introuvable" and comptes["candidatd"] == "sans_compte" and comptes["candidat_c"] == "en_attente"
    fw = {f["key"] for f in data["codebook"]["frameworks"]}
    assert {"carre", "topoi", "retardement", "visions", "appropriation", "formules", "lexique"} <= fw
    assert data["lexique"]["formules"] and data["study"]["questions"]
    assert any(f["key"] == "ecologie_punitive" and f["total"] >= 1 for f in data["lexique"]["formules"])


def test_games_payload_anonymises():
    g = site.games_payload(**KW)
    assert g["items"], "les tweets écologie assez longs doivent alimenter les jeux"
    for it in g["items"]:
        assert it["m"] == "auto" and "Candidat A" not in it["t"]
        assert set(it["codes"]) >= {"position", "cadrage", "vision"}


def test_build_writes_site(tmp_path):
    out = tmp_path / "_site"
    site.build(out, validation_path=tmp_path / "absent.json", **KW)
    for name in ("index.html", "app.js", "style.css", "data.json", "games.json"):
        assert (out / name).exists()


def test_build_with_no_data(tmp_path):
    out = tmp_path / "_site"
    site.build(out, raw_path=tmp_path / "x.jsonl", cls_path=tmp_path / "y.jsonl", validation_path=tmp_path / "z.json", candidates=CANDS)
    data = json.loads((out / "data.json").read_text(encoding="utf-8"))
    assert data["tweets"]["rows"] == [] and data["lexique"] is None
