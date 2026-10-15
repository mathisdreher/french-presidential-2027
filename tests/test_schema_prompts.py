import json

from presidentielle import codebook as cb
from presidentielle.prompts import SYSTEM_PROMPT, user_message
from presidentielle.schema import TweetClassification, json_schema


def _payload():
    out = {}
    for v in cb.VARIABLES:
        out[v.key] = {"noul": True, "choice": v.option_keys[0] if v.options else None, "score": v.option_keys[-1] if v.options else None,
                      "multi": [v.option_keys[0]] if v.options else []}[v.kind]
    out.update(nous="", eux="", lexique=["mot"], implicites="", resume="ok", confiance="elevee")
    return out


def test_json_schema_is_strict_and_complete():
    schema = json_schema()
    assert schema["additionalProperties"] is False
    assert set(schema["required"]) == {v.key for v in cb.VARIABLES} | set(cb.TEXT_FIELDS)
    assert schema["properties"]["procedes"]["type"] == "array"
    json.dumps(schema)


def test_model_validates_and_rejects_unknown_values():
    parsed = TweetClassification.model_validate_json(json.dumps(_payload()))
    assert parsed.procedes == ["denegation"]
    bad = _payload() | {"vision": "inconnue"}
    try:
        TweetClassification.model_validate_json(json.dumps(bad))
    except Exception:
        return
    raise AssertionError("une valeur hors livre de codes doit être refusée")


def test_prompt_generated_from_codebook():
    for v in cb.VARIABLES:
        assert v.key in SYSTEM_PROMPT
    for o in cb.RETARDEMENT.options + cb.VISION.options:
        assert o.key in SYSTEM_PROMPT
    assert "{" not in SYSTEM_PROMPT  # pas de gabarit non rempli, cache stable


def test_user_message():
    msg = user_message({"candidate": "X", "party": "P", "handle": "x", "created_at": "2026-10-01", "text": "Bonjour"})
    assert "Candidat : X (P, @x)" in msg and "Bonjour" in msg


def test_every_framework_is_sourced_and_every_category_explained():
    for fw in cb.FRAMEWORKS + cb.ENGINES:
        assert fw.refs and fw.resume and fw.dans_l_etude
    for v in cb.VARIABLES:
        if v.framework in ("procedes", "topoi", "legitimation", "retardement", "visions", "ethos", "grammaire"):
            assert all(o.fr for o in v.options if o.key not in ("non_applicable", "indetermine"))
