from datetime import datetime, timezone
from unittest.mock import MagicMock

import pytest

from presidentielle.x_client import XApiError, XClient, full_text


def _resp(status, json=None, headers=None, text=""):
    r = MagicMock()
    r.status_code = status
    r.json.return_value = json or {}
    r.headers = headers or {}
    r.text = text
    return r


def make_client(responses):
    session = MagicMock()
    session.headers = {}
    session.get.side_effect = responses
    sleeps = []
    client = XClient("token", session=session, sleep=sleeps.append)
    return client, session, sleeps


def test_pagination_follows_next_token():
    client, session, _ = make_client([
        _resp(200, {"data": [{"id": "3"}, {"id": "2"}], "meta": {"next_token": "abc"}}),
        _resp(200, {"data": [{"id": "1"}], "meta": {}}),
    ])
    tweets = list(client.iter_user_tweets("42", start_time=datetime(2026, 10, 1, tzinfo=timezone.utc)))
    assert [t["id"] for t in tweets] == ["3", "2", "1"]
    first_params = session.get.call_args_list[0].kwargs["params"]
    assert first_params["exclude"] == "replies,retweets"
    assert first_params["start_time"] == "2026-10-01T00:00:00Z"
    assert "pagination_token" not in first_params
    assert session.get.call_args_list[1].kwargs["params"]["pagination_token"] == "abc"


def test_max_pages_stops_early():
    client, session, _ = make_client([
        _resp(200, {"data": [{"id": "3"}], "meta": {"next_token": "abc"}}),
    ])
    tweets = list(client.iter_user_tweets("42", max_pages=1))
    assert len(tweets) == 1
    assert session.get.call_count == 1


def test_rate_limit_waits_until_reset():
    import time
    reset = int(time.time()) + 30
    client, _, sleeps = make_client([
        _resp(429, headers={"x-rate-limit-reset": str(reset)}),
        _resp(200, {"data": {"id": "7", "username": "x", "name": "X"}}),
    ])
    user = client.get_user_by_username("@x")
    assert user["id"] == "7"
    assert len(sleeps) == 1 and 25 <= sleeps[0] <= 35


def test_unknown_user_raises():
    client, _, _ = make_client([_resp(200, {"errors": [{"detail": "Could not find user"}]})])
    with pytest.raises(XApiError):
        client.get_user_by_username("nobody")


def test_full_text_prefers_note_tweet():
    assert full_text({"text": "court…", "note_tweet": {"text": "version longue"}}) == "version longue"
    assert full_text({"text": "court"}) == "court"
