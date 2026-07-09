"""
Client for a self-hosted Judge0 instance. ALL user-submitted code execution
MUST go through this sandbox — never eval/exec in the Django process.

Judge0's official docker-compose config: https://github.com/judge0/judge0
"""
import base64
import logging

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

# Conservative resource limits enforced on every submission.
CPU_TIME_LIMIT_SECONDS = 5
MEMORY_LIMIT_KB = 256 * 1024  # 256 MB

# Common Judge0 language IDs (subset). Extend as needed; see
# GET {JUDGE0_API_URL}/languages for the full authoritative list.
LANGUAGE_IDS = {
    "cpp": 54,        # C++ (GCC 9.2.0)
    "python": 71,      # Python (3.8.1)
    "java": 62,        # Java (OpenJDK 13.0.1)
    "javascript": 63,  # JavaScript (Node.js 12.14.0)
    "go": 60,          # Go (1.13.5)
}


class Judge0Error(Exception):
    pass


def _headers():
    headers = {"Content-Type": "application/json"}
    if settings.JUDGE0_AUTH_TOKEN:
        headers["X-Auth-Token"] = settings.JUDGE0_AUTH_TOKEN
    return headers


def _b64(text: str) -> str:
    return base64.b64encode((text or "").encode("utf-8")).decode("utf-8")


def _b64_decode(text):
    if not text:
        return ""
    try:
        return base64.b64decode(text).decode("utf-8", errors="replace")
    except Exception:
        return text


def execute(source_code: str, language: str, stdin: str = "", expected_output: str = "") -> dict:
    """
    Submits code to Judge0 with a synchronous (wait=true) request, enforcing
    strict CPU time / memory limits. Returns a normalized result dict.
    """
    language_id = LANGUAGE_IDS.get(language)
    if language_id is None:
        raise Judge0Error(f"Unsupported language '{language}'. Supported: {list(LANGUAGE_IDS)}")

    payload = {
        "source_code": _b64(source_code),
        "language_id": language_id,
        "stdin": _b64(stdin),
        "cpu_time_limit": CPU_TIME_LIMIT_SECONDS,
        "memory_limit": MEMORY_LIMIT_KB,
        "enable_network": False,
    }
    if expected_output:
        payload["expected_output"] = _b64(expected_output)

    url = f"{settings.JUDGE0_API_URL}/submissions"
    params = {"base64_encoded": "true", "wait": "true"}

    try:
        resp = requests.post(url, params=params, json=payload, headers=_headers(), timeout=30)
    except requests.RequestException as exc:
        raise Judge0Error(
            f"Could not reach Judge0 at {settings.JUDGE0_API_URL}. "
            f"Is `docker compose up judge0-server` running? ({exc})"
        ) from exc

    if resp.status_code not in (200, 201):
        raise Judge0Error(f"Judge0 returned {resp.status_code}: {resp.text[:500]}")

    data = resp.json()
    status_desc = (data.get("status") or {}).get("description", "Unknown")
    normalized_status = _normalize_status(status_desc, data, expected_output)

    return {
        "stdout": _b64_decode(data.get("stdout")),
        "stderr": _b64_decode(data.get("stderr")) or _b64_decode(data.get("compile_output")),
        "status": normalized_status,
        "raw_status": status_desc,
        "execution_time_ms": _to_ms(data.get("time")),
        "memory_used": data.get("memory"),
    }


def _to_ms(seconds_str):
    if not seconds_str:
        return None
    try:
        return int(float(seconds_str) * 1000)
    except (TypeError, ValueError):
        return None


def _normalize_status(status_desc: str, data: dict, expected_output: str) -> str:
    mapping = {
        "Accepted": "Accepted",
        "Wrong Answer": "WrongAnswer",
        "Time Limit Exceeded": "TLE",
        "Compilation Error": "CompileError",
        "Runtime Error (SIGSEGV)": "RuntimeError",
        "Runtime Error (SIGABRT)": "RuntimeError",
        "Runtime Error (NZEC)": "RuntimeError",
        "Runtime Error (Other)": "RuntimeError",
        "Internal Error": "RuntimeError",
    }
    if status_desc in mapping:
        return mapping[status_desc]
    if status_desc == "Processing" and expected_output:
        actual = _b64_decode(data.get("stdout")).strip()
        return "Accepted" if actual == expected_output.strip() else "WrongAnswer"
    return "RuntimeError"
