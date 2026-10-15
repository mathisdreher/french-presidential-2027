import pytest

from presidentielle import config

FILES = {
    "RAW_TWEETS_FILE": "raw/tweets.jsonl", "METRICS_FILE": "raw/metrics.json", "CLASSIFICATIONS_FILE": "classified/classifications.jsonl",
    "GAMES_FILE": "games/anonymized.jsonl", "TRANSLATIONS_FILE": "translations/tweets_en.jsonl", "EXPORTS_DIR": "exports", "REPORTS_DIR": "reports",
    "VALIDATION_FILE": "reports/validation.json", "STATE_DIR": "state", "USERS_STATE_FILE": "state/users.json",
    "SINCE_STATE_FILE": "state/since_ids.json", "BATCHES_STATE_FILE": "state/batches.json",
    "VALIDATION_SAMPLE_FILE": "state/validation_sample.json",
}


@pytest.fixture
def tmp_data(tmp_path, monkeypatch):
    """Redirige tous les fichiers de données vers un dossier temporaire."""
    monkeypatch.setattr(config, "DATA_DIR", tmp_path)
    for name, rel in FILES.items():
        monkeypatch.setattr(config, name, tmp_path / rel)
    config.ensure_dirs()
    (tmp_path / "state").mkdir(exist_ok=True)
    return tmp_path
