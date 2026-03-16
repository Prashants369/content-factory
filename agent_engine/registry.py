import os
import json
from pathlib import Path
from typing import Any, Dict, List

REGISTRY_FILE = Path(__file__).parent / "registry.json"

class Registry:
    _instance = None
    _config: Dict[str, Any] = {}

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(Registry, cls).__new__(cls)
            cls._instance.load()
        return cls._instance

    def load(self):
        if REGISTRY_FILE.exists():
            with open(REGISTRY_FILE, "r") as f:
                self._config = json.load(f)
        else:
            self._config = self._get_defaults()
            self.save()

    def save(self):
        with open(REGISTRY_FILE, "w") as f:
            json.dump(self._config, f, indent=4)

    def get(self, key: str, default: Any = None) -> Any:
        return self._config.get(key, default)

    def set(self, key: str, value: Any):
        self._config[key] = value
        self.save()

    def _get_defaults(self) -> Dict[str, Any]:
        return {
            "providers": {
                "ollama": {
                    "url": os.getenv("OLLAMA_URL", "http://127.0.0.1:11434"),
                    "model": os.getenv("OLLAMA_MODEL", "qwen2.5:7b")
                },
                "comfyui": {
                    "url": os.getenv("COMFYUI_URL", "http://127.0.0.1:8188")
                },
                "openclaw": {
                    "url": os.getenv("OPENCLAW_URL", "http://127.0.0.1:18789")
                }
            },
            "workflows": {
                "image_base": "flux-9b-base-v2.json",
                "image_refine": "flux-9b-refine-i2i.json",
                "image_detail": "flux-9b-detailer-zimage.json",
                "image_upscale": "upscale-seedvr2.json",
                "video_base": "video-animatediff-v1.json",
                "video_refine": "video-svd-v1.json"
            },
            "strategies": {
                "creative_wildcards": [
                    "Give an unexpected contradiction (warrior poet, scientist who dresses like royalty).",
                    "Obsession with a very specific subculture nobody expects.",
                    "Mix two completely different aesthetics (Cyber-Gothic + Old Money).",
                    "Unusual origin story rooted in a real cultural event.",
                    "Design around a specific life philosophy.",
                    "Signature visual element that becomes recognizable.",
                    "Subvert all expectations of the niche.",
                    "Embody a hyper-specific micro-aesthetic.",
                    "Base around an emotion or mood rather than a topic."
                ],
                "prompt_quality_suffix": "cinematic RAW photo, hyper-realistic, shot on Hasselblad H6D, 100MP sensor, Zeiss 85mm f/1.8, razor-sharp iris focus, visible skin pores, micro-textures, Godox AD600 Pro lighting"
            },
            "autonomous": {
                "check_interval_seconds": 3600,
                "min_post_buffer_days": 3,
                "auto_render_ideas": True,
                "auto_post_ready": False
            }
        }

# Global singleton
registry = Registry()
