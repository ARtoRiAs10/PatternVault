"""
Thin client for the OpenRouter chat completions API, used for:
  - pattern-card extraction from a solved problem
  - merging post-mortem insights into an existing pattern card
  - generating an isomorphic "quiz" problem for spaced-repetition testing
"""
import json
import logging

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"


class OpenRouterError(Exception):
    pass


def _chat(messages, temperature=0.3, max_tokens=1200):
    if not settings.OPENROUTER_API_KEY:
        raise OpenRouterError(
            "OPENROUTER_API_KEY is not set. Add it to backend/.env to enable LLM features."
        )

    headers = {
        "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": settings.OPENROUTER_MODEL,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }

    resp = requests.post(OPENROUTER_URL, headers=headers, json=payload, timeout=60)
    if resp.status_code != 200:
        raise OpenRouterError(f"OpenRouter API error {resp.status_code}: {resp.text[:500]}")

    data = resp.json()
    try:
        return data["choices"][0]["message"]["content"]
    except (KeyError, IndexError) as exc:
        raise OpenRouterError(f"Unexpected OpenRouter response shape: {data}") from exc


def _parse_json_with_retry(prompt_messages, max_retries=2):
    """
    Calls the LLM, expecting a raw JSON object back. If parsing fails,
    re-prompts with an explicit correction instruction, up to max_retries.
    """
    last_error = None
    messages = list(prompt_messages)

    for attempt in range(max_retries + 1):
        raw = _chat(messages)
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.strip("`")
            if cleaned.lower().startswith("json"):
                cleaned = cleaned[4:]
        try:
            return json.loads(cleaned.strip())
        except json.JSONDecodeError as exc:
            last_error = exc
            messages = prompt_messages + [
                {"role": "assistant", "content": raw},
                {
                    "role": "user",
                    "content": (
                        "That was not valid JSON. Respond with ONLY a single valid JSON "
                        "object, no markdown fences, no commentary."
                    ),
                },
            ]

    raise OpenRouterError(f"Could not parse valid JSON from LLM after retries: {last_error}")


def generate_pattern_card(statement: str, code: str) -> dict:
    prompt = (
        f"Given this problem statement: {statement}\n\n"
        f"And this solution code:\n{code}\n\n"
        "Extract: (1) the core pattern name, (2) what wording/structure in the "
        "problem should trigger recognition of this pattern, (3) the core "
        "state/transition or algorithmic insight in one sentence, (4) 2-3 common "
        "edge cases or bugs for this pattern. "
        "Return ONLY valid JSON with keys: pattern_name, recognition_trigger, "
        "core_insight, common_edge_cases."
    )
    messages = [
        {
            "role": "system",
            "content": "You are a competitive programming coach. Respond with ONLY valid JSON, no markdown.",
        },
        {"role": "user", "content": prompt},
    ]
    return _parse_json_with_retry(messages)


def merge_postmortem_insight(existing_edge_cases: str, bug_found: str, root_cause: str, lesson_learned: str) -> str:
    prompt = (
        "Existing common_edge_cases notes for a pattern card:\n"
        f"{existing_edge_cases or '(none yet)'}\n\n"
        "New post-mortem from a failed/partial attempt:\n"
        f"Bug found: {bug_found}\nRoot cause: {root_cause}\nLesson learned: {lesson_learned}\n\n"
        "Merge the new insight into the existing notes WITHOUT duplicating content "
        "that's already covered. Return ONLY valid JSON with a single key 'merged_edge_cases' "
        "containing the updated, deduplicated text."
    )
    messages = [
        {
            "role": "system",
            "content": "You are a competitive programming coach. Respond with ONLY valid JSON, no markdown.",
        },
        {"role": "user", "content": prompt},
    ]
    result = _parse_json_with_retry(messages)
    return result.get("merged_edge_cases", existing_edge_cases)


def generate_quiz_problem(pattern_name: str, core_insight: str, recognition_trigger: str) -> dict:
    prompt = (
        f"A learner has a pattern card for '{pattern_name}' with core insight: "
        f"{core_insight}. The recognition trigger was: {recognition_trigger}. "
        "Generate a NEW competitive-programming problem statement that uses the SAME "
        "underlying algorithmic pattern, but with different surface details (different "
        "story, variable names, constraints) so it is not trivially recognizable as a copy. "
        "Do NOT reveal the pattern name anywhere in the statement. "
        "Return ONLY valid JSON with keys: quiz_statement, difficulty_hint."
    )
    messages = [
        {
            "role": "system",
            "content": "You are a competitive programming problem setter. Respond with ONLY valid JSON, no markdown.",
        },
        {"role": "user", "content": prompt},
    ]
    return _parse_json_with_retry(messages)


def generate_weekly_digest(weak_patterns: list) -> str:
    prompt = (
        "Here are pattern cards with recent low self-ratings (1-2) from a spaced-repetition "
        f"review log:\n{json.dumps(weak_patterns, indent=2)}\n\n"
        "Write a short, encouraging weekly digest (plain text, 150-250 words) summarizing "
        "the learner's weakest patterns this week and 2-3 concrete suggestions for what to "
        "drill next."
    )
    messages = [
        {"role": "system", "content": "You are a supportive competitive programming coach."},
        {"role": "user", "content": prompt},
    ]
    return _chat(messages, temperature=0.5)
