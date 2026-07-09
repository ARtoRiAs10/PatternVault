from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import PatternCard, PostMortem, Problem, ReviewLog, TestRun, Topic


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])

    class Meta:
        model = User
        fields = ["id", "username", "email", "password"]

    def create(self, validated_data):
        return User.objects.create_user(
            username=validated_data["username"],
            email=validated_data.get("email", ""),
            password=validated_data["password"],
        )


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "email"]


class TopicSerializer(serializers.ModelSerializer):
    class Meta:
        model = Topic
        fields = ["id", "name", "parent_category"]


class TestRunSerializer(serializers.ModelSerializer):
    class Meta:
        model = TestRun
        fields = [
            "id",
            "problem",
            "code_snapshot",
            "language",
            "stdin",
            "expected_output",
            "actual_output",
            "status",
            "execution_time_ms",
            "timer_duration_seconds",
            "created_at",
        ]
        read_only_fields = ["created_at"]


class PostMortemSerializer(serializers.ModelSerializer):
    class Meta:
        model = PostMortem
        fields = [
            "id",
            "problem",
            "bug_found",
            "root_cause",
            "lesson_learned",
            "created_at",
        ]
        read_only_fields = ["created_at"]


class ReviewLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReviewLog
        fields = ["id", "pattern_card", "review_date", "self_rating", "next_review_date"]
        read_only_fields = ["review_date", "next_review_date"]


class PatternCardSerializer(serializers.ModelSerializer):
    next_review_date = serializers.SerializerMethodField()
    problem_title = serializers.CharField(source="problem.title", read_only=True)

    class Meta:
        model = PatternCard
        fields = [
            "id",
            "problem",
            "problem_title",
            "pattern_name",
            "recognition_trigger",
            "core_insight",
            "common_edge_cases",
            "llm_generated",
            "created_at",
            "next_review_date",
        ]
        read_only_fields = ["created_at"]

    def get_next_review_date(self, obj):
        return obj.next_review_date


class ProblemSerializer(serializers.ModelSerializer):
    topics = TopicSerializer(many=True, read_only=True)
    topic_ids = serializers.PrimaryKeyRelatedField(
        source="topics", many=True, queryset=Topic.objects.all(), write_only=True, required=False
    )
    pattern_cards = PatternCardSerializer(many=True, read_only=True)
    test_run_count = serializers.SerializerMethodField()

    class Meta:
        model = Problem
        fields = [
            "id",
            "title",
            "source",
            "url",
            "statement",
            "difficulty_rating",
            "status",
            "topics",
            "topic_ids",
            "language",
            "code_submitted",
            "time_taken_minutes",
            "is_core_algorithm",
            "created_at",
            "pattern_cards",
            "test_run_count",
        ]
        read_only_fields = ["created_at"]

    def get_test_run_count(self, obj):
        return obj.test_runs.count()


class ProblemListSerializer(serializers.ModelSerializer):
    """Lighter-weight serializer for list views / dashboards."""

    topics = TopicSerializer(many=True, read_only=True)

    class Meta:
        model = Problem
        fields = [
            "id",
            "title",
            "source",
            "url",
            "difficulty_rating",
            "status",
            "topics",
            "language",
            "time_taken_minutes",
            "is_core_algorithm",
            "created_at",
        ]
