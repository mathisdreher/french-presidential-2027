import json
from datetime import datetime, timezone

from presidentielle import config, jev_client, lexique, metrics, purge
from presidentielle.storage import append_jsonl, load_json, read_jsonl, save_json

NOW = datetime(2026, 10, 20, 12, tzinfo=timezone.utc)


class FakeClient:
    def __init__(self):
        self.calls = []

    def get_tweets(self, ids):
        self.calls.append(list(ids))
        found = [{"id": i, "created_at": "2026-10-15T08:00:00.000Z",
                  "public_metrics": {"like_count": 10, "retweet_count": 2, "reply_count": 3, "quote_count": 1,
                                     "bookmark_count": 4, "impression_count": 900}} for i in ids if i != "gone"]
        return found, [i for i in ids if i == "gone"]


def _tweets(tmp_data):
    rows = [{"id": "old", "handle": "a", "created_at": "2026-10-15T08:00:00.000Z"},
            {"id": "gone", "handle": "a", "created_at": "2026-10-14T08:00:00.000Z"},
            {"id": "fresh", "handle": "a", "created_at": "2026-10-19T20:00:00.000Z"}]
    append_jsonl(config.RAW_TWEETS_FILE, rows)


def test_h48_reads_only_tweets_older_than_48h_once(tmp_data):
    _tweets(tmp_data)
    client = FakeClient()
    assert metrics.run_h48(client, now=NOW) == 1
    store = load_json(config.METRICS_FILE, {})
    assert store["old"]["h48"]["likes"] == 10 and store["old"]["h48"]["bookmarks"] == 4 and store["old"]["h48"]["age_h"] == 124
    assert store["gone"]["h48"]["absent"] and "fresh" not in store
    assert metrics.run_h48(client, now=NOW) == 0 and len(client.calls) == 1  # ni relu, ni retenté
    # la réactualisation ne touche pas la mesure de référence
    metrics.refresh(client, now=NOW)
    store = load_json(config.METRICS_FILE, {})
    assert store["old"]["maj"]["impressions"] == 900 and store["old"]["h48"]["at"] == "2026-10-20T12:00:00Z"
    assert "maj" in store["fresh"] and "maj" not in store["gone"]


def test_h48_respects_read_cap(tmp_data):
    _tweets(tmp_data)
    client = FakeClient()
    metrics.run_h48(client, now=NOW, max_reads=1)
    assert sum(len(c) for c in client.calls) == 1


def test_purge_removes_accounts_absent_from_config(tmp_data, monkeypatch):
    monkeypatch.setattr(config, "load_candidates", lambda only_enabled=True: [config.Candidate(name="A", party="P", handle="keep")])
    append_jsonl(config.RAW_TWEETS_FILE, [{"id": "1", "handle": "Keep"}, {"id": "2", "handle": "WrongProfile"}])
    append_jsonl(config.CLASSIFICATIONS_FILE, [{"id": "1"}, {"id": "2"}])
    metrics.save({"1": {"h48": {}}, "2": {"h48": {}}})
    save_json(config.USERS_STATE_FILE, {"keep": {"id": "9"}, "wrongprofile": {"id": "8"}})
    out = purge.run()
    assert out["tweets"] == 1 and out["comptes"] == ["WrongProfile"]
    assert [r["id"] for r in read_jsonl(config.RAW_TWEETS_FILE)] == ["1"]
    assert [r["id"] for r in read_jsonl(config.CLASSIFICATIONS_FILE)] == ["1"]
    assert list(json.loads(config.METRICS_FILE.read_text())) == ["1"]
    assert list(load_json(config.USERS_STATE_FILE, {})) == ["keep"]


def test_tweet_level_matches_claude_routing():
    cases = [(0.5, {}), (0.95, {"position": 0.9, "cadrage": 0.55, "niveau": 0.9}), (0.95, {"position": 0.9, "cadrage": 0.7, "niveau": 0.95}),
             (0.02, {"position": 0.1}), (0.8, {"position": 0.95, "cadrage": 0.95, "niveau": 0.95})]
    for p, conf in cases:
        res = {"probabilities": {"parle_ecologie": p}, "confidence": conf, "values": {"parle_ecologie": p >= 0.5}}
        assert (jev_client.tweet_level(res) == 0) == jev_client.low_confidence(res), (p, conf)
    assert jev_client.tweet_level({"probabilities": {"parle_ecologie": 0.95}, "confidence": {"position": 0.7, "cadrage": 0.9, "niveau": 0.9},
                                   "values": {"parle_ecologie": True}}) == 1


def test_lexique_ignores_english_single_tweets_and_own_name():
    base = [("Le logement et les passoires thermiques", "fr"), ("Rénover chaque logement, sortir des passoires", "fr"),
            ("Des logements dignes contre les passoires", "fr"), ("The energy transition and our future", "en")]
    tweets = [{"id": f"a{i}", "handle": "a", "candidate": "Jean Dupont", "created_at": "2026-10-01", "text": t + " Dupont dupont", "lang": lang}
              for i, (t, lang) in enumerate(base * 3)]
    tweets += [{"id": f"b{i}", "handle": "b", "candidate": "Marie Curie", "created_at": "2026-10-01", "lang": "fr",
                "text": "Le climat, la planète et le climat encore" if i else "Nucléaire " * 20} for i in range(12)]
    out = lexique.analyse(tweets, {t["id"] for t in tweets}, {"a": "gauche", "b": "droite"})
    words_a = [w for w, *_ in out["candidats"]["a"]]
    assert "logement" in words_a and "logements" not in words_a and "passoires" in words_a
    assert not {"the", "energy", "dupont", "and"} & set(words_a)
    assert "nucléaire" not in [w for w, *_ in out["candidats"]["b"]]  # un seul tweet, si long soit-il
    assert out["corpus"]["tweets_autre_langue"] == 3
    assert all(len(k) == 4 and k[3] >= 2 for k in out["candidats"]["a"])
