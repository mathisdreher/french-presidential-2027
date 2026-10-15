import json

from presidentielle import classify, config


def _setup(tmp_data):
    tweets, rows = [], []
    for i in range(40):
        cand = f"c{i % 4}"
        tweets.append({"id": str(i), "candidate": cand, "party": "P", "handle": cand, "created_at": "2026-10-01", "text": "x"})
        eco = i % 5 == 0
        row = {"id": str(i), "jev": {"values": {"parle_ecologie": eco}}, "needs_claude": i % 7 == 0}
        if i == 0:
            row["claude"] = {"values": {}}
            row["needs_claude"] = False
        rows.append(row)
    rows.append({"id": "nojev"})  # sans codage Jev
    tweets.append({"id": "nojev", "candidate": "c0", "party": "P", "handle": "c0", "created_at": "2026-10-01", "text": "x"})
    config.RAW_TWEETS_FILE.write_text("\n".join(json.dumps(t) for t in tweets))
    config.CLASSIFICATIONS_FILE.write_text("\n".join(json.dumps(r) for r in rows))


def ids(tweets):
    return {t["id"] for t in tweets}


def test_scopes(tmp_data):
    _setup(tmp_data)
    eco = {str(i) for i in range(40) if i % 5 == 0} - {"0"}
    unsure = {str(i) for i in range(40) if i % 7 == 0} - {"0"}
    assert ids(classify.claude_targets("incertains")) == unsure
    assert ids(classify.claude_targets("ecologie_et_incertains")) == eco | unsure
    assert len(classify.claude_targets("tous")) == 40  # 41 tweets, dont un déjà codé par Claude
    assert ids(classify.pending_tweets("jev")) == {"nojev"}
    assert len(classify.claude_targets("tous", limit=3)) == 3
    assert ids(classify.claude_targets("tous", candidate="c1")) == {str(i) for i in range(40) if i % 4 == 1}


def test_validation_sample_is_stratified_and_persistent(tmp_data):
    _setup(tmp_data)
    first = classify.ensure_validation_sample(16)
    state = json.loads(config.VALIDATION_SAMPLE_FILE.read_text())
    assert len(first) == 16 and len(set(first)) == 16
    alea = [it["id"] for it in state["items"] if it["strate"] == "aleatoire"]
    assert len(alea) == 12
    per_cand = {f"c{k}": sum(1 for i in alea if int(i) % 4 == k) for k in range(4)}
    assert set(per_cand.values()) == {3}  # allocation égale
    assert all(int(it["id"]) % 5 == 0 for it in state["items"] if it["strate"] == "ecologie")
    assert classify.ensure_validation_sample(10) == first  # jamais réduit
    bigger = classify.ensure_validation_sample(24)
    assert bigger[:16] == first and len(set(bigger)) == 24
    targets = ids(classify.claude_targets("echantillon", sample_size=24))
    assert targets == set(bigger) - {"0"}
