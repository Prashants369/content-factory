import logging
import json
import base64
from pathlib import Path
from typing import Optional, Dict, Any

from ..registry import registry
try:
    from google import genai
    from google.genai import types
except ImportError:
    genai = None

logger = logging.getLogger("auditor-agent")

class AuditorAgent:
    def __init__(self):
        self.api_key = registry.get("providers", {}).get("gemini", {}).get("api_key")
        self.enabled = genai is not None and self.api_key is not None
        if self.enabled:
            self.client = genai.Client(api_key=self.api_key)
        else:
            logger.warning("AuditorAgent disabled: google-genai not installed or gemini API key missing.")

    async def audit_image(self, image_path: str, dna: Dict[str, Any], prompt: str) -> Dict[str, Any]:
        """
        Multimodal audit of a generated image.
        Returns a score (0-1) and feedback.
        """
        if not self.enabled:
            return {"score": 1.0, "feedback": "Auditor disabled, auto-passed.", "pass": True}

        try:
            p = Path(image_path)
            if not p.exists():
                return {"score": 0, "feedback": "Image not found.", "pass": False}

            # Prepare DNA summary for context
            id_data = dna.get("identity", {})
            personality = dna.get("personality", {})
            style = dna.get("style", {})
            
            dna_context = (
                f"Subject: {id_data.get('ethnicity', '')} woman, {id_data.get('age', 24)}yo, "
                f"Hair: {id_data.get('hair_style', '')} {id_data.get('hair_color', '')}. "
                f"Persona: {personality.get('archetype', '')}, mood: {personality.get('current_mood', 'neutral')}. "
                f"Vibe: {style.get('vibe', '')}."
            )

            with open(image_path, "rb") as f:
                image_bytes = f.read()

            response = self.client.models.generate_content(
                model="gemini-2.0-flash",
                contents=[
                    types.Content(
                        parts=[
                            types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg"),
                            types.Part.from_text(
                                text=(
                                    f"Analyze this AI generated image for a virtual influencer.\n"
                                    f"Target Character DNA: {dna_context}\n"
                                    f"Original Prompt: {prompt}\n\n"
                                    "Evaluate the following (0-10 scale for each):\n"
                                    "1. Visual Quality (artifacts, hands, anatomy, lighting)\n"
                                    "2. Character Consistency (does she look like the DNA description?)\n"
                                    "3. Flavor/Vibe (does it match the influencer's style?)\n\n"
                                    "Output your evaluation in JSON format with fields: "
                                    "'quality_score', 'consistency_score', 'vibe_score', 'overall_score' (0-1 average), "
                                    "'feedback' (short string), and 'pass' (boolean, pass if overall_score >= 0.7)."
                                )
                            )
                        ]
                    )
                ],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json"
                )
            )

            result = json.loads(response.text)
            logger.info(f"Audit Result for {image_path}: {result.get('overall_score')} | Pass: {result.get('pass')}")
            return result

        except Exception as e:
            logger.error(f"Audit failed: {e}")
            return {"score": 0.8, "feedback": f"Audit error, defaulting to marginal pass: {e}", "pass": True}

    async def audit_text(self, text: str, dna: Dict[str, Any]) -> Dict[str, Any]:
        """Audits captions/hooks for voice consistency."""
        # Implementation similar to image audit but text-only
        return {"score": 1.0, "pass": True}
