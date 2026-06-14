# Dev2 Week 4 Day 3 - Music Preferences

Day 24 hardens `GET/PUT/PATCH /api/music/preferences/` for built-in focus music
and custom playlist configuration.

## Endpoint

`GET /api/music/preferences/`

`PUT /api/music/preferences/`

`PATCH /api/music/preferences/`

The endpoint requires authentication and always uses `request.user`. It does
not accept `user_id` or any client-selected owner.

## Persistence

The implementation reuses `apps.users.UserPreference`; no separate
`MusicPreference` model or new app was created.

Reused fields:

- `music_enabled`
- `music_track`
- `ambient_sound_volume` as the music preference volume
- `custom_playlist_url`

Added fields:

- `music_autoplay`
- `use_custom_playlist`
- `custom_playlist_provider`

## Built-In Tracks

Supported built-in track values:

- `none`
- `lofi`
- `rain`
- `forest`
- `cafe`
- `white_noise`

Defaults are `enabled=false`, `built_in_track=none`, `volume=50`,
`autoplay=false`, `use_custom_playlist=false`, empty URL, and provider `none`.
Music is not enabled by default.

If music is enabled and `use_custom_playlist=false`, `built_in_track` must not be
`none`.

## Custom Playlists

When `use_custom_playlist=true`, a valid custom playlist URL is required.

Provider is detected from the URL:

- `open.spotify.com` -> `spotify`
- `music.youtube.com` and YouTube playlist URLs -> `youtube_music`
- HTTPS URLs ending in `.mp3`, `.ogg`, `.wav`, `.m4a`, or `.aac` -> `direct_audio`
- other valid HTTPS URLs -> `external`

If the client sends a provider, it must match server detection. Switching back to
built-in keeps the existing custom URL unless the client explicitly clears it.

## URL Security

The backend validates playlist URLs but never fetches them.

Rejected URL patterns include:

- non-HTTPS schemes such as `http`, `file`, `ftp`, `javascript`, `data`, `blob`,
  and `chrome-extension`
- URLs containing username or password credentials
- `localhost`
- literal loopback, private, link-local, reserved, multicast, or unspecified IPs
- metadata/link-local addresses such as `169.254.169.254`
- URLs longer than 2048 characters

The validator does not resolve DNS. If the backend later fetches playlist URLs,
that future fetch path must add a dedicated outbound request policy with DNS
rebinding protection.

## Backend Boundary

The backend only stores preference configuration. It does not stream audio,
proxy playlist content, download files, call Spotify or YouTube APIs, call AI,
enqueue workers, or create playback sessions. Frontend owns playback/embed
behavior.

## Compatibility

The endpoint keeps existing camelCase fields such as `musicEnabled`,
`musicTrack`, `customPlaylistUrl`, and `ambientSoundVolume` while adding the
Day 24 snake_case contract. `PUT/PATCH` return both top-level compatibility
fields and a `preferences` object with `status=updated`.

## Migration

Migration `users.0003_userpreference_custom_playlist_provider_and_more` adds the
new fields, updates music defaults, expands track choices, extends
`custom_playlist_url` to 2048 characters, and normalizes legacy `white-noise`
values to `white_noise`.

## Known Limitations

The backend does not verify that a playlist actually exists and does not inspect
remote MIME types. Direct audio classification is extension-based only and is
used as frontend routing metadata, not as proof that the remote file is safe or
playable.
