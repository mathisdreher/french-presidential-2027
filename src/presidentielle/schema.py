"""Schéma de sortie de Claude, construit depuis le livre de codes.

Mêmes variables que Jev, pour mesurer l'accord, plus les champs de sémantique locale que seul
un modèle de langage produit (lexique, implicites, désignations du « nous » et du « eux »).
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, create_model

from . import codebook as cb


def _field(var: cb.Variable):
    if var.kind == "noul":
        return (bool, Field(description=var.instructions))
    keys = Literal[var.option_keys]  # type: ignore[valid-type]
    # Les définitions détaillées sont dans le prompt système : le schéma reste court.
    if var.kind == "multi":
        return (list[keys], Field(description=var.label + " : every value that applies, empty list if none."))
    return (keys, Field(description=var.label))


_fields = {v.key: _field(v) for v in cb.VARIABLES}
_fields.update({
    "nous": (str, Field(description=cb.TEXT_FIELDS["nous"])),
    "eux": (str, Field(description=cb.TEXT_FIELDS["eux"])),
    "lexique": (list[str], Field(description=cb.TEXT_FIELDS["lexique"])),
    "implicites": (str, Field(description=cb.TEXT_FIELDS["implicites"])),
    "resume": (str, Field(description=cb.TEXT_FIELDS["resume"])),
    "confiance": (Literal["faible", "moyenne", "elevee"], Field(description=cb.TEXT_FIELDS["confiance"])),
})
TweetClassification: type[BaseModel] = create_model("TweetClassification", **_fields)


def json_schema(model: type[BaseModel] = TweetClassification) -> dict:
    """Schéma JSON strict pour output_config.format (API Batches)."""
    schema = model.model_json_schema()
    schema.pop("title", None)
    schema["additionalProperties"] = False
    for prop in schema.get("properties", {}).values():
        prop.pop("title", None)
    return schema
