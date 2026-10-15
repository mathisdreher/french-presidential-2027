from collections import Counter

from presidentielle import config, games, lexique


def test_tokens_and_fold():
    assert lexique.tokens("L'écologie punitive, c'est NON ! #ZFE @x https://t.co/a") == ["écologie", "punitive", "zfe"]
    assert lexique.fold("Écologie PUNITIVE") == "ecologie punitive"


def test_keywords_keep_only_significant_overuse():
    target = Counter({"nucléaire": 30, "climat": 5, "facture": 3})
    rest = Counter({"nucléaire": 5, "climat": 200, "facture": 2, "planète": 50})
    words = [w for w, *_ in lexique.keywords(target, rest)]
    assert words[0] == "nucléaire" and "climat" not in words


def test_formules_and_specific_vocabulary():
    tweets = [{"id": str(i), "handle": h, "created_at": f"2026-09-{i + 1:02d}T00:00:00Z", "text": t} for i, (h, t) in enumerate([
        ("a", "Stop à l'écologie punitive et aux ZFE, le nucléaire nucléaire nucléaire d'abord"),
        ("a", "Le nucléaire, notre fierté, nucléaire et souveraineté"),
        ("a", "Encore le nucléaire et la facture"),
        ("b", "La planification écologique contre l'écologie punitive"),
        ("b", "Climat, climat, urgence climatique, planification"),
        ("b", "La planification, le climat et la sobriété"),
    ])]
    out = lexique.analyse(tweets, {t["id"] for t in tweets}, {"a": "droite", "b": "gauche"})
    f = {x["key"]: x for x in out["formules"]}
    assert f["ecologie_punitive"]["total"] == 2 and f["ecologie_punitive"]["premiere"]["c"] == "a"
    assert f["urgence_climatique"]["par_candidat"] == {"b": 1}
    # le vocabulaire spécifique exige un corpus suffisant : on répète les tweets
    many = [dict(t, id=f"{t['id']}-{k}") for t in tweets for k in range(5)]
    out = lexique.analyse(many, {t["id"] for t in many}, {"a": "droite", "b": "gauche"})
    assert out["candidats"]["a"][0][0] == "nucléaire"
    assert "planification" in [w for w, *_ in out["candidats"]["b"]]


def test_anonymize_removes_identity_but_keeps_discourse():
    cands = [config.Candidate(name="Jeanne Exemple", party="Parti Test", handle="jeanne_ex")]
    out = games.anonymize("Avec Jeanne Exemple et le RN, stop à l'écologie punitive ! #Exemple2027 #climat @jeanne_ex https://t.co/z", cands)
    assert "Jeanne" not in out and "Exemple" not in out and "RN" not in out and "https" not in out
    assert "écologie punitive" in out and "#climat" in out and "#…" in out and "@…" in out


def test_select_spreads_candidates():
    tweets = [{"id": f"{h}{i}", "handle": h, "created_at": f"2026-09-{i + 1:02d}", "text": "x" * 120} for h in "ab" for i in range(20)]
    rows = {t["id"]: {"parle_ecologie": True, "jev": {"probabilities": {"parle_ecologie": 0.9}}} for t in tweets}
    chosen = games.select(tweets, rows, per_candidate=5)
    assert len(chosen) == 10 and {t["handle"] for t in chosen} == {"a", "b"}
