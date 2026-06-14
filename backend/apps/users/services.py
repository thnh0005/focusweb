import ipaddress
from pathlib import PurePosixPath
from urllib.parse import urlsplit, urlunsplit

from rest_framework import serializers

from .models import UserPreference


class MusicProviderDetector:
    AUDIO_EXTENSIONS = {".mp3", ".ogg", ".wav", ".m4a", ".aac"}
    LOCAL_HOSTNAMES = {
        "localhost",
        "metadata.google.internal",
    }
    LOCAL_SUFFIXES = (".localhost", ".local", ".internal", ".lan")

    @classmethod
    def normalize_url(cls, value):
        url = (value or "").strip()
        if not url:
            return ""

        parsed = urlsplit(url)
        scheme = parsed.scheme.lower()
        hostname = (parsed.hostname or "").lower()
        netloc = hostname
        if parsed.port:
            netloc = f"{netloc}:{parsed.port}"
        return urlunsplit((scheme, netloc, parsed.path, parsed.query, ""))

    @classmethod
    def validate_custom_url(cls, value):
        url = cls.normalize_url(value)
        if not url:
            return ""

        if len(url) > 2048:
            raise serializers.ValidationError("Playlist URL must be 2048 characters or less.")

        parsed = urlsplit(url)
        if parsed.scheme != "https":
            raise serializers.ValidationError(
                "Only secure HTTPS playlist URLs are supported."
            )
        if not parsed.hostname:
            raise serializers.ValidationError("Playlist URL must include a hostname.")
        if parsed.username or parsed.password:
            raise serializers.ValidationError(
                "Playlist URLs must not include username or password credentials."
            )

        hostname = parsed.hostname.lower()
        if cls.is_blocked_hostname(hostname):
            raise serializers.ValidationError(
                "Local or private playlist hosts are not supported."
            )
        return url

    @classmethod
    def detect_provider(cls, value):
        url = cls.validate_custom_url(value)
        if not url:
            return UserPreference.MusicPlaylistProvider.NONE

        parsed = urlsplit(url)
        hostname = parsed.hostname.lower()
        path_suffix = PurePosixPath(parsed.path.lower()).suffix

        if hostname == "open.spotify.com":
            return UserPreference.MusicPlaylistProvider.SPOTIFY
        if hostname == "music.youtube.com":
            return UserPreference.MusicPlaylistProvider.YOUTUBE_MUSIC
        if hostname == "youtube.com" and "list=" in parsed.query:
            return UserPreference.MusicPlaylistProvider.YOUTUBE_MUSIC
        if hostname == "www.youtube.com" and "list=" in parsed.query:
            return UserPreference.MusicPlaylistProvider.YOUTUBE_MUSIC
        if path_suffix in cls.AUDIO_EXTENSIONS:
            return UserPreference.MusicPlaylistProvider.DIRECT_AUDIO
        return UserPreference.MusicPlaylistProvider.EXTERNAL

    @classmethod
    def is_blocked_hostname(cls, hostname):
        if hostname in cls.LOCAL_HOSTNAMES or hostname.endswith(cls.LOCAL_SUFFIXES):
            return True

        candidate = hostname.strip("[]")
        try:
            address = ipaddress.ip_address(candidate)
        except ValueError:
            return False

        return any(
            [
                address.is_loopback,
                address.is_private,
                address.is_link_local,
                address.is_reserved,
                address.is_multicast,
                address.is_unspecified,
            ]
        )
