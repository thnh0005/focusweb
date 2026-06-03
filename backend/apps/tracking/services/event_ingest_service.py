class EventIngestService:
    def ingest_batch(self, user, session_id, events: list) -> dict:
        if not isinstance(events, list):
            raise ValueError("Events must be a list.")

        return {
            "session_id": session_id,
            "accepted": len(events),
            "rejected": 0,
        }
