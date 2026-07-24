VENV := .venv
PYTHON := $(VENV)/bin/python
PIP := $(VENV)/bin/pip
RUFF := $(VENV)/bin/ruff
BLACK := $(VENV)/bin/black
ISORT := $(VENV)/bin/isort

SRC := bill_processor
LIMIT ?= 9999

.PHONY: help install install-dev format isort black ruff-format lint check \
	dry-run sync process process-all

help:
	@echo "Processor Makefile targets:"
	@echo "  make install       Install package into .venv"
	@echo "  make install-dev   Install package + ruff, black, isort"
	@echo "  make format        Apply isort + black (writes)"
	@echo "  make ruff-format   Apply ruff format only (writes)"
	@echo "  make lint          Run ruff lint"
	@echo "  make check         Format check + ruff lint (no writes)"
	@echo "  make dry-run       Sync Drive metadata and preview pending work"
	@echo "  make sync          Sync Drive metadata only"
	@echo "  make process       Sync and process pending/failed files"
	@echo "  make process-all   Same as process (override: make process LIMIT=10)"

$(PYTHON):
	python3 -m venv $(VENV)

install: $(PYTHON)
	$(PIP) install -e .

install-dev: $(PYTHON)
	$(PIP) install -e ".[dev]"

isort:
	$(ISORT) $(SRC)

black:
	$(BLACK) $(SRC)

ruff-format:
	$(RUFF) format $(SRC)

# Classic formatters (pick this OR ruff-format — not both in one pass)
format: isort black

lint:
	$(RUFF) check $(SRC)

check:
	$(ISORT) --check-only --diff $(SRC)
	$(BLACK) --check $(SRC)
	$(RUFF) check $(SRC)

dry-run:
	$(PYTHON) -m bill_processor --dry-run --limit $(LIMIT)

sync:
	$(PYTHON) -m bill_processor --sync-only

process process-all:
	$(PYTHON) -m bill_processor --limit $(LIMIT) --retry-failed
