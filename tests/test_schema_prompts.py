import json

from presidentielle.prompts import SYSTEM_PROMPT, user_message
from presidentielle.schema import TweetClassification, json_schema


def test_json_schema_is_strict_and_enumerated():
    schema = json_schema()
    assert schema["additionalProperties"] is False
    assert set(schema["required"]) == {"parle_ecologie", "niveau", "themes", "position", "resume", "confiance"}
    assert "title" not in schema
    json.dumps(schema)  # sérialisable


def test_model_validates_batch_output():
    payload = {"parle_ecologie": True, "niveau": "central", "themes": ["climat"],
               "position": "favorable_transition", "resume": "ok", "confiance": "elevee"}
    parsed = TweetClassification.model_validate_json(json.dumps(payload))
    assert parsed.themes == ["climat"]


def test_user_message_contains_context():
    msg = user_message({"candidate": "X", "party": "P", "handle": "x", "created_at": "2026-10-01", "text": "Bonjour"})
    assert "Candidat : X (P, @x)" in msg and "Bonjour" in msg


def test_system_prompt_is_stable_for_cache():
    assert "{" not in SYSTEM_PROMPT  # pas de placeholder dynamique
