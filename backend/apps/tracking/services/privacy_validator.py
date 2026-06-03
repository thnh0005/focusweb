class PrivacyValidator:
    def validate_browser_payload(self, payload: dict) -> dict:
        if not isinstance(payload, dict):
            raise ValueError("Browser payload must be a dict.")
        return payload
