"""Central configuration loaded from repo-root .env."""

from __future__ import annotations

import os
import socket
from pathlib import Path

from dotenv import load_dotenv
from psycopg.conninfo import conninfo_to_dict

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
load_dotenv(REPO_ROOT / ".env")
load_dotenv(REPO_ROOT / ".env.local", override=True)

# Google Drive (shared with Next.js app)
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REFRESH_TOKEN = os.getenv("GOOGLE_REFRESH_TOKEN", "")

DRIVE_APP_SOURCE = "bill-uploader"

# Supabase Postgres — prefer pooler URL for local/WSL (direct db.*.supabase.co is IPv6-only)


def get_database_url() -> str:
    return os.getenv("DATABASE_POOLER_URL") or os.getenv("DATABASE_URL", "")

SUPABASE_DIRECT_HOST_HELP = """
Supabase direct connections (db.[ref].supabase.co:5432) are IPv6-only and often fail from WSL.

Fix: Supabase dashboard → Project Settings → Database → Connection string → Session pooler (port 6543).
Set that URI as DATABASE_URL (or DATABASE_POOLER_URL) in repo-root .env or .env.local.

If your database password contains special characters (#, @, etc.), URL-encode them in the URI (# → %23).
""".strip()

# Ollama — one multimodal model for text PDFs and images (gemma4)
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
# Single model by default; optional PROCESSOR_LLM_MODEL / PROCESSOR_VISION_MODEL overrides
_MODEL = os.getenv("PROCESSOR_MODEL", "gemma4:12b")
LLM_MODEL = os.getenv("PROCESSOR_LLM_MODEL", _MODEL)
VISION_MODEL = os.getenv("PROCESSOR_VISION_MODEL", _MODEL)
LLM_TIMEOUT = int(os.getenv("PROCESSOR_LLM_TIMEOUT", "300"))
BATCH_LIMIT = int(os.getenv("PROCESSOR_BATCH_LIMIT", "1"))
PROCESSOR_STALE_MINUTES = int(os.getenv("PROCESSOR_STALE_MINUTES", "0"))
VISION_MAX_SIDE = int(os.getenv("PROCESSOR_VISION_MAX_SIDE", "1280"))
NUM_CTX = int(os.getenv("PROCESSOR_NUM_CTX", "4096"))
# Second Gemma pass to catch missing line items (default on)
VALIDATE_EXTRACTION = os.getenv("PROCESSOR_VALIDATE", "1") == "1"
# Tall screenshot slicing (JioMart-style)
MAX_ITEM_SLICES = int(os.getenv("PROCESSOR_MAX_ITEM_SLICES", "8"))
SLICE_WINDOW_RATIO = float(os.getenv("PROCESSOR_SLICE_WINDOW_RATIO", "1.55"))
SLICE_OVERLAP_RATIO = float(os.getenv("PROCESSOR_SLICE_OVERLAP_RATIO", "0.28"))
# Chunked item harvest for tall images (one Ollama call per item slice)
CHUNKED_ITEM_EXTRACTION = os.getenv("PROCESSOR_CHUNKED_ITEMS", "1") == "1"

# PDF text threshold: below this, treat as scanned and render pages for vision
PDF_MIN_TEXT_CHARS = int(os.getenv("PROCESSOR_PDF_MIN_TEXT_CHARS", "80"))

DEFAULT_CURRENCY = "INR"
VALID_OWNERS = frozenset({"me", "parents"})


def require_google_config() -> None:
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET or not GOOGLE_REFRESH_TOKEN:
        raise RuntimeError(
            "Google Drive credentials missing. Set GOOGLE_CLIENT_ID, "
            "GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN in .env"
        )


def _host_has_ipv4(host: str, port: int) -> bool:
    try:
        socket.getaddrinfo(host, port, socket.AF_INET, socket.SOCK_STREAM)
    except socket.gaierror:
        return False
    return True


def _validate_supabase_database_url(url: str) -> None:
    params = conninfo_to_dict(url)
    host = params.get("host") or ""
    port = int(params.get("port") or 5432)

    if not (host.startswith("db.") and host.endswith(".supabase.co") and port == 5432):
        return

    if _host_has_ipv4(host, port):
        return

    raise RuntimeError(SUPABASE_DIRECT_HOST_HELP)


def get_database_conninfo() -> str:
    require_database_url()
    url = get_database_url()
    _validate_supabase_database_url(url)
    return url


def require_database_url() -> None:
    if not (os.getenv("DATABASE_POOLER_URL") or os.getenv("DATABASE_URL")):
        raise RuntimeError(
            "DATABASE_URL is not set in .env. "
            "For local/WSL, use the Supabase Session pooler URI (port 6543)."
        )
