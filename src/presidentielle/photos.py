"""Photos des candidats depuis Wikipédia et Wikimedia Commons, avec auteur et licence.

Le résultat est enregistré dans config/photos.json (dépôt public) : ce sont des métadonnées
publiques, rafraîchies à la main avec `python -m presidentielle photos`.
"""

from __future__ import annotations

import html
import json
import logging
import re

import requests

from . import config

log = logging.getLogger(__name__)

UA = "presidentielle2027-ecologie/0.3 (https://github.com/mathisdreher/french-presidential-2027)"
WIKI_API = "https://fr.wikipedia.org/w/api.php"
COMMONS_API = "https://commons.wikimedia.org/w/api.php"
THUMB = 256


def _strip_tags(s: str) -> str:
    return html.unescape(re.sub(r"<[^>]+>", "", s or "")).strip()


def _get(s: requests.Session, url: str, params: dict) -> dict:
    """GET avec nouvelles tentatives : les API Wikimedia renvoient 429 aux adresses partagées."""
    import time
    for attempt in range(6):
        r = s.get(url, params=params, timeout=30)
        if r.status_code == 429 and attempt < 5:
            time.sleep(int(r.headers.get("retry-after", 0) or 0) or 5 * (attempt + 1))
            continue
        r.raise_for_status()
        return r.json()
    raise RuntimeError("Wikimedia : trop de requêtes")


def resolve(candidates: list[config.Candidate], session: requests.Session | None = None) -> dict:
    s = session or requests.Session()
    s.headers["User-Agent"] = UA
    titles = {c.wikipedia: c for c in candidates}
    q = _get(s, WIKI_API, {"action": "query", "format": "json", "prop": "pageimages|info", "inprop": "url",
                           "piprop": "name", "redirects": 1, "titles": "|".join(titles)})["query"]
    redirect = {x["from"]: x["to"] for x in q.get("redirects", []) + q.get("normalized", [])}
    pages = {p["title"]: p for p in q["pages"].values()}
    files = {}
    for title, cand in titles.items():
        page = pages.get(redirect.get(title, title)) or pages.get(redirect.get(redirect.get(title, title), ""))
        if page and page.get("pageimage"):
            files[cand.slug] = (page["pageimage"], page.get("fullurl"))
        else:
            log.warning("Pas d'image Wikipédia pour %s (page « %s »)", cand.name, title)
    out = {}
    if files:
        q = _get(s, COMMONS_API, {"action": "query", "format": "json", "prop": "imageinfo",
                                  "iiprop": "url|extmetadata", "iiurlwidth": THUMB,
                                  "titles": "|".join(f"File:{f}" for f, _ in files.values())})["query"]
        norm = {x["from"]: x["to"] for x in q.get("normalized", [])}
        info = {p["title"]: p for p in q["pages"].values()}
        for slug, (fname, wiki_url) in files.items():
            page = info.get(norm.get(f"File:{fname}", f"File:{fname}"))
            if not page or "imageinfo" not in page:
                log.warning("Fichier Commons introuvable : %s", fname)
                continue
            ii = page["imageinfo"][0]
            meta = ii.get("extmetadata", {})
            out[slug] = {
                "url": (ii.get("thumburl") or ii["url"]).split("?")[0],
                "source": ii.get("descriptionurl"),
                "auteur": _strip_tags(meta.get("Artist", {}).get("value", ""))[:120],
                "licence": _strip_tags(meta.get("LicenseShortName", {}).get("value", "")),
                "wikipedia": wiki_url,
            }
    return out


def run() -> dict:
    cands = config.load_candidates(only_enabled=False)
    photos = resolve(cands)
    config.PHOTOS_FILE.write_text(json.dumps(photos, ensure_ascii=False, indent=1, sort_keys=True) + "\n", encoding="utf-8")
    log.info("%d photos sur %d candidats", len(photos), len(cands))
    return photos


def load() -> dict:
    if config.PHOTOS_FILE.exists():
        return json.loads(config.PHOTOS_FILE.read_text(encoding="utf-8"))
    return {}
