from unittest.mock import MagicMock

from presidentielle import config, fetch


def test_fetch_is_incremental(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "RAW_DIR", tmp_path)
    monkeypatch.setattr(config, "CLASSIFIED_DIR", tmp_path)
    monkeypatch.setattr(config, "REPORTS_DIR", tmp_path)
    monkeypatch.setattr(config, "STATE_DIR", tmp_path)
    monkeypatch.setattr(config, "RAW_TWEETS_FILE", tmp_path / "tweets.jsonl")
    monkeypatch.setattr(config, "USERS_STATE_FILE", tmp_path / "users.json")
    monkeypatch.setattr(config, "SINCE_STATE_FILE", tmp_path / "since.json")

    cand = config.Candidate(name="Test", party="P", handle="test")
    client = MagicMock()
    client.get_user_by_username.return_value = {"id": "9", "username": "test", "name": "Test"}
    client.iter_user_tweets.return_value = iter([
        {"id": "20", "text": "b", "created_at": "2026-10-02T00:00:00.000Z", "public_metrics": {"like_count": 5}},
        {"id": "10", "text": "a", "created_at": "2026-10-01T00:00:00.000Z", "public_metrics": {}},
    ])
    assert fetch.fetch(client, [cand], days=7) == 2
    rows = list(fetch.read_jsonl(config.RAW_TWEETS_FILE))
    assert rows[0]["likes"] == 5 and rows[0]["url"].endswith("/20")

    # Deuxième passage : since_id transmis, user id lu depuis le cache
    client.iter_user_tweets.return_value = iter([{"id": "20", "text": "b", "created_at": "x", "public_metrics": {}}])
    assert fetch.fetch(client, [cand], days=7) == 0
    assert client.get_user_by_username.call_count == 1
    assert client.iter_user_tweets.call_args.kwargs["since_id"] == "20"
