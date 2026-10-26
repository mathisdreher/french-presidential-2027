"""Configuration : chemins, candidats, paramètres de l'étude, clés d'API.

Les données vivent hors du dépôt public, dans un dépôt privé cloné dans `data/`
(ou dans le dossier indiqué par la variable d'environnement DATA_DIR).
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import yaml
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
CONFIG_DIR = ROOT / "config"
CANDIDATES_FILE = CONFIG_DIR / "candidates.yaml"
STUDY_FILE = CONFIG_DIR / "study.yaml"
FORMULES_FILE = CONFIG_DIR / "formules.yaml"
PHOTOS_FILE = CONFIG_DIR / "photos.json"
SITE_SRC_DIR = ROOT / "site"

DATA_DIR = Path(os.environ.get("DATA_DIR") or ROOT / "data")
RAW_TWEETS_FILE = DATA_DIR / "raw" / "tweets.jsonl"
METRICS_FILE = DATA_DIR / "raw" / "metrics.json"          # mesures d'engagement à 48 h et réactualisations
CLASSIFICATIONS_FILE = DATA_DIR / "classified" / "classifications.jsonl"
GAMES_FILE = DATA_DIR / "games" / "anonymized.jsonl"
TRANSLATIONS_FILE = DATA_DIR / "translations" / "tweets_en.jsonl"  # traductions anglaises des tweets affichés
EXPORTS_DIR = DATA_DIR / "exports"
REPORTS_DIR = DATA_DIR / "reports"
VALIDATION_FILE = REPORTS_DIR / "validation.json"
STATE_DIR = DATA_DIR / "state"
USERS_STATE_FILE = STATE_DIR / "users.json"
SINCE_STATE_FILE = STATE_DIR / "since_ids.json"
BATCHES_STATE_FILE = STATE_DIR / "batches.json"
VALIDATION_SAMPLE_FILE = STATE_DIR / "validation_sample.json"

DEFAULT_MODEL = "claude-opus-5-5"


@dataclass
class Candidate:
    name: str
    party: str
    handle: Optional[str]          # None : pas de compte X connu
    status: str = "declare"
    bloc: str = ""
    enabled: bool = True
    wikipedia: str = ""            # titre de la page Wikipédia (photo), par défaut le nom
    note: str = ""                 # signalement affiché sur le site
    party_en: str = ""             # version anglaise du site, si le nom du parti se traduit
    note_en: str = ""
    cadrage: Optional[list] = None   # [x, y, zoom] du visage dans la photo, pour les portraits ronds
    noms: Optional[list] = None      # façons de le nommer dans un tweet (réseau « qui nomme qui ») ; défaut : nom et patronyme
    photo: str = ""                 # fichier Wikimedia Commons imposé, quand l'image de la page Wikipédia ne convient pas

    @property
    def slug(self) -> str:
        if self.handle:
            return self.handle.lower()
        return "".join(c for c in self.name.lower() if c.isalnum())


def load_env() -> None:
    """Charge .env depuis la racine du projet, sans écraser l'environnement existant."""
    load_dotenv(ROOT / ".env", override=False)


def load_candidates(path: Path = CANDIDATES_FILE, only_enabled: bool = True) -> list[Candidate]:
    with open(path, encoding="utf-8") as f:
        raw = yaml.safe_load(f) or {}
    out: list[Candidate] = []
    for item in raw.get("candidates", []):
        handle = item.get("handle")
        cand = Candidate(
            name=item["name"],
            party=item.get("party", ""),
            handle=str(handle).lstrip("@") if handle else None,
            status=item.get("status", "declare"),
            bloc=item.get("bloc", ""),
            enabled=bool(item.get("enabled", True)),
            wikipedia=item.get("wikipedia", "") or item["name"],
            note=item.get("note", ""),
            party_en=item.get("party_en", ""),
            note_en=item.get("note_en", ""),
            cadrage=item.get("cadrage"),
            noms=item.get("noms"),
            photo=item.get("photo", ""),
        )
        if only_enabled and not cand.enabled:
            continue
        out.append(cand)
    return out


def load_study(path: Path = STUDY_FILE) -> dict:
    """Paramètres de l'étude : date de début, phases, événements, familles politiques."""
    with open(path, encoding="utf-8") as f:
        study = yaml.safe_load(f) or {}
    if "start" in study:
        study["start"] = str(study["start"])
    for item in study.get("phases", []) + study.get("events", []):
        for key in ("start", "end", "date"):
            if key in item:
                item[key] = str(item[key])
    return study


def study_start() -> datetime:
    return datetime.fromisoformat(load_study()["start"]).replace(tzinfo=timezone.utc)


def x_bearer_token() -> str:
    load_env()
    token = os.environ.get("X_BEARER_TOKEN", "").strip()
    if not token:
        raise SystemExit("X_BEARER_TOKEN manquant : renseignez-le dans .env ou dans les secrets GitHub.")
    return token


def claude_model() -> str:
    load_env()
    return os.environ.get("CLAUDE_MODEL", DEFAULT_MODEL).strip() or DEFAULT_MODEL


def ensure_dirs() -> None:
    for p in (RAW_TWEETS_FILE, CLASSIFICATIONS_FILE, GAMES_FILE, TRANSLATIONS_FILE, VALIDATION_FILE, USERS_STATE_FILE):
        p.parent.mkdir(parents=True, exist_ok=True)
    EXPORTS_DIR.mkdir(parents=True, exist_ok=True)


def anthropic_client(**kwargs):
    """Client Claude. Une clé non rattachée à un espace de travail exige ANTHROPIC_WORKSPACE_ID."""
    import anthropic

    workspace = os.environ.get("ANTHROPIC_WORKSPACE_ID", "").strip()
    if workspace:
        kwargs["default_headers"] = {**kwargs.get("default_headers", {}), "anthropic-workspace-id": workspace}
    return anthropic.Anthropic(**kwargs)
