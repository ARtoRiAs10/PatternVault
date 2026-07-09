"""
Test suite for PatternVault's core app.

Run with:  python manage.py test core
(uses Django's TestCase, backed by sqlite in-memory by default when
DATABASE_URL isn't set — see patternvault/settings.py)
"""
from datetime import date, timedelta
from unittest.mock import patch

from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status

from core.models import PatternCard, Problem, ReviewLog, Topic
from core.services.spaced_repetition import compute_next_review_date, get_last_interval_days


# ---------------------------------------------------------------------------
# Pure logic: spaced repetition scheduler
# ---------------------------------------------------------------------------
class SpacedRepetitionTests(APITestCase):
    def test_low_rating_reviews_tomorrow(self):
        today = date(2026, 1, 1)
        self.assertEqual(compute_next_review_date(1, None, today), today + timedelta(days=1))
        self.assertEqual(compute_next_review_date(2, 10, today), today + timedelta(days=1))

    def test_rating_three_reviews_in_three_days(self):
        today = date(2026, 1, 1)
        self.assertEqual(compute_next_review_date(3, 1, today), today + timedelta(days=3))

    def test_rating_four_doubles_interval_min_seven(self):
        today = date(2026, 1, 1)
        self.assertEqual(compute_next_review_date(4, 1, today), today + timedelta(days=7))
        self.assertEqual(compute_next_review_date(4, 10, today), today + timedelta(days=20))

    def test_rating_five_uses_2_5x_min_fourteen(self):
        today = date(2026, 1, 1)
        self.assertEqual(compute_next_review_date(5, 1, today), today + timedelta(days=14))
        self.assertEqual(compute_next_review_date(5, 10, today), today + timedelta(days=25))


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
class AuthTests(APITestCase):
    def test_register_creates_user_and_token(self):
        resp = self.client.post(
            reverse("register"),
            {"username": "alice", "password": "SuperSecret123!"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertIn("token", resp.data)
        self.assertTrue(User.objects.filter(username="alice").exists())

    def test_login_returns_token(self):
        User.objects.create_user(username="bob", password="SuperSecret123!")
        resp = self.client.post(
            reverse("login"), {"username": "bob", "password": "SuperSecret123!"}, format="json"
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("token", resp.data)

    def test_unauthenticated_request_is_rejected(self):
        resp = self.client.get("/api/problems/")
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)


# ---------------------------------------------------------------------------
# Ownership isolation
# ---------------------------------------------------------------------------
class ProblemOwnershipTests(APITestCase):
    def setUp(self):
        self.alice = User.objects.create_user(username="alice", password="pw12345!")
        self.bob = User.objects.create_user(username="bob", password="pw12345!")
        self.alice_problem = Problem.objects.create(title="Alice's problem", owner=self.alice)
        self.bob_problem = Problem.objects.create(title="Bob's problem", owner=self.bob)

    def test_user_only_sees_own_problems(self):
        self.client.force_authenticate(user=self.alice)
        resp = self.client.get("/api/problems/")
        titles = [p["title"] for p in resp.data["results"]]
        self.assertIn("Alice's problem", titles)
        self.assertNotIn("Bob's problem", titles)

    def test_created_problem_is_owned_by_requester(self):
        self.client.force_authenticate(user=self.alice)
        resp = self.client.post("/api/problems/", {"title": "New problem"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        problem = Problem.objects.get(id=resp.data["id"])
        self.assertEqual(problem.owner, self.alice)

    def test_user_cannot_fetch_another_users_problem_by_id(self):
        self.client.force_authenticate(user=self.alice)
        resp = self.client.get(f"/api/problems/{self.bob_problem.id}/")
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)


# ---------------------------------------------------------------------------
# Review queue
# ---------------------------------------------------------------------------
class ReviewQueueTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="carol", password="pw12345!")
        self.client.force_authenticate(user=self.user)
        self.problem = Problem.objects.create(title="Two Sum", owner=self.user)
        self.due_card = PatternCard.objects.create(
            problem=self.problem, pattern_name="Hash map lookup"
        )
        self.not_due_card = PatternCard.objects.create(
            problem=self.problem, pattern_name="Not due yet"
        )
        ReviewLog.objects.create(
            pattern_card=self.not_due_card,
            self_rating=5,
            next_review_date=date.today() + timedelta(days=30),
        )

    def test_review_queue_returns_only_due_cards(self):
        resp = self.client.get(reverse("review-queue"))
        names = [c["pattern_name"] for c in resp.data]
        self.assertIn("Hash map lookup", names)
        self.assertNotIn("Not due yet", names)

    def test_submitting_review_computes_next_date(self):
        resp = self.client.post(
            "/api/review-logs/", {"pattern_card": self.due_card.id, "self_rating": 5}, format="json"
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        expected = date.today() + timedelta(days=14)
        self.assertEqual(resp.data["next_review_date"], expected.isoformat())


# ---------------------------------------------------------------------------
# Judge0 execution (mocked — never hits a real sandbox in tests)
# ---------------------------------------------------------------------------
class ExecuteCodeTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="dave", password="pw12345!")
        self.client.force_authenticate(user=self.user)
        self.problem = Problem.objects.create(title="Palindrome check", owner=self.user)

    @patch("core.views.judge0.execute")
    def test_execute_saves_test_run_on_submit(self, mock_execute):
        mock_execute.return_value = {
            "stdout": "true\n",
            "stderr": "",
            "status": "Accepted",
            "raw_status": "Accepted",
            "execution_time_ms": 12,
            "memory_used": 1024,
        }
        resp = self.client.post(
            "/api/execute/",
            {
                "source_code": "print('true')",
                "language": "python",
                "problem": self.problem.id,
                "save_run": True,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["status"], "Accepted")
        self.assertTrue(self.problem.test_runs.exists())

    def test_execute_requires_source_and_language(self):
        resp = self.client.post("/api/execute/", {}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)


# ---------------------------------------------------------------------------
# LLM-assisted pattern card generation (mocked — never calls OpenRouter)
# ---------------------------------------------------------------------------
class PatternCardGenerationTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="erin", password="pw12345!")
        self.client.force_authenticate(user=self.user)
        self.problem = Problem.objects.create(
            title="Longest substring",
            owner=self.user,
            statement="Find the longest substring without repeating characters.",
            code_submitted="def f(s): ...",
        )

    @patch("core.views.openrouter.generate_pattern_card")
    def test_generate_pattern_card_creates_card(self, mock_generate):
        mock_generate.return_value = {
            "pattern_name": "Sliding window",
            "recognition_trigger": "Contiguous substring/subarray with a constraint",
            "core_insight": "Expand right, shrink left when constraint violated",
            "common_edge_cases": "Empty string, all-unique string",
        }
        resp = self.client.post(f"/api/problems/{self.problem.id}/generate-pattern-card/")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data["pattern_name"], "Sliding window")
        self.assertTrue(PatternCard.objects.filter(problem=self.problem).exists())

    @patch("core.views.openrouter.generate_pattern_card")
    def test_generate_pattern_card_surfaces_llm_errors(self, mock_generate):
        from core.services.openrouter import OpenRouterError

        mock_generate.side_effect = OpenRouterError("OPENROUTER_API_KEY is not set.")
        resp = self.client.post(f"/api/problems/{self.problem.id}/generate-pattern-card/")
        self.assertEqual(resp.status_code, status.HTTP_502_BAD_GATEWAY)


# ---------------------------------------------------------------------------
# Codeforces client throttling/parsing (mocked network)
# ---------------------------------------------------------------------------
class CodeforcesServiceTests(APITestCase):
    @patch("core.services.codeforces.requests.get")
    def test_get_problem_parses_metadata(self, mock_get):
        mock_get.return_value.status_code = 200
        mock_get.return_value.json.return_value = {
            "status": "OK",
            "result": {
                "problems": [
                    {"contestId": 20, "index": "C", "name": "Dijkstra?", "rating": 1900, "tags": ["graphs"]}
                ]
            },
        }
        from core.services import codeforces

        data = codeforces.get_problem(20, "C")
        self.assertEqual(data["title"], "Dijkstra?")
        self.assertEqual(data["difficulty_rating"], 1900)
