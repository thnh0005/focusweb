import hashlib
import json
import math
import re
from dataclasses import dataclass, field
from typing import Callable, Iterable

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.ai.models import AIRequestUsage, AITokenCalibration, AITokenCalibrationSample
from apps.ai.services.exceptions import AIProviderError


MODEL_TOKENIZER_REGISTRY = {
    "llama-3.1-8b-instant": {
        "tokenizer": "NousResearch/Meta-Llama-3.1-8B-Instruct",
        "context_window": 131072,
    },
    "llama3-8b-8192": {
        "tokenizer": "NousResearch/Meta-Llama-3-8B-Instruct",
        "context_window": 8192,
    },
    "model": {"tokenizer": "focusos/simple-chat", "context_window": 8192},
    "test-model": {"tokenizer": "focusos/simple-chat", "context_window": 8192},
    "summary-model": {"tokenizer": "focusos/simple-chat", "context_window": 8192},
    "flashcard-model": {"tokenizer": "focusos/simple-chat", "context_window": 8192},
}

_TOKENIZER_CACHE = {}


@dataclass(frozen=True)
class PreparedAIRequest:
    operation: str
    model: str
    messages: list[dict]
    tools: list | None = None
    response_format: dict | None = None
    max_completion_tokens: int = 0
    prompt_version: str = "legacy"
    job_id: str = ""
    document_id: object | None = None
    chunk_id: str = ""

    def to_payload(self):
        payload = {
            "model": self.model,
            "messages": self.messages,
        }
        if self.response_format:
            payload["response_format"] = self.response_format
        if self.tools:
            payload["tools"] = self.tools
        if self.max_completion_tokens:
            payload["max_tokens"] = self.max_completion_tokens
        return payload


@dataclass(frozen=True)
class TokenEstimate:
    tokenizer_name: str
    local_prompt_tokens: int
    calibration_ratio: float
    fixed_overhead_tokens: int
    calibrated_prompt_tokens: int
    reserved_output_tokens: int
    estimated_total_tokens: int
    payload_hash: str
    context_window: int


@dataclass(frozen=True)
class ChunkFitResult:
    text: str
    token_count: int
    estimated_total_tokens: int
    consumed_token_ids: list[int] = field(default_factory=list)


class SimpleChatTokenizer:
    name_or_path = "focusos/simple-chat"

    def encode(self, text, add_special_tokens=False):
        del add_special_tokens
        return [match.group(0) for match in re.finditer(r"\S+|\s+|[^\w\s]", str(text or ""), re.UNICODE)]

    def decode(self, token_ids):
        if not token_ids:
            return ""
        return "".join(str(token) for token in token_ids)

    def apply_chat_template(self, messages, tokenize=True, add_generation_prompt=True):
        rendered = []
        for message in messages:
            rendered.append(
                f"<|start_header_id|>{message.get('role', 'user')}<|end_header_id|>\n"
                f"{message.get('content', '')}<|eot_id|>"
            )
        if add_generation_prompt:
            rendered.append("<|start_header_id|>assistant<|end_header_id|>\n")
        text = "\n".join(rendered)
        return self.encode(text) if tokenize else text


def calculate_p95(values: Iterable[float], percentile: float | None = None):
    numbers = sorted(float(value) for value in values if value is not None)
    if not numbers:
        return 1.0
    percentile = settings.AI_CALIBRATION_PERCENTILE if percentile is None else percentile
    index = max(0, min(len(numbers) - 1, math.ceil(len(numbers) * percentile) - 1))
    return numbers[index]


class TokenCountingService:
    registry = MODEL_TOKENIZER_REGISTRY

    def get_model_config(self, model: str):
        if model in self.registry:
            return self.registry[model]
        raise AIProviderError(
            "No tokenizer is registered for this model.",
            error_code="UNSUPPORTED_MODEL_TOKENIZER",
            retryable=False,
        )

    def get_tokenizer(self, model: str):
        config = self.get_model_config(model)
        tokenizer_name = config["tokenizer"]
        if tokenizer_name in _TOKENIZER_CACHE:
            return _TOKENIZER_CACHE[tokenizer_name]
        if tokenizer_name == "focusos/simple-chat":
            tokenizer = SimpleChatTokenizer()
        else:
            try:
                from transformers import AutoTokenizer
            except ImportError as exc:
                raise AIProviderError(
                    "Tokenizer dependency is not installed.",
                    error_code="AI_TOKENIZER_UNAVAILABLE",
                    retryable=False,
                ) from exc
            try:
                tokenizer = AutoTokenizer.from_pretrained(tokenizer_name)
            except Exception as exc:
                raise AIProviderError(
                    "Tokenizer could not be loaded.",
                    error_code="AI_TOKENIZER_UNAVAILABLE",
                    retryable=False,
                ) from exc
            if not hasattr(tokenizer, "apply_chat_template"):
                raise AIProviderError(
                    "Tokenizer does not support chat templates.",
                    error_code="AI_TOKENIZER_UNSUPPORTED_CHAT_TEMPLATE",
                    retryable=False,
                )
        _TOKENIZER_CACHE[tokenizer_name] = tokenizer
        return tokenizer

    def count_text_tokens(self, model: str, value: str):
        return len(self.get_tokenizer(model).encode(str(value or ""), add_special_tokens=False))

    def count_chat_tokens(self, prepared_request: PreparedAIRequest):
        tokenizer = self.get_tokenizer(prepared_request.model)
        try:
            tokens = tokenizer.apply_chat_template(
                prepared_request.messages,
                tokenize=True,
                add_generation_prompt=True,
            )
        except Exception as exc:
            raise AIProviderError(
                "Tokenizer failed to apply the chat template.",
                error_code="AI_TOKENIZER_CHAT_TEMPLATE_FAILED",
                retryable=False,
            ) from exc
        total = len(tokens)
        for extra in (prepared_request.tools, prepared_request.response_format):
            if extra:
                total += len(tokenizer.encode(json.dumps(extra, sort_keys=True), add_special_tokens=False))
        return total

    def payload_hash(self, prepared_request: PreparedAIRequest):
        return hashlib.sha256(
            json.dumps(prepared_request.to_payload(), sort_keys=True, separators=(",", ":")).encode("utf-8")
        ).hexdigest()

    def get_calibration(self, provider, model, operation, prompt_version):
        calibration = AITokenCalibration.objects.filter(
            provider=provider,
            model=model,
            operation=operation,
            prompt_version=prompt_version,
        ).first()
        if not calibration:
            return settings.AI_INITIAL_CALIBRATION_RATIO, settings.AI_INITIAL_FIXED_OVERHEAD_TOKENS
        return calibration.p95_ratio, calibration.fixed_overhead_tokens

    def estimate_request(self, prepared_request: PreparedAIRequest, provider: str):
        config = self.get_model_config(prepared_request.model)
        tokenizer_name = config["tokenizer"]
        local_prompt_tokens = self.count_chat_tokens(prepared_request)
        calibration_ratio, fixed_overhead = self.get_calibration(
            provider,
            prepared_request.model,
            prepared_request.operation,
            prepared_request.prompt_version,
        )
        calibrated = math.ceil(local_prompt_tokens * calibration_ratio) + fixed_overhead
        reserved = int(prepared_request.max_completion_tokens or 0)
        return TokenEstimate(
            tokenizer_name=tokenizer_name,
            local_prompt_tokens=local_prompt_tokens,
            calibration_ratio=calibration_ratio,
            fixed_overhead_tokens=fixed_overhead,
            calibrated_prompt_tokens=calibrated,
            reserved_output_tokens=reserved,
            estimated_total_tokens=calibrated + reserved,
            payload_hash=self.payload_hash(prepared_request),
            context_window=int(config["context_window"]),
        )

    def validate_request_budget(self, prepared_request: PreparedAIRequest, provider: str):
        estimate = self.estimate_request(prepared_request, provider)
        target = min(settings.AI_TARGET_REQUEST_TOKENS, estimate.context_window)
        if estimate.estimated_total_tokens > target or estimate.estimated_total_tokens > settings.AI_MAX_REQUEST_TOKENS:
            usage = self.record_rejected(prepared_request, provider, estimate)
            raise AIProviderError(
                f"AI request token estimate exceeded budget: {estimate.estimated_total_tokens} > {target}.",
                error_code="AI_TOKEN_BUDGET_EXCEEDED",
                retryable=False,
                provider=provider,
                operation=prepared_request.operation,
            )
        return estimate

    def record_started(self, prepared_request: PreparedAIRequest, provider: str, estimate: TokenEstimate):
        return AIRequestUsage.objects.create(
            job_id=prepared_request.job_id,
            document_id=prepared_request.document_id,
            chunk_id=prepared_request.chunk_id,
            provider=provider,
            model=prepared_request.model,
            operation=prepared_request.operation,
            prompt_version=prepared_request.prompt_version,
            payload_hash=estimate.payload_hash,
            tokenizer_name=estimate.tokenizer_name,
            local_prompt_tokens=estimate.local_prompt_tokens,
            calibration_ratio=estimate.calibration_ratio,
            fixed_overhead_tokens=estimate.fixed_overhead_tokens,
            calibrated_prompt_tokens=estimate.calibrated_prompt_tokens,
            reserved_output_tokens=estimate.reserved_output_tokens,
            estimated_total_tokens=estimate.estimated_total_tokens,
            status=AIRequestUsage.Status.STARTED,
            request_started_at=timezone.now(),
        )

    def record_rejected(self, prepared_request: PreparedAIRequest, provider: str, estimate: TokenEstimate):
        return AIRequestUsage.objects.create(
            job_id=prepared_request.job_id,
            document_id=prepared_request.document_id,
            chunk_id=prepared_request.chunk_id,
            provider=provider,
            model=prepared_request.model,
            operation=prepared_request.operation,
            prompt_version=prepared_request.prompt_version,
            payload_hash=estimate.payload_hash,
            tokenizer_name=estimate.tokenizer_name,
            local_prompt_tokens=estimate.local_prompt_tokens,
            calibration_ratio=estimate.calibration_ratio,
            fixed_overhead_tokens=estimate.fixed_overhead_tokens,
            calibrated_prompt_tokens=estimate.calibrated_prompt_tokens,
            reserved_output_tokens=estimate.reserved_output_tokens,
            estimated_total_tokens=estimate.estimated_total_tokens,
            status=AIRequestUsage.Status.REJECTED,
            error_code="AI_TOKEN_BUDGET_EXCEEDED",
            request_started_at=timezone.now(),
            request_completed_at=timezone.now(),
        )

    def record_success(self, usage, provider_response, duration_ms):
        provider_usage = provider_response.get("usage") or {}
        actual_prompt = provider_usage.get("prompt_tokens")
        actual_completion = provider_usage.get("completion_tokens")
        actual_total = provider_usage.get("total_tokens")
        usage.status = AIRequestUsage.Status.COMPLETED
        usage.actual_prompt_tokens = actual_prompt
        usage.actual_completion_tokens = actual_completion
        usage.actual_total_tokens = actual_total
        usage.duration_ms = duration_ms
        usage.provider_request_id = provider_response.get("id", "")
        usage.request_completed_at = timezone.now()
        if actual_prompt and usage.local_prompt_tokens:
            usage.ratio = actual_prompt / usage.local_prompt_tokens
            usage.difference_tokens = actual_prompt - usage.local_prompt_tokens
        usage.save()
        if actual_prompt and usage.local_prompt_tokens:
            self.update_calibration_from_usage(usage)
        return usage

    def record_failure(self, usage, error_code):
        if not usage:
            return
        usage.status = AIRequestUsage.Status.FAILED
        usage.error_code = error_code or ""
        usage.request_completed_at = timezone.now()
        usage.save(update_fields=["status", "error_code", "request_completed_at"])

    def update_calibration_from_usage(self, usage):
        with transaction.atomic():
            calibration, _created = AITokenCalibration.objects.select_for_update().get_or_create(
                provider=usage.provider,
                model=usage.model,
                operation=usage.operation,
                prompt_version=usage.prompt_version,
                defaults={
                    "p95_ratio": settings.AI_INITIAL_CALIBRATION_RATIO,
                    "fixed_overhead_tokens": settings.AI_INITIAL_FIXED_OVERHEAD_TOKENS,
                    "window_size": settings.AI_CALIBRATION_WINDOW_SIZE,
                },
            )
            AITokenCalibrationSample.objects.get_or_create(
                usage=usage,
                defaults={
                    "calibration": calibration,
                    "local_prompt_tokens": usage.local_prompt_tokens,
                    "actual_prompt_tokens": usage.actual_prompt_tokens,
                    "ratio": usage.ratio,
                    "difference_tokens": usage.difference_tokens or 0,
                },
            )
            samples = list(
                calibration.samples.order_by("-created_at").values_list("ratio", flat=True)[
                    : settings.AI_CALIBRATION_WINDOW_SIZE
                ]
            )
            calibration.sample_count = len(samples)
            if len(samples) >= settings.AI_CALIBRATION_MIN_SAMPLES:
                calibration.p95_ratio = max(1.0, calculate_p95(samples))
            calibration.fixed_overhead_tokens = settings.AI_INITIAL_FIXED_OVERHEAD_TOKENS
            calibration.window_size = settings.AI_CALIBRATION_WINDOW_SIZE
            calibration.save()


def find_largest_fitting_chunk(
    source_token_ids,
    decode_tokens: Callable[[list], str],
    request_builder: Callable[[str], PreparedAIRequest],
    token_service: TokenCountingService,
    provider: str,
    minimum_chunk_tokens: int | None = None,
):
    minimum = minimum_chunk_tokens or settings.AI_MIN_CURRENT_CHUNK_TOKENS
    low, high = 0, len(source_token_ids)
    best = 0
    best_estimate = None
    while low <= high:
        mid = (low + high) // 2
        if mid == 0:
            low = 1
            continue
        request = request_builder(decode_tokens(source_token_ids[:mid]))
        estimate = token_service.estimate_request(request, provider)
        target = min(settings.AI_TARGET_REQUEST_TOKENS, estimate.context_window)
        if estimate.estimated_total_tokens > target or estimate.estimated_total_tokens > settings.AI_MAX_REQUEST_TOKENS:
            high = mid - 1
            continue
        best = mid
        best_estimate = estimate
        low = mid + 1
    if best < min(minimum, len(source_token_ids)) and len(source_token_ids) >= minimum:
        raise AIProviderError(
            "No fitting chunk met the minimum token size.",
            error_code="AI_TOKEN_CHUNK_TOO_SMALL",
            retryable=False,
        )
    text = decode_tokens(source_token_ids[:best])
    adjusted = _adjust_to_natural_boundary(text)
    if adjusted and adjusted != text:
        adjusted_tokens = source_token_ids[: len(token_service.get_tokenizer(request_builder(adjusted).model).encode(adjusted))]
        request = request_builder(adjusted)
        try:
            best_estimate = token_service.estimate_request(request, provider)
            target = min(settings.AI_TARGET_REQUEST_TOKENS, best_estimate.context_window)
            if best_estimate.estimated_total_tokens > target or best_estimate.estimated_total_tokens > settings.AI_MAX_REQUEST_TOKENS:
                raise AIProviderError(
                    "Adjusted chunk exceeded budget.",
                    error_code="AI_TOKEN_BUDGET_EXCEEDED",
                    retryable=False,
                )
            text = adjusted
            best = len(adjusted_tokens)
        except AIProviderError:
            pass
    return ChunkFitResult(
        text=text,
        token_count=best,
        estimated_total_tokens=best_estimate.estimated_total_tokens if best_estimate else 0,
        consumed_token_ids=list(source_token_ids[:best]),
    )


def _adjust_to_natural_boundary(text):
    if not text:
        return text
    floor_index = int(len(text) * 0.85)
    candidates = [text.rfind("\n\n", floor_index), text.rfind(". ", floor_index), text.rfind("? ", floor_index), text.rfind("! ", floor_index)]
    boundary = max(candidates)
    if boundary <= 0:
        return text
    return text[: boundary + 1].strip()
