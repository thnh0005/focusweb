import json
import socket
import time as time_module
import time
from email.utils import parsedate_to_datetime
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django.conf import settings
from django.utils import timezone

from .circuit_breaker import AICircuitBreaker
from .exceptions import (
    AIAuthError,
    AIInvalidResponse,
    AINotConfigured,
    AIServiceError,
    AIUnknownError,
    AIProviderError,
    AIProviderUnavailable,
    AIQuotaDeferred,
    AIRateLimited,
    AITimeout,
)
from .observability import log_ai_event
from .provider_rate_limiter import ProviderRateLimiter
from .prompt_builder import PromptBuilder
from .token_counter import PreparedAIRequest, TokenCountingService


class AIClient:
    PROVIDER = "openrouter"

    def __init__(
        self,
        api_key=None,
        model=None,
        base_url=None,
        timeout_seconds=None,
        max_retries=None,
        retry_backoff_seconds=None,
    ):
        self.provider = settings.AI_PROVIDER
        self.api_key = api_key if api_key is not None else (
            settings.GROQ_API_KEY or settings.OPENROUTER_API_KEY
        )
        self.model = model if model is not None else (
            settings.GROQ_MODEL or settings.OPENROUTER_MODEL
        )
        default_base_url = (
            settings.GROQ_BASE_URL
            if self.provider == "groq"
            else settings.OPENROUTER_BASE_URL
        )
        self.base_url = (base_url if base_url is not None else default_base_url).rstrip("/")
        self.timeout_seconds = (
            timeout_seconds
            if timeout_seconds is not None
            else settings.AI_REQUEST_TIMEOUT_SECONDS
        )
        self.max_retries = (
            max_retries if max_retries is not None else settings.AI_MAX_RETRIES
        )
        self.retry_backoff_seconds = (
            retry_backoff_seconds
            if retry_backoff_seconds is not None
            else settings.AI_RETRY_BACKOFF_SECONDS
        )

    def complete_json(
        self,
        system_prompt: str,
        user_prompt: str,
        operation: str = "semantic",
        prompt_version: str = "legacy",
        max_completion_tokens: int | None = None,
        job_id: str = "",
        document_id=None,
        chunk_id: str = "",
    ) -> dict:
        prepared = PreparedAIRequest(
            operation=operation,
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
            max_completion_tokens=(
                max_completion_tokens
                if max_completion_tokens is not None
                else self.reserve_for_operation(operation)
            ),
            prompt_version=prompt_version,
            job_id=job_id,
            document_id=document_id,
            chunk_id=chunk_id,
        )
        return self.complete_prepared(prepared)

    def complete_prepared(self, prepared: PreparedAIRequest) -> dict:
        self.ensure_configured()
        circuit = AICircuitBreaker(provider=self.provider, operation=prepared.operation)
        circuit_state = circuit.before_call()
        token_service = TokenCountingService()
        usage = None
        estimate = token_service.validate_request_budget(prepared, self.provider)
        rate_context = self.rate_limit_context(prepared)
        ProviderRateLimiter().reserve(
            self.provider,
            prepared.model,
            prepared.operation,
            estimate.estimated_total_tokens,
            context=rate_context,
        )
        usage = token_service.record_started(prepared, self.provider, estimate)
        rate_context["request_usage_id"] = str(usage.id)
        payload = prepared.to_payload()

        started = time.monotonic()
        try:
            response = self.post_json(
                "/chat/completions",
                payload,
                operation=prepared.operation,
                rate_limit_context=rate_context,
            )
            latency_ms = round((time.monotonic() - started) * 1000)
            content = response["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            circuit.record_failure()
            token_service.record_failure(usage, "AI_INVALID_RESPONSE")
            raise AIInvalidResponse(
                "Provider response did not include content.",
                provider=self.provider,
                operation=prepared.operation,
            ) from exc
        except (AIInvalidResponse, AITimeout, AIQuotaDeferred, AIRateLimited, AIProviderUnavailable) as exc:
            circuit.record_failure()
            token_service.record_failure(usage, exc.error_code)
            raise
        except AIServiceError as exc:
            circuit.record_failure()
            token_service.record_failure(usage, exc.error_code)
            raise
        except Exception as exc:
            circuit.record_failure()
            token_service.record_failure(usage, "AI_UNKNOWN_ERROR")
            raise AIUnknownError(
                "Provider request failed unexpectedly.",
                provider=self.provider,
                operation=prepared.operation,
            ) from exc

        token_service.record_success(usage, response, latency_ms)
        circuit.record_success()
        log_ai_event(
            "ai_request_success",
            operation=prepared.operation,
            provider=self.provider,
            latency_ms=latency_ms,
            circuit_state=circuit_state.state,
            local_prompt_tokens=estimate.local_prompt_tokens,
            calibrated_prompt_tokens=estimate.calibrated_prompt_tokens,
            estimated_total_tokens=estimate.estimated_total_tokens,
            request_usage_id=str(usage.id),
            document_id=str(prepared.document_id) if prepared.document_id else "",
            job_id=prepared.job_id,
            chunk_id=prepared.chunk_id,
            **self.celery_context(),
        )

        return {
            "content": content,
            "source": self.provider,
            "model": response.get("model") or self.model,
            "latency_ms": latency_ms,
            "usage": response.get("usage") or {},
            "request_usage_id": str(usage.id),
        }

    def reserve_for_operation(self, operation):
        return {
            "document_summary": settings.AI_DETAILED_SUMMARY_OUTPUT_RESERVE_TOKENS,
            "flashcard_generation": settings.AI_FLASHCARD_OUTPUT_RESERVE_TOKENS,
        }.get(operation, settings.AI_CHUNK_OUTPUT_RESERVE_TOKENS)

    def post_json(self, path: str, payload: dict, operation: str = "semantic", rate_limit_context=None) -> dict:
        data = json.dumps(payload).encode("utf-8")
        request = Request(
            f"{self.base_url}{path}",
            data=data,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                "Accept": "application/json",
                "User-Agent": "FocusOS/0.1 (+https://localhost)",
            },
            method="POST",
        )

        attempts = max(0, int(self.max_retries)) + 1
        for attempt in range(attempts):
            try:
                with urlopen(request, timeout=self.timeout_seconds) as response:
                    ProviderRateLimiter().observe_success_headers(
                        self.provider,
                        payload.get("model") or self.model,
                        operation,
                        response.headers,
                        context=rate_limit_context,
                    )
                    return json.loads(response.read().decode("utf-8"))
            except HTTPError as exc:
                if exc.code == 429:
                    ProviderRateLimiter().observe_rate_limit_headers(
                        self.provider,
                        payload.get("model") or self.model,
                        operation,
                        exc.headers,
                        context=rate_limit_context,
                    )
                error = self.error_from_http(exc, operation)
                if error.retryable and attempt < attempts - 1:
                    self.sleep_before_retry(attempt, retry_after=self.retry_after_seconds(exc))
                    continue
                raise error from exc
            except (TimeoutError, socket.timeout) as exc:
                if attempt < attempts - 1:
                    self.sleep_before_retry(attempt)
                    continue
                raise AITimeout(
                    "Provider request timed out.",
                    provider=self.provider,
                    operation=operation,
                ) from exc
            except URLError as exc:
                if isinstance(exc.reason, (TimeoutError, socket.timeout)):
                    if attempt < attempts - 1:
                        self.sleep_before_retry(attempt)
                        continue
                    raise AITimeout(
                        "Provider request timed out.",
                        provider=self.provider,
                        operation=operation,
                    ) from exc
                if attempt < attempts - 1:
                    self.sleep_before_retry(attempt)
                    continue
                raise AIProviderUnavailable(
                    "Provider request failed.",
                    provider=self.provider,
                    operation=operation,
                ) from exc
            except json.JSONDecodeError as exc:
                raise AIInvalidResponse(
                    "Provider returned malformed transport JSON.",
                    provider=self.provider,
                    operation=operation,
                ) from exc

        raise AIProviderUnavailable(
            "Provider request failed.",
            provider=self.provider,
            operation=operation,
        )

    def error_from_http(self, exc: HTTPError, operation: str):
        if exc.code in {401, 403}:
            return AIAuthError(
                "Provider authentication failed.",
                provider=self.provider,
                operation=operation,
            )
        if exc.code == 429:
            retry_after = self.retry_after_seconds(exc)
            if retry_after is None:
                retry_after = ProviderRateLimiter().fallback_backoff_seconds()
            return AIQuotaDeferred(
                "Provider rate limit was reached.",
                provider=self.provider,
                operation=operation,
                model=self.model,
                retry_after_seconds=retry_after,
            )
        if exc.code >= 500:
            return AIProviderUnavailable(
                "Provider returned a temporary error.",
                provider=self.provider,
                operation=operation,
            )
        return AIProviderError(
            "Provider returned an error response.",
            retryable=False,
            provider=self.provider,
            operation=operation,
        )

    def retry_after_seconds(self, exc: HTTPError):
        value = exc.headers.get("Retry-After") if exc.headers else None
        if not value:
            return None
        try:
            return max(0, int(value))
        except ValueError:
            try:
                retry_at = parsedate_to_datetime(value)
            except (TypeError, ValueError):
                return None
            if timezone.is_naive(retry_at):
                retry_at = timezone.make_aware(retry_at)
            return max(0, int((retry_at - timezone.now()).total_seconds()))

    def sleep_before_retry(self, attempt: int, retry_after=None):
        if retry_after is not None:
            time_module.sleep(retry_after)
            return
        if self.retry_backoff_seconds > 0:
            time_module.sleep(self.retry_backoff_seconds * (attempt + 1))

    def ensure_configured(self):
        if not self.api_key or not self.model:
            raise AINotConfigured(
                "OpenRouter API key and model are required.",
                provider=self.provider,
            )

    def rate_limit_context(self, prepared):
        return {
            "document_id": str(prepared.document_id) if prepared.document_id else "",
            "job_id": prepared.job_id,
            "chunk_id": prepared.chunk_id,
            **self.celery_context(),
        }

    def celery_context(self):
        try:
            from celery import current_task
        except ImportError:
            return {}
        task = current_task
        request = getattr(task, "request", None)
        if request is None:
            return {}
        return {
            "task_id": getattr(request, "id", "") or "",
            "root_id": getattr(request, "root_id", "") or "",
            "parent_id": getattr(request, "parent_id", "") or "",
            "attempt": getattr(request, "retries", 0) or 0,
        }

    def analyze_relevance(
        self,
        goal: str,
        title: str = "",
        meta: str = "",
        snippet: str = "",
    ) -> dict:
        system_prompt, user_prompt = PromptBuilder().build_relevance_messages(
            goal=goal,
            title=title,
            meta=meta,
            snippet=snippet,
        )
        return self.complete_json(system_prompt, user_prompt)
