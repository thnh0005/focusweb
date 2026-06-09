from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APITestCase

from .models import FlashcardDeck, StudyDocument


User = get_user_model()
PASSWORD = "A9!vQ2#pLm7$"


class DocumentApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="documents@example.com", password=PASSWORD)
        self.other_user = User.objects.create_user(
            email="documents-other@example.com",
            password=PASSWORD,
        )
        self.client.force_authenticate(self.user)

    def upload_txt_document(self, name="focus-notes.txt"):
        file = SimpleUploadedFile(
            name,
            b"Focus sessions need clear goals. Short reviews improve memory.",
            content_type="text/plain",
        )
        return self.client.post("/api/documents/upload/", {"file": file}, format="multipart")

    def test_document_upload_library_summary_flashcards_and_review_flow(self):
        upload = self.upload_txt_document()
        document_id = upload.data["id"]

        listing = self.client.get("/api/documents/?search=focus&fileType=txt")
        summary = self.client.get(f"/api/documents/{document_id}/summary/?mode=detailed")
        flashcards = self.client.get(f"/api/documents/{document_id}/flashcards/")
        deck_id = flashcards.data["id"]
        card_ids = [card["id"] for card in flashcards.data["cards"]]
        decks = self.client.get("/api/flashcard-decks/")
        review = self.client.post(
            f"/api/flashcard-decks/{deck_id}/review-session/",
            {
                "reviewedCardIds": card_ids,
                "correctCardIds": card_ids[:1],
                "metadata": {"source": "api-test"},
            },
            format="json",
        )

        self.assertEqual(upload.status_code, status.HTTP_201_CREATED)
        self.assertEqual(upload.data["fileType"], "txt")
        self.assertEqual(upload.data["status"], "ready")
        self.assertEqual(listing.status_code, status.HTTP_200_OK)
        self.assertEqual(len(listing.data), 1)
        self.assertEqual(summary.status_code, status.HTTP_200_OK)
        self.assertEqual(summary.data["documentId"], document_id)
        self.assertIn("focus-notes.txt", summary.data["content"])
        self.assertEqual(flashcards.status_code, status.HTTP_200_OK)
        self.assertGreater(len(flashcards.data["cards"]), 0)
        self.assertEqual(decks.status_code, status.HTTP_200_OK)
        self.assertEqual(decks.data[0]["id"], deck_id)
        self.assertEqual(review.status_code, status.HTTP_201_CREATED)
        self.assertEqual(review.data["totalCards"], len(card_ids))
        self.assertEqual(review.data["reviewedCount"], len(card_ids))

    def test_document_crud_is_user_scoped(self):
        upload = self.upload_txt_document("private.txt")
        document_id = upload.data["id"]
        update = self.client.patch(
            f"/api/documents/{document_id}/",
            {"originalName": "renamed.txt"},
            format="json",
        )

        self.client.force_authenticate(self.other_user)
        other_access = self.client.get(f"/api/documents/{document_id}/")

        self.client.force_authenticate(self.user)
        delete = self.client.delete(f"/api/documents/{document_id}/")
        listing = self.client.get("/api/documents/")

        self.assertEqual(update.status_code, status.HTTP_200_OK)
        self.assertEqual(update.data["originalName"], "renamed.txt")
        self.assertEqual(other_access.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(delete.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(listing.data, [])
        self.assertFalse(StudyDocument.objects.filter(pk=document_id).exists())

    def test_document_upload_rejects_unsupported_file_type(self):
        file = SimpleUploadedFile("notes.exe", b"bad", content_type="application/octet-stream")

        response = self.client.post("/api/documents/upload/", {"file": file}, format="multipart")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(FlashcardDeck.objects.exists())
