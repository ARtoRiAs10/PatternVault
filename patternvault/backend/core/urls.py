from django.urls import include, path
from rest_framework.authtoken.views import obtain_auth_token
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("topics", views.TopicViewSet)
router.register("problems", views.ProblemViewSet, basename="problem")
router.register("pattern-cards", views.PatternCardViewSet, basename="patterncard")
router.register("review-logs", views.ReviewLogViewSet, basename="reviewlog")
router.register("postmortems", views.PostMortemViewSet, basename="postmortem")
router.register("test-runs", views.TestRunViewSet, basename="testrun")

urlpatterns = [
    path("", include(router.urls)),
    # Auth
    path("auth/register/", views.register, name="register"),
    path("auth/login/", obtain_auth_token, name="login"),
    path("auth/me/", views.me, name="me"),
    # Codeforces / CodeChef import
    path(
        "codeforces/problem/<int:contest_id>/<str:problem_index>/",
        views.codeforces_problem,
        name="codeforces-problem",
    ),
    path("codechef/problem/<str:problem_code>/", views.codechef_problem, name="codechef-problem"),
    # Judge0 execution
    path("execute/", views.execute_code, name="execute-code"),
    # Spaced repetition
    path("review-queue/", views.review_queue, name="review-queue"),
    # LLM-assisted endpoints
    path(
        "problems/<int:problem_id>/generate-pattern-card/",
        views.generate_pattern_card,
        name="generate-pattern-card",
    ),
    path("problems/<int:problem_id>/postmortem/", views.create_postmortem, name="create-postmortem"),
    path("pattern-cards/<int:pattern_card_id>/quiz/", views.quiz_pattern_card, name="quiz-pattern-card"),
    # Stretch features
    path("weekly-digest/", views.weekly_digest, name="weekly-digest"),
    path("export/markdown/", views.export_markdown, name="export-markdown"),
    path("stats/overview/", views.stats_overview, name="stats-overview"),
]
