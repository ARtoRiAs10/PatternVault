"""
Client for the official, public, unauthenticated Codeforces API
(https://codeforces.com/apiHelp). No API key required.

Rate limiting note: Codeforces documents a soft limit of ~1 request/2 seconds
per IP for the API. We throttle client-side to stay well within that.
"""
import logging
import time

import requests
from django.core.cache import cache

logger = logging.getLogger(__name__)

CF_API_BASE = "https://codeforces.com/api"
MIN_INTERVAL_SECONDS = 2.0
_LAST_CALL_CACHE_KEY = "cf_api_last_call_ts"


class CodeforcesError(Exception):
    pass


def _throttle():
    last_call = cache.get(_LAST_CALL_CACHE_KEY)
    now = time.time()
    if last_call is not None:
        elapsed = now - last_call
        if elapsed < MIN_INTERVAL_SECONDS:
            time.sleep(MIN_INTERVAL_SECONDS - elapsed)
    cache.set(_LAST_CALL_CACHE_KEY, time.time(), timeout=60)


def get_problem(contest_id: int, problem_index: str) -> dict:
    """
    Fetches problem metadata (name, rating, tags) via problemset.problems,
    filtered to the requested contest_id/problem_index. The full statement is
    intentionally NOT scraped — the frontend links out to the CF problem page.
    """
    _throttle()
    try:
        resp = requests.get(f"{CF_API_BASE}/problemset.problems", timeout=15)
    except requests.RequestException as exc:
        raise CodeforcesError(f"Could not reach Codeforces API: {exc}") from exc

    if resp.status_code != 200:
        raise CodeforcesError(f"Codeforces API returned {resp.status_code}")

    data = resp.json()
    if data.get("status") != "OK":
        raise CodeforcesError(f"Codeforces API error: {data.get('comment')}")

    problems = data["result"]["problems"]
    match = next(
        (
            p
            for p in problems
            if p.get("contestId") == int(contest_id) and p.get("index") == problem_index
        ),
        None,
    )
    if not match:
        raise CodeforcesError(f"Problem {contest_id}{problem_index} not found on Codeforces")

    return {
        "title": match.get("name"),
        "url": f"https://codeforces.com/problemset/problem/{contest_id}/{problem_index}",
        "difficulty_rating": match.get("rating"),
        "tags": match.get("tags", []),
        "source": "CODEFORCES",
    }
