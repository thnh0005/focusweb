import json
import time

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.ai.services.ai_client import AIClient
from apps.ai.services.exceptions import AIServiceError


class Command(BaseCommand):
    help = "Run a dev-only AI provider smoke test with a tiny JSON prompt."

    def add_arguments(self, parser):
        parser.add_argument("--provider", choices=["groq", "openrouter"], default=None)
        parser.add_argument("--model", default=None)
        parser.add_argument("--timeout", type=int, default=15)

    def handle(self, *args, **options):
        provider = options["provider"] or settings.AI_PROVIDER
        model = options["model"] or self.default_model(provider)
        api_key = self.api_key(provider)
        base_url = self.base_url(provider)

        if not api_key:
            raise CommandError(f"{provider} API key is not configured.")
        if not model:
            raise CommandError(f"{provider} model is not configured.")

        client = AIClient(
            api_key=api_key,
            model=model,
            base_url=base_url,
            timeout_seconds=options["timeout"],
            max_retries=0,
        )
        client.provider = provider

        started = time.monotonic()
        try:
            response = client.complete_json(
                "Return only a compact JSON object.",
                'Return exactly {"ok":true,"service":"focusos"} as JSON.',
                operation="ai_provider_smoke_test",
                prompt_version="ai-provider-smoke-test-v1",
                max_completion_tokens=64,
            )
            parsed = json.loads(response["content"])
        except AIServiceError as exc:
            raise CommandError(f"AI smoke test failed: {exc.error_code} ({exc.safe_message})") from exc
        except (KeyError, TypeError, json.JSONDecodeError) as exc:
            raise CommandError("AI smoke test failed: provider response was not valid JSON.") from exc

        if parsed.get("ok") is not True:
            raise CommandError("AI smoke test failed: JSON response did not include ok=true.")

        latency_ms = round((time.monotonic() - started) * 1000)
        usage = response.get("usage") or {}
        self.stdout.write(
            self.style.SUCCESS(
                "AI smoke test passed "
                f"(provider={provider}, model={response.get('model') or model}, "
                f"base_url={base_url}, "
                f"latency_ms={latency_ms}, "
                f"prompt_tokens={usage.get('prompt_tokens', 'unknown')}, "
                f"completion_tokens={usage.get('completion_tokens', 'unknown')})."
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

    def base_url(self, provider):
        if provider == "groq":
            return settings.GROQ_BASE_URL
        return settings.OPENROUTER_BASE_URL
