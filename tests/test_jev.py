from types import SimpleNamespace

from presidentielle import codebook as cb
from presidentielle.classify import merge
from presidentielle.jev_client import SEP, build_questions, build_state, flatten, low_confidence


def _choice(var, pick, confidence=0.9):
    probs = {k: 0.0 for k in var.option_keys} | {pick: 1.0}
    return SimpleNamespace(choice=pick, probabilities=probs, confidence=confidence)


def _score(probs, confidence=0.9):
    return SimpleNamespace(score=sum(k * v for k, v in probs.items()), probabilities=probs, confidence=confidence, legend={})


def fake_response(eco=0.9, position="critique_ecologie", multi=None, cadrage_conf=0.75):
    multi = multi or {}
    answers = {}
    for v in cb.VARIABLES:
        if v.kind == "noul":
            answers[v.key] = SimpleNamespace(noul=eco if v.key == "parle_ecologie" else 0.7)
        elif v.kind == "score":
            answers[v.key] = _score({0: 0.05, 1: 0.15, 2: 0.8})
        elif v.kind == "choice":
            pick = position if v.key == "position" else v.option_keys[0]
            answers[v.key] = _choice(v, pick, cadrage_conf if v.key == "cadrage" else 0.9)
        else:
            for o in v.option_keys:
                answers[f"{v.key}{SEP}{o}"] = SimpleNamespace(noul=multi.get(f"{v.key}.{o}", 0.02))
    return SimpleNamespace(answers=answers, model="jev-test", usage=SimpleNamespace(input_tokens=6000, output_tokens=0))


def test_questions_cover_codebook():
    q = build_questions()
    n = sum(len(v.options) if v.kind == "multi" else 1 for v in cb.VARIABLES)
    assert len(q) == n
    assert f"procedes{SEP}denegation" in q and f"retardement{SEP}whataboutisme" in q and "vision" in q


def test_state_is_structured():
    s = build_state({"candidate": "X", "party": "P", "created_at": "2026-10-01", "text": "Bonjour"})
    assert s["tweet"] == "Bonjour" and s["author"] == "X"


def test_flatten_ecology_tweet():
    r = flatten(fake_response(multi={"themes.transports_mobilite": 0.9, "themes.fiscalite_normes": 0.6, "procedes.hyperbole": 0.8,
                                     "retardement.justice_sociale": 0.7}))
    v = r["values"]
    assert v["parle_ecologie"] is True and v["niveau"] == "central" and v["niveau_score"] == 1.75
    assert v["themes"] == ["transports_mobilite", "fiscalite_normes"]
    assert v["procedes"] == ["hyperbole"] and v["retardement"] == ["justice_sociale"]
    assert v["position"] == "critique_ecologie" and v["registre"] == "alarmiste_indigne"
    assert r["probabilities"]["procedes"]["hyperbole"] == 0.8
    assert r["confidence"]["cadrage"] == 0.75
    assert low_confidence(r) is False


def test_flatten_non_ecology_forces_defaults():
    r = flatten(fake_response(eco=0.1, multi={"themes.climat": 0.8, "retardement.fatalisme": 0.9, "procedes.ironie": 0.9}))
    v = r["values"]
    assert v["parle_ecologie"] is False
    assert v["themes"] == [] and v["retardement"] == [] and v["position"] == "non_applicable" and v["vision"] == "non_applicable"
    assert v["procedes"] == ["ironie"]  # variable valable pour tous les tweets


def test_flatten_keeps_best_theme_when_none_above_threshold():
    r = flatten(fake_response(multi={"themes.climat": 0.4, "themes.eau": 0.3}))
    assert r["values"]["themes"] == ["climat"]


def test_low_confidence_routing():
    assert low_confidence(flatten(fake_response(eco=0.55))) is True
    assert low_confidence(flatten(fake_response(cadrage_conf=0.4, multi={"themes.climat": 0.9}))) is True


def test_merge_prefers_jev_unless_uncertain():
    jev = flatten(fake_response(multi={"themes.climat": 0.9}))
    claude = {"model": "c", "values": {**jev["values"], "position": "neutre", "resume": "ok", "lexique": ["x"],
                                       "nous": "", "eux": "", "implicites": "", "confiance": "elevee"}}
    row = merge("1", jev, claude)
    assert row["final_source"] == "jev" and row["position"] == "critique_ecologie"
    assert row["resume"] == "ok" and row["accord_position"] is False
    uncertain = flatten(fake_response(eco=0.5, multi={"themes.climat": 0.9}))
    row = merge("2", uncertain, None)
    assert row["needs_claude"] is True and row["final_source"] == "jev"
    row = merge("2", None, claude, existing=row)
    assert row["final_source"] == "claude" and row["position"] == "neutre" and row["needs_claude"] is False
