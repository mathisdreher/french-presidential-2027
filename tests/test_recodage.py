from presidentielle import classify, codebook as cb, config
from presidentielle.jev_client import coherent
from presidentielle.storage import append_jsonl


def test_coherent_replaces_non_applicable_stance_on_ecology_tweets():
    v = {"parle_ecologie": True, "position": "non_applicable"}
    assert coherent(v, {"position": {"non_applicable": 0.5, "neutre": 0.3, "critique_ecologie": 0.2}})
    assert v["position"] == "neutre"
    off = {"parle_ecologie": False, "position": "non_applicable"}
    assert not coherent(off, {}) and off["position"] == "non_applicable"


def _jev(eco, version=1, position="non_applicable"):
    values = {k: None for k in classify.CATEGORICAL}
    values.update({"parle_ecologie": eco, "position": position})
    out = {"values": values, "probabilities": {"parle_ecologie": 0.95 if eco else 0.05, "position": {"non_applicable": 0.6, "favorable_transition": 0.4}},
           "confidence": {"position": 0.9, "cadrage": 0.9, "niveau": 0.9}}
    if version > 1:
        out["codebook"] = version
    return out


def test_recoding_targets_and_reconcile(tmp_data):
    append_jsonl(config.RAW_TWEETS_FILE, [{"id": i, "handle": "x", "text": "t"} for i in ("1", "2", "3")])
    rows = [classify.merge("1", _jev(True), None), classify.merge("2", _jev(False), None),
            classify.merge("3", _jev(True, cb.CODEBOOK_VERSION, "favorable_transition"), None)]
    rows[0]["claude"] = {"values": {"parle_ecologie": True, "position": "favorable_transition"}}            # codé par Claude avant la version actuelle
    append_jsonl(config.CLASSIFICATIONS_FILE, rows)
    # Jev : seul le tweet écologie à l'ancienne version est à recoder ; Claude « recodage » : idem
    assert [t["id"] for t in classify.pending_tweets("jev")] == ["1"]
    assert [t["id"] for t in classify.claude_targets("recodage")] == ["1"]
    # la règle de cohérence est réappliquée aux codages stockés, sans appel aux modèles
    assert classify.reconcile() >= 1
    fixed = classify.load_rows()
    assert fixed["1"]["position"] == "favorable_transition" and fixed["2"]["echelle"] == "non_applicable"
