class AIServiceError(Exception):
    error_code = "AI_PROVIDER_ERROR"
    retryable = False
    safe_message = "AI provider request failed."

    def __init__(
        self,
        message="",
        error_code=None,
        retryable=None,
        provider="",
        operation="",
    ):
        super().__init__(message or self.safe_message)
        if error_code:
            self.error_code = error_code
        if retryable is not None:
            self.retryable = retryable
        self.provider = provider
        self.operation = operation

    def to_safe_dict(self):
        return {
            "code": self.error_code,
            "retryable": self.retryable,
            "message": self.safe_message,
            "provider": self.provider or None,
            "operation": self.operation or None,
        }


class AINotConfigured(AIServiceError):
    error_code = "AI_NOT_CONFIGURED"
    safe_message = "AI provider is not configured."


class AIAuthError(AIServiceError):
    error_code = "AI_AUTH_ERROR"
    safe_message = "AI provider authentication failed."


class AITimeout(AIServiceError):
    error_code = "AI_TIMEOUT"
    retryable = True
    safe_message = "AI provider request timed out."


class AIRateLimited(AIServiceError):
    error_code = "AI_RATE_LIMITED"
    retryable = True
    safe_message = "AI provider rate limit was reached."


class AIProviderUnavailable(AIServiceError):
    error_code = "AI_PROVIDER_UNAVAILABLE"
    retryable = True
    safe_message = "AI provider is temporarily unavailable."


class AIProviderError(AIServiceError):
    error_code = "AI_PROVIDER_ERROR"
    safe_message = "AI provider returned an error."


class AIInvalidResponse(AIServiceError):
    error_code = "AI_INVALID_RESPONSE"
    safe_message = "AI provider returned an invalid response."


class AICircuitOpen(AIServiceError):
    error_code = "AI_CIRCUIT_OPEN"
    retryable = True
    safe_message = "AI provider circuit is open."


class AIUnknownError(AIServiceError):
    error_code = "AI_UNKNOWN_ERROR"
    safe_message = "AI provider failed unexpectedly."
