import pytest

from presidentielle import config


@pytest.fixture
def tmp_data(tmp_path, monkeypatch):
    """Redirige tous les fichiers de données vers un dossier temporaire."""
    for name, value in {
        "RAW_DIR": tmp_path, "CLASSIFIED_DIR": tmp_path, "REPORTS_DIR": tmp_path / "reports", "STATE_DIR": tmp_path,
        "RAW_TWEETS_FILE": tmp_path / "tweets.jsonl", "CLASSIFICATIONS_FILE": tmp_path / "cls.jsonl",
        "USERS_STATE_FILE": tmp_path / "users.json", "SINCE_STATE_FILE": tmp_path / "since.json",
        "BATCHES_STATE_FILE": tmp_path / "batches.json", "VALIDATION_SAMPLE_FILE": tmp_path / "sample.json",
        "VALIDATION_FILE": tmp_path / "reports" / "validation.json",
    }.items():
        monkeypatch.setattr(config, name, value)
    return tmp_path
