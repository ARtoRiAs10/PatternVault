"""
Client for the CodeChef developer API (https://developers.codechef.com/).

CodeChef's API requires registering an API client and typically an OAuth-style
credential exchange (client_id/client_secret -> access token). Their published
rate-limit policy is less clearly documented than Codeforces', so we throttle
conservatively client-side (~1 request per 2 seconds) regardless.

Credentials are read from CODECHEF_API_KEY / CODECHEF_API_SECRET env vars —
never hardcode them. If they are not configured, this module raises a clear
error rather than silently failing.
"""
import logging
import time

import requests
from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)

CODECHEF_API_BASE = "https://api.codechef.com"
MIN_INTERVAL_SECONDS = 2.0
_LAST_CALL_CACHE_KEY = "codechef_api_last_call_ts"
_TOKEN_CACHE_KEY = "codechef_access_token"


class CodeChefError(Exception):
    pass


def _throttle():
    last_call = cache.get(_LAST_CALL_CACHE_KEY)
    now = time.time()
    if last_call is not None:
        elapsed = now - last_call
        if elapsed < MIN_INTERVAL_SECONDS:
            time.sleep(MIN_INTERVAL_SECONDS - elapsed)
    cache.set(_LAST_CALL_CACHE_KEY, time.time(), timeout=60)


def _get_access_token() -> str:
    cached = cache.get(_TOKEN_CACHE_KEY)
    if cached:
        return cached

    if not settings.CODECHEF_API_KEY or not settings.CODECHEF_API_SECRET:
        raise CodeChefError(
            "CODECHEF_API_KEY / CODECHEF_API_SECRET are not set. Register an API "
            "client at https://developers.codechef.com/ and add credentials to "
            "backend/.env to enable CodeChef import."
        )

    _throttle()
    try:
        resp = requests.post(
            f"{CODECHEF_API_BASE}/oauth/token",
            data={
                "grant_type": "client_credentials",
                "client_id": settings.CODECHEF_API_KEY,
                "client_secret": settings.CODECHEF_API_SECRET,
            },
            timeout=15,
        )
    except requests.RequestException as exc:
        raise CodeChefError(f"Could not reach CodeChef auth endpoint: {exc}") from exc

    if resp.status_code != 200:
        raise CodeChefError(f"CodeChef auth failed ({resp.status_code}): {resp.text[:300]}")

    token = resp.json().get("access_token")
    if not token:
        raise CodeChefError("CodeChef auth response did not include an access_token")

    # CodeChef tokens are typically short-lived; cache conservatively for 25 min.
    cache.set(_TOKEN_CACHE_KEY, token, timeout=60 * 25)
    return token


def get_problem(problem_code: str) -> dict:
    """
    Fetches problem metadata (title, difficulty, tags, contest info) via the
    CodeChef developer API. Full statement is NOT scraped — the frontend
    links out to the CodeChef problem page.
    """
    token = _get_access_token()
    _throttle()

    try:
        resp = requests.get(
            f"{CODECHEF_API_BASE}/problems/{problem_code}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=15,
        )
    except requests.RequestException as exc:
        raise CodeChefError(f"Could not reach CodeChef API: {exc}") from exc

    if resp.status_code != 200:
        raise CodeChefError(f"CodeChef API returned {resp.status_code}: {resp.text[:300]}")

    data = resp.json()
    result = data.get("result", {}).get("data", {}).get("content", data)

    return {
        "title": result.get("problem_name") or result.get("name") or problem_code,
        "url": f"https://www.codechef.com/problems/{problem_code}",
        "difficulty_rating": result.get("difficulty_rating") or result.get("difficulty"),
        "tags": result.get("tags", []),
        "source": "CODECHEF",
    }
