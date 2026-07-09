from django.contrib import admin

from .models import PatternCard, PostMortem, Problem, ReviewLog, TestRun, Topic


@admin.register(Topic)
class TopicAdmin(admin.ModelAdmin):
    list_display = ("name", "parent_category")
    list_filter = ("parent_category",)
    search_fields = ("name",)


@admin.register(Problem)
class ProblemAdmin(admin.ModelAdmin):
    list_display = ("title", "owner", "source", "status", "difficulty_rating", "is_core_algorithm", "created_at")
    list_filter = ("source", "status", "language", "is_core_algorithm")
    search_fields = ("title", "statement", "owner__username")
    filter_horizontal = ("topics",)


@admin.register(PatternCard)
class PatternCardAdmin(admin.ModelAdmin):
    list_display = ("pattern_name", "problem", "llm_generated", "created_at")
    list_filter = ("llm_generated",)
    search_fields = ("pattern_name", "problem__title")


@admin.register(ReviewLog)
class ReviewLogAdmin(admin.ModelAdmin):
    list_display = ("pattern_card", "self_rating", "review_date", "next_review_date")
    list_filter = ("self_rating",)


@admin.register(PostMortem)
class PostMortemAdmin(admin.ModelAdmin):
    list_display = ("problem", "created_at")
    search_fields = ("problem__title", "bug_found")


@admin.register(TestRun)
class TestRunAdmin(admin.ModelAdmin):
    list_display = ("problem", "language", "status", "execution_time_ms", "created_at")
    list_filter = ("status", "language")
