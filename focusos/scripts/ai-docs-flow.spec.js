import fs from "node:fs";
import { test, expect } from "@playwright/test";

const API_PATTERN = /\/api\/(.+)$/;

test("AI Docs dashboard upload, summary, flashcards, review, and drag flow", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const now = new Date().toISOString();
  const documentId = "11111111-1111-4111-8111-111111111111";
  const uploadedDocument = {
    id: documentId,
    userId: "22222222-2222-4222-8222-222222222222",
    filename: "ai-doc-flow.txt",
    originalName: "ai-doc-flow.txt",
    fileType: "txt",
    fileSizeBytes: 128,
    pageCount: 1,
    status: "ready",
    hasSummary: false,
    hasFlashcards: false,
    uploadedAt: now,
    processedAt: now,
  };
  const documents = [
    {
      ...uploadedDocument,
      id: "33333333-3333-4333-8333-333333333333",
      originalName: "existing-notes.txt",
      hasSummary: true,
    },
  ];
  const requests = {
    uploadCount: 0,
    summaryPayloads: [],
    flashcardPayloads: [],
  };

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const match = url.pathname.match(API_PATTERN);
    const apiPath = match?.[1] ?? "";
    const method = request.method();

    if (apiPath === "auth/me/") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "22222222-2222-4222-8222-222222222222",
          email: "tester@example.com",
          displayName: "Tester",
          createdAt: now,
          onboardingComplete: true,
          isEmailVerified: true,
        }),
      });
    }

    if (apiPath === "auth/csrf/") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "set-cookie": "csrftoken=test-csrf; Path=/" },
        body: JSON.stringify({ csrfToken: "test-csrf" }),
      });
    }

    if (apiPath === "user/profile/") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "22222222-2222-4222-8222-222222222222",
          email: "tester@example.com",
          displayName: "Tester",
          createdAt: now,
          onboardingComplete: true,
          isEmailVerified: true,
          streakCount: 4,
          totalSessions: 9,
          totalFocusMinutes: 240,
        }),
      });
    }

    if (apiPath === "analytics/dashboard/") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          totalFocusMinutes: 240,
          totalSessions: 9,
          averageFocusScore: 88,
          deepWorkSessionCount: 2,
          completionRate: 92,
          dateRange: "7d",
        }),
      });
    }

    if (apiPath === "sessions/") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ results: [], count: 0, next: null, previous: null, nextPage: null }),
      });
    }

    if (apiPath === "documents/" && method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(documents),
      });
    }

    if (apiPath === "documents/upload/" && method === "POST") {
      requests.uploadCount += 1;
      documents.unshift(uploadedDocument);
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(uploadedDocument),
      });
    }

    if (apiPath === `documents/${documentId}/` && method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(uploadedDocument),
      });
    }

    if (apiPath === `documents/${documentId}/summary/` && method === "POST") {
      const payload = request.postDataJSON();
      requests.summaryPayloads.push(payload);
      uploadedDocument.hasSummary = true;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "completed",
          cached: false,
          document_id: documentId,
          summary: {
            id: "44444444-4444-4444-8444-444444444444",
            documentId,
            mode: payload.mode,
            status: "completed",
            content: "- **Focus:** Clear goals improve recall.",
            structured_content: {
              language: "en",
              key_points: [{ title: "Focus", content: "Clear goals improve recall." }],
            },
            provider: "mock",
            source: "ai",
            generated_at: now,
          },
        }),
      });
    }

    if (apiPath === `documents/${documentId}/summary/` && method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "completed",
          cached: true,
          document_id: documentId,
          summary: {
            id: "44444444-4444-4444-8444-444444444444",
            documentId,
            mode: url.searchParams.get("mode") || "key_points",
            status: "completed",
            content: "- **Focus:** Clear goals improve recall.",
            structured_content: {
              language: "en",
              key_points: [{ title: "Focus", content: "Clear goals improve recall." }],
            },
            provider: "mock",
            source: "ai",
            generated_at: now,
          },
        }),
      });
    }

    if (apiPath === `documents/${documentId}/flashcards/generate/` && method === "POST") {
      const payload = request.postDataJSON();
      requests.flashcardPayloads.push(payload);
      uploadedDocument.hasFlashcards = true;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "completed",
          cached: false,
          document_id: documentId,
          deck: flashcardDeck(documentId, payload.quantity),
        }),
      });
    }

    if (apiPath === `documents/${documentId}/flashcards/` && method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(flashcardDeck(documentId, 10)),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({}),
    });
  });

  await page.goto("http://127.0.0.1:3000/dashboard", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.waitForLoadState("networkidle");

  await expect(page.getByRole("button", { name: /Open AI Docs/i })).toBeVisible();
  await page.getByRole("button", { name: /Open AI Docs/i }).click();
  const docsPopup = page.locator("#dashboard-docs-popover");
  await expect(docsPopup).toBeVisible();

  const beforeDrag = await docsPopup.boundingBox();
  await page.getByText("Recent documents and study actions").hover();
  await page.mouse.down();
  await page.mouse.move((beforeDrag?.x ?? 0) - 60, (beforeDrag?.y ?? 0) - 35, { steps: 4 });
  await page.mouse.up();
  const afterDrag = await docsPopup.boundingBox();
  expect(Math.abs((afterDrag?.x ?? 0) - (beforeDrag?.x ?? 0)) + Math.abs((afterDrag?.y ?? 0) - (beforeDrag?.y ?? 0))).toBeGreaterThan(10);

  await page.getByRole("button", { name: /^Add$/i }).click();
  await expect(page.getByRole("dialog", { name: /Add AI document/i })).toBeVisible();
  const uploadFile = testInfo.outputPath("ai-doc-flow.txt");
  fs.writeFileSync(uploadFile, "Focus sessions need clear goals. Short reviews improve memory.");
  await page.locator('input[type="file"]').setInputFiles(uploadFile);
  await page.getByRole("button", { name: /Upload document/i }).click();
  await expect(page.getByText("Upload complete")).toBeVisible();
  expect(requests.uploadCount).toBe(1);

  await page
    .getByRole("dialog", { name: /Add AI document/i })
    .getByRole("button", { name: /^Summary$/i })
    .click();
  await expect(page.getByRole("dialog", { name: /Generate summary/i })).toBeVisible();
  await page.getByRole("radio", { name: /Detailed/i }).click();
  await page.getByRole("button", { name: /^Generate summary$/i }).click();
  await page.waitForURL(/\/study-tools\/.+tab=summary/);
  expect(requests.summaryPayloads).toEqual([{ mode: "detailed", force: false }]);
  await expect(page.getByText("Focus")).toBeVisible();

  await page.goto("http://127.0.0.1:3000/dashboard?panel=docs", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.waitForLoadState("networkidle");
  await expect(page.locator("#dashboard-docs-popover")).toBeVisible();
  await page.getByRole("button", { name: /^Flashcards$/i }).first().click();
  await expect(page.getByRole("dialog", { name: /Generate flashcards/i })).toBeVisible();
  await page.getByRole("radio", { name: "15" }).click();
  await page.getByRole("button", { name: /^Generate flashcards$/i }).click();
  await page.waitForURL(/\/study-tools\/.+tab=flashcards/);
  expect(requests.flashcardPayloads).toEqual([
    { scope: "full_document", quantity: 15, difficulty: "medium", force: false },
  ]);
  await expect(page.getByRole("button", { name: /Start review/i })).toBeEnabled();
  await page.getByRole("button", { name: /Start review/i }).click();
  await page.waitForURL(/\/review$/);
  await expect(page.getByText(/Card 1 of/i)).toBeVisible();
  await page.keyboard.press("Space");
  await expect(page.getByText("Clear goals improve recall.")).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByText(/Card 2 of/i)).toBeVisible();
});

function flashcardDeck(documentId, quantity) {
  const cards = Array.from({ length: Math.max(2, Number(quantity) || 10) }, (_, index) => ({
    id: `card-${index + 1}`,
    documentId,
    deckId: "55555555-5555-4555-8555-555555555555",
    question: `What is focus idea ${index + 1}?`,
    answer: index === 0 ? "Clear goals improve recall." : `Answer ${index + 1}`,
    difficulty: "medium",
    order: index,
  }));
  return {
    id: "55555555-5555-4555-8555-555555555555",
    documentId,
    title: "AI docs flow cards",
    quantity: cards.length,
    requestedQuantity: cards.length,
    generatedQuantity: cards.length,
    difficulty: "medium",
    status: "completed",
    pageRange: {},
    scope: { type: "full_document" },
    cards,
    generatedAt: new Date().toISOString(),
  };
}
