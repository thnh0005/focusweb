import os
from pathlib import Path

from celery.schedules import crontab
from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BASE_DIR / ".env")


def env_bool(name, default=False):
    value = os.getenv(name)
    if value is None:
        return default
    return value.lower() in {"1", "true", "yes", "on"}


def env_list(name, default=""):
    value = os.getenv(name, default)
    return [item.strip() for item in value.split(",") if item.strip()]


def env_int(name, default):
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        return default


def env_float(name, default):
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return float(value)
    except ValueError:
        return default


DEBUG = env_bool("DJANGO_DEBUG", env_bool("DEBUG", False))

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY")
if not SECRET_KEY:
    raise ImproperlyConfigured(
        "DJANGO_SECRET_KEY is required. Set it in the environment or backend/.env."
    )

ALLOWED_HOSTS = env_list(
    "DJANGO_ALLOWED_HOSTS",
    os.getenv("ALLOWED_HOSTS", "localhost,127.0.0.1"),
)

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
FRONTEND_URLS_DEFAULT = os.getenv(
    "FRONTEND_ORIGINS",
    os.getenv("CORS_ALLOWED_ORIGINS", f"{FRONTEND_URL},http://127.0.0.1:3000"),
)
FRONTEND_URLS = env_list("FRONTEND_URLS", FRONTEND_URLS_DEFAULT)
if FRONTEND_URL not in FRONTEND_URLS:
    FRONTEND_URLS.insert(0, FRONTEND_URL)
EXTENSION_ALLOWED_ORIGINS = env_list("EXTENSION_ALLOWED_ORIGINS")
CSRF_EXTRA_TRUSTED_ORIGINS = env_list("CSRF_TRUSTED_ORIGINS")
TRUSTED_CLIENT_ORIGINS = list(
    dict.fromkeys(
        [
            *FRONTEND_URLS,
            *EXTENSION_ALLOWED_ORIGINS,
            *CSRF_EXTRA_TRUSTED_ORIGINS,
        ]
    )
)


INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "drf_spectacular",
    "core",
    "apps.users",
    "apps.sessions",
    "apps.analytics",
    "apps.tracking",
    "apps.extension",
    "apps.ai",
    "apps.scoring",
    "apps.recommendations",
    "apps.notifications",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"


if os.getenv("DATABASE_ENGINE") == "sqlite":
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": os.getenv("SQLITE_PATH", BASE_DIR / "db.sqlite3"),
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.getenv("POSTGRES_DB", "focusos_db"),
            "USER": os.getenv("POSTGRES_USER", "focusos_user"),
            "PASSWORD": os.getenv("POSTGRES_PASSWORD", "focusos_password"),
            "HOST": os.getenv("POSTGRES_HOST", "localhost"),
            "PORT": os.getenv("POSTGRES_PORT", "5432"),
        }
    }


REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", OPENROUTER_MODEL)
OPENROUTER_BASE_URL = os.getenv(
    "OPENROUTER_BASE_URL",
    "https://openrouter.ai/api/v1",
)
GROQ_BASE_URL = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1")
AI_PROVIDER = os.getenv("AI_PROVIDER", "groq" if GROQ_API_KEY else "openrouter")
AI_MAX_REQUEST_TOKENS = env_int("AI_MAX_REQUEST_TOKENS", 3700)
AI_TARGET_REQUEST_TOKENS = env_int("AI_TARGET_REQUEST_TOKENS", 3500)
AI_CHUNK_OUTPUT_RESERVE_TOKENS = env_int("AI_CHUNK_OUTPUT_RESERVE_TOKENS", 650)
AI_REDUCTION_OUTPUT_RESERVE_TOKENS = env_int("AI_REDUCTION_OUTPUT_RESERVE_TOKENS", 700)
AI_SUMMARY_OUTPUT_RESERVE_TOKENS = env_int("AI_SUMMARY_OUTPUT_RESERVE_TOKENS", 500)
AI_KEY_POINTS_SUMMARY_OUTPUT_RESERVE_TOKENS = env_int(
    "AI_KEY_POINTS_SUMMARY_OUTPUT_RESERVE_TOKENS",
    max(AI_SUMMARY_OUTPUT_RESERVE_TOKENS, 800),
)
AI_DETAILED_SUMMARY_OUTPUT_RESERVE_TOKENS = env_int(
    "AI_DETAILED_SUMMARY_OUTPUT_RESERVE_TOKENS",
    max(AI_REDUCTION_OUTPUT_RESERVE_TOKENS, 1200),
)
AI_FLASHCARD_OUTPUT_RESERVE_TOKENS = env_int("AI_FLASHCARD_OUTPUT_RESERVE_TOKENS", 1100)
AI_INITIAL_CALIBRATION_RATIO = env_float("AI_INITIAL_CALIBRATION_RATIO", 1.05)
AI_INITIAL_FIXED_OVERHEAD_TOKENS = env_int("AI_INITIAL_FIXED_OVERHEAD_TOKENS", 32)
AI_CALIBRATION_MIN_SAMPLES = env_int("AI_CALIBRATION_MIN_SAMPLES", 20)
AI_CALIBRATION_WINDOW_SIZE = env_int("AI_CALIBRATION_WINDOW_SIZE", 200)
AI_CALIBRATION_PERCENTILE = env_float("AI_CALIBRATION_PERCENTILE", 0.95)
AI_CONTEXT_SUMMARY_MAX_TOKENS = env_int("AI_CONTEXT_SUMMARY_MAX_TOKENS", 450)
AI_ENTITY_MEMORY_MAX_TOKENS = env_int("AI_ENTITY_MEMORY_MAX_TOKENS", 250)
AI_CHUNK_OVERLAP_TOKENS = env_int("AI_CHUNK_OVERLAP_TOKENS", 120)
AI_MIN_CURRENT_CHUNK_TOKENS = env_int("AI_MIN_CURRENT_CHUNK_TOKENS", 300)
if AI_TARGET_REQUEST_TOKENS >= AI_MAX_REQUEST_TOKENS:
    raise ImproperlyConfigured("AI_TARGET_REQUEST_TOKENS must be lower than AI_MAX_REQUEST_TOKENS.")
if min(
    AI_CHUNK_OUTPUT_RESERVE_TOKENS,
    AI_REDUCTION_OUTPUT_RESERVE_TOKENS,
    AI_SUMMARY_OUTPUT_RESERVE_TOKENS,
    AI_KEY_POINTS_SUMMARY_OUTPUT_RESERVE_TOKENS,
    AI_DETAILED_SUMMARY_OUTPUT_RESERVE_TOKENS,
    AI_FLASHCARD_OUTPUT_RESERVE_TOKENS,
) <= 0:
    raise ImproperlyConfigured("AI output reserve token settings must be positive.")
if AI_INITIAL_CALIBRATION_RATIO < 1:
    raise ImproperlyConfigured("AI_INITIAL_CALIBRATION_RATIO must be >= 1.")
if not 0 < AI_CALIBRATION_PERCENTILE <= 1:
    raise ImproperlyConfigured("AI_CALIBRATION_PERCENTILE must be in the range (0, 1].")
if AI_CALIBRATION_WINDOW_SIZE <= 0:
    raise ImproperlyConfigured("AI_CALIBRATION_WINDOW_SIZE must be positive.")
AI_REQUEST_TIMEOUT_SECONDS = env_int("AI_REQUEST_TIMEOUT_SECONDS", 2)
AI_MAX_RETRIES = env_int("AI_MAX_RETRIES", 1)
AI_RETRY_BACKOFF_SECONDS = env_int("AI_RETRY_BACKOFF_SECONDS", 1)
AI_CIRCUIT_FAILURE_THRESHOLD = env_int("AI_CIRCUIT_FAILURE_THRESHOLD", 5)
AI_CIRCUIT_COOLDOWN_SECONDS = env_int("AI_CIRCUIT_COOLDOWN_SECONDS", 60)
AI_SEMANTIC_REALTIME_ENABLED = env_bool("AI_SEMANTIC_REALTIME_ENABLED", False)
SESSION_INSIGHT_TASK_MAX_RETRIES = env_int(
    "SESSION_INSIGHT_TASK_MAX_RETRIES",
    env_int("AI_INSIGHT_MAX_RETRIES", 2),
)
AI_INSIGHT_MAX_RETRIES = SESSION_INSIGHT_TASK_MAX_RETRIES
SESSION_INSIGHT_TASK_RETRY_BACKOFF_SECONDS = env_int(
    "SESSION_INSIGHT_TASK_RETRY_BACKOFF_SECONDS",
    env_int("AI_INSIGHT_RETRY_BACKOFF_SECONDS", 30),
)
AI_INSIGHT_RETRY_BACKOFF_SECONDS = SESSION_INSIGHT_TASK_RETRY_BACKOFF_SECONDS
SESSION_INSIGHT_MANUAL_RETRY_LIMIT = env_int("SESSION_INSIGHT_MANUAL_RETRY_LIMIT", 3)
SESSION_INSIGHT_STALE_PROCESSING_SECONDS = env_int(
    "SESSION_INSIGHT_STALE_PROCESSING_SECONDS",
    900,
)
ACCOUNT_DELETION_STATUS_TOKEN_TTL_HOURS = env_int(
    "ACCOUNT_DELETION_STATUS_TOKEN_TTL_HOURS",
    24,
)

REALTIME_SCORE_WINDOW_SECONDS = env_int("REALTIME_SCORE_WINDOW_SECONDS", 300)
REALTIME_SCORE_STALE_SECONDS = env_int("REALTIME_SCORE_STALE_SECONDS", 90)
REALTIME_SCORE_MIN_EVENTS = env_int("REALTIME_SCORE_MIN_EVENTS", 3)
REALTIME_SCORE_TAB_SWITCH_PENALTY = env_int(
    "REALTIME_SCORE_TAB_SWITCH_PENALTY",
    8,
)
WARNING_INTERVAL_SECONDS = env_int("WARNING_INTERVAL_SECONDS", 5)
WARNING_MAX_LEVEL = env_int("WARNING_MAX_LEVEL", 3)

DOCUMENT_ALLOWED_EXTENSIONS = [".pdf", ".docx", ".txt"]
DOCUMENT_ALLOWED_MIME_TYPES = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "application/octet-stream",
]
DOCUMENT_MAX_UPLOAD_SIZE_BYTES = env_int(
    "DOCUMENT_MAX_UPLOAD_SIZE_BYTES",
    10 * 1024 * 1024,
)
DOCUMENT_MAX_EXTRACTED_CHARACTERS = env_int(
    "DOCUMENT_MAX_EXTRACTED_CHARACTERS",
    500000,
)
DOCUMENT_EXTRACTION_TIMEOUT_SECONDS = env_int(
    "DOCUMENT_EXTRACTION_TIMEOUT_SECONDS",
    30,
)
DOCUMENT_EXTRACTION_TASK_MAX_RETRIES = env_int(
    "DOCUMENT_EXTRACTION_TASK_MAX_RETRIES",
    2,
)
DOCUMENT_EXTRACTION_TASK_RETRY_BACKOFF_SECONDS = env_int(
    "DOCUMENT_EXTRACTION_TASK_RETRY_BACKOFF_SECONDS",
    30,
)
DOCUMENT_EXTRACTION_STALE_SECONDS = env_int(
    "DOCUMENT_EXTRACTION_STALE_SECONDS",
    900,
)
DOCUMENT_UPLOADED_GRACE_SECONDS = env_int(
    "DOCUMENT_UPLOADED_GRACE_SECONDS",
    120,
)
DOCUMENT_EXTRACTION_MAX_RECOVERY_ATTEMPTS = env_int(
    "DOCUMENT_EXTRACTION_MAX_RECOVERY_ATTEMPTS",
    env_int("AI_JOB_MAX_RECOVERY_ATTEMPTS", 2),
)
DOCUMENT_SUMMARY_MODEL = os.getenv("DOCUMENT_SUMMARY_MODEL", OPENROUTER_MODEL)
DOCUMENT_SUMMARY_CHUNK_CHARACTERS = env_int(
    "DOCUMENT_SUMMARY_CHUNK_CHARACTERS",
    12000,
)
DOCUMENT_SUMMARY_CHUNK_OVERLAP_CHARACTERS = env_int(
    "DOCUMENT_SUMMARY_CHUNK_OVERLAP_CHARACTERS",
    400,
)
DOCUMENT_SUMMARY_MAX_CHUNKS = env_int("DOCUMENT_SUMMARY_MAX_CHUNKS", 8)
DOCUMENT_SUMMARY_MAX_SOURCE_CHARACTERS = env_int(
    "DOCUMENT_SUMMARY_MAX_SOURCE_CHARACTERS",
    96000,
)
DOCUMENT_SUMMARY_TASK_MAX_RETRIES = env_int("DOCUMENT_SUMMARY_TASK_MAX_RETRIES", 2)
DOCUMENT_SUMMARY_TASK_RETRY_BACKOFF_SECONDS = env_int(
    "DOCUMENT_SUMMARY_TASK_RETRY_BACKOFF_SECONDS",
    30,
)
DOCUMENT_CHUNK_REQUEST_DELAY_SECONDS = env_int(
    "DOCUMENT_CHUNK_REQUEST_DELAY_SECONDS",
    60,
)
FLASHCARD_GENERATION_MODEL = os.getenv("FLASHCARD_GENERATION_MODEL", OPENROUTER_MODEL)
FLASHCARD_GENERATION_MIN_QUANTITY = env_int("FLASHCARD_GENERATION_MIN_QUANTITY", 1)
FLASHCARD_GENERATION_MAX_QUANTITY = env_int("FLASHCARD_GENERATION_MAX_QUANTITY", 50)
FLASHCARD_GENERATION_CHUNK_CHARACTERS = env_int(
    "FLASHCARD_GENERATION_CHUNK_CHARACTERS",
    9000,
)
FLASHCARD_GENERATION_MAX_CHUNKS = env_int("FLASHCARD_GENERATION_MAX_CHUNKS", 8)
FLASHCARD_GENERATION_TASK_MAX_RETRIES = env_int(
    "FLASHCARD_GENERATION_TASK_MAX_RETRIES",
    2,
)
FLASHCARD_GENERATION_TASK_RETRY_BACKOFF_SECONDS = env_int(
    "FLASHCARD_GENERATION_TASK_RETRY_BACKOFF_SECONDS",
    30,
)
AI_JOB_STALE_PROCESSING_SECONDS = env_int(
    "AI_JOB_STALE_PROCESSING_SECONDS",
    900,
)
AI_JOB_MAX_RECOVERY_ATTEMPTS = env_int(
    "AI_JOB_MAX_RECOVERY_ATTEMPTS",
    2,
)
AI_STALE_RECOVERY_INTERVAL_SECONDS = env_int(
    "AI_STALE_RECOVERY_INTERVAL_SECONDS",
    300,
)
AI_QUOTA_DEFER_MAX_RETRIES = env_int("AI_QUOTA_DEFER_MAX_RETRIES", 120)
AI_RATE_LIMITER_ENABLED = env_bool("AI_RATE_LIMITER_ENABLED", True)
AI_RATE_LIMITER_REDIS_URL = os.getenv("AI_RATE_LIMITER_REDIS_URL", REDIS_URL)
AI_RATE_LIMITER_FAIL_OPEN = env_bool("AI_RATE_LIMITER_FAIL_OPEN", True)
AI_PROVIDER_TOKEN_LIMIT_PER_MINUTE = env_int(
    "AI_PROVIDER_TOKEN_LIMIT_PER_MINUTE",
    6000,
)
AI_PROVIDER_REQUEST_LIMIT_PER_MINUTE = env_int(
    "AI_PROVIDER_REQUEST_LIMIT_PER_MINUTE",
    30,
)
AI_RATE_LIMITER_SAFETY_MARGIN = float(os.getenv("AI_RATE_LIMITER_SAFETY_MARGIN", "0.15"))
AI_RATE_LIMITER_FALLBACK_BACKOFF_SECONDS = env_int(
    "AI_RATE_LIMITER_FALLBACK_BACKOFF_SECONDS",
    60,
)
AI_RATE_LIMITER_JITTER_SECONDS = env_int("AI_RATE_LIMITER_JITTER_SECONDS", 5)

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": REDIS_URL,
    }
}

CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/1")
CELERY_TIMEZONE = os.getenv("CELERY_TIMEZONE", "UTC")
CELERY_BEAT_SCHEDULE = {
    "process-daily-session-reminders": {
        "task": "apps.notifications.tasks.process_daily_session_reminders",
        "schedule": crontab(minute=os.getenv("CELERY_REMINDERS_MINUTE", "*/30")),
    },
    "process-weekly-summary-notifications": {
        "task": "apps.notifications.tasks.process_weekly_summary_notifications",
        "schedule": crontab(
            minute=os.getenv("CELERY_WEEKLY_SUMMARY_MINUTE", "0"),
            hour=os.getenv("CELERY_WEEKLY_SUMMARY_HOUR", "9"),
            day_of_week=os.getenv("CELERY_WEEKLY_SUMMARY_DAY_OF_WEEK", "mon"),
        ),
    },
    "process-deep-work-suggestions": {
        "task": "apps.notifications.tasks.process_deep_work_suggestions",
        "schedule": crontab(
            minute=os.getenv("CELERY_DEEP_WORK_SUGGESTIONS_MINUTE", "*/30")
        ),
    },
    "cleanup-expired-report-exports": {
        "task": "apps.analytics.tasks.cleanup_expired_report_exports_task",
        "schedule": crontab(
            minute=os.getenv("CELERY_EXPORT_CLEANUP_MINUTE", "15"),
            hour=os.getenv("CELERY_EXPORT_CLEANUP_HOUR", "3"),
        ),
    },
    "cleanup-expired-account-exports": {
        "task": "apps.users.tasks.cleanup_expired_account_exports_task",
        "schedule": crontab(
            minute=os.getenv("CELERY_ACCOUNT_EXPORT_CLEANUP_MINUTE", "45"),
            hour=os.getenv("CELERY_ACCOUNT_EXPORT_CLEANUP_HOUR", "3"),
        ),
    },
    "cleanup-expired-account-deletion-receipts": {
        "task": "apps.users.tasks.cleanup_expired_account_deletion_receipts_task",
        "schedule": crontab(
            minute=os.getenv("CELERY_ACCOUNT_DELETION_RECEIPT_CLEANUP_MINUTE", "0"),
            hour=os.getenv("CELERY_ACCOUNT_DELETION_RECEIPT_CLEANUP_HOUR", "4"),
        ),
    },
    "recover-stale-ai-work": {
        "task": "apps.ai.tasks.recover_stale_ai_work",
        "schedule": AI_STALE_RECOVERY_INTERVAL_SECONDS,
    },
}

CELERY_TASK_ROUTES = {
    "apps.ai.tasks.generate_document_summary": {"queue": "ai_provider"},
    "apps.ai.tasks.generate_document_flashcards": {"queue": "ai_provider"},
    "apps.ai.tasks.process_next_document_chunk": {"queue": "ai_provider"},
    "apps.ai.tasks.process_reduction_step": {"queue": "ai_provider"},
    "apps.ai.tasks.generate_document_short_summary": {"queue": "ai_provider"},
    "apps.ai.tasks.generate_document_ai_flashcards": {"queue": "ai_provider"},
}


AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]


LANGUAGE_CODE = "en-us"

TIME_ZONE = "UTC"

USE_I18N = True

USE_TZ = True


STATIC_URL = "static/"
STATIC_ROOT = os.getenv("STATIC_ROOT", BASE_DIR / "staticfiles")

MEDIA_URL = os.getenv("MEDIA_URL", "/media/")
MEDIA_ROOT = os.getenv("MEDIA_ROOT", BASE_DIR / "media")

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

AUTH_USER_MODEL = "users.User"

CORS_ALLOWED_ORIGINS = TRUSTED_CLIENT_ORIGINS
CORS_ALLOW_CREDENTIALS = True

CSRF_TRUSTED_ORIGINS = TRUSTED_CLIENT_ORIGINS

SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_SECURE = env_bool("SESSION_COOKIE_SECURE", not DEBUG)
CSRF_COOKIE_SECURE = env_bool("CSRF_COOKIE_SECURE", not DEBUG)
SECURE_SSL_REDIRECT = env_bool("SECURE_SSL_REDIRECT", False)
SECURE_HSTS_SECONDS = env_int("SECURE_HSTS_SECONDS", 0)
SECURE_HSTS_INCLUDE_SUBDOMAINS = env_bool("SECURE_HSTS_INCLUDE_SUBDOMAINS", False)
SECURE_HSTS_PRELOAD = env_bool("SECURE_HSTS_PRELOAD", False)
SECURE_CONTENT_TYPE_NOSNIFF = env_bool("SECURE_CONTENT_TYPE_NOSNIFF", True)
X_FRAME_OPTIONS = os.getenv("X_FRAME_OPTIONS", "DENY")

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}

SPECTACULAR_SETTINGS = {
    "TITLE": "FocusOS Backend API",
    "DESCRIPTION": "FocusOS backend API.",
    "VERSION": "0.1.0",
    "ENUM_NAME_OVERRIDES": {
        "SessionModeEnum": "apps.sessions.models.FocusSession.Mode",
        "TrendDirectionEnum": ["up", "down", "neutral"],
        "BlacklistSeverityEnum": "apps.extension.models.BlacklistEntry.Severity",
        "DistractionSeverityEnum": ["high", "medium", "low"],
        "DocumentFileTypeEnum": "apps.ai.models.StudyDocument.FileType",
        "DocumentStatusEnum": "apps.ai.models.StudyDocument.Status",
        "DocumentSummaryModeEnum": "apps.ai.models.DocumentSummary.Mode",
        "FlashcardDifficultyEnum": "apps.ai.models.FlashcardDeck.Difficulty",
        "MusicTrackEnum": "apps.users.models.UserPreference.MusicTrack",
        "ReportExportStatusEnum": "apps.analytics.models.ReportExportJob.Status",
        "ReportExportFormatEnum": "apps.analytics.models.ReportExportJob.Format",
    },
}
