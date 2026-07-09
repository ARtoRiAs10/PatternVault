from django.contrib.auth.models import User
from django.core.management import call_command
from django.core.management.base import BaseCommand

from core.models import Problem


class Command(BaseCommand):
    help = (
        "Loads demo seed data (8 example problems across topics) for PatternVault, "
        "and assigns them to a demo user (username: demo, password: demopass123) "
        "so they're visible after logging in."
    )

    def handle(self, *args, **options):
        call_command("loaddata", "seed_data")

        demo_user, created = User.objects.get_or_create(
            username="demo", defaults={"email": "demo@example.com"}
        )
        if created:
            demo_user.set_password("demopass123")
            demo_user.save()
            self.stdout.write(self.style.SUCCESS("Created demo user (demo / demopass123)."))
        else:
            self.stdout.write("Demo user already exists.")

        updated = Problem.objects.filter(owner__isnull=True).update(owner=demo_user)
        self.stdout.write(self.style.SUCCESS(f"Assigned {updated} seeded problem(s) to 'demo' user."))
        self.stdout.write(self.style.SUCCESS("Seed data loaded successfully. Log in as demo / demopass123."))
