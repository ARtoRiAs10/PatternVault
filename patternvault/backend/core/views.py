import logging
from datetime import date

from django.contrib.auth.models import User
from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from .models import PatternCard, PostMortem, Problem, ReviewLog, TestRun, Topic
from .serializers import (
    PatternCardSerializer,
    PostMortemSerializer,
    ProblemListSerializer,
    ProblemSerializer,
    RegisterSerializer,
    ReviewLogSerializer,
    TestRunSerializer,
    TopicSerializer,
    UserSerializer,
)
from .services import codechef, codeforces, judge0, openrouter
from .services.spaced_repetition import compute_next_review_date, get_last_interval_days

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Auth: register / me. Login is handled by DRF's built-in obtain_auth_token
# (wired in urls.py), which exchanges username+password for a token.
# ---------------------------------------------------------------------------
@api_view(["POST"])
@permission_classes([AllowAny])
def register(request):
    serializer = RegisterSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.save()
    token, _ = Token.objects.get_or_create(user=user)
    return Response(
        {"token": token.key, "user": UserSerializer(user).data}, status=status.HTTP_201_CREATED
    )


@api_view(["GET"])
def me(request):
    return Response(UserSerializer(request.user).data)


# ---------------------------------------------------------------------------
# Standard CRUD ViewSets
# ---------------------------------------------------------------------------
class TopicViewSet(viewsets.ModelViewSet):
    queryset = Topic.objects.all()
    serializer_class = TopicSerializer


class ProblemViewSet(viewsets.ModelViewSet):
    serializer_class = ProblemSerializer

    def get_serializer_class(self):
        if self.action == "list":
            return ProblemListSerializer
        return ProblemSerializer

    def get_queryset(self):
        qs = Problem.objects.filter(owner=self.request.user).prefetch_related("topics", "pattern_cards")
        status_filter = self.request.query_params.get("status")
        source_filter = self.request.query_params.get("source")
        topic_filter = self.request.query_params.get("topic")
        search = self.request.query_params.get("search")
        if status_filter:
            qs = qs.filter(status=status_filter)
        if source_filter:
            qs = qs.filter(source=source_filter)
        if topic_filter:
            qs = qs.filter(topics__id=topic_filter)
        if search:
            qs = qs.filter(Q(title__icontains=search) | Q(statement__icontains=search))
        return qs.distinct()

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


class PatternCardViewSet(viewsets.ModelViewSet):
    serializer_class = PatternCardSerializer

    def get_queryset(self):
        return PatternCard.objects.filter(problem__owner=self.request.user).select_related("problem")


class ReviewLogViewSet(viewsets.ModelViewSet):
    serializer_class = ReviewLogSerializer

    def get_queryset(self):
        return ReviewLog.objects.filter(pattern_card__problem__owner=self.request.user).select_related(
            "pattern_card"
        )

    def create(self, request, *args, **kwargs):
        """
        Creating a ReviewLog auto-computes next_review_date via the spaced
        repetition service, rather than requiring the client to compute it.
        """
        pattern_card_id = request.data.get("pattern_card")
        self_rating = int(request.data.get("self_rating"))

        try:
            pattern_card = PatternCard.objects.get(id=pattern_card_id, problem__owner=request.user)
        except PatternCard.DoesNotExist:
            return Response({"detail": "pattern_card not found"}, status=status.HTTP_404_NOT_FOUND)

        last_interval = get_last_interval_days(pattern_card)
        next_review_date = compute_next_review_date(self_rating, last_interval)

        review_log = ReviewLog.objects.create(
            pattern_card=pattern_card,
            self_rating=self_rating,
            next_review_date=next_review_date,
        )
        serializer = self.get_serializer(review_log)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class PostMortemViewSet(viewsets.ModelViewSet):
    serializer_class = PostMortemSerializer

    def get_queryset(self):
        return PostMortem.objects.filter(problem__owner=self.request.user).select_related("problem")


class TestRunViewSet(viewsets.ModelViewSet):
    serializer_class = TestRunSerializer

    def get_queryset(self):
        qs = TestRun.objects.filter(problem__owner=self.request.user).select_related("problem")
        problem_id = self.request.query_params.get("problem")
        if problem_id:
            qs = qs.filter(problem_id=problem_id)
        return qs


# ---------------------------------------------------------------------------
# Codeforces / CodeChef import endpoints
# ---------------------------------------------------------------------------
@api_view(["GET"])
@throttle_classes([ScopedRateThrottle])
def codeforces_problem(request, contest_id, problem_index):
    try:
        data = codeforces.get_problem(contest_id, problem_index)
        return Response(data)
    except codeforces.CodeforcesError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)


codeforces_problem.cls.throttle_scope = "import"


@api_view(["GET"])
@throttle_classes([ScopedRateThrottle])
def codechef_problem(request, problem_code):
    try:
        data = codechef.get_problem(problem_code)
        return Response(data)
    except codechef.CodeChefError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)


codechef_problem.cls.throttle_scope = "import"


# ---------------------------------------------------------------------------
# Judge0 sandboxed execution endpoint
# ---------------------------------------------------------------------------
@api_view(["POST"])
@throttle_classes([ScopedRateThrottle])
def execute_code(request):
    source_code = request.data.get("source_code", "")
    language = request.data.get("language")
    stdin = request.data.get("stdin", "")
    expected_output = request.data.get("expected_output", "")
    problem_id = request.data.get("problem")
    timer_duration_seconds = request.data.get("timer_duration_seconds")
    save_run = request.data.get("save_run", True)

    if not source_code or not language:
        return Response(
            {"detail": "source_code and language are required"}, status=status.HTTP_400_BAD_REQUEST
        )

    try:
        result = judge0.execute(source_code, language, stdin, expected_output)
    except judge0.Judge0Error as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

    response_payload = dict(result)

    if save_run and problem_id:
        try:
            problem = Problem.objects.get(id=problem_id, owner=request.user)
            test_run = TestRun.objects.create(
                problem=problem,
                code_snapshot=source_code,
                language=language,
                stdin=stdin,
                expected_output=expected_output,
                actual_output=result["stdout"] or result["stderr"],
                status=result["status"],
                execution_time_ms=result["execution_time_ms"],
                timer_duration_seconds=timer_duration_seconds,
            )
            response_payload["test_run_id"] = test_run.id
        except Problem.DoesNotExist:
            pass

    return Response(response_payload)


execute_code.cls.throttle_scope = "execute"


# ---------------------------------------------------------------------------
# Review queue
# ---------------------------------------------------------------------------
@api_view(["GET"])
def review_queue(request):
    today = date.today()
    cards = []
    for card in PatternCard.objects.filter(problem__owner=request.user).select_related("problem"):
        next_date = card.next_review_date
        if next_date <= today:
            cards.append((card, (today - next_date).days))

    cards.sort(key=lambda pair: pair[1], reverse=True)
    serialized = PatternCardSerializer([c for c, _ in cards], many=True).data
    for item, (_, overdue_days) in zip(serialized, cards):
        item["overdue_days"] = overdue_days

    return Response(serialized)


# ---------------------------------------------------------------------------
# LLM-assisted endpoints
# ---------------------------------------------------------------------------
@api_view(["POST"])
@throttle_classes([ScopedRateThrottle])
def generate_pattern_card(request, problem_id):
    try:
        problem = Problem.objects.get(id=problem_id, owner=request.user)
    except Problem.DoesNotExist:
        return Response({"detail": "Problem not found"}, status=status.HTTP_404_NOT_FOUND)

    try:
        extracted = openrouter.generate_pattern_card(problem.statement, problem.code_submitted)
    except openrouter.OpenRouterError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

    pattern_card, _created = PatternCard.objects.update_or_create(
        problem=problem,
        pattern_name=extracted.get("pattern_name", "Untitled Pattern"),
        defaults={
            "recognition_trigger": extracted.get("recognition_trigger", ""),
            "core_insight": extracted.get("core_insight", ""),
            "common_edge_cases": extracted.get("common_edge_cases", ""),
            "llm_generated": True,
        },
    )
    return Response(PatternCardSerializer(pattern_card).data, status=status.HTTP_201_CREATED)


generate_pattern_card.cls.throttle_scope = "llm"


@api_view(["POST"])
@throttle_classes([ScopedRateThrottle])
def create_postmortem(request, problem_id):
    try:
        problem = Problem.objects.get(id=problem_id, owner=request.user)
    except Problem.DoesNotExist:
        return Response({"detail": "Problem not found"}, status=status.HTTP_404_NOT_FOUND)

    serializer = PostMortemSerializer(data={**request.data, "problem": problem.id})
    serializer.is_valid(raise_exception=True)
    postmortem = serializer.save()

    pattern_card = problem.pattern_cards.order_by("-created_at").first()
    merged = None
    if pattern_card:
        try:
            merged = openrouter.merge_postmortem_insight(
                pattern_card.common_edge_cases,
                postmortem.bug_found,
                postmortem.root_cause,
                postmortem.lesson_learned,
            )
            pattern_card.common_edge_cases = merged
            pattern_card.save(update_fields=["common_edge_cases"])
        except openrouter.OpenRouterError as exc:
            logger.warning("Could not merge post-mortem insight via LLM: %s", exc)

    return Response(
        {
            "postmortem": PostMortemSerializer(postmortem).data,
            "pattern_card": PatternCardSerializer(pattern_card).data if pattern_card else None,
        },
        status=status.HTTP_201_CREATED,
    )


create_postmortem.cls.throttle_scope = "llm"


@api_view(["POST"])
@throttle_classes([ScopedRateThrottle])
def quiz_pattern_card(request, pattern_card_id):
    try:
        pattern_card = PatternCard.objects.get(id=pattern_card_id, problem__owner=request.user)
    except PatternCard.DoesNotExist:
        return Response({"detail": "PatternCard not found"}, status=status.HTTP_404_NOT_FOUND)

    try:
        quiz = openrouter.generate_quiz_problem(
            pattern_card.pattern_name, pattern_card.core_insight, pattern_card.recognition_trigger
        )
    except openrouter.OpenRouterError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

    return Response(quiz)


quiz_pattern_card.cls.throttle_scope = "llm"


# ---------------------------------------------------------------------------
# Stretch: weekly digest, markdown export, stats
# ---------------------------------------------------------------------------
@api_view(["GET"])
@throttle_classes([ScopedRateThrottle])
def weekly_digest(request):
    from datetime import timedelta

    week_ago = date.today() - timedelta(days=7)
    weak_logs = (
        ReviewLog.objects.filter(
            pattern_card__problem__owner=request.user, review_date__date__gte=week_ago, self_rating__lte=2
        )
        .select_related("pattern_card")
        .order_by("-review_date")[:20]
    )
    weak_patterns = [
        {
            "pattern_name": log.pattern_card.pattern_name,
            "self_rating": log.self_rating,
            "core_insight": log.pattern_card.core_insight,
        }
        for log in weak_logs
    ]

    if not weak_patterns:
        return Response({"digest": "No low-rated reviews in the past week — great job!"})

    try:
        digest = openrouter.generate_weekly_digest(weak_patterns)
    except openrouter.OpenRouterError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

    return Response({"digest": digest, "weak_patterns": weak_patterns})


weekly_digest.cls.throttle_scope = "llm"


@api_view(["GET"])
def export_markdown(request):
    lines = ["# PatternVault — Pattern Sheet\n"]
    for topic in Topic.objects.all():
        cards = PatternCard.objects.filter(
            problem__topics=topic, problem__owner=request.user
        ).select_related("problem")
        if not cards.exists():
            continue
        lines.append(f"\n## {topic.name} ({topic.get_parent_category_display()})\n")
        for card in cards:
            lines.append(f"### {card.pattern_name}")
            lines.append(f"- **Problem:** [{card.problem.title}]({card.problem.url})")
            lines.append(f"- **Recognition trigger:** {card.recognition_trigger}")
            lines.append(f"- **Core insight:** {card.core_insight}")
            lines.append(f"- **Common edge cases:** {card.common_edge_cases}")
            lines.append("")

    content = "\n".join(lines)
    response = Response(content, content_type="text/markdown")
    response["Content-Disposition"] = 'attachment; filename="patternvault_sheet.md"'
    return response


@api_view(["GET"])
def stats_overview(request):
    from django.db.models import Avg, Count
    from django.db.models.functions import TruncWeek

    per_topic = (
        Topic.objects.annotate(
            solved_count=Count(
                "problems",
                filter=Q(problems__status=Problem.Status.SOLVED, problems__owner=request.user),
            ),
            avg_time=Avg("problems__time_taken_minutes", filter=Q(problems__owner=request.user)),
        )
        .values("name", "parent_category", "solved_count", "avg_time")
    )

    solved_per_week = (
        Problem.objects.filter(status=Problem.Status.SOLVED, owner=request.user)
        .annotate(week=TruncWeek("created_at"))
        .values("week")
        .annotate(count=Count("id"))
        .order_by("week")
    )

    review_streak = (
        ReviewLog.objects.filter(pattern_card__problem__owner=request.user)
        .values("review_date__date")
        .distinct()
        .count()
    )

    return Response(
        {
            "per_topic": list(per_topic),
            "solved_per_week": list(solved_per_week),
            "review_days_count": review_streak,
        }
    )
