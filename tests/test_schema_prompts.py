import json

from presidentielle import codebook as cb
from presidentielle.prompts import SYSTEM_PROMPT, user_message
from presidentielle.schema import TweetClassification, json_schema


def test_json_schema_is_strict_and_enumerated():
    schema = json_schema()
    assert schema["additionalProperties"] is False
    assert {"parle_ecologie", "niveau", "themes", "position", "cadrage", "polarisation", "lexique", "resume"} <= set(schema["required"])
    assert "title" not in schema
    json.dumps(schema)


def test_model_validates_batch_output():
    payload = {"parle_ecologie": True, "niveau": "central", "themes": ["climat"], "position": "favorable_transition",
               "cadrage": "urgence_menace", "polarisation": "aucune", "adversaire": "aucun", "victime": "aucune",
               "acte_discursif": "constat_information", "registre": "factuel", "chiffres": False, "reactivite": True,
               "autorite": True, "nous": "", "eux": "", "lexique": ["urgence"], "implicites": "", "resume": "ok",
               "confiance": "elevee"}
    parsed = TweetClassification.model_validate_json(json.dumps(payload))
    assert parsed.themes == ["climat"]


def test_user_message_contains_context():
    msg = user_message({"candidate": "X", "party": "P", "handle": "x", "created_at": "2026-10-01", "text": "Bonjour"})
    assert "Candidat : X (P, @x)" in msg and "Bonjour" in msg


def test_system_prompt_generated_from_codebook():
    for v in cb.VARIABLES:
        assert v.key in SYSTEM_PROMPT
    for o in cb.CADRAGE.options:
        assert o.key in SYSTEM_PROMPT
    assert "{" not in SYSTEM_PROMPT  # pas de placeholder dynamique (cache stable)


def test_codebook_markdown_renders():
    md = cb.codebook_markdown()
    assert "| `cadrage` |" in md and "energie_nucleaire" in md
