import json

from presidentielle import config, validate
from presidentielle.validate import cohen_kappa, evaluate, krippendorff_alpha


def test_known_values():
    a, b = ["a", "a", "b", "b"], ["a", "b", "b", "b"]
    assert abs(krippendorff_alpha(a, b) - 0.5333333) < 1e-6
    assert abs(cohen_kappa(a, b) - 0.5) < 1e-9
    assert krippendorff_alpha(["x", "y"], ["x", "y"]) == 1.0
    assert krippendorff_alpha([], []) is None


def test_ordinal_penalises_distant_disagreements_more():
    order = ["aucun", "secondaire", "central"]
    base = ["aucun"] * 5 + ["secondaire"] * 5 + ["central"] * 5
    near = list(base); near[0] = "secondaire"
    far = list(base); far[0] = "central"
    assert krippendorff_alpha(base, near, order) > krippendorff_alpha(base, far, order)


def _vals(eco, pos="neutre", themes=(), procedes=()):
    from presidentielle import codebook as cb
    v = {"parle_ecologie": eco, "niveau": "central" if eco else "aucun", "position": pos if eco else "non_applicable",
         "cadrage": "non_applicable", "polarisation": "aucune", "adversaire": "aucun", "victime": "aucune",
         "acte_discursif": "autre", "registre": "factuel", "reactivite": False, "themes": list(themes), "procedes": list(procedes),
         "topoi": [], "legitimation": [], "retardement": [], "vision": "non_applicable", "ethos": "indetermine",
         "agentivite": "non_applicable", "modalite": "assertion"}
    assert set(v) == {x.key for x in cb.VARIABLES}
    return v


def test_evaluate_and_run(tmp_data):
    pairs = [(_vals(True, "favorable_transition", ["climat"], ["hyperbole"]), _vals(True, "favorable_transition", ["climat", "eau"], ["hyperbole"]), 0.9),
             (_vals(True, "critique_ecologie"), _vals(True, "neutre"), 0.8),
             (_vals(False), _vals(False), 0.1),
             (_vals(False), _vals(True), 0.4)]
    ev = evaluate(pairs)
    eco = next(v for v in ev["variables"] if v["variable"] == "parle_ecologie")
    assert eco["n"] == 4 and eco["accord"] == 0.75
    pos = next(v for v in ev["variables"] if v["variable"] == "position")
    assert pos["n"] == 2  # variable propre à l'écologie : seuls les tweets écologie pour les deux moteurs
    assert ev["confusions"]["position"]["matrice"]["critique_ecologie"]["neutre"] == 1
    assert ev["multi"]["themes"]["n"] == 2 and ev["multi"]["themes"]["jaccard_moyen"] == 0.5
    assert ev["multi"]["procedes"]["n"] == 4  # variable valable pour tous les tweets
    assert next(v for v in ev["variables"] if v["variable"] == "niveau")["metrique"] == "ordinale"
    assert ev["calibration_ecologie"]["n"] == 4

    rows = []
    for i, (j, c, p) in enumerate(pairs):
        rows.append({"id": str(i), "jev": {"values": j, "probabilities": {"parle_ecologie": p}, "model": "jev-1"},
                     "claude": {"values": c, "model": "claude-x"}})
    rows.append({"id": "99", "jev": {"values": _vals(False), "probabilities": {}}, "needs_claude": True})
    config.CLASSIFICATIONS_FILE.write_text("\n".join(json.dumps(r) for r in rows))
    config.VALIDATION_SAMPLE_FILE.write_text(json.dumps({"items": [{"id": "0", "strate": "aleatoire"}, {"id": "1", "strate": "ecologie"}]}))
    out = validate.run()
    assert out["double_code"]["n"] == 4
    assert out["echantillon"]["aleatoire"]["n"] == 1 and out["echantillon"]["complet"]["n"] == 2
    assert out["routage"]["incertains_en_attente"] == 1 and out["modeles"]["jev"] == ["jev-1"]
    assert (config.REPORTS_DIR / "validation.md").exists()
