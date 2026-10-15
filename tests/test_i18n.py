"""Version anglaise : livre de codes traduit en entier, et textes d'interface cohérents entre app.js et i18n.js."""

import re
from pathlib import Path

from presidentielle import codebook as cb
from presidentielle import codebook_en as en
from presidentielle import config

SITE = Path(__file__).resolve().parents[1] / "site"


def test_codebook_fully_translated():
    for v in cb.VARIABLES:
        assert en.VARIABLES.get(v.key), v.key
        missing = set(v.option_keys) - set(en.OPTIONS.get(v.key, {}))
        assert not missing, (v.key, missing)
    for f in (*cb.FRAMEWORKS, *cb.ENGINES):
        assert len(en.FRAMEWORKS[f.key]) == 4 and all(en.FRAMEWORKS[f.key]), f.key


def test_config_has_english_labels():
    study = config.load_study()
    for key in ("phases", "events", "blocs"):
        assert all(x.get("label_en") for x in study[key]), key
    assert all(q.get("titre_en") and q.get("texte_en") for q in study["questions"])


def _dictionaries():
    src = (SITE / "i18n.js").read_text(encoding="utf-8")
    fr, en_part = src.split("\n  en: {", 1)
    keys = lambda block: set(re.findall(r"^\s{4}([a-z0-9_]+):", block, flags=re.M))
    return keys(fr), keys(en_part)


def test_interface_keys():
    fr, en_keys = _dictionaries()
    assert fr == en_keys, ("clés présentes dans une seule langue", sorted(fr ^ en_keys))
    app = (SITE / "app.js").read_text(encoding="utf-8")
    used = set(re.findall(r'\bt\("([a-z0-9_]+)"\s*[,)]', app))  # clés littérales, hors préfixes concaténés
    plural = set(re.findall(r'\btn\("([a-z0-9_]+)"', app))
    assert not used - fr, sorted(used - fr)
    assert not {f"{k}_{n}" for k in plural for n in ("one", "other")} - fr
    # Toute clé du dictionnaire doit servir : littéral dans app.js, ou clé construite (onglets, jeux, sections…)
    dynamic = re.compile(r"^(tab_|account_|limit_\d|step\d_[tp]|conf_(faible|moyenne|elevee)$|g_(qui|agent|situer)(_text|_level)?$"
                         r"|m_(questions|corpus|moteurs|fiabilite|confiance|comptes|limites|codebook|credits)$|net_(desc|note)_(formules|themes|proximite|mentions)$)")
    unused = [k for k in fr if not dynamic.match(k) and f'"{re.sub(r"_(one|other)$", "", k)}"' not in app]
    assert not unused, sorted(unused)
