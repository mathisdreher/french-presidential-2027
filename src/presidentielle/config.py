"""Chargement de la configuration : candidats, chemins, variables d'environnement."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

import yaml
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "data"
RAW_DIR = DATA_DIR / "raw"
CLASSIFIED_DIR = DATA_DIR / "classified"
REPORTS_DIR = DATA_DIR / "reports"
STATE_DIR = DATA_DIR / "state"
CANDIDATES_FILE = ROOT / "config" / "candidates.yaml"
STUDY_FILE = ROOT / "config" / "study.yaml"
SITE_SRC_DIR = ROOT / "site"

RAW_TWEETS_FILE = RAW_DIR / "tweets.jsonl"
CLASSIFICATIONS_FILE = CLASSIFIED_DIR / "classifications.jsonl"
USERS_STATE_FILE = STATE_DIR / "users.json"
SINCE_STATE_FILE = STATE_DIR / "since_ids.json"
BATCHES_STATE_FILE = STATE_DIR / "batches.json"
VALIDATION_SAMPLE_FILE = STATE_DIR / "validation_sample.json"
VALIDATION_FILE = REPORTS_DIR / "validation.json"

DEFAULT_MODEL = "claude-opus-5-5"


@dataclass
class Candidate:
    name: str
    party: str
    handle: str
    status: str = "declare"
    bloc: str = ""
    enabled: bool = True
    extra: dict = field(default_factory=dict)

    @property
    def slug(self) -> str:
        return self.handle.lower()


def load_env() -> None:
    """Charge .env depuis la racine du projet (sans écraser l'environnement existant)."""
    load_dotenv(ROOT / ".env", override=False)


def load_candidates(path: Path = CANDIDATES_FILE, only_enabled: bool = True) -> list[Candidate]:
    with open(path, encoding="utf-8") as f:
        raw = yaml.safe_load(f) or {}
    out: list[Candidate] = []
    for item in raw.get("candidates", []):
        cand = Candidate(
            name=item["name"],
            party=item.get("party", ""),
            handle=item["handle"].lstrip("@"),
            status=item.get("status", "declare"),
            bloc=item.get("bloc", ""),
            enabled=bool(item.get("enabled", True)),
        )
        if only_enabled and not cand.enabled:
            continue
        out.append(cand)
    return out


def load_study(path: Path = STUDY_FILE) -> dict:
    """Paramètres de l'étude (date de début, phases, événements, blocs)."""
    with open(path, encoding="utf-8") as f:
        study = yaml.safe_load(f) or {}
    for key in ("start",):
        if key in study:
            study[key] = str(study[key])
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
        raise SystemExit("X_BEARER_TOKEN manquant : renseignez-le dans .env (voir .env.example).")
    return token


def claude_model() -> str:
    load_env()
    return os.environ.get("CLAUDE_MODEL", DEFAULT_MODEL).strip() or DEFAULT_MODEL


def ensure_dirs() -> None:
    for d in (RAW_DIR, CLASSIFIED_DIR, REPORTS_DIR, STATE_DIR):
        d.mkdir(parents=True, exist_ok=True)
