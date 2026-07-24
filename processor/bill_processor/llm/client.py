"""Ollama HTTP client — strictly one model in VRAM at a time."""

from __future__ import annotations

import json
import time
import urllib.error
import urllib.request

from bill_processor import config


def _request(
    path: str, *, data: bytes | None = None, timeout: int | None = None
) -> dict | list:
    url = f"{config.OLLAMA_HOST.rstrip('/')}{path}"
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"} if data is not None else {},
        method="POST" if data is not None else "GET",
    )
    with urllib.request.urlopen(req, timeout=timeout or config.LLM_TIMEOUT) as resp:
        raw = resp.read()
        if not raw:
            return {}
        return json.loads(raw)


def list_loaded_models() -> list[str]:
    try:
        data = _request("/api/ps", timeout=10)
    except Exception:
        return []
    models = data.get("models") if isinstance(data, dict) else None
    if not models:
        return []
    names: list[str] = []
    for item in models:
        name = item.get("model") or item.get("name")
        if name:
            names.append(str(name))
    return names


def unload_model(model: str) -> None:
    """Unload a model that is already in VRAM (do not call for unloaded models)."""
    body = json.dumps({"model": model, "keep_alive": 0}).encode()
    try:
        _request("/api/generate", data=body, timeout=120)
    except Exception as exc:
        print(f"Warning: failed to unload {model}: {exc}")


def unload_all_models(*, retries: int = 5) -> None:
    """Unload every model currently in VRAM and wait until /api/ps is empty."""
    for _attempt in range(retries):
        loaded = list_loaded_models()
        if not loaded:
            print("Ollama VRAM clear (no models loaded).")
            return
        for name in loaded:
            print(f"Unloading Ollama model from VRAM: {name}")
            unload_model(name)
        time.sleep(1.5)
    leftover = list_loaded_models()
    if leftover:
        raise RuntimeError(
            "Could not free Ollama VRAM before starting. Still loaded: "
            f"{leftover}. Close other Ollama apps (e.g. personal_finance) "
            "and run: curl http://localhost:11434/api/ps"
        )


def _message_text(data: dict) -> str:
    """Pull usable text from an Ollama /api/chat response."""
    message = data.get("message") or {}
    for key in ("content", "thinking", "reasoning"):
        value = message.get(key)
        if isinstance(value, str) and value.strip():
            return value
    # Some builds put the answer at the top level
    for key in ("response", "content"):
        value = data.get(key)
        if isinstance(value, str) and value.strip():
            return value
    return ""


def chat(
    *,
    model: str,
    system: str,
    user: str,
    images_b64: list[str] | None = None,
    json_format: bool = True,
) -> str:
    # Always clear VRAM first so chat + vision never co-reside.
    unload_all_models()
    image_count = len(images_b64 or [])
    print(f"Calling Ollama with single model: {model} (images={image_count})")

    # Match personal_finance/scripts/ollama_vision.py for vision:
    # single user message + think=False (gemma4 otherwise returns empty content).
    if images_b64:
        messages: list[dict[str, object]] = [
            {
                "role": "user",
                "content": f"{system}\n\n{user}",
                "images": images_b64,
            }
        ]
    else:
        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ]

    payload: dict[str, object] = {
        "model": model,
        "messages": messages,
        "stream": False,
        "think": False,  # required for gemma4 — otherwise content is empty
        "keep_alive": 0,
        "options": {
            "temperature": 0,
            "num_ctx": config.NUM_CTX,
        },
    }
    if json_format:
        payload["format"] = "json"

    body = json.dumps(payload).encode()
    req = urllib.request.Request(
        f"{config.OLLAMA_HOST.rstrip('/')}/api/chat",
        data=body,
        headers={"Content-Type": "application/json"},
    )
    data: dict = {}
    try:
        with urllib.request.urlopen(req, timeout=config.LLM_TIMEOUT) as resp:
            data = json.loads(resp.read())
    except urllib.error.URLError as exc:
        raise RuntimeError(
            f"Failed to reach Ollama at {config.OLLAMA_HOST}. Is `ollama serve` running?\n{exc}"
        ) from exc
    finally:
        try:
            leftover = list_loaded_models()
            for name in leftover:
                unload_model(name)
        except Exception:
            pass

    content = _message_text(data)
    if not content and json_format:
        # Retry once without forced JSON schema — some vision builds return empty with format=json
        print("Empty response with format=json; retrying without format constraint...")
        return chat(
            model=model,
            system=system,
            user=user + "\n\nRespond with JSON only.",
            images_b64=images_b64,
            json_format=False,
        )

    if not content:
        keys = list(data.keys())
        message_keys = list((data.get("message") or {}).keys())
        raise RuntimeError(
            f"Ollama returned empty response (top_keys={keys}, message_keys={message_keys})"
        )
    return str(content)
