# Bill processor

Local Python job that syncs bill-uploader files from Google Drive, extracts expense data via Ollama, and writes results to Supabase.

See [docs/processor-setup.md](../docs/processor-setup.md) for setup and usage.

## Quick start

```bash
cd processor
python -m venv .venv
source .venv/bin/activate
pip install -e .

# From repo root .env (Google + DATABASE_URL + Ollama vars)
python -m bill_processor --dry-run
python -m bill_processor --limit 5
```

Or use the Makefile:

```bash
cd processor
make install-dev          # .venv + package + ruff, black, isort
make format               # isort + black
make ruff-format          # ruff format (alternative to isort/black)
make lint                 # ruff check
make check                # format check + lint (no writes)
make process              # sync + process pending/failed (LIMIT=9999)
make process LIMIT=10     # process up to 10 files
make dry-run              # preview pending work without LLM
```
