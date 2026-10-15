"""Schéma de classification Claude (sortie structurée), aligné sur le codebook.

Claude joue le rôle de « System Two » : mêmes variables catégorielles que Jev (pour
mesurer l'accord inter-moteurs) plus les champs textuels que Jev ne produit pas
(résumé, lexique marqué, implicites, désignation Nous/Eux).
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from . import codebook as cb

Niveau = Literal["aucun", "secondaire", "central"]
Theme = Literal[
    "climat", "energie_nucleaire", "energies_renouvelables", "prix_energie_reseau",
    "sobriete_efficacite", "transports_mobilite", "biodiversite_nature", "agriculture_alimentation",
    "pollution_sante", "eau", "industrie_verte_emploi", "fiscalite_normes", "international_europe",
    "autre_ecologie",
]
Position = Literal["favorable_transition", "critique_ecologie", "neutre", "non_applicable"]
Cadrage = Literal[
    "urgence_menace", "opportunite_economique", "contrainte_punitive", "souverainete",
    "justice_sociale", "science_rationalite", "identite_terroir", "sante", "non_applicable",
]
Polarisation = Literal["autopresentation_positive", "presentation_negative_autrui", "les_deux", "aucune"]
Adversaire = Literal[
    "gouvernement_executif", "union_europeenne", "ecologistes_gauche", "droite_extreme_droite",
    "lobbies_industries", "elites_technocrates_medias", "puissances_etrangeres", "autre_candidat", "aucun",
]
Victime = Literal[
    "menages_modestes", "agriculteurs_ruraux", "entreprises_industrie", "planete_generations_futures",
    "francais_en_general", "aucune",
]
Acte = Literal["promesse_proposition", "critique_attaque", "constat_information", "appel_mobilisation", "autre"]
Registre = Literal["factuel", "engage", "alarmiste_indigne"]
Confiance = Literal["faible", "moyenne", "elevee"]

# Garde-fou : les Literal ci-dessus doivent rester alignés sur le codebook
assert set(Theme.__args__) == set(cb.THEME_KEYS)
assert set(Cadrage.__args__) == set(cb.CADRAGE.option_keys)
assert set(Polarisation.__args__) == set(cb.POLARISATION.option_keys)
assert set(Adversaire.__args__) == set(cb.ADVERSAIRE.option_keys)
assert set(Victime.__args__) == set(cb.VICTIME.option_keys)
assert set(Acte.__args__) == set(cb.ACTE.option_keys)
assert set(Registre.__args__) == set(cb.REGISTRE.level_keys)


class TweetClassification(BaseModel):
    """Résultat de classification d'un tweet (Claude)."""

    parle_ecologie: bool = Field(description="True if the tweet addresses ecology, environment, climate or energy, including to criticise them.")
    niveau: Niveau = Field(description="aucun = no ecology; secondaire = mentioned among other topics; central = main subject.")
    themes: list[Theme] = Field(description="1 to 3 ecological themes (empty if parle_ecologie is false).")
    position: Position = Field(description="Stance toward ecological action.")
    cadrage: Cadrage = Field(description="Dominant frame (non_applicable if no ecology).")
    polarisation: Polarisation = Field(description="Ideological square: positive self-presentation and/or negative other-presentation.")
    adversaire: Adversaire = Field(description="Who is cast as the opponent or culprit.")
    victime: Victime = Field(description="Who is presented as suffering or needing protection.")
    acte_discursif: Acte = Field(description="Dominant speech act.")
    registre: Registre = Field(description="Emotional register.")
    chiffres: bool = Field(description="Uses numbers, statistics or amounts as arguments.")
    reactivite: bool = Field(description="Reacts to a specific current event.")
    autorite: bool = Field(description="Invokes an authority (science, report, experts, institution).")
    nous: str = Field(description="Who 'we' designates in the tweet (empty string if no 'we' group).")
    eux: str = Field(description="Who 'they' designates in the tweet (empty string if no out-group).")
    lexique: list[str] = Field(description="Up to 5 marked words or phrases quoted verbatim from the tweet (loaded, metaphorical, euphemistic or hyperbolic terms).")
    implicites: str = Field(description="One French sentence stating the presupposition or implication the tweet relies on (empty if none).")
    resume: str = Field(description="One French sentence justifying the classification.")
    confiance: Confiance = Field(description="Confidence in the classification.")


def json_schema() -> dict:
    """Schéma JSON pour output_config.format (API Batches)."""
    schema = TweetClassification.model_json_schema()
    schema.pop("title", None)
    schema.pop("description", None)
    schema["additionalProperties"] = False
    for prop in schema.get("properties", {}).values():
        prop.pop("title", None)
    return schema
