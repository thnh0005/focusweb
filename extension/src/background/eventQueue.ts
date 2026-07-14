import {
  MAX_BATCH_SIZE,
  MAX_QUEUE_SIZE,
  STORAGE_KEYS,
} from "../shared/constants";
import { getStorageValue, setStorageValue } from "../shared/storage";
import { sendEventBatch } from "./apiClient";
import type {
  BackendEventPayload,
  FocusSessionState,
  QueuedEvent,
  QueueFlushResult,
} from "./types";

function toBackendEvent(event: QueuedEvent): BackendEventPayload {
  return {
    event_type: event.event_type,
    client_event_id: event.id,
    occurred_at: event.occurred_at,
    url: event.url,
    domain: event.domain,
    page_title: event.page_title,
    active_seconds: event.active_seconds,
    idle_seconds: event.idle_seconds,
    tab_switch_count: event.tab_switch_count,
  };
}

export async function getQueue(): Promise<QueuedEvent[]> {
  return getStorageValue<QueuedEvent[]>(STORAGE_KEYS.queue, []);
}

export async function replaceQueue(events: QueuedEvent[]): Promise<void> {
  await setStorageValue(STORAGE_KEYS.queue, events.slice(-MAX_QUEUE_SIZE));
}

export async function clearQueue(): Promise<void> {
  await replaceQueue([]);
}

export async function enqueueEvent(event: QueuedEvent): Promise<void> {
  const queue = await getQueue();
  queue.push(event);
  await replaceQueue(queue);
}

export async function flushQueue(
  session: FocusSessionState
): Promise<QueueFlushResult> {
  const queue = await getQueue();
  const sessionEvents = queue.filter((event) => event.sessionId === session.sessionId);
  if (!sessionEvents.length) {
    return { ok: true, sent: 0, retained: queue.length };
  }

  const batch = sessionEvents.slice(0, MAX_BATCH_SIZE);
  const result = await sendEventBatch(
    session.backendApiUrl,
    session.sessionId,
    batch.map(toBackendEvent),
    session.extensionToken
  );

  if (!result.ok) {
    if (result.sessionClosed) {
      const retained = queue.filter((event) => event.sessionId !== session.sessionId);
      await replaceQueue(retained);
      return {
        ok: false,
        sent: 0,
        retained: retained.length,
        error: result.error,
        sessionClosed: true,
      };
    }
    return {
      ok: false,
      sent: 0,
      retained: queue.length,
      error: result.error,
    };
  }

  const sentIds = new Set(batch.map((event) => event.id));
  const retained = queue.filter((event) => !sentIds.has(event.id));
  await replaceQueue(retained);

  return {
    ok: true,
    sent: batch.length,
    retained: retained.length,
  };
}

export function createQueuedEvent(
  sessionId: string,
  event: Omit<QueuedEvent, "id" | "sessionId" | "occurred_at"> & {
    occurred_at?: string;
  }
): QueuedEvent {
  return {
    id: crypto.randomUUID(),
    sessionId,
    occurred_at: event.occurred_at ?? new Date().toISOString(),
    ...event,
  };
}
