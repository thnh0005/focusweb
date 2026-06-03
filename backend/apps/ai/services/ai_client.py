class AIClient:
    def analyze_relevance(
        self,
        goal: str,
        title: str = "",
        meta: str = "",
        snippet: str = "",
    ) -> dict:
        return {
            "relevance_score": 0.0,
            "label": "unknown",
            "provider": "mock",
        }
