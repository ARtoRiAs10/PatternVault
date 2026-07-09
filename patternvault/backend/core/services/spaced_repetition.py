"""
Simplified SM-2 spaced repetition scheduler.

Rules (per spec):
  self_rating 1-2 -> next_review_date = today + 1 day
  self_rating 3   -> next_review_date = today + 3 days
  self_rating 4   -> next_review_date = today + max(last_interval * 2, 7) days
  self_rating 5   -> next_review_date = today + max(last_interval * 2.5, 14) days
"""
from datetime import date, timedelta


def compute_next_review_date(self_rating: int, last_interval_days: int | None, today: date | None = None) -> date:
    today = today or date.today()
    last_interval_days = last_interval_days or 1

    if self_rating <= 2:
        interval = 1
    elif self_rating == 3:
        interval = 3
    elif self_rating == 4:
        interval = max(last_interval_days * 2, 7)
    else:  # 5
        interval = max(int(last_interval_days * 2.5), 14)

    return today + timedelta(days=interval)


def get_last_interval_days(pattern_card) -> int:
    """
    Derive the last interval (in days) used for a pattern card, based on its
    most recent two review logs. Falls back to 1 day if there's no history.
    """
    logs = list(pattern_card.review_logs.order_by("-review_date")[:2])
    if len(logs) < 1:
        return 1
    latest = logs[0]
    prior_date = logs[1].review_date.date() if len(logs) > 1 else pattern_card.created_at.date()
    interval = (latest.next_review_date - prior_date).days
    return interval if interval > 0 else 1
