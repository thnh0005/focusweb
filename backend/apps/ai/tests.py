from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from .models import AIAnalysisResult


User = get_user_model()
PASSWORD = "A9!vQ2#pLm7$"


class AIAnalysisResultModelTests(APITestCase):
    def test_ai_analysis_result_model_creation(self):
        user = User.objects.create_user(email="ai-model@example.com", password=PASSWORD)
        session_id = user.id

        result = AIAnalysisResult.objects.create(
            session_id=session_id,
            provider="mock",
            model_name="mock-relevance",
            session_goal="Study Django REST Framework",
            page_title="DRF serializers",
            domain="www.django-rest-framework.org",
            content_snippet="Serializers allow complex data to be converted.",
            relevance_score=0.87,
            is_relevant=True,
            focus_state=AIAnalysisResult.FocusState.FOCUSED,
            reason="Documentation matches the focus goal.",
            raw_response={"score": 0.87},
            latency_ms=123,
        )

        self.assertIsNotNone(result.id)
        self.assertEqual(result.session_id, session_id)
        self.assertEqual(result.focus_state, AIAnalysisResult.FocusState.FOCUSED)
        self.assertTrue(result.is_relevant)
        self.assertEqual(result.raw_response["score"], 0.87)
        self.assertIn("AI 0.87 focused", str(result))


class DocumentApiTests(APITestCase):
    def test_document_list_is_empty_until_document_storage_is_implemented(self):
        user = User.objects.create_user(email="documents@example.com", password=PASSWORD)
        self.client.force_authenticate(user)

        response = self.client.get("/api/documents/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [])

