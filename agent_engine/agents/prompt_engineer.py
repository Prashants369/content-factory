import json
import logging
import random
from typing import Dict, Any, Optional

from ..registry import registry
from .memory import MemoryAgent

logger = logging.getLogger("prompt-engineer")

class PromptEngineerAgent:
    """
    Expert agent for "Prompt Engineering" for image and video generation.
    Converts raw ideas into high-fidelity, production-grade prompts using RAG.
    """

    def __init__(self, memory: Optional[MemoryAgent] = None):
        self.memory = memory or MemoryAgent()
        self.quality_suffix = registry.get("strategies", {}).get("prompt_quality_suffix", "")

    async def engineer_prompt(self, base_idea: str, dna: Dict[str, Any], context: str = "") -> str:
        """
        Transforms a base idea into a master cinematic prompt using character memory.
        """
        influencer_id = dna.get("id", "default")
        id_data = dna.get("identity", {})
        style_data = dna.get("style", {})
        
        # 1. RAG Retrieve: Style Context
        style_memory = self.memory.get_style_context(influencer_id)
        
        # 2. Technical "Studio" Knowledge (Lenses, Lighting)
        lenses = [
            "85mm f/1.8 prime lens for compression",
            "35mm wide angle for environmental storytelling",
            "50mm street photography lens",
            "100mm macro for extreme detail"
        ]
        lighting = [
            "soft golden hour sunlight passing through window blinds",
            "dramatic chiaroscuro studio lighting with blue rim light",
            "soft-box diffused indoor lighting, neutral color temperature",
            "neon-drenched rainy night lighting with reflections",
            "high-key minimalist bright white studio lighting"
        ]
        atmosphere = [
            "subtle floating dust particles in light beams",
            "light misty atmosphere, cinematic haze",
            "extremely crisp air, perfect visibility",
            "warm cozy indoor vibe with bundle-light glow"
        ]

        # 3. Character Anchor
        subject = (
            f"stunning {id_data.get('ethnicity', '')} woman, "
            f"{id_data.get('age', 24)} years old, "
            f"{id_data.get('hair_style', '')} {id_data.get('hair_color', '')}"
        )

        # 4. Dynamic Selection (Weighted by Style Memory if available)
        # For an industry-grade factory, this would be an LLM call.
        selected_lens = random.choice(lenses)
        selected_light = random.choice(lighting)
        selected_atmos = random.choice(atmosphere)

        # 5. Assembly
        full_prompt = (
            f"PHOTO, {subject}, {base_idea}. "
            f"Environment: {context or 'lifestyle cinemati'}. "
            f"Style Clues: {style_memory or style_data.get('vibe', 'lifestyle photo')}. "
            f"Technical: {selected_lens}, {selected_light}, {selected_atmos}. "
            f"{self.quality_suffix}"
        )

        logger.info(f"Engineered Prompt: {full_prompt[:100]}...")
        return full_prompt

    async def get_negative_prompt(self, workflow_type: str = "image") -> str:
        """Standard production-grade negative prompts."""
        base_neg = (
            "cartoon, illustration, 3d, 2d, cg, paintings, sketches, "
            "deformed, blur, bad anatomy, bad hands, mutated fingers, "
            "extra limbs, double head, fused fingers, low quality, "
            "watermark, text, signature, lowres, ugly"
        )
        if workflow_type == "video":
            return base_neg + ", flickering, jump cuts, erratic movement"
        return base_neg
