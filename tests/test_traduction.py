from presidentielle import config, traduction
from presidentielle.storage import append_jsonl


def test_displayed_keeps_only_ecology_tweets_with_text():
    tweets = [{"id": "1", "text": "Climat"}, {"id": "2", "text": "Retraites"}, {"id": "3", "text": ""}]
    rows = {"1": {"parle_ecologie": True, "resume": "R", "implicites": None},
            "2": {"parle_ecologie": False}, "3": {"parle_ecologie": True}}
    items = traduction.displayed(tweets, rows)
    assert [it["id"] for it in items] == ["1"] and items[0]["resume"] == "R"


def test_todo_and_current_follow_source_changes(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "TRANSLATIONS_FILE", tmp_path / "tweets_en.jsonl")
    a = {"id": "1", "text": "Non à l'écologie punitive", "resume": "Critique", "implicites": None}
    b = {"id": "2", "text": "La planification", "resume": None, "implicites": None}
    append_jsonl(config.TRANSLATIONS_FILE, [{"id": "1", "src": traduction.source_hash(a["text"], a["resume"], None), "t": "No to punitive ecology"}])
    done = traduction.load()
    assert [it["id"] for it in traduction.todo([a, b], done)] == ["2"]
    # le résumé recodé change la source : la traduction n'est plus valide et doit être refaite
    a2 = {**a, "resume": "Critique de l'écologie punitive"}
    assert [it["id"] for it in traduction.todo([a2], done)] == ["1"]
    assert set(traduction.current({"1": a, "2": b})) == {"1"} and traduction.current({"1": a2}) == {}
