"""
Persona Agent — simulates audience reactions using OpenRouter (free models).
Replaced Gemini dependency with OpenRouter GLM 4.5 Air.
"""
import os
import json
import asyncio
from typing import Dict

# Use OpenRouter instead of Gemini
from .openrouter_helper import openrouter_chat, openrouter_chat_sync

class PersonaAgent:
    def __init__(self):
        # No API key needed - uses OpenRouter from auth-profiles.json
        pass

    async def simulate_audience(self, post: Dict, influencer_dna: Dict) -> Dict:
        """Simulate a group of diverse personas reacting to a post using OpenRouter."""
        
        personas = [
            {"name": "The Skeptic", "bio": "45yo male, doubtful of AI, values raw authenticity, looks for 'tells' in images."},
            {"name": "The Superfan", "bio": "19yo female, obsessed with trends, loves high-energy content, uses Gen-Z slang."},
            {"name": "The Pragmatist", "bio": "32yo entrepreneur, values time, hates fluff, only interacts with educational value."},
            {"name": "The Chaotic Neutral", "bio": "Likes to troll, looks for controversial angles to argue in comments."}
        ]

        post_context = f"""
        INFLUENCER DNA: {json.dumps(influencer_dna.get('personality', {}))}
        POST HOOK: {post.get('viral_hook')}
        POST CAPTION: {post.get('caption')}
        POST IMAGE PROMPT: {post.get('image_prompt')}
        """

        system = "You are a social media focus group simulator. Always respond with valid JSON only. No markdown."

        prompt = f"""
        You are a diverse focus group of these 4 personas:
        {json.dumps(personas)}

        Given the post below, each persona must give a quick reaction and a score (1-10) on how likely they are to engage.

        POST:
        {post_context}

        Output ONLY a JSON object (no markdown, no explanation):
        {{
          "overall_virality_score": 0.0-1.0,
          "persona_reactions": [
            {{"name": "Persona Name", "score": 1, "comment": "Comment content"}},
            {{"name": "Persona Name", "score": 1, "comment": "Comment content"}},
            {{"name": "Persona Name", "score": 1, "comment": "Comment content"}},
            {{"name": "Persona Name", "score": 1, "comment": "Comment content"}}
          ],
          "critical_flaw": "One thing that might break the illusion or kill engagement",
          "improvement_tip": "One tactical change to improve the score"
        }}
        """

        try:
            raw = await openrouter_chat(prompt, system=system, temperature=0.7, timeout=60)
            # Clean any markdown fences
            raw = raw.strip()
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
            if raw.endswith("```"):
                raw = raw[:-3]
            raw = raw.strip()
            
            result = json.loads(raw)
            return result
        except Exception as e:
            print(f"[PersonaAgent] OpenRouter failed: {e}")
            # Return neutral score so pipeline continues
            return {
                "overall_virality_score": 0.5,
                "persona_reactions": [],
                "critical_flaw": "Simulation skipped (API error)",
                "improvement_tip": "Content still generated successfully"
            }
