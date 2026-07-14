import random
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone as datetime_timezone
from email.utils import parsedate_to_datetime

import redis
from django.conf import settings
from django.utils import timezone
from redis.exceptions import RedisError

from apps.ai.services.exceptions import AIQuotaDeferred
from apps.ai.services.observability import log_ai_event


RESERVE_SCRIPT = """
local key = KEYS[1]
local now_ms = tonumber(ARGV[1])
local window_ms = tonumber(ARGV[2])
local token_limit = tonumber(ARGV[3])
local request_limit = tonumber(ARGV[4])
local requested_tokens = tonumber(ARGV[5])
local reset_ms = tonumber(redis.call('HGET', key, 'reset_ms') or '0')
local used_tokens = tonumber(redis.call('HGET', key, 'used_tokens') or '0')
local used_requests = tonumber(redis.call('HGET', key, 'used_requests') or '0')
local blocked_until_ms = tonumber(redis.call('HGET', key, 'blocked_until_ms') or '0')

if blocked_until_ms > now_ms then
  local remaining_tokens = math.max(0, token_limit - used_tokens)
  return {0, remaining_tokens, blocked_until_ms, used_tokens, used_requests, 'blocked'}
end

if reset_ms <= now_ms then
  reset_ms = now_ms + window_ms
  used_tokens = 0
  used_requests = 0
end

local remaining_tokens = token_limit - used_tokens
local remaining_requests = request_limit - used_requests
if requested_tokens > remaining_tokens or remaining_requests <= 0 then
  redis.call('HMSET', key, 'reset_ms', reset_ms, 'used_tokens', used_tokens, 'used_requests', used_requests)
  redis.call('PEXPIRE', key, math.max(window_ms, reset_ms - now_ms))
  return {0, math.max(0, remaining_tokens), reset_ms, used_tokens, used_requests, 'limited'}
end

used_tokens = used_tokens + requested_tokens
used_requests = used_requests + 1
redis.call('HMSET', key, 'reset_ms', reset_ms, 'used_tokens', used_tokens, 'used_requests', used_requests)
redis.call('PEXPIRE', key, math.max(window_ms, reset_ms - now_ms))
return {1, math.max(0, token_limit - used_tokens), reset_ms, used_tokens, used_requests, 'allowed'}
"""


@dataclass(frozen=True)
class RateLimitReservation:
    allowed: bool
    retry_after_seconds: int
    remaining_tokens: int
    reset_at: datetime
    requested_tokens: int
    action: str


class ProviderRateLimiter:
    window_seconds = 60

    def __init__(self, redis_client=None):
        self.redis_client = redis_client

    def reserve(self, provider, model, operation, requested_tokens, context=None):
        if not settings.AI_RATE_LIMITER_ENABLED:
            return self.allowed(requested_tokens, "disabled")

        requested_tokens = self.apply_safety_margin(requested_tokens)
        token_limit = self.token_limit(provider, model)
        request_limit = self.request_limit(provider, model)
        if token_limit <= 0 or request_limit <= 0:
            return self.allowed(requested_tokens, "unconfigured")

        now_ms = int(time.time() * 1000)
        try:
            result = self.client().eval(
                RESERVE_SCRIPT,
                1,
                self.key(provider, model),
                now_ms,
                self.window_seconds * 1000,
                token_limit,
                request_limit,
                requested_tokens,
            )
        except RedisError as exc:
            if settings.AI_RATE_LIMITER_FAIL_OPEN:
                log_ai_event(
                    "ai_rate_limit_state",
                    provider=provider,
                    model=model,
                    operation=operation,
                    action="redis_unavailable_allowed",
                    estimated_tokens=requested_tokens,
                    error_code=exc.__class__.__name__,
                    **self.safe_context(context),
                )
                return self.allowed(requested_tokens, "redis_unavailable_allowed")
            raise

        allowed = bool(int(result[0]))
        remaining_tokens = int(result[1])
        reset_ms = int(result[2])
        reset_at = datetime.fromtimestamp(reset_ms / 1000, tz=datetime_timezone.utc)
        retry_after = self.retry_after(reset_at)
        action = self.decode_result_value(result[5])
        reservation = RateLimitReservation(
            allowed=allowed,
            retry_after_seconds=retry_after,
            remaining_tokens=remaining_tokens,
            reset_at=reset_at,
            requested_tokens=requested_tokens,
            action=action,
        )
        log_ai_event(
            "ai_rate_limit_state",
            provider=provider,
            model=model,
            operation=operation,
            action="allowed" if allowed else "deferred",
            estimated_tokens=requested_tokens,
            reserved_tokens=requested_tokens if allowed else 0,
            remaining_tokens=remaining_tokens,
            reset_seconds=retry_after,
            **self.safe_context(context),
        )
        if not allowed:
            raise AIQuotaDeferred(
                retry_after_seconds=retry_after,
                provider=provider,
                operation=operation,
                model=model,
                estimated_tokens=requested_tokens,
                remaining_tokens=remaining_tokens,
                reset_at=reset_at,
            )
        return reservation

    def observe_success_headers(self, provider, model, operation, headers, context=None):
        self.observe_headers(provider, model, operation, headers, status_code=200, context=context)

    def observe_rate_limit_headers(self, provider, model, operation, headers, context=None):
        self.observe_headers(provider, model, operation, headers, status_code=429, context=context)

    def observe_headers(self, provider, model, operation, headers, status_code, context=None):
        if not settings.AI_RATE_LIMITER_ENABLED or not headers:
            return
        normalized = self.normalized_headers(headers)
        retry_after = self.parse_retry_after(normalized.get("retry-after"))
        remaining = self.int_header(normalized, "x-ratelimit-remaining-tokens")
        limit = self.int_header(normalized, "x-ratelimit-limit-tokens")
        reset_seconds = self.parse_reset_seconds(normalized.get("x-ratelimit-reset-tokens"))
        if retry_after is not None:
            reset_seconds = max(reset_seconds or 0, retry_after)
        if status_code == 429 and reset_seconds is None:
            reset_seconds = self.fallback_backoff_seconds()
        if remaining is None and limit is None and reset_seconds is None:
            return

        now_ms = int(time.time() * 1000)
        reset_ms = now_ms + int((reset_seconds or self.window_seconds) * 1000)
        token_limit = limit or self.token_limit(provider, model)
        used_tokens = max(0, token_limit - remaining) if remaining is not None else None
        mapping = {"reset_ms": reset_ms}
        if used_tokens is not None:
            mapping["used_tokens"] = used_tokens
        if status_code == 429:
            mapping["blocked_until_ms"] = reset_ms
        try:
            client = self.client()
            client.hset(self.key(provider, model), mapping=mapping)
            client.pexpire(self.key(provider, model), max(self.window_seconds * 1000, reset_ms - now_ms))
        except RedisError:
            if not settings.AI_RATE_LIMITER_FAIL_OPEN:
                raise
        log_ai_event(
            "ai_rate_limit_state",
            provider=provider,
            model=model,
            operation=operation,
            action="rate_limited" if status_code == 429 else "observed",
            remaining_tokens=remaining if remaining is not None else -1,
            reset_seconds=reset_seconds or self.window_seconds,
            **self.safe_context(context),
        )

    def client(self):
        if self.redis_client is None:
            self.redis_client = redis.Redis.from_url(settings.AI_RATE_LIMITER_REDIS_URL)
        return self.redis_client

    def key(self, provider, model):
        return f"ai-rate-limit:{provider}:{model}"

    def token_limit(self, provider, model):
        del provider, model
        return int(settings.AI_PROVIDER_TOKEN_LIMIT_PER_MINUTE)

    def request_limit(self, provider, model):
        del provider, model
        return int(settings.AI_PROVIDER_REQUEST_LIMIT_PER_MINUTE)

    def apply_safety_margin(self, tokens):
        margin = float(settings.AI_RATE_LIMITER_SAFETY_MARGIN)
        return max(1, int((tokens or 0) * (1 + margin)))

    def retry_after(self, reset_at):
        seconds = int((reset_at - timezone.now()).total_seconds())
        return max(1, seconds)

    def fallback_backoff_seconds(self):
        base = int(settings.AI_RATE_LIMITER_FALLBACK_BACKOFF_SECONDS)
        jitter = random.randint(0, max(0, int(settings.AI_RATE_LIMITER_JITTER_SECONDS)))
        return max(1, base + jitter)

    def parse_retry_after(self, value):
        if not value:
            return None
        try:
            return max(0, int(float(value)))
        except (TypeError, ValueError):
            try:
                retry_at = parsedate_to_datetime(value)
            except (TypeError, ValueError):
                return None
            if timezone.is_naive(retry_at):
                retry_at = timezone.make_aware(retry_at)
            return max(0, int((retry_at - timezone.now()).total_seconds()))

    def parse_reset_seconds(self, value):
        if not value:
            return None
        try:
            return max(0, int(float(value)))
        except (TypeError, ValueError):
            retry_at = self.parse_retry_after(value)
            return retry_at

    def normalized_headers(self, headers):
        return {str(key).lower(): str(value) for key, value in dict(headers).items()}

    def int_header(self, headers, name):
        try:
            value = headers.get(name)
            return None if value is None else int(float(value))
        except (TypeError, ValueError):
            return None

    def allowed(self, requested_tokens, action):
        return RateLimitReservation(
            allowed=True,
            retry_after_seconds=0,
            remaining_tokens=0,
            reset_at=timezone.now() + timedelta(seconds=self.window_seconds),
            requested_tokens=int(requested_tokens or 0),
            action=action,
        )

    def safe_context(self, context):
        context = context or {}
        return {
            key: value
            for key, value in context.items()
            if key
            in {
                "document_id",
                "job_id",
                "chunk_id",
                "task_id",
                "root_id",
                "parent_id",
                "request_usage_id",
                "attempt",
            }
            and value not in {None, ""}
        }

    def decode_result_value(self, value):
        if isinstance(value, bytes):
            return value.decode("utf-8")
        return str(value)
