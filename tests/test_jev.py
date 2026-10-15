from types import SimpleNamespace

from presidentielle import codebook as cb
from presidentielle.classify import merge
from presidentielle.jev_client import build_questions, build_state, flatten, low_confidence


def _choice(choice, probs, confidence=0.9):
    return SimpleNamespace(choice=choice, probabilities=probs, confidence=confidence)


def _score(probs, confidence=0.9):
    score = sum(k * v for k, v in probs.items())
    return SimpleNamespace(score=score, probabilities=probs, confidence=confidence, legend={})


def _noul(p):
    return SimpleNamespace(noul=p)


def fake_response(eco=0.9, position="critique_ecologie", themes=None):
    themes = themes or {}
    answers = {
        "parle_ecologie": _noul(eco),
        "niveau": _score({0: 0.05, 1: 0.15, 2: 0.8}),
        "position": _choice(position, {k: 0.0 for k in cb.POSITION.option_keys} | {position: 1.0}),
        "cadrage": _choice("contrainte_punitive", {"contrainte_punitive": 0.8, "souverainete": 0.2}, 0.75),
        "polarisation": _choice("presentation_negative_autrui", {"presentation_negative_autrui": 0.9}),
        "adversaire": _choice("ecologistes_gauche", {"ecologistes_gauche": 0.9}),
        "victime": _choice("menages_modestes", {"menages_modestes": 0.9}),
        "acte_discursif": _choice("critique_attaque", {"critique_attaque": 0.9}),
        "registre": _score({0: 0.1, 1: 0.3, 2: 0.6}),
        "chiffres": _noul(0.1),
        "reactivite": _noul(0.7),
        "autorite": _noul(0.05),
    }
    for t in cb.THEMES:
        answers[f"theme_{t.key}"] = _noul(themes.get(t.key, 0.02))
    return SimpleNamespace(answers=answers, model="jev-test", usage=SimpleNamespace(input_tokens=1500, output_tokens=0))


def test_questions_cover_codebook():
    q = build_questions()
    for v in cb.VARIABLES:
        assert v.key in q
    for t in cb.THEMES:
        assert f"theme_{t.key}" in q
    assert len(q) == len(cb.VARIABLES) + len(cb.THEMES)


def test_state_is_structured():
    s = build_state({"candidate": "X", "party": "P", "created_at": "2026-10-01", "text": "Bonjour"})
    assert s["tweet"] == "Bonjour" and s["author"] == "X"


def test_flatten_ecology_tweet():
    r = flatten(fake_response(themes={"transports_mobilite": 0.9, "fiscalite_normes": 0.6}))
    v = r["values"]
    assert v["parle_ecologie"] is True
    assert v["niveau"] == "central" and v["niveau_score"] == 1.75
    assert v["themes"] == ["transports_mobilite", "fiscalite_normes"]
    assert v["position"] == "critique_ecologie"
    assert v["registre"] == "alarmiste_indigne"
    assert v["reactivite"] is True and v["chiffres"] is False
    assert r["confidence"]["cadrage"] == 0.75
    assert r["probabilities"]["parle_ecologie"] == 0.9
    assert low_confidence(r) is False


def test_flatten_non_ecology_forces_defaults():
    r = flatten(fake_response(eco=0.1, position="critique_ecologie", themes={"climat": 0.8}))
    v = r["values"]
    assert v["parle_ecologie"] is False
    assert v["themes"] == [] and v["position"] == "non_applicable" and v["cadrage"] == "non_applicable"


def test_flatten_keeps_best_theme_when_none_above_threshold():
    r = flatten(fake_response(themes={"climat": 0.4, "eau": 0.3}))
    assert r["values"]["themes"] == ["climat"]


def test_low_confidence_routing():
    assert low_confidence(flatten(fake_response(eco=0.55))) is True
    r = flatten(fake_response(themes={"climat": 0.9}))
    r["confidence"]["position"] = 0.4
    assert low_confidence(r) is True


def test_merge_prefers_jev_unless_uncertain():
    jev = flatten(fake_response(themes={"climat": 0.9}))
    claude = {"model": "c", "values": {**jev["values"], "position": "neutre", "resume": "ok", "lexique": ["x"],
                                       "nous": "", "eux": "", "implicites": "", "confiance": "elevee"}}
    row = merge("1", jev, claude)
    assert row["final_source"] == "jev" and row["position"] == "critique_ecologie"
    assert row["resume"] == "ok" and row["accord_position"] is False and row["engine"] == "hybrid"

    uncertain = flatten(fake_response(eco=0.5, themes={"climat": 0.9}))
    row = merge("2", uncertain, None)
    assert row["needs_claude"] is True and row["final_source"] == "jev"
    row = merge("2", None, claude, existing=row)
    assert row["final_source"] == "claude" and row["position"] == "neutre" and row["needs_claude"] is False
