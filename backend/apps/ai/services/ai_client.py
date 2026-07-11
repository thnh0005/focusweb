import json
import socket
import time as time_module
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django.conf import settings

from .circuit_breaker import AICircuitBreaker
from .exceptions import (
    AIAuthError,
    AIInvalidResponse,
    AINotConfigured,
    AIServiceError,
    AIUnknownError,
    AIProviderError,
    AIProviderUnavailable,
    AIRateLimited,
    AITimeout,
)
from .observability import log_ai_event
from .prompt_builder import PromptBuilder


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
        self.api_key = api_key if api_key is not None else settings.OPENROUTER_API_KEY
        self.model = model if model is not None else settings.OPENROUTER_MODEL
        self.base_url = (
            base_url if base_url is not None else settings.OPENROUTER_BASE_URL
        ).rstrip("/")
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
    ) -> dict:
        self.ensure_configured()
        circuit = AICircuitBreaker(provider=self.PROVIDER, operation=operation)
        circuit_state = circuit.before_call()
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "response_format": {"type": "json_object"},
        }

        started = time.monotonic()
        try:
            response = self.post_json("/chat/completions", payload, operation=operation)
            latency_ms = round((time.monotonic() - started) * 1000)
            content = response["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            circuit.record_failure()
            raise AIInvalidResponse(
                "Provider response did not include content.",
                provider=self.PROVIDER,
                operation=operation,
            ) from exc
        except (AIInvalidResponse, AITimeout, AIRateLimited, AIProviderUnavailable) as exc:
            circuit.record_failure()
            raise
        except AIServiceError:
            raise
        except Exception as exc:
            circuit.record_failure()
            raise AIUnknownError(
                "Provider request failed unexpectedly.",
                provider=self.PROVIDER,
                operation=operation,
            ) from exc

        circuit.record_success()
        log_ai_event(
            "ai_request_success",
            operation=operation,
            provider=self.PROVIDER,
            latency_ms=latency_ms,
            circuit_state=circuit_state.state,
        )

        return {
            "content": content,
            "source": self.PROVIDER,
            "model": response.get("model") or self.model,
            "latency_ms": latency_ms,
        }

    def post_json(self, path: str, payload: dict, operation: str = "semantic") -> dict:
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
                    return json.loads(response.read().decode("utf-8"))
            except HTTPError as exc:
                error = self.error_from_http(exc, operation)
                if error.retryable and attempt < attempts - 1:
                    self.sleep_before_retry(attempt)
                    continue
                raise error from exc
            except (TimeoutError, socket.timeout) as exc:
                if attempt < attempts - 1:
                    self.sleep_before_retry(attempt)
                    continue
                raise AITimeout(
                    "Provider request timed out.",
                    provider=self.PROVIDER,
                    operation=operation,
                ) from exc
            except URLError as exc:
                if isinstance(exc.reason, (TimeoutError, socket.timeout)):
                    if attempt < attempts - 1:
                        self.sleep_before_retry(attempt)
                        continue
                    raise AITimeout(
                        "Provider request timed out.",
                        provider=self.PROVIDER,
                        operation=operation,
                    ) from exc
                if attempt < attempts - 1:
                    self.sleep_before_retry(attempt)
                    continue
                raise AIProviderUnavailable(
                    "Provider request failed.",
                    provider=self.PROVIDER,
                    operation=operation,
                ) from exc
            except json.JSONDecodeError as exc:
                raise AIInvalidResponse(
                    "Provider returned malformed transport JSON.",
                    provider=self.PROVIDER,
                    operation=operation,
                ) from exc

        raise AIProviderUnavailable(
            "Provider request failed.",
            provider=self.PROVIDER,
            operation=operation,
        )

    def error_from_http(self, exc: HTTPError, operation: str):
        if exc.code in {401, 403}:
            return AIAuthError(
                "Provider authentication failed.",
                provider=self.PROVIDER,
                operation=operation,
            )
        if exc.code == 429:
            return AIRateLimited(
                "Provider rate limit was reached.",
                provider=self.PROVIDER,
                operation=operation,
            )
        if exc.code >= 500:
            return AIProviderUnavailable(
                "Provider returned a temporary error.",
                provider=self.PROVIDER,
                operation=operation,
            )
        return AIProviderError(
            "Provider returned an error response.",
            retryable=False,
            provider=self.PROVIDER,
            operation=operation,
        )

    def sleep_before_retry(self, attempt: int):
        if self.retry_backoff_seconds <= 0:
            return
        time_module.sleep(self.retry_backoff_seconds * (attempt + 1))

    def ensure_configured(self):
        if not self.api_key or not self.model:
            raise AINotConfigured(
                "OpenRouter API key and model are required.",
                provider=self.PROVIDER,
            )

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
