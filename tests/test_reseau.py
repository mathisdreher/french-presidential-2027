from presidentielle import config, reseau


def cands():
    return [
        config.Candidate(name="Marine Le Pen", party="RN", handle="MLP_officiel"),
        config.Candidate(name="Édouard Philippe", party="Horizons", handle="EPhilippe_LH", noms=["Édouard Philippe"]),
        config.Candidate(name="Dominique de Villepin", party="", handle="Villepin"),
        config.Candidate(name="Jean-Luc Mélenchon", party="LFI", handle="JLMelenchon"),
    ]


def test_surname():
    assert reseau.surname("Marine Le Pen") == "Le Pen"
    assert reseau.surname("Dominique de Villepin") == "Villepin"
    assert reseau.surname("Jean-Luc Mélenchon") == "Mélenchon"


def test_named_by_handle_name_and_accents():
    named = reseau.matcher(cands())
    assert named("Merci @MLP_officiel !", "jlmelenchon") == [0]
    assert named("La politique de M. Melenchon et de Le Pen", "villepin") == [0, 3]
    assert named("Edouard PHILIPPE a raison", "mlp_officiel") == [1]


def test_named_ignores_self_ambiguous_and_partial_words():
    named = reseau.matcher(cands())
    assert named("Moi, Jean-Luc Mélenchon, je dis", "jlmelenchon") == []
    assert named("Philippe Martinez et le prince Philippe", "mlp_officiel") == []   # patronyme ambigu non retenu
    assert named("Les villepinistes et @Villepin2", "mlp_officiel") == []
