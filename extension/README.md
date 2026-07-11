# FocusOS Browser Bridge

Chrome MV3 extension for FocusOS active-session tracking.

## What It Does

- Receives `SESSION_START`, `SESSION_PAUSE`, `SESSION_RESUME`, `SESSION_END`, `BLACKLIST_SYNC`, `GET_STATUS`, and `PING` from the FocusOS web app.
- Stores only the active FocusOS session, queued tracking events, current active-tab timing, and the latest warning in `chrome.storage.local`.
- Tracks active tab changes, URL/title updates, window focus changes, and idle state while a session is active and not paused.
- Ignores browser/internal pages such as `chrome://`, `edge://`, `about:`, `devtools://`, extension pages, and empty URLs.
- Flushes queued events to `POST /api/tracking/sessions/{sessionId}/events/` about every 15 seconds and on session end.
- Emits immediate frontend-compatible `WARNING`, `TAB_SWITCH`, `CONTENT_CHANGED`, `PONG`, `SYNC_COMPLETE`, and `DISCONNECTED` messages through the content-script bridge.

## Privacy Boundary

The extension does not read page content, form input, cookies, passwords, local storage, or browsing history. During an active, unpaused FocusOS session it sends only:

- event type
- event UUID
- timestamp
- URL
- normalized domain
- page title
- active seconds
- idle seconds
- tab switch count

No AI calls are made by the extension.

## Local Build

```powershell
npm install
npm run build
```

Load `extension/dist` as an unpacked extension in Chrome.

## FocusOS Setup

Set the installed extension ID in the frontend environment:

```text
NEXT_PUBLIC_EXTENSION_ID=<chrome-extension-id>
```

Add the installed extension origin to the backend environment:

```text
EXTENSION_ALLOWED_ORIGINS=chrome-extension://<chrome-extension-id>
```

The frontend sends the active session ID, goal, mode, blacklist, backend API URL, app URL, and planned duration when a session starts.

## Backend Auth Note

The extension fetches `/api/auth/csrf/` and posts with `credentials: "include"` plus `X-CSRFToken` when available. Django must trust the exact `chrome-extension://<id>` origin through `EXTENSION_ALLOWED_ORIGINS`; the extension intentionally does not bypass session or CSRF protections.
