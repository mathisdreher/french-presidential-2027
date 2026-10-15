"""Client minimal pour l'API X v2 (lecture des timelines utilisateur).

Endpoints utilisés :
  GET /2/users/by/username/{username}   -> résolution handle -> user id
  GET /2/users/{id}/tweets              -> timeline, collecte quotidienne (3 200 posts max)
  GET /2/tweets/search/all              -> recherche full-archive, rattrapage historique
                                           sans plafond (500 posts par page, 1 requête/s)
  GET /2/tweets?ids=…                   -> relecture des métriques (100 posts par requête)

Authentification : jeton Bearer (app-only). Facturation à l'usage (pay-per-use).
"""

from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from typing import Iterator, Optional

import requests

log = logging.getLogger(__name__)

API_BASE = "https://api.x.com/2"
TWEET_FIELDS = "id,text,created_at,lang,public_metrics,entities,referenced_tweets,note_tweet,conversation_id"
MAX_RESULTS = 100
SEARCH_MAX_RESULTS = 500
SEARCH_MIN_INTERVAL = 1.1  # secondes entre deux requêtes full-archive


class XApiError(RuntimeError):
    def __init__(self, message: str, status: Optional[int] = None):
        super().__init__(message)
        self.status = status


class XClient:
    def __init__(self, bearer_token: str, session: Optional[requests.Session] = None,
                 max_wait_on_rate_limit: int = 16 * 60, sleep=time.sleep):
        self.session = session or requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {bearer_token}",
            "User-Agent": "presidentielle2027-ecologie/0.1",
        })
        self.max_wait = max_wait_on_rate_limit
        self._sleep = sleep

    # ------------------------------------------------------------------ HTTP
    def _get(self, path: str, params: dict) -> dict:
        url = f"{API_BASE}{path}"
        for attempt in range(6):
            resp = self.session.get(url, params=params, timeout=30)
            if resp.status_code == 429:
                reset = resp.headers.get("x-rate-limit-reset")
                wait = 60
                if reset:
                    wait = max(5, int(reset) - int(time.time()) + 2)
                if wait > self.max_wait:
                    raise XApiError(f"Quota X épuisé, réinitialisation dans {wait}s (> {self.max_wait}s).", 429)
                log.warning("Rate limit X atteint sur %s, attente %ss", path, wait)
                self._sleep(wait)
                continue
            if resp.status_code >= 500:
                wait = 2 ** attempt
                log.warning("Erreur serveur X %s sur %s, nouvel essai dans %ss", resp.status_code, path, wait)
                self._sleep(wait)
                continue
            if resp.status_code != 200:
                raise XApiError(f"HTTP {resp.status_code} sur {path}: {resp.text[:300]}", resp.status_code)
            return resp.json()
        raise XApiError(f"Échec répété sur {path}")

    # ------------------------------------------------------------- utilisateurs
    def get_user_by_username(self, username: str) -> dict:
        data = self._get(f"/users/by/username/{username.lstrip('@')}",
                         {"user.fields": "id,name,username,public_metrics,verified,protected,profile_image_url"})
        if "data" not in data:
            raise XApiError(f"Compte X introuvable : @{username} ({data.get('errors')})", 404)
        return data["data"]

    # --------------------------------------------------------------- timeline
    def iter_user_tweets(self, user_id: str, *, start_time: Optional[datetime] = None,
                         end_time: Optional[datetime] = None, since_id: Optional[str] = None,
                         exclude_replies: bool = True, exclude_retweets: bool = True,
                         max_pages: Optional[int] = None) -> Iterator[dict]:
        """Itère sur les tweets d'un utilisateur, du plus récent au plus ancien."""
        params: dict = {"max_results": MAX_RESULTS, "tweet.fields": TWEET_FIELDS}
        exclude = []
        if exclude_replies:
            exclude.append("replies")
        if exclude_retweets:
            exclude.append("retweets")
        if exclude:
            params["exclude"] = ",".join(exclude)
        if start_time:
            params["start_time"] = _iso(start_time)
        if end_time:
            params["end_time"] = _iso(end_time)
        if since_id:
            params["since_id"] = since_id

        page = 0
        next_token = None
        while True:
            page_params = dict(params)
            if next_token:
                page_params["pagination_token"] = next_token
            data = self._get(f"/users/{user_id}/tweets", page_params)
            for tweet in data.get("data", []):
                yield tweet
            page += 1
            next_token = data.get("meta", {}).get("next_token")
            if not next_token or (max_pages and page >= max_pages):
                return


    # ------------------------------------------------------- relecture
    def get_tweets(self, ids: list[str]) -> tuple[list[dict], list[str]]:
        """Relit jusqu'à 100 tweets : (tweets trouvés, identifiants absents, supprimés ou devenus privés)."""
        if len(ids) > MAX_RESULTS:
            raise ValueError("100 tweets au plus par requête")
        data = self._get("/tweets", {"ids": ",".join(ids), "tweet.fields": "id,created_at,public_metrics"})
        found = data.get("data", [])
        seen = {t["id"] for t in found}
        return found, [i for i in ids if i not in seen]

    # ------------------------------------------------------- full-archive
    def iter_search_all(self, query: str, *, start_time: Optional[datetime] = None,
                        end_time: Optional[datetime] = None, max_pages: Optional[int] = None) -> Iterator[dict]:
        """Recherche full-archive (du plus récent au plus ancien), sans plafond de 3 200 posts."""
        params: dict = {"query": query, "max_results": SEARCH_MAX_RESULTS, "tweet.fields": TWEET_FIELDS}
        if start_time:
            params["start_time"] = _iso(start_time)
        if end_time:
            params["end_time"] = _iso(end_time)
        page = 0
        next_token = None
        while True:
            page_params = dict(params)
            if next_token:
                page_params["next_token"] = next_token
            if page:
                self._sleep(SEARCH_MIN_INTERVAL)
            data = self._get("/tweets/search/all", page_params)
            for tweet in data.get("data", []):
                yield tweet
            page += 1
            next_token = data.get("meta", {}).get("next_token")
            if not next_token or (max_pages and page >= max_pages):
                return


def author_query(username: str, include_replies: bool = False, include_retweets: bool = False) -> str:
    query = f"from:{username.lstrip('@')}"
    if not include_retweets:
        query += " -is:retweet"
    if not include_replies:
        query += " -is:reply"
    return query


def _iso(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def full_text(tweet: dict) -> str:
    """Texte complet : les posts longs (> 280 caractères) sont dans note_tweet."""
    note = tweet.get("note_tweet") or {}
    return note.get("text") or tweet.get("text", "")
