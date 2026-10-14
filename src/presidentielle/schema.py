"""Schéma de classification (sortie structurée de Claude)."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Niveau = Literal["aucun", "secondaire", "central"]

Theme = Literal[
    "climat",                   # réchauffement, émissions, neutralité carbone, COP
    "energie_nucleaire",        # EPR, parc nucléaire, relance/sortie du nucléaire
    "energies_renouvelables",   # éolien, solaire, hydro, biogaz, hydrogène
    "prix_energie_reseau",      # facture, marché de l'électricité, réseau, stockage, flexibilité
    "sobriete_efficacite",      # rénovation thermique, sobriété, consommation
    "transports_mobilite",      # voiture électrique, ZFE, train, aviation, carburants
    "biodiversite_nature",      # faune, forêts, océans, artificialisation, ZAN
    "agriculture_alimentation", # pesticides, élevage, agroécologie, Mercosur
    "pollution_sante",          # air, plastiques, PFAS, déchets, nuisances
    "eau",                      # sécheresse, mégabassines, inondations, ressource en eau
    "industrie_verte_emploi",   # réindustrialisation verte, planification, emplois
    "fiscalite_normes",         # taxe carbone, normes européennes, "écologie punitive"
    "international_europe",     # Green Deal, accords internationaux, diplomatie climat
    "autre_ecologie",
]

Position = Literal[
    "favorable_transition",  # soutient l'action écologique ou propose des mesures
    "critique_ecologie",     # critique les politiques/normes/mouvements écologistes
    "neutre",                # constat, information, ambiguïté
    "non_applicable",        # le tweet ne parle pas d'écologie
]

Confiance = Literal["faible", "moyenne", "elevee"]


class TweetClassification(BaseModel):
    """Résultat de classification d'un tweet."""

    parle_ecologie: bool = Field(description="Vrai si le tweet aborde l'écologie, l'environnement, le climat ou l'énergie.")
    niveau: Niveau = Field(description="aucun = pas d'écologie ; secondaire = mention parmi d'autres sujets ; central = sujet principal du tweet.")
    themes: list[Theme] = Field(description="Thèmes écologiques abordés (vide si parle_ecologie est faux).")
    position: Position = Field(description="Position du candidat vis-à-vis de l'action écologique dans ce tweet.")
    resume: str = Field(description="Une phrase en français justifiant la classification.")
    confiance: Confiance = Field(description="Niveau de confiance dans la classification.")


def json_schema() -> dict:
    """Schéma JSON pour output_config.format (API Batches)."""
    schema = TweetClassification.model_json_schema()
    schema.pop("title", None)
    schema.pop("description", None)
    schema["additionalProperties"] = False
    for prop in schema.get("properties", {}).values():
        prop.pop("title", None)
    return schema
