import uuid
from time import monotonic, sleep

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.core.management.base import BaseCommand, CommandError
from django.test import override_settings
from django.utils import timezone

from apps.ai.models import AIRequestUsage, DocumentSummary, FlashcardDeck, StudyDocument
from apps.ai.services.document_extraction import build_storage_filename
from apps.ai.services.document_summary import DocumentSummaryService
from apps.ai.services.flashcard_generation import FlashcardGenerationService
from apps.ai.tasks import (
    extract_document_text,
    generate_document_flashcards,
    generate_document_summary,
)


class Command(BaseCommand):
    help = "Run a staging-only live provider verification for document extraction, summary, and flashcards."

    def add_arguments(self, parser):
        parser.add_argument("--confirm-live-provider", action="store_true")
        parser.add_argument("--provider", choices=["groq", "openrouter"], default=None)
        parser.add_argument("--model", default=None)
        parser.add_argument("--timeout", type=int, default=180)
        parser.add_argument("--use-celery", action="store_true")

    def handle(self, *args, **options):
        if not options["confirm_live_provider"]:
            raise CommandError("Refusing to run live provider E2E without --confirm-live-provider.")

        provider = options["provider"] or settings.AI_PROVIDER
        model = options["model"] or self.default_model(provider)
        if not self.api_key(provider):
            raise CommandError(f"{provider} API key is not configured.")
        if not model:
            raise CommandError(f"{provider} model is not configured.")

        overrides = {"AI_PROVIDER": provider}
        if provider == "groq":
            overrides.update(
                {
                    "GROQ_MODEL": model,
                    "DOCUMENT_SUMMARY_MODEL": model,
                    "FLASHCARD_GENERATION_MODEL": model,
                }
            )
        else:
            overrides.update(
                {
                    "OPENROUTER_MODEL": model,
                    "DOCUMENT_SUMMARY_MODEL": model,
                    "FLASHCARD_GENERATION_MODEL": model,
                }
            )

        started_at = timezone.now()
        start = monotonic()
        user = None
        document = None
        source_path = ""
        try:
            with override_settings(**overrides):
                user, document, source_path = self.create_temporary_document()
                self.step("create", f"document_id={document.id}")

                if options["use_celery"]:
                    extract_document_text.delay(str(document.id))
                    document = self.wait_for_document_ready(document.id, options["timeout"], start)
                else:
                    extract_document_text.apply(args=[str(document.id)], throw=True)
                    document.refresh_from_db()
                if document.status != StudyDocument.Status.READY:
                    raise CommandError(f"Extraction did not complete: status={document.status}.")
                self.step("extraction", "ready")

                summary_result = DocumentSummaryService().request_summary(
                    document,
                    DocumentSummary.Mode.KEY_POINTS,
                    force=True,
                )
                if options["use_celery"]:
                    generate_document_summary.delay(str(document.id), DocumentSummary.Mode.KEY_POINTS, force=True)
                    summary = self.wait_for_summary(summary_result.summary.id, options["timeout"], start)
                else:
                    generate_document_summary.apply(
                        args=[str(document.id), DocumentSummary.Mode.KEY_POINTS],
                        kwargs={"force": True},
                        throw=True,
                    )
                    summary = DocumentSummary.objects.get(pk=summary_result.summary.id)
                if summary.status != DocumentSummary.Status.COMPLETED or not summary.content.strip():
                    raise CommandError(f"Summary failed: status={summary.status} code={summary.error_code}.")
                self.step("summary", f"completed chars={len(summary.content)}")

                config = {"scope": "full_document", "quantity": 5, "difficulty": "medium"}
                deck_result = FlashcardGenerationService().request_generation(document, config, force=True)
                if options["use_celery"]:
                    generate_document_flashcards.delay(str(document.id), {**config, "force": False}, force=False)
                    deck = self.wait_for_deck(deck_result.deck.id, options["timeout"], start)
                else:
                    generate_document_flashcards.apply(
                        args=[str(document.id), {**config, "force": False}],
                        kwargs={"force": False},
                        throw=True,
                    )
                    deck = FlashcardDeck.objects.prefetch_related("cards").get(pk=deck_result.deck.id)
                if deck.status != FlashcardDeck.Status.COMPLETED or deck.cards.count() != 5:
                    raise CommandError(
                        f"Flashcards failed: status={deck.status} cards={deck.cards.count()} code={deck.error_code}."
                    )
                self.step("flashcards", "completed cards=5")

                self.print_usage(started_at, provider, model, round((monotonic() - start) * 1000))
        finally:
            if document is not None:
                document.delete()
            elif source_path and default_storage.exists(source_path):
                default_storage.delete(source_path)
            if user is not None:
                user.delete()

    def create_temporary_document(self):
        User = get_user_model()
        unique = uuid.uuid4().hex
        user = User.objects.create_user(
            email=f"focusos-ai-e2e-{unique}@example.invalid",
            password=uuid.uuid4().hex,
        )
        original_name = f"focusos-ai-e2e-{unique}.txt"
        text = (
            "FocusOS live verification document. Clear goals improve study sessions. "
            "Short reviews strengthen memory. Flashcards should be grounded in this text."
        )
        filename = build_storage_filename(original_name, "txt")
        source_path = default_storage.save(
            f"study-documents/e2e/{filename}",
            ContentFile(text.encode("utf-8")),
        )
        document = StudyDocument.objects.create(
            user=user,
            filename=filename,
            original_name=original_name,
            file_type=StudyDocument.FileType.TXT,
            file_size_bytes=len(text.encode("utf-8")),
            status=StudyDocument.Status.UPLOADED,
            metadata={
                "source_file": {"path": source_path, "content_type": "text/plain"},
                "extraction": {"status": "pending", "queued_at": timezone.now().isoformat()},
            },
        )
        return user, document, source_path

    def wait_for_document_ready(self, document_id, timeout, start):
        while monotonic() - start < timeout:
            document = StudyDocument.objects.get(pk=document_id)
            if document.status in {StudyDocument.Status.READY, StudyDocument.Status.ERROR}:
                return document
            sleep(2)
        raise CommandError("Timed out waiting for document extraction.")

    def wait_for_summary(self, summary_id, timeout, start):
        while monotonic() - start < timeout:
            summary = DocumentSummary.objects.get(pk=summary_id)
            if summary.status in {DocumentSummary.Status.COMPLETED, DocumentSummary.Status.FAILED}:
                return summary
            sleep(2)
        raise CommandError("Timed out waiting for summary generation.")

    def wait_for_deck(self, deck_id, timeout, start):
        while monotonic() - start < timeout:
            deck = FlashcardDeck.objects.prefetch_related("cards").get(pk=deck_id)
            if deck.status in {
                FlashcardDeck.Status.COMPLETED,
                FlashcardDeck.Status.PARTIAL,
                FlashcardDeck.Status.FAILED,
            }:
                return deck
            sleep(2)
        raise CommandError("Timed out waiting for flashcard generation.")

    def step(self, name, detail):
        self.stdout.write(self.style.SUCCESS(f"{name}: {detail}"))

    def print_usage(self, started_at, provider, model, latency_ms):
        usages = AIRequestUsage.objects.filter(
            created_at__gte=started_at,
            operation__in=["document_summary", "flashcard_generation"],
        )
        prompt_tokens = sum(usage.actual_prompt_tokens or 0 for usage in usages)
        completion_tokens = sum(usage.actual_completion_tokens or 0 for usage in usages)
        self.stdout.write(
            self.style.SUCCESS(
                "provider: "
                f"{provider}, model: {model}, latency_ms: {latency_ms}, "
                f"requests: {usages.count()}, prompt_tokens: {prompt_tokens}, "
                f"completion_tokens: {completion_tokens}"
            )
        )

    def default_model(self, provider):
        if provider == "groq":
            return settings.GROQ_MODEL or settings.OPENROUTER_MODEL
        return settings.OPENROUTER_MODEL or settings.GROQ_MODEL

    def api_key(self, provider):
        if provider == "groq":
            return settings.GROQ_API_KEY
        return settings.OPENROUTER_API_KEY
