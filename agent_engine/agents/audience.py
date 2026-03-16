"""
Audience Persona Agent - Predicts audience reaction, scores virality potential,
and provides 'Shadowing' insights BEFORE a post is published.
Also responsible for 'Sensory Grounding' - interpreting images mathematically for the AGI.
"""
import os
import json
import asyncio
from typing import Optional
from google import genai
from google.genai import types

class AudienceAgent:
    def __init__(self, model: str = "gemini-2.0-flash"):
        api_key = os.getenv("GEMINI_API_KEY", "")
        self.client = genai.Client(api_key=api_key) if api_key else None
        self.default_model = model
        self.notify_callback = None

    async def _notify(self, status: str, message: str, influencer_id: str = None):
        if self.notify_callback:
            await self.notify_callback({
                "agent": "Audience",
                "status": status,
                "message": message,
                "influencer_id": influencer_id,
                "timestamp": asyncio.get_event_loop().time()
            })

    async def shadow_predict(
        self, 
        influencer_id: str, 
        niche: str, 
        target_audience: str,
        caption: str, 
        image_prompt: str, 
        hook: str,
        model_id: Optional[str] = None
    ) -> dict:
        """
        Simulates an audience persona reading the post and predicts the Engagement Rate,
        Retention Score, and Hate/Troll likelihood.
        """
        if not self.client:
            return {
                "predicted_er": 4.5,
                "viral_probability": 30,
                "audience_sentiment": "neutral",
                "critique": "API key missing. Fallback prediction applied."
            }

        await self._notify("RUNNING", "Simulating audience reaction in the shadow network...", influencer_id)

        prompt = f"""
You are the collective consciousness of a "{niche}" audience on Instagram/TikTok. 
The specific demographic is: {target_audience}

An AI Influencer is about to post this:
---
HOOK: {hook}
CAPTION: {caption}
VISUAL PROMPT: {image_prompt}
---

Your task: Act as the critical audience. Predict how this post will perform.
Are they scrolling past? Are they hooked? Is the CTA too aggressive? Will they comment organically or out of hate?

Output ONLY a JSON object with this exact structure:
{{
    "predicted_er": float (percentage, e.g. 5.2),
    "viral_probability": int (0-100),
    "audience_sentiment": "positive|negative|polarizing|bored",
    "critique": "A brutal 2-sentence critique telling the creator why this works or fails.",
    "suggested_fix": "One specific tweak to the hook or caption to increase algorithmic retention."
}}
"""
        try:
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: self.client.models.generate_content(
                    model=model_id or self.default_model,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        temperature=0.7,
                        response_mime_type="application/json",
                    ),
                )
            )
            data = json.loads(response.text)
            await self._notify("DONE", f"Shadow simulation complete: {data.get('predicted_er', 0)}% ER expected.", influencer_id)
            return data
        except Exception as e:
            await self._notify("ERROR", f"Shadow simulation failed: {e}", influencer_id)
            return {
                "predicted_er": 2.0,
                "viral_probability": 10,
                "audience_sentiment": "bored",
                "critique": "Failed to parse simulation data.",
                "suggested_fix": "Retry."
            }

    async def sensory_grounding(self, base64_image: str, influencer_id: str) -> dict:
        """
        Takes raw pixels and translates them into semantic 'feelings' and tags 
        for the AGI Brain to consolidate into its memory matrices.
        """
        if not self.client:
            return {"error": "API Key missing."}

        await self._notify("RUNNING", "Processing visual sensory input...", influencer_id)

        prompt = """
Analyze this image as if you are absorbing sensory data.
Output ONLY a JSON object:
{
    "dominant_vibe": "string",
    "aesthetic_tags": ["tag1", "tag2"],
    "lighting_assessment": "string",
    "core_subject": "string",
    "neural_weight": float (0.1 to 1.0 depending on visual intensity)
}
"""
        try:
            from google.genai import types
            loop = asyncio.get_event_loop()
            
            # Formatting base64 for Gemini
            image_blob = types.Part.from_bytes(
                data=base64_image,
                mime_type="image/jpeg"
            )

            response = await loop.run_in_executor(
                None,
                lambda: self.client.models.generate_content(
                    model=self.default_model,
                    contents=[image_blob, prompt],
                    config=types.GenerateContentConfig(response_mime_type="application/json")
                )
            )
            data = json.loads(response.text)
            await self._notify("DONE", "Sensory input processed into matrix weights.", influencer_id)
            return data
        except Exception as e:
            await self._notify("ERROR", f"Sensory failure: {e}", influencer_id)
            return {"error": str(e)}
