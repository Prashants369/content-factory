"""
Creator Agent — generates post content (captions, hooks, hashtags, image prompts)
from influencer DNA using LOCAL Ollama (primary) with Gemini as optional fallback.
"""
import os
import json
import asyncio
import re
import httpx
import random
from typing import Optional

# ── LLM helpers ──────────────────────────────────────────────────────────

from ..registry import registry
from .openrouter_helper import openrouter_chat, openrouter_chat_sync

OLLAMA_URL = registry.get("providers", {}).get("ollama", {}).get("url", "http://127.0.0.1:11434")
OLLAMA_MODEL = registry.get("providers", {}).get("ollama", {}).get("model", "tinyllama:latest")


async def _ollama_generate(prompt: str, system: str = "", temperature: float = 0.8, timeout: int = 120) -> str:
    """Call Ollama /api/generate endpoint asynchronously. Returns the generated text."""
    payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "system": system,
        "stream": False,
        "options": {"temperature": temperature, "num_predict": 4096},
    }
    async with httpx.AsyncClient(timeout=timeout) as client:
        r = await client.post(f"{OLLAMA_URL}/api/generate", json=payload)
        r.raise_for_status()
        return r.json().get("response", "").strip()


def _ollama_generate_sync(prompt: str, system: str = "", temperature: float = 0.8, timeout: int = 120) -> str:
    """Synchronous version for Redis workers."""
    payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "system": system,
        "stream": False,
        "options": {"temperature": temperature, "num_predict": 4096},
    }
    import requests
    r = requests.post(f"{OLLAMA_URL}/api/generate", json=payload, timeout=timeout)
    r.raise_for_status()
    return r.json().get("response", "").strip()


def _clean_json(raw: str) -> str:
    """Strip markdown fences and return clean JSON string."""
    raw = re.sub(r"^```(?:json)?\s*", "", raw.strip())
    raw = re.sub(r"\s*```$", "", raw)
    return raw.strip()


# ── Creator Agent ──────────────────────────────────────────────────────────

class CreatorAgent:
    def __init__(self, model: str = "qwen2.5:7b"):
        self.ollama_model = os.getenv("OLLAMA_MODEL", model)
        self.ollama_url = OLLAMA_URL
        self._gemini_client = None  # lazy-loaded fallback

    def _get_gemini(self):
        """Lazy-load Gemini client as fallback only."""
        if self._gemini_client is None:
            api_key = os.getenv("GEMINI_API_KEY", "")
            if api_key:
                from google import genai
                self._gemini_client = genai.Client(api_key=api_key)
        return self._gemini_client

    async def _check_ollama_health(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=3) as c:
                r = await c.get(f"{self.ollama_url}/api/tags")
                return r.status_code == 200
        except Exception:
            return False

    async def determine_mood(
        self, influencer_name: str, niche: str, dna: dict, current_mood: str = "creative"
    ) -> str:
        """Determines the next cognitive/emotional mood for the influencer."""
        system = "You are an AI Influencer Subconscious Engine. Always respond with a single lowercase word."
        wildcards = registry.get("strategies", {}).get("creative_wildcards", [])
        prompt = (
            f"Influencer: {influencer_name} | Niche: {niche} | Previous Mood: {current_mood}\n"
            f"DNA Personality: {json.dumps(dna.get('personality', {}))}\n\n"
            "Choose the NEXT mood to keep content dynamic and viral. "
            f"Context: {random.choice(wildcards) if wildcards else ''}\n"
            "Options: creative, burnout, high-energy, intellectual, mysterious, vulnerable, provocative\n"
            "Output ONLY the single mood word."
        )
        try:
            result = await _ollama_generate(prompt, system=system, temperature=0.7, timeout=30)
            # Extract only the mood word
            for mood in ["creative", "burnout", "high-energy", "intellectual", "mysterious", "vulnerable", "provocative"]:
                if mood in result.lower():
                    return mood
            return result.split()[0].lower().strip()
        except Exception as e:
            print(f"[Creator] Mood determination failed: {e}. Using fallback.")
            return current_mood

    async def generate_posts(
        self,
        influencer_id: str,
        influencer_name: str,
        niche: str,
        dna: dict,
        num_posts: int = 7,
        trend_context: str = "",
        model_id: Optional[str] = None,
        current_mood: str = "creative",
    ) -> list[dict]:
        """Generate N posts. Uses OpenRouter (free) as primary, Ollama as fallback."""
        try:
            return await self._generate_posts_openrouter(
                influencer_id, influencer_name, niche, dna, num_posts, trend_context, current_mood
            )
        except Exception as e:
            print(f"[Creator] OpenRouter failed ({e}), trying Ollama...")
            ollama_ok = await self._check_ollama_health()
            if ollama_ok:
                return await self._generate_posts_ollama(
                    influencer_id, influencer_name, niche, dna, num_posts, trend_context, current_mood
                )
            raise RuntimeError(f"All LLM providers failed. Last error: {e}")

    async def _generate_posts_openrouter(
        self,
        influencer_id: str,
        influencer_name: str,
        niche: str,
        dna: dict,
        num_posts: int,
        trend_context: str,
        current_mood: str,
    ) -> list[dict]:
        """Generate posts using OpenRouter free models (GLM 4.5 Air)."""
        p = dna.get("personality", {})
        v = dna.get("viral_strategy", {})
        id_data = dna.get("identity", {})
        comm = p.get("communication", {})
        social = p.get("social_algorithm", {})
        archetype = v.get("primary_hook_archetype", "authentic")
        market = v.get("market_focus", "Global")
        platforms = v.get("platform_priority", ["Instagram"])
        caption_style = social.get("caption_style", "one_liner")
        hook_type = social.get("hook_type", "curiosity_gap")
        vocab_level = comm.get("vocabulary_level", "conversational")
        humor_type = comm.get("humor_type", "none")
        emotional_expr = comm.get("emotional_expression", "moderate")
        recurring_phrases = comm.get("recurring_phrases", [])
        psych_hooks = v.get("psychological_hooks", [])
        backstory = id_data.get("backstory", "")
        ethnicity = id_data.get("ethnicity", "")
        age = id_data.get("age", 24)
        core_values = id_data.get("core_values", [])
        topics_love = comm.get("topics_they_love", [])

        trend_block = f"\nCurrent viral trends:\n{trend_context}" if trend_context else ""

        system = (
            f"You are {influencer_name}'s social media brain. Write ONLY in their voice.\n"
            f"Voice: {vocab_level} vocabulary, {humor_type} humor, {emotional_expr} emotion\n"
            f"Format: {caption_style} captions, {hook_type} hooks\n"
            f"Archetype: {archetype}\n"
            "Always respond with valid JSON arrays only. No markdown."
        )

        prompt = f"""Generate {num_posts} Instagram posts for {influencer_name}.

INFLUENCER: {influencer_name} ({ethnicity}, {age}y)
BACKSTORY: {backstory}
NICHE: {niche} | MARKET: {market}
PLATFORMS: {', '.join(platforms)} | MOOD: {current_mood}
HOOKS: {', '.join(psych_hooks[:3])}
VALUES: {', '.join(core_values[:3])}
{trend_block}

Rules:
- Captions in {influencer_name}'s voice ({caption_style} format)
- Hooks: {hook_type} style, no emoji at start
- Image prompts: cinematic, Hasselblad quality, 8K detail
- Use ONE consistent outfit across all posts

Return ONLY this JSON array:
[
  {{
    "post_number": 1,
    "viral_hook": "scroll-stopping line",
    "caption": "authentic caption with CTA",
    "hashtags": ["tag1", "tag2", "tag3"],
    "image_prompt": "cinematic photo description with camera/lighting details",
    "negative_prompt": "cartoon, 3d render, blurry, low quality",
    "content_type": "lifestyle",
    "monetization_angle": "revenue driver"
  }}
]"""

        try:
            raw = await openrouter_chat(prompt, system=system, temperature=0.85, timeout=120)
            raw = _clean_json(raw)
            posts = json.loads(raw)
            for post in posts:
                post["influencer_id"] = influencer_id
            return posts
        except Exception as e:
            print(f"[Creator] OpenRouter generation failed: {e}")
            raise

    async def _generate_posts_ollama(
        self,
        influencer_id: str,
        influencer_name: str,
        niche: str,
        dna: dict,
        num_posts: int,
        trend_context: str,
        current_mood: str,
    ) -> list[dict]:
        p = dna.get("personality", {})
        v = dna.get("viral_strategy", {})
        id_data = dna.get("identity", {})
        comm = p.get("communication", {})
        social = p.get("social_algorithm", {})
        archetype = v.get("primary_hook_archetype", "authentic")
        market = v.get("market_focus", "Global")
        platforms = v.get("platform_priority", ["Instagram"])
        cpm = v.get("target_cpm", 10)
        ethnicity = id_data.get("ethnicity", "")
        age = id_data.get("age", 24)
        viral_phrase = v.get("viral_phrase_template", "")
        aesthetic_trigger = v.get("aesthetic_trigger", "")
        psych_hooks = v.get("psychological_hooks", [])
        backstory = id_data.get("backstory", "")
        core_values = id_data.get("core_values", [])
        topics_love = comm.get("topics_they_love", [])
        topics_avoid = comm.get("topics_they_avoid", [])
        recurring_phrases = comm.get("recurring_phrases", [])
        vocab_level = comm.get("vocabulary_level", "conversational")
        humor_type = comm.get("humor_type", "none")
        emotional_expr = comm.get("emotional_expression", "moderate")
        caption_style = social.get("caption_style", "one_liner")
        hook_type = social.get("hook_type", "curiosity_gap")

        trend_block = f"\nCurrent viral trends to reference:\n{trend_context}" if trend_context else ""

        # ── FULL VOICE SYSTEM PROMPT injected with DNA personality ──
        system = (
            f"You are the social media brain of {influencer_name}, an AI influencer. "
            f"You write SOLELY in {influencer_name}'s voice and never break character.\n"
            f"VOICE PROFILE:\n"
            f"- Vocabulary: {vocab_level}\n"
            f"- Humor: {humor_type}\n"
            f"- Emotional expression: {emotional_expr}\n"
            f"- Caption format: {caption_style}\n"
            f"- Hook style: {hook_type}\n"
            f"- Archetype: {archetype}\n"
            + (f"- Signature phrases: {', '.join(recurring_phrases)}\n" if recurring_phrases else "")
            + (f"- Topics she loves: {', '.join(topics_love[:4])}\n" if topics_love else "")
            + (f"- Topics she avoids: {', '.join(topics_avoid[:3])}\n" if topics_avoid else "")
            + (f"- Core values: {', '.join(core_values[:3])}\n" if core_values else "")
            + f"\nYou ALWAYS respond with valid JSON arrays only. No markdown. No explanation."
        )

        prompt = f"""Generate exactly {num_posts} posts for {influencer_name}.

INFLUENCER: {influencer_name}
IDENTITY: {ethnicity}, {age} years old
BACKSTORY: {backstory}
NICHE: {niche}
MARKET: {market}
PSYCHOLOGICAL HOOKS: {', '.join(psych_hooks)}
PLATFORMS: {', '.join(platforms)}
MOOD: {current_mood}
TARGET CPM: ${cpm}
AESTHETIC TRIGGER: {aesthetic_trigger}
VIRAL PHRASE TEMPLATE: {viral_phrase}
{trend_block}

[VOICE RULES — NON-NEGOTIABLE]
- Write captions ONLY in {influencer_name}'s voice ({vocab_level} vocabulary, {humor_type} humor, {emotional_expr} emotion)
- Hook format: {hook_type} style — no emoji at start of hook
- Caption format: {caption_style} — must feel authentic, never generic
- Include her signature phrases where natural: {', '.join(recurring_phrases) if recurring_phrases else 'none defined'}
- Psychological hooks to use: {', '.join(psych_hooks)}

[CINEMATIC IMAGE PROMPT RULES]
Each image_prompt MUST include:
- Camera: Phase One XF, Hasselblad H6D-100c, or Sony A7R V
- Lighting: Profoto B10X softbox, Godox AD600 rim light, volumetric, golden hour or dramatic
- Skin detail: natural pores, micro-texture, realistic fabric detail, 8K resolution
- Niche environment specific to: {niche}

[OUTFIT LOCK] Invent ONE specific outfit and wear it consistently across ALL {num_posts} image_prompts for temporal consistency.

Return ONLY this JSON array:
[
  {{
    "post_number": 1,
    "viral_hook": "Scroll-stopping line in {influencer_name}'s authentic voice, no emoji at start",
    "caption": "In-character caption. {caption_style} format. Ends with comment-bait question or CTA.",
    "hashtags": ["tag1", "tag2", "tag3", "niche_specific"],
    "image_prompt": "Technically detailed cinema-grade prompt with OOTD, optics, lighting, and niche environment",
    "negative_prompt": "text, logo, watermark, blur, cartoon, 3d render, plastic skin, airbrushed, CGI",
    "content_type": "lifestyle|educational|promotional|behind_scenes|controversial|interactive",
    "monetization_angle": "Specific revenue driver for this post"
  }}
]"""

        raw = await _ollama_generate(prompt, system=system, temperature=0.85, timeout=180)
        raw = _clean_json(raw)

        posts = json.loads(raw)
        for post in posts:
            post["influencer_id"] = influencer_id
        return posts

    async def _generate_posts_gemini(
        self, influencer_id, influencer_name, niche, dna, num_posts,
        trend_context, current_mood, model_id, client
    ) -> list[dict]:
        """Gemini fallback — full DNA injection for parity with Ollama."""
        from google.genai import types
        p = dna.get("personality", {})
        v = dna.get("viral_strategy", {})
        id_data = dna.get("identity", {})
        comm = p.get("communication", {})
        social = p.get("social_algorithm", {})
        trend_block = f"\nCurrent trending context:\n{trend_context}" if trend_context else ""
        archetype = v.get("primary_hook_archetype", "")
        market = v.get("market_focus", "Global")
        platforms = v.get("platform_priority", ["Instagram"])
        cpm = v.get("target_cpm", 10)
        caption_style = social.get("caption_style", "one_liner")
        hook_type = social.get("hook_type", "curiosity_gap")
        vocab_level = comm.get("vocabulary_level", "conversational")
        humor_type = comm.get("humor_type", "none")
        psych_hooks = v.get("psychological_hooks", [])
        backstory = id_data.get("backstory", "")
        ethnicity = id_data.get("ethnicity", "")
        age = id_data.get("age", 24)

        prompt = f"""Generate {num_posts} posts for AI influencer {influencer_name}.
IDENTITY: {ethnicity}, {age}y | NICHE: {niche} | MARKET: {market} | ARCHETYPE: {archetype}
BACKSTORY: {backstory}
VOICE: {vocab_level} vocabulary, {humor_type} humor, {caption_style} caption format, {hook_type} hooks
PSYCHOLOGICAL HOOKS: {', '.join(psych_hooks)}
PLATFORMS: {', '.join(platforms)} | MOOD: {current_mood} | TARGET CPM: ${cpm}
{trend_block}

[IMAGE PROMPT RULES] Camera: Phase One XF or Sony A7R V | Lighting: Profoto B10X softbox, Godox rim | Detail: 8K skin pores, realistic fabric
[OUTFIT LOCK] One consistent outfit across ALL posts.

Return JSON array: post_number, viral_hook, caption, hashtags, image_prompt, negative_prompt, content_type, monetization_angle.
Output ONLY the JSON array."""

        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: client.models.generate_content(
                model=model_id or "gemini-2.0-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.9, max_output_tokens=4096,
                    response_mime_type="application/json"
                ),
            )
        )
        posts = json.loads(_clean_json(response.text))
        for post in posts:
            post["influencer_id"] = influencer_id
        return posts

    async def generate_stories(
        self, influencer_id: str, influencer_name: str, niche: str,
        dna: dict, num_stories: int = 3, current_mood: str = "creative"
    ) -> list[dict]:
        """Generates IG story ideas using local Ollama with full DNA personality context."""
        comm = dna.get("personality", {}).get("communication", {})
        v = dna.get("viral_strategy", {})
        id_data = dna.get("identity", {})
        vocab_level = comm.get("vocabulary_level", "conversational")
        humor_type = comm.get("humor_type", "none")
        emotional_expr = comm.get("emotional_expression", "moderate")
        recurring_phrases = comm.get("recurring_phrases", [])
        backstory = id_data.get("backstory", "")
        psych_hooks = v.get("psychological_hooks", [])

        system = (
            f"You are the social media brain of {influencer_name}. "
            f"Voice: {vocab_level} vocabulary, {humor_type} humor, {emotional_expr} emotion. "
            "Always respond with valid JSON only."
        )
        prompt = (
            f"Influencer: {influencer_name} | Niche: {niche} | Mood: {current_mood}\n"
            f"Backstory: {backstory}\n"
            f"Psychological hooks to use: {', '.join(psych_hooks)}\n"
            + (f"Signature phrases: {', '.join(recurring_phrases[:3])}\n" if recurring_phrases else "")
            + f"Generate {num_stories} Instagram story ideas (BTS, daily life, Q&A, poll, countdown).\n"
            f"Each story should feel authentic to {influencer_name}'s voice.\n"
            "Return JSON array: [{\"title\": \"\", \"text_overlay\": \"\", \"visual_description\": \"\", \"type\": \"bts|poll|q&a|countdown\"}]"
        )
        try:
            raw = await _ollama_generate(prompt, system=system, temperature=0.75, timeout=60)
            data = json.loads(_clean_json(raw))
            for story in data:
                story["influencer_id"] = influencer_id
            return data
        except Exception as e:
            print(f"[Creator] Stories failed: {e}")
            return []

    async def transmute_post(self, post: dict, target_platform: str) -> dict:
        """Adapts a post for a different platform."""
        system = "You are a cross-platform social media adaptor. Return only valid JSON."
        prompt = (
            f"Original post: {json.dumps(post)}\n"
            f"Target: {target_platform}\n"
            "Adapt the caption and hook for this platform's culture and limits. "
            "Return ONLY a JSON object with: caption, viral_hook"
        )
        try:
            raw = await _ollama_generate(prompt, system=system, temperature=0.5, timeout=60)
            transmuted = json.loads(_clean_json(raw))
            new_post = post.copy()
            new_post.update(transmuted)
            new_post["platform"] = target_platform
            return new_post
        except Exception:
            return post

    def generate_master_prompt_sync(
        self, influencer_name: str, niche: str, dna: dict, scenario: Optional[str] = None
    ) -> str:
        """Synchronous master shot prompt generation for Redis workers."""
        scenario_context = scenario or "high fashion profile portrait with dramatic lighting"
        system = "You are a Cinematic Prompt Engineer. Output only the final prompt string, nothing else."
        prompt = (
            f"Influencer: {influencer_name} | Niche: {niche}\n"
            f"Identity: {json.dumps(dna.get('identity', {}))}\n"
            f"Personality: {json.dumps(dna.get('personality', {}))}\n"
            f"Scenario: {scenario_context}\n\n"
            "Write ONE technically precise image prompt. Include: camera (85mm f/1.8), lighting (rim, catchlights), "
            "skin texture (pores, highlights), eye detail. Respect the influencer ethnicity and features. "
            "No buzzwords like 'masterpiece'. Output ONLY the prompt string."
        )
        try:
            result = _ollama_generate_sync(prompt, system=system, temperature=0.8, timeout=90)
            return result
        except Exception as e:
            print(f"[Creator] Master Prompt Sync Error: {e}")
            return f"Professional RAW photo of {influencer_name}, ultra-detailed features, {scenario_context}"

    async def generate_master_prompt(
        self, influencer_name: str, niche: str, dna: dict, scenario: Optional[str] = None
    ) -> str:
        """Async master shot prompt generation for the orchestrator pipeline."""
        scenario_context = scenario or "high fashion profile portrait with dramatic lighting"
        system = "You are a Cinematic Prompt Engineer. Output only the final prompt string, nothing else."
        prompt = (
            f"Influencer: {influencer_name} | Niche: {niche}\n"
            f"Identity: {json.dumps(dna.get('identity', {}))}\n"
            f"Personality: {json.dumps(dna.get('personality', {}))}\n"
            f"Scenario: {scenario_context}\n\n"
            "Write ONE technically precise image prompt. Include: camera (85mm f/1.8), lighting (rim, catchlights), "
            "skin texture (pores, highlights), eye detail. Respect the influencer ethnicity and features. "
            "No buzzwords like 'masterpiece'. Output ONLY the prompt string."
        )
        try:
            result = await _ollama_generate(prompt, system=system, temperature=0.8, timeout=90)
            return result
        except Exception as e:
            print(f"[Creator] Master Prompt Error: {e}")
            return f"Professional RAW photo of {influencer_name}, ultra-detailed features, {scenario_context}"
    async def generate_production_script(
        self, influencer_name: str, niche: str, dna: dict, base_idea: str, num_clips: int = 1
    ) -> dict:
        """
        AI VIDEO DIRECTOR: Generates a JSON 'Production Script' for the VideoEditorAgent.
        Defines how to chop, reorder, and apply effects to generated clips.
        """
        system = "You are an Elite AI Video Director. You output ONLY valid JSON for a production script."
        prompt = (
            f"Influencer: {influencer_name} | Niche: {niche}\n"
            f"DNA: {json.dumps(dna.get('personality', {}))}\n"
            f"Base Idea: {base_idea}\n"
            f"Available Clips: {num_clips}\n\n"
            "Design a 5-10 second viral video production script. "
            "Output a JSON object with this exact structure:\n"
            "{\n"
            "  'scenes': [\n"
            "    {'source_clip_index': 0, 'start': 0.0, 'end': 1.5, 'effect': 'zoom_in'},\n"
            "    {'source_clip_index': 0, 'start': 1.5, 'end': 3.0, 'effect': 'mirror'}\n"
            "  ],\n"
            "  'audio': {'background_music': 'upbeat_trending', 'pacing': 'high-energy'}\n"
            "}\n"
            "Ensure 'source_clip_index' is within range [0, 1]. Output ONLY the JSON."
        )
        try:
            raw = await _ollama_generate(prompt, system=system, temperature=0.7, timeout=60)
            clean = _clean_json(raw)
            script = json.loads(clean)
            return script
        except Exception as e:
            print(f"[Creator] Production script generation failed: {e}. Using default.")
            return {
                "scenes": [{"source_clip_index": 0, "start": 0, "end": 3.0, "effect": "zoom_in"}],
                "audio": {"pacing": "medium"}
            }
