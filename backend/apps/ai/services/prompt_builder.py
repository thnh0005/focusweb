class PromptBuilder:
    def build_relevance_prompt(self, goal, title, meta, snippet) -> str:
        return (
            "Evaluate page relevance for the user's focus goal.\n"
            f"Goal: {goal}\n"
            f"Title: {title}\n"
            f"Meta: {meta}\n"
            f"Snippet: {snippet}"
        )
