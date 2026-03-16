"""OpenRouter helper — multi-key rotation with speed models."""
import os
import json
import httpx
import random
from ..registry import registry

OPENROUTER_URL = "https://openrouter.ai/api/v1"

# Speed models (fastest first)
SPEED_MODELS = [
    "step-3.5-flash:free",           # ~1-2s, fastest
    "z-ai/glm-4.5-air:free",         # ~2-3s, 3-key rotation
    "arcee-ai/trinity-large-preview:free",  # ~3s, creative
    "cognitivecomputations/dolphin-mistral-24b-venice-edition:free",  # fallback
]

def _get_api_keys():
    """Get all OpenRouter API keys from auth-profiles.json."""
    keys = []
    try:
        profiles_path = os.path.expanduser("~/.openclaw/auth-profiles.json")
        with open(profiles_path) as f:
            profiles = json.load(f)
        for profile in profiles.values():
            if isinstance(profile, dict) and "apiKey" in profile:
                keys.append(profile["apiKey"])
    except Exception:
        pass
    
    # Fallback to env var
    env_key = os.getenv("OPENROUTER_API_KEY", "")
    if env_key and env_key not in keys:
        keys.append(env_key)
    
    return keys

def _get_random_key():
    """Get a random API key for load distribution."""
    keys = _get_api_keys()
    if not keys:
        raise RuntimeError("No OpenRouter API keys found")
    return random.choice(keys)

async def openrouter_chat(prompt: str, system: str = "", temperature: float = 0.7, timeout: int = 60) -> str:
    """Call OpenRouter with speed models and multi-key rotation."""
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})
    
    # Try each model with a random key
    last_error = None
    for model in SPEED_MODELS:
        try:
            api_key = _get_random_key()
            async with httpx.AsyncClient(timeout=timeout) as client:
                r = await client.post(
                    f"{OPENROUTER_URL}/chat/completions",
                    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                    json={"model": model, "messages": messages, "temperature": temperature, "max_tokens": 2048}
                )
                if r.status_code == 429:
                    print(f"[OpenRouter] Rate limited on {model}, trying next...")
                    continue
                if r.status_code >= 500:
                    print(f"[OpenRouter] Server error {r.status_code} on {model}, trying next...")
                    continue
                r.raise_for_status()
                return r.json()["choices"][0]["message"]["content"].strip()
        except Exception as e:
            last_error = e
            print(f"[OpenRouter] {model} failed: {e}, trying next...")
            continue
    
    raise RuntimeError(f"All models failed. Last error: {last_error}")

def openrouter_chat_sync(prompt: str, system: str = "", temperature: float = 0.7, timeout: int = 60) -> str:
    """Sync version with speed models and multi-key rotation."""
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})
    
    last_error = None
    for model in SPEED_MODELS:
        try:
            api_key = _get_random_key()
            r = httpx.post(
                f"{OPENROUTER_URL}/chat/completions",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={"model": model, "messages": messages, "temperature": temperature, "max_tokens": 2048},
                timeout=timeout
            )
            if r.status_code == 429 or r.status_code >= 500:
                continue
            r.raise_for_status()
            return r.json()["choices"][0]["message"]["content"].strip()
        except Exception as e:
            last_error = e
            continue
    
    raise RuntimeError(f"All models failed. Last error: {last_error}")
