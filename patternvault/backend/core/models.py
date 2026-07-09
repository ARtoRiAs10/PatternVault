from django.conf import settings
from django.db import models


class Topic(models.Model):
    class ParentCategory(models.TextChoices):
        DP = "DP", "Dynamic Programming"
        GRAPH = "GRAPH", "Graph"
        LINEAR_DS = "LINEAR_DS", "Linear Data Structures"
        OTHER = "OTHER", "Other"

    name = models.CharField(max_length=120, unique=True)
    parent_category = models.CharField(
        max_length=20, choices=ParentCategory.choices, default=ParentCategory.OTHER
    )

    class Meta:
        ordering = ["parent_category", "name"]

    def __str__(self):
        return f"{self.name} ({self.parent_category})"


class Problem(models.Model):
    class Source(models.TextChoices):
        CODEFORCES = "CODEFORCES", "Codeforces"
        CODECHEF = "CODECHEF", "CodeChef"
        LEETCODE = "LEETCODE", "LeetCode"
        OA = "OA", "OA"
        OTHER = "OTHER", "Other"

    class Status(models.TextChoices):
        SOLVED = "SOLVED", "Solved"
        PARTIAL = "PARTIAL", "Partial"
        FAILED = "FAILED", "Failed"
        UNTRIED = "UNTRIED", "Untried"

    class Language(models.TextChoices):
        CPP = "cpp", "C++"
        PYTHON = "python", "Python"
        JAVA = "java", "Java"
        JAVASCRIPT = "javascript", "JavaScript"
        GO = "go", "Go"
        OTHER = "other", "Other"

    title = models.CharField(max_length=255)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="problems",
        null=True,
        blank=True,
        help_text="User who owns this problem. Null for pre-auth seed/demo data.",
    )
    source = models.CharField(max_length=20, choices=Source.choices, default=Source.OTHER)
    url = models.URLField(blank=True)
    statement = models.TextField(blank=True)
    difficulty_rating = models.IntegerField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.UNTRIED)
    topics = models.ManyToManyField(Topic, blank=True, related_name="problems")
    language = models.CharField(max_length=20, choices=Language.choices, default=Language.CPP)
    code_submitted = models.TextField(blank=True)
    time_taken_minutes = models.IntegerField(null=True, blank=True)
    is_core_algorithm = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title


class PatternCard(models.Model):
    problem = models.ForeignKey(Problem, on_delete=models.CASCADE, related_name="pattern_cards")
    pattern_name = models.CharField(max_length=255)
    recognition_trigger = models.TextField(blank=True)
    core_insight = models.TextField(blank=True)
    common_edge_cases = models.TextField(blank=True)
    llm_generated = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.pattern_name} ({self.problem.title})"

    @property
    def latest_review(self):
        return self.review_logs.order_by("-review_date").first()

    @property
    def next_review_date(self):
        latest = self.latest_review
        if latest:
            return latest.next_review_date
        return self.created_at.date()


class ReviewLog(models.Model):
    pattern_card = models.ForeignKey(
        PatternCard, on_delete=models.CASCADE, related_name="review_logs"
    )
    review_date = models.DateTimeField(auto_now_add=True)
    self_rating = models.IntegerField()
    next_review_date = models.DateField()

    class Meta:
        ordering = ["-review_date"]

    def __str__(self):
        return f"Review of {self.pattern_card.pattern_name} rated {self.self_rating}"


class PostMortem(models.Model):
    problem = models.ForeignKey(Problem, on_delete=models.CASCADE, related_name="postmortems")
    bug_found = models.TextField(blank=True)
    root_cause = models.TextField(blank=True)
    lesson_learned = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Post-mortem for {self.problem.title}"


class TestRun(models.Model):
    class Status(models.TextChoices):
        ACCEPTED = "Accepted", "Accepted"
        WRONG_ANSWER = "WrongAnswer", "Wrong Answer"
        RUNTIME_ERROR = "RuntimeError", "Runtime Error"
        TLE = "TLE", "Time Limit Exceeded"
        COMPILE_ERROR = "CompileError", "Compile Error"

    problem = models.ForeignKey(Problem, on_delete=models.CASCADE, related_name="test_runs")
    code_snapshot = models.TextField(blank=True)
    language = models.CharField(max_length=20)
    stdin = models.TextField(blank=True)
    expected_output = models.TextField(blank=True)
    actual_output = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACCEPTED)
    execution_time_ms = models.IntegerField(null=True, blank=True)
    timer_duration_seconds = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"TestRun({self.problem.title}, {self.status})"
