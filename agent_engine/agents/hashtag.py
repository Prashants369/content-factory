"""
Hashtag Agent — Finds trending, high-reach hashtags for each influencer niche.

Strategy (in priority order):
1. OpenClaw      → live web scrape of hashtag sites (best-hashtags.com, Reddit)
2. Exa AI        → neural search if EXA_API_KEY is set
3. Ollama        → AI-generated sets using niche + DNA intelligence
4. Evergreen     → curated static fallback per niche category
"""

import os
import re
import json
import asyncio
import httpx
from datetime import datetime
from typing import Optional

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:7b")


# ── Evergreen fallback hashtag sets per niche category ─────────────────────────
EVERGREEN_HASHTAGS: dict[str, dict[str, list[str]]] = {
    "fashion": {
        "trending_now":    ["#fashionweek", "#ootd", "#fashionblogger", "#outfitinspo", "#streetstyle"],
        "niche_authority": ["#wiwt", "#fashionista", "#styleinspo", "#lookoftheday", "#fashionphotography"],
        "engagement_bait": ["#fashionlovers", "#fashionaddict", "#styleoftheday", "#whatiwore", "#outfitcheck"],
    },
    "fitness": {
        "trending_now":    ["#fitcheck", "#gymlife", "#workoutmotivation", "#fitnessgirls", "#gainz"],
        "niche_authority": ["#fitnessjourney", "#fitnessmotivation", "#gymrat", "#bodybuilding", "#personaltrainer"],
        "engagement_bait": ["#fitfam", "#fitspo", "#healthylifestyle", "#workoutoftheday", "#gymflow"],
    },
    "luxury": {
        "trending_now":    ["#luxurylifestyle", "#richlife", "#millionairemindset", "#luxurycar", "#designerfashion"],
        "niche_authority": ["#luxuryfashion", "#luxuryliving", "#highfashion", "#luxury", "#wealthymindset"],
        "engagement_bait": ["#luxurylooks", "#luxurylovers", "#lifestyleoftherich", "#opulence", "#affluent"],
    },
    "beauty": {
        "trending_now":    ["#makeupoftheday", "#glowup", "#makeuptutorial", "#skincare2025", "#beautytrends"],
        "niche_authority": ["#makeupartist", "#skincareroutine", "#beautyblogger", "#glowskin", "#makeuplover"],
        "engagement_bait": ["#beautylovers", "#makeupjunkie", "#skincarecheck", "#naturalmakeup", "#makeuptransformation"],
    },
    "travel": {
        "trending_now":    ["#travelgram", "#wanderlust", "#travelblogger", "#travelreels", "#instatravel"],
        "niche_authority": ["#travellife", "#travelphotography", "#solotravel", "#travelcouple", "#luxurytravel"],
        "engagement_bait": ["#traveladdict", "#wanderer", "#exploreeverything", "#travelgoals", "#travelbabe"],
    },
    "tech": {
        "trending_now":    ["#aiinfluencer", "#techindustry", "#aiart", "#digitalnomad", "#futuretech"],
        "niche_authority": ["#techblogger", "#artificialintelligence", "#machinelearning", "#coding", "#techgirl"],
        "engagement_bait": ["#techlovers", "#techlife", "#techcommunity", "#womenintech", "#aitools"],
    },
    "indian": {
        "trending_now":    ["#indianfashion", "#indianblogger", "#desi", "#bollywood", "#indianinfluencer"],
        "niche_authority": ["#indianmodel", "#desivibes", "#mumbaiinfluencer", "#indiangirl", "#ethnicwear"],
        "engagement_bait": ["#indians", "#indianstyle", "#traditionalindian", "#desigirl", "#saree"],
    },
    "kbeauty": {
        "trending_now":    ["#kbeauty", "#kpop", "#koreanmakeup", "#kbeautyroutine", "#glassskin"],
        "niche_authority": ["#koreanfashion", "#kdrama", "#koreanskincare", "#kpopidol", "#koreanstyle"],
        "engagement_bait": ["#kbeautylover", "#kstyle", "#koreanbeauty", "#asianskincare", "#skindumplings"],
    },
    "dark": {
        "trending_now":    ["#darkacademia", "#gothfashion", "#darkstyle", "#villainess", "#alternativefashion"],
        "niche_authority": ["#darkfashion", "#gothicstyle", "#edgyfashion", "#alternativemodel", "#darkvibes"],
        "engagement_bait": ["#darkbeauty", "#gothgirl", "#darkfeed", "#aestheticgoth", "#darkaesthetic"],
    },
    "default": {
        "trending_now":    ["#viral", "#trending", "#explore", "#fyp", "#reels"],
        "niche_authority": ["#influencer", "#content", "#creator", "#lifestyle", "#aesthetic"],
        "engagement_bait": ["#instalike", "#follow", "#like4like", "#instagood", "#photooftheday"],
    },
}


def _niche_to_category(niche: str) -> str:
    """Map influencer niche string to an evergreen hashtag category key."""
    n = niche.lower()
    if re.search(r"fashion|model|glam|vogue|style|couture|outfit|ootd", n): return "fashion"
    if re.search(r"gym|fit|sport|athlet|yoga|wellness|crossfit|pilates", n): return "fitness"
    if re.search(r"luxury|wealth|rich|elite|opulen|premium", n): return "luxury"
    if re.search(r"beauty|makeup|skincare|glow|cosmetic", n): return "beauty"
    if re.search(r"travel|nomad|adventure|explore|wander|backpack", n): return "travel"
    if re.search(r"tech|cyber|ai|code|hack|robot|scifit|fintech|startup", n): return "tech"
    if re.search(r"indian|desi|bollywood|hindi|punjabi|saree", n): return "indian"
    if re.search(r"korean|kpop|k-beauty|kdrama|hanbok", n): return "kbeauty"
    if re.search(r"dark|goth|punk|rebel|villain|occult|shadow", n): return "dark"
    return "default"


def _clean_json(raw: str) -> str:
    raw = re.sub(r"^```(?:json)?\s*", "", raw.strip())
    raw = re.sub(r"\s*```$", "", raw)
    return raw.strip()


class HashtagAgent:
    """
    Finds trending + niche-authority hashtags using OpenClaw, Exa AI, Ollama, and evergreen fallbacks.
    Produces a full hashtag strategy with 4 tiers:
      trending_now, niche_authority, engagement_bait, brand_signature
    """

    def __init__(self):
        self.exa_key = os.getenv("EXA_API_KEY", "")
        self._cache: dict[str, tuple[float, dict]] = {}
        self._cache_ttl = 3600  # 1 hour cache per niche
        # Lazy-init OpenClawAgent so import doesn't fail if openclaw.py has issues
        self._openclaw = None

    def _get_openclaw(self):
        if self._openclaw is None:
            try:
                from agents.openclaw import OpenClawAgent
                self._openclaw = OpenClawAgent()
            except Exception as e:
                print(f"[Hashtag] OpenClaw import failed: {e}")
        return self._openclaw

    async def find_hashtags(
        self,
        niche: str,
        influencer_name: str,
        dna: Optional[dict] = None,
        platforms: Optional[list[str]] = None,
        force_refresh: bool = False,
    ) -> dict:
        """
        Main entry point. Returns a full hashtag strategy dict:
        {
            trending_now: [...],
            niche_authority: [...],
            engagement_bait: [...],
            brand_signature: [...],
            caption_blocks: { minimal: str, standard: str, full: str },
            source: str,
            niche_category: str,
        }
        """
        if platforms is None:
            platforms = ["instagram"]

        cache_key = f"{niche}:{':'.join(platforms)}"
        now = datetime.utcnow().timestamp()

        if not force_refresh and cache_key in self._cache:
            ts, cached = self._cache[cache_key]
            if now - ts < self._cache_ttl:
                print(f"[Hashtag] Cache hit for {niche}")
                return cached

        niche_category = _niche_to_category(niche)
        result: dict = {
            "trending_now": [],
            "niche_authority": [],
            "engagement_bait": [],
            "brand_signature": [],
            "source": "fallback",
            "niche_category": niche_category,
        }
        sources_used: list[str] = []

        # Step 1: OpenClaw — live web scrape (free, no API key needed)
        openclaw = self._get_openclaw()
        if openclaw:
            try:
                oc_tags = await openclaw.scrape_hashtag_trends(niche, platforms)
                if oc_tags:
                    result["trending_now"] = oc_tags[:8]
                    sources_used.append("openclaw")
                    print(f"[Hashtag] ✓ OpenClaw scraped {len(oc_tags)} live tags for {niche}")
            except Exception as e:
                print(f"[Hashtag] OpenClaw hashtag scrape failed: {e}")

        # Step 2: Exa AI (real-time web trends)
        if self.exa_key:
            try:
                exa_tags = await self._fetch_via_exa(niche, platforms)
                if exa_tags:
                    if not result["trending_now"]:
                        result["trending_now"] = exa_tags[:8]
                    sources_used.append("exa")
                    print(f"[Hashtag] ✓ Exa returned {len(exa_tags)} trending tags for {niche}")
            except Exception as e:
                print(f"[Hashtag] Exa failed: {e}")

        # Step 3: Ollama AI (niche intelligence + DNA-aware)
        try:
            ollama_result = await self._fetch_via_ollama(niche, influencer_name, dna, platforms)
            if ollama_result:
                if not result["trending_now"]:
                    result["trending_now"] = ollama_result.get("trending_now", [])[:8]
                result["niche_authority"] = ollama_result.get("niche_authority", [])[:10]
                result["engagement_bait"] = ollama_result.get("engagement_bait", [])[:6]
                result["brand_signature"] = ollama_result.get("brand_signature", [])[:4]
                sources_used.append("ollama")
                print(f"[Hashtag] ✓ Ollama enriched hashtag set for {niche}")
        except Exception as e:
            print(f"[Hashtag] Ollama failed: {e}")

        result["source"] = "+".join(sources_used) if sources_used else "fallback"

        # Step 3: Evergreen fallback for any missing tiers
        evergreen = EVERGREEN_HASHTAGS.get(niche_category, EVERGREEN_HASHTAGS["default"])
        if not result["trending_now"]:
            result["trending_now"] = evergreen.get("trending_now", [])[:8]
        if not result["niche_authority"]:
            result["niche_authority"] = evergreen.get("niche_authority", [])[:10]
        if not result["engagement_bait"]:
            result["engagement_bait"] = evergreen.get("engagement_bait", [])[:6]
        if not result["brand_signature"]:
            # Auto-generate brand signature tags from influencer name
            slug = influencer_name.lower().replace(" ", "")
            result["brand_signature"] = [
                f"#{slug}",
                f"#{slug}official",
                f"#by{slug.split('_')[0] if '_' in slug else slug[:6]}",
            ]

        # Build caption-ready hashtag blocks (3 sizes)
        result["caption_blocks"] = _build_caption_blocks(result)

        self._cache[cache_key] = (now, result)
        return result

    async def _fetch_via_exa(self, niche: str, platforms: list[str]) -> list[str]:
        """Use Exa AI to find what hashtags are trending right now for this niche."""
        today = datetime.utcnow().strftime("%Y-%m-%d")
        platform_str = ", ".join(platforms)
        query = f"trending hashtags {niche} {platform_str} {today} viral"

        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(
                "https://api.exa.ai/search",
                headers={"x-api-key": self.exa_key, "Content-Type": "application/json"},
                json={
                    "query": query,
                    "numResults": 5,
                    "useAutoprompt": True,
                    "startPublishedDate": f"{today}T00:00:00.000Z",
                    "contents": {"text": {"maxCharacters": 800}},
                },
            )
            if not r.is_success:
                return []

            data = r.json()
            results = data.get("results", [])
            tags: list[str] = []
            for item in results:
                text = (item.get("text", "") + " " + item.get("title", "")).lower()
                # Extract hashtags from scraped content
                found = re.findall(r"#[\w]+", text)
                tags.extend(found)

            # Deduplicate and filter noise
            seen: set[str] = set()
            clean: list[str] = []
            for t in tags:
                t_clean = t.lower().strip()
                if t_clean not in seen and len(t_clean) > 3 and len(t_clean) < 35:
                    seen.add(t_clean)
                    clean.append(t_clean)

            return clean[:15]

    async def _fetch_via_ollama(
        self, niche: str, influencer_name: str, dna: Optional[dict], platforms: list[str]
    ) -> Optional[dict]:
        """
        Ask Ollama to generate a full tiered hashtag strategy based on niche + DNA personality.
        """
        # Extract key DNA signals for hashtag personalization
        dna_context = ""
        brand_slug = influencer_name.lower().replace(" ", "")
        if dna:
            v = dna.get("viral_strategy", {})
            id_data = dna.get("identity", {})
            psych_hooks = v.get("psychological_hooks", [])
            market = v.get("market_focus", "Global")
            archetype = v.get("primary_hook_archetype", "")
            ethnicity = id_data.get("ethnicity", "")
            aesthetic = dna.get("style", {}).get("primary_aesthetic", "")
            dna_context = (
                f"\nINFLUENCER DNA:\n"
                f"- Name: {influencer_name}\n"
                f"- Ethnicity/Market: {ethnicity} / {market}\n"
                f"- Archetype: {archetype}\n"
                f"- Aesthetic: {aesthetic}\n"
                f"- Psychological hooks: {', '.join(psych_hooks)}\n"
            )

        today = datetime.utcnow().strftime("%A, %B %d %Y")
        platform_str = ", ".join(platforms)

        system = (
            "You are an Instagram growth expert and hashtag strategist. "
            "You know exactly which hashtags are growing vs dying in real time. "
            "You ALWAYS respond with valid JSON only. No markdown. No explanation."
        )

        prompt = f"""Find the BEST hashtags for this AI influencer. Today is {today}.

NICHE: {niche}
PLATFORMS: {platform_str}
{dna_context}

HASHTAG STRATEGY RULES:
- trending_now: 8 hashtags currently viral this week (high volume 500k-5M posts) — these change weekly
- niche_authority: 10 hashtags specific to this niche (50k-500k posts) — ideal discovery zone
- engagement_bait: 6 community hashtags that drive comments/saves
- brand_signature: 3 unique custom hashtags ONLY for {influencer_name} (like #priyavermaofficial)

IMPORTANT:
- Mix hashtag sizes: big (5M+), medium (500k), small (50k) for maximum reach algorithm
- No generic hashtags like #love #instagood #photo — must be niche-specific
- Include region-specific tags if market is India: #indianinfluencer #mumbaimodel etc
- brand_signature must include one with the influencer's name slug: #{brand_slug}

Return ONLY this JSON object:
{{
  "trending_now": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5", "#tag6", "#tag7", "#tag8"],
  "niche_authority": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5", "#tag6", "#tag7", "#tag8", "#tag9", "#tag10"],
  "engagement_bait": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5", "#tag6"],
  "brand_signature": ["#{brand_slug}", "#tag2", "#tag3"]
}}"""

        async with httpx.AsyncClient(timeout=90) as client:
            r = await client.post(
                f"{OLLAMA_URL}/api/generate",
                json={
                    "model": OLLAMA_MODEL,
                    "prompt": prompt,
                    "system": system,
                    "stream": False,
                    "format": "json",
                    "options": {"temperature": 0.75, "num_predict": 800, "top_k": 40, "top_p": 0.9},
                },
            )
            r.raise_for_status()
            raw = r.json().get("response", "").strip()
            raw = re.sub(r"<think>[\s\S]*?</think>", "", raw, flags=re.IGNORECASE).strip()
            raw = _clean_json(raw)
            match = re.search(r"\{[\s\S]*\}", raw)
            if not match:
                return None
            data = json.loads(match.group())
            # Validate and clean each tier
            clean: dict[str, list[str]] = {}
            for tier in ["trending_now", "niche_authority", "engagement_bait", "brand_signature"]:
                tags = data.get(tier, [])
                clean[tier] = [
                    t if t.startswith("#") else f"#{t}"
                    for t in tags
                    if isinstance(t, str) and len(t) > 1
                ]
            return clean


def _build_caption_blocks(strategy: dict) -> dict[str, str]:
    """
    Build 3 ready-to-paste hashtag blocks of different sizes:
    - minimal: 5 highest-impact tags (stories, first comment)
    - standard: 15 tags (main post caption)
    - full:     25+ tags (maximum reach, append as comment)
    """
    trending = strategy.get("trending_now", [])
    authority = strategy.get("niche_authority", [])
    engagement = strategy.get("engagement_bait", [])
    brand = strategy.get("brand_signature", [])

    # Minimal: top 2 trending + top 2 authority + 1 brand
    minimal_tags = trending[:2] + authority[:2] + brand[:1]
    minimal = " ".join(minimal_tags[:5])

    # Standard: 4 trending + 6 authority + 3 engagement + 2 brand
    standard_tags = trending[:4] + authority[:6] + engagement[:3] + brand[:2]
    standard = " ".join(standard_tags[:15])

    # Full: everything
    all_tags = list(dict.fromkeys(trending + authority + engagement + brand))  # dedup, preserve order
    full = " ".join(all_tags[:30])

    return {
        "minimal": minimal,
        "standard": standard,
        "full": full,
    }


# ── Sync helper for use in non-async contexts ──────────────────────────────────
def find_hashtags_sync(
    niche: str,
    influencer_name: str,
    dna: Optional[dict] = None,
    platforms: Optional[list[str]] = None,
) -> dict:
    """Synchronous wrapper for the hashtag agent."""
    agent = HashtagAgent()
    try:
        loop = asyncio.new_event_loop()
        return loop.run_until_complete(
            agent.find_hashtags(niche, influencer_name, dna, platforms or ["instagram"])
        )
    finally:
        loop.close()
