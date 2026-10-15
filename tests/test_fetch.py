from unittest.mock import MagicMock

from presidentielle import config, fetch
from presidentielle.x_client import XApiError


def _tweet(i, likes=0):
    return {"id": str(i), "text": f"t{i}", "created_at": "2026-10-01T00:00:00.000Z", "public_metrics": {"like_count": likes}}


def _client():
    client = MagicMock()
    client.get_user_by_username.return_value = {"id": "9", "username": "test", "name": "Test"}
    return client


CAND = config.Candidate(name="Test", party="P", handle="test")


def test_first_run_backfills_with_full_archive_then_incremental(tmp_data):
    client = _client()
    client.iter_search_all.return_value = iter([_tweet(20, likes=5), _tweet(10)])
    assert fetch.fetch(client, [CAND]) == 2
    query = client.iter_search_all.call_args.args[0]
    assert query == "from:test -is:retweet -is:reply"
    assert client.iter_search_all.call_args.kwargs["start_time"] == config.study_start()
    rows = list(fetch.read_jsonl(config.RAW_TWEETS_FILE))
    assert rows[0]["likes"] == 5 and rows[0]["url"].endswith("/20")

    # Deuxième passage : timeline depuis le dernier tweet vu, sans date de début
    client.iter_user_tweets.return_value = iter([_tweet(30), _tweet(20)])
    assert fetch.fetch(client, [CAND]) == 1
    assert client.iter_search_all.call_count == 1
    kwargs = client.iter_user_tweets.call_args.kwargs
    assert kwargs["since_id"] == "20" and kwargs["start_time"] is None
    assert client.get_user_by_username.call_count == 1
    assert fetch.load_json(config.SINCE_STATE_FILE, {})["test"] == "30"


def test_falls_back_to_timeline_when_search_forbidden(tmp_data):
    client = _client()
    client.iter_search_all.side_effect = XApiError("HTTP 403", 403)
    client.iter_user_tweets.return_value = iter([_tweet(5)])
    assert fetch.fetch(client, [CAND, config.Candidate(name="B", party="P", handle="b")]) == 1
    # la recherche n'est plus retentée pour le second compte
    assert client.iter_search_all.call_count == 1
    assert client.iter_user_tweets.call_args.kwargs["start_time"] == config.study_start()


def test_interrupted_collection_does_not_advance_cursor(tmp_data):
    client = _client()

    def broken(*a, **k):
        yield _tweet(50)
        raise XApiError("HTTP 503", 503)

    client.iter_search_all.side_effect = broken
    assert fetch.fetch(client, [CAND]) == 1
    assert "test" not in fetch.load_json(config.SINCE_STATE_FILE, {})
    # le passage suivant relance le rattrapage ; le doublon est ignoré
    client.iter_search_all.side_effect = None
    client.iter_search_all.return_value = iter([_tweet(50), _tweet(40)])
    assert fetch.fetch(client, [CAND]) == 1
    assert fetch.load_json(config.SINCE_STATE_FILE, {})["test"] == "50"


def test_unknown_account_is_flagged_not_fatal(tmp_data):
    client = _client()
    client.get_user_by_username.side_effect = [XApiError("introuvable", 404), {"id": "9", "username": "b", "name": "B", "protected": False,
                                                                               "profile_image_url": "https://pbs.twimg.com/x_normal.jpg"}]
    client.iter_search_all.return_value = iter([_tweet(1)])
    n = fetch.fetch(client, [config.Candidate(name="A", party="P", handle="a"), config.Candidate(name="B", party="P", handle="b"),
                             config.Candidate(name="Sans", party="P", handle=None)])
    users = fetch.load_json(config.USERS_STATE_FILE, {})
    assert n == 1 and users["a"]["status"] == "introuvable" and users["b"]["status"] == "ok"
    assert users["b"]["image"].endswith("x_400x400.jpg")
    assert client.get_user_by_username.call_count == 2  # le compte sans handle n'est pas interrogé
