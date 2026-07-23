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
