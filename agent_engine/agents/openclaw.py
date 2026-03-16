"""
OpenClaw Agent — Wraps OpenClaw's local Gateway (default port 18789) to provide
real-time web scraping capability for the AI Influencer Factory.

OpenClaw is an open-source agentic framework that lets LLMs control a browser.
It exposes a local Gateway service we call via HTTP.

Integration priority:
  1. OpenClaw web_fetch  → fast, converts HTML to markdown, no JS
  2. OpenClaw browser    → full Chromium for JS-heavy sites (Instagram explore)
  3. Direct httpx fetch  → fallback if OpenClaw gateway is offline

Main use-cases in this project:
  - Hashtag trend scraping from hashtagify, best-hashtags.com, Reddit
  - Trending topic scraping from Google Trends + Reddit
  - Competitor caption inspiration scraping
  - Supplement/replace Playwright in scout.py

Gateway API (OpenClaw v1):
  POST http://localhost:18789/v1/tools/web_fetch  { "url": "..." }
  POST http://localhost:18789/v1/tools/browser    { "url": "...", "action": "navigate" }
  GET  http://localhost:18789/health
"""

import os
import re
import json
import asyncio
import httpx
from typing import Optional
from datetime import datetime

OPENCLAW_URL = os.getenv("OPENCLAW_URL", "http://127.0.0.1:18789")
OLLAMA_URL   = os.getenv("OLLAMA_URL",   "http://127.0.0.1:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:7b")

# Sites we scrape for hashtag intelligence (all static HTML, no JS needed)
HASHTAG_SCRAPE_TARGETS = [
    "https://best-hashtags.com/hashtag/{niche}/",
    "https://www.hashtags.org/analytics/{niche}/",
]

# Sites for trend intelligence
TREND_SCRAPE_TARGETS = [
    "https://www.reddit.com/r/{subreddit}/hot/.json",  # Reddit JSON API (no auth needed)
    "https://trends.google.com/trends/explore?q={niche}&date=now+7-d",
]


class OpenClawAgent:
    """
    Wraps the OpenClaw local gateway to provide real-time web intelligence.
    Falls back to direct httpx fetching if OpenClaw isn't running.
    Uses Ollama to parse and extract structured data from raw scraped content.
    """

    def __init__(self):
        self.gateway_url = OPENCLAW_URL
        self._available: Optional[bool] = None  # cached health check

    # ── Health / Availability ──────────────────────────────────────────────────
    async def is_available(self) -> bool:
        """Check if OpenClaw gateway is running. Cached for 5 minutes."""
        if self._available is not None:
            return self._available
        try:
            async with httpx.AsyncClient(timeout=2) as c:
                r = await c.get(f"{self.gateway_url}/health")
                self._available = r.status_code == 200
        except Exception:
            self._available = False
        return self._available

    def reset_cache(self):
        """Reset availability cache so next call re-checks the gateway."""
        self._available = None

    # ── Core: web_fetch ────────────────────────────────────────────────────────
    async def web_fetch(self, url: str, use_browser: bool = False) -> str:
        """
        Fetch a URL and return clean markdown text.
        
        Tries:
          1. OpenClaw gateway web_fetch (HTML → markdown, fast)
          2. OpenClaw gateway browser  (full Chromium, for JS-heavy sites)
          3. Direct httpx GET          (fallback if OpenClaw offline)
        
        Returns: clean text/markdown string, empty string on failure.
        """
        # Path 1: OpenClaw gateway
        if await self.is_available():
            try:
                endpoint = "browser" if use_browser else "web_fetch"
                payload = {"url": url}
                if use_browser:
                    payload["action"] = "navigate_and_extract"

                async with httpx.AsyncClient(timeout=20) as c:
                    r = await c.post(
                        f"{self.gateway_url}/v1/tools/{endpoint}",
                        json=payload,
                    )
                    if r.is_success:
                        data = r.json()
                        # OpenClaw returns content in "content" or "text" or "markdown" field
                        content = (
                            data.get("content")
                            or data.get("text")
                            or data.get("markdown")
                            or data.get("result")
                            or ""
                        )
                        if content:
                            print(f"[OpenClaw] ✓ Fetched via {'browser' if use_browser else 'web_fetch'}: {url[:60]}")
                            return str(content)
            except Exception as e:
                print(f"[OpenClaw] Gateway request failed: {e}")
                self._available = False  # reset so we don't keep hitting it

        # Path 2: Direct httpx fallback (static sites only)
        try:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Accept": "text/html,application/xhtml+xml,application/json,*/*",
            }
            async with httpx.AsyncClient(timeout=15, follow_redirects=True) as c:
                r = await c.get(url, headers=headers)
                if r.is_success:
                    text = r.text
                    # Strip HTML tags for basic cleanup
                    text = re.sub(r"<script[^>]*>[\s\S]*?</script>", "", text, flags=re.IGNORECASE)
                    text = re.sub(r"<style[^>]*>[\s\S]*?</style>", "", text, flags=re.IGNORECASE)
                    text = re.sub(r"<[^>]+>", " ", text)
                    text = re.sub(r"\s{3,}", "\n", text).strip()
                    print(f"[OpenClaw] ✓ Direct httpx fetch: {url[:60]}")
                    return text[:8000]  # cap to avoid token explosion
        except Exception as e:
            print(f"[OpenClaw] Direct fetch also failed for {url[:60]}: {e}")

        return ""

    # ── Hashtag Scraping ───────────────────────────────────────────────────────
    async def scrape_hashtag_trends(
        self, niche: str, platforms: Optional[list[str]] = None
    ) -> list[str]:
        """
        Scrape trending hashtags from hashtag analytics sites.
        Returns a list of hashtag strings like ['#fashionweek', '#ootd', ...]
        
        Sources (all free, no auth):
          - best-hashtags.com
          - hashtags.org (JSON API available)
          - Reddit JSON hot posts (extracts hashtags from titles/comments)
        """
        if platforms is None:
            platforms = ["instagram"]

        # Clean niche for URL slugs
        niche_slug = niche.lower().split()[0].replace("-", "").replace("_", "")
        all_content = []

        # Source 1: best-hashtags.com
        url1 = f"https://best-hashtags.com/hashtag/{niche_slug}/"
        content1 = await self.web_fetch(url1)
        if content1:
            all_content.append(content1[:3000])

        # Source 2: Reddit JSON API for the niche subreddit
        url2 = f"https://www.reddit.com/r/{niche_slug}/hot/.json?limit=10"
        content2 = await self.web_fetch(url2)
        if content2:
            # Try to parse as JSON for Reddit
            try:
                data = json.loads(content2)
                posts = data.get("data", {}).get("children", [])
                titles = [p["data"].get("title", "") for p in posts[:10]]
                all_content.append("\n".join(titles))
            except Exception:
                all_content.append(content2[:2000])

        # Source 3: Hashtagify (if content found)
        url3 = f"https://hashtagify.me/hashtag/{niche_slug}"
        content3 = await self.web_fetch(url3)
        if content3:
            all_content.append(content3[:2000])

        if not any(all_content):
            print(f"[OpenClaw] No content scraped for hashtag niche: {niche}")
            return []

        combined = "\n\n---\n\n".join(c for c in all_content if c)

        # Use Ollama to extract hashtags from scraped content
        return await self._extract_hashtags_from_content(combined, niche)

    async def _extract_hashtags_from_content(self, content: str, niche: str) -> list[str]:
        """
        Ask Ollama to parse raw scraped content and extract the best hashtags.
        """
        system = "You extract hashtags from web content. Return ONLY a JSON array of hashtag strings. No explanation."
        prompt = (
            f"Niche: {niche}\n\n"
            f"Scraped web content:\n{content[:4000]}\n\n"
            "Extract ALL hashtags you can find in this content. "
            "Also infer any likely trending hashtags for this niche based on the topics mentioned. "
            "Return ONLY a JSON array: [\"#tag1\", \"#tag2\", \"#tag3\", ...]"
        )

        try:
            async with httpx.AsyncClient(timeout=60) as c:
                r = await c.post(
                    f"{OLLAMA_URL}/api/generate",
                    json={
                        "model": OLLAMA_MODEL,
                        "prompt": prompt,
                        "system": system,
                        "stream": False,
                        "format": "json",
                        "options": {"temperature": 0.4, "num_predict": 400},
                    },
                )
                raw = r.json().get("response", "").strip()
                raw = re.sub(r"<think>[\s\S]*?</think>", "", raw, flags=re.IGNORECASE).strip()
                # Extract JSON array
                match = re.search(r"\[[\s\S]*\]", raw)
                if match:
                    tags = json.loads(match.group())
                    cleaned = [
                        t if t.startswith("#") else f"#{t}"
                        for t in tags
                        if isinstance(t, str) and len(t) > 2
                    ]
                    print(f"[OpenClaw] ✓ Extracted {len(cleaned)} hashtags via Ollama")
                    return cleaned[:20]
        except Exception as e:
            print(f"[OpenClaw] Hashtag extraction failed: {e}")

        # Fallback: regex extraction from raw content
        found = re.findall(r"#[\w]+", content)
        return list(dict.fromkeys(found))[:15]  # dedup, preserve order

    # ── Trend Scraping ─────────────────────────────────────────────────────────
    async def scrape_trending_topics(self, niche: str, limit: int = 8) -> list[dict]:
        """
        Scrape trending topics using Reddit JSON API + Google Trends.
        Returns list of {topic, platform, virality_score, source} dicts.
        """
        trends: list[dict] = []
        niche_slug = niche.lower().split()[0]
        today = datetime.utcnow().strftime("%Y-%m-%d")

        # Reddit hot posts (JSON API — no auth, no scraping needed)
        reddit_url = f"https://www.reddit.com/r/{niche_slug}/hot/.json?limit={limit}"
        reddit_content = await self.web_fetch(reddit_url)

        if reddit_content:
            try:
                data = json.loads(reddit_content)
                posts = data.get("data", {}).get("children", [])
                for p in posts[:limit]:
                    pd = p.get("data", {})
                    title = pd.get("title", "")
                    score = pd.get("score", 0)
                    if title:
                        trends.append({
                            "topic": title[:120],
                            "platform": "reddit",
                            "source": "openclaw_reddit",
                            "virality_score": min(score / 10000, 1.0),
                            "discovered_at": today,
                        })
                print(f"[OpenClaw] ✓ Reddit: {len(trends)} trends for r/{niche_slug}")
            except json.JSONDecodeError:
                # Content not JSON (subreddit might not exist), fallback to text parse
                if reddit_content and len(reddit_content) > 100:
                    trends.extend(await self._parse_trends_via_ollama(reddit_content, niche, "reddit"))

        # HackerNews / ProductHunt for tech niches
        if re.search(r"tech|startup|ai|saas|crypto|finance", niche, re.IGNORECASE):
            hn_url = "https://hacker-news.firebaseio.com/v0/topstories.json"
            hn_content = await self.web_fetch(hn_url)
            if hn_content:
                try:
                    story_ids = json.loads(hn_content)[:5]
                    for sid in story_ids:
                        story_url = f"https://hacker-news.firebaseio.com/v0/item/{sid}.json"
                        story = await self.web_fetch(story_url)
                        if story:
                            data = json.loads(story)
                            if data.get("title"):
                                trends.append({
                                    "topic": data["title"][:120],
                                    "platform": "hackernews",
                                    "source": "openclaw_hn",
                                    "virality_score": 0.85,
                                    "discovered_at": today,
                                })
                except Exception:
                    pass

        return trends[:limit]

    async def _parse_trends_via_ollama(
        self, content: str, niche: str, platform: str
    ) -> list[dict]:
        """Ask Ollama to extract trending topics from raw scraped text."""
        today = datetime.utcnow().strftime("%Y-%m-%d")
        system = "Extract trending topics from web content. Return ONLY valid JSON array."
        prompt = (
            f"Niche: {niche} | Platform: {platform} | Date: {today}\n\n"
            f"Content:\n{content[:3000]}\n\n"
            'Return JSON array: [{"topic": "...", "virality_score": 0.8}]'
        )
        try:
            async with httpx.AsyncClient(timeout=60) as c:
                r = await c.post(
                    f"{OLLAMA_URL}/api/generate",
                    json={
                        "model": OLLAMA_MODEL,
                        "prompt": prompt,
                        "system": system,
                        "stream": False,
                        "format": "json",
                        "options": {"temperature": 0.3, "num_predict": 400},
                    },
                )
                raw = r.json().get("response", "").strip()
                raw = re.sub(r"<think>[\s\S]*?</think>", "", raw, flags=re.IGNORECASE)
                match = re.search(r"\[[\s\S]*\]", raw)
                if match:
                    items = json.loads(match.group())
                    return [
                        {
                            "topic": item.get("topic", "")[:120],
                            "platform": platform,
                            "source": "openclaw_ollama",
                            "virality_score": float(item.get("virality_score", 0.7)),
                            "discovered_at": today,
                        }
                        for item in items
                        if item.get("topic")
                    ]
        except Exception as e:
            print(f"[OpenClaw] Trend extraction failed: {e}")
        return []

    # ── Competitor Intelligence ────────────────────────────────────────────────
    async def scrape_competitor_posts(self, niche: str, limit: int = 5) -> list[dict]:
        """
        Scrape real public content from niche influencer aggregators.
        Uses sites that aggregate top creator content (Socialblade, etc.)
        Returns: [{hook, caption_style, hashtags, platform, engagement_hint}]
        """
        niche_slug = niche.lower().replace(" ", "-")
        posts: list[dict] = []

        # Scrape Pinterest search (public, no auth)
        pinterest_url = f"https://www.pinterest.com/search/pins/?q={niche_slug.replace('-', '%20')}&rs=typed"
        content = await self.web_fetch(pinterest_url, use_browser=False)

        if content:
            posts = await self._extract_post_intelligence(content, niche)

        if not posts:
            # Fallback: scrape public IG hashtag page (basic metadata only)
            ig_url = f"https://www.instagram.com/explore/tags/{niche_slug.replace('-', '')}/"
            ig_content = await self.web_fetch(ig_url, use_browser=True)  # needs Chromium
            if ig_content:
                posts = await self._extract_post_intelligence(ig_content, niche)

        return posts[:limit]

    async def _extract_post_intelligence(self, content: str, niche: str) -> list[dict]:
        """Ask Ollama to extract caption/hook patterns from scraped content."""
        system = "You are a social media analyst. Extract content patterns. Return ONLY JSON array."
        prompt = (
            f"Niche: {niche}\nScraped content:\n{content[:3500]}\n\n"
            "Extract viral post patterns you see. Return JSON:\n"
            '[{"hook": "...", "caption_style": "one_liner|paragraph", '
            '"key_themes": ["theme1"], "engagement_hint": "high|medium"}]'
        )
        try:
            async with httpx.AsyncClient(timeout=60) as c:
                r = await c.post(
                    f"{OLLAMA_URL}/api/generate",
                    json={
                        "model": OLLAMA_MODEL,
                        "prompt": prompt,
                        "system": system,
                        "stream": False,
                        "format": "json",
                        "options": {"temperature": 0.5, "num_predict": 600},
                    },
                )
                raw = r.json().get("response", "").strip()
                raw = re.sub(r"<think>[\s\S]*?</think>", "", raw, flags=re.IGNORECASE)
                match = re.search(r"\[[\s\S]*\]", raw)
                if match:
                    return json.loads(match.group())
        except Exception as e:
            print(f"[OpenClaw] Post intelligence extraction failed: {e}")
        return []

    # ── Caption Inspiration ────────────────────────────────────────────────────
    async def scrape_caption_inspiration(
        self, niche: str, hashtag: Optional[str] = None
    ) -> list[str]:
        """
        Fetch viral captions/hooks from public sources to seed the CreatorAgent.
        Returns a list of example hook strings to include in generation prompts.
        """
        target_tag = hashtag or niche.lower().split()[0]
        url = f"https://www.reddit.com/r/{target_tag}/top/.json?t=week&limit=10"
        content = await self.web_fetch(url)

        hooks: list[str] = []
        if content:
            try:
                data = json.loads(content)
                posts = data.get("data", {}).get("children", [])
                hooks = [p["data"].get("title", "")[:150] for p in posts if p.get("data", {}).get("title")]
            except Exception:
                pass

        if not hooks and content:
            # Parse text reddit content with Ollama
            parsed = await self._parse_trends_via_ollama(content, niche, "reddit")
            hooks = [t["topic"] for t in parsed if t.get("topic")]

        return hooks[:8]
    # ── Posting Capability ─────────────────────────────────────────────────────
    async def post_to_instagram(self, media_path: str, caption: str) -> bool:
        """
        DISTRIBUTION MACHINE: Uses OpenClaw to post content to Instagram.
        Requires the OpenClaw browser gateway to be running and logged in.
        """
        if not await self.is_available():
            print("[OpenClaw] Cannot post: Gateway unavailable.")
            return False

        print(f"[OpenClaw] Attempting to post '{media_path}' to Instagram...")
        
        # In a real OpenClaw scenario, we'd send a series of 'browser' tool calls.
        # Here we use the 'automated_task' concept or 'agent' prompt.
        
        prompt = (
            f"Go to instagram.com. Upload the file at {media_path}. "
            f"Set the caption to: {caption}. Submit the post."
        )
        
        payload = {
            "task": prompt,
            "url": "https://www.instagram.com"
        }
        
        try:
            async with httpx.AsyncClient(timeout=120) as c:
                r = await c.post(f"{self.gateway_url}/v1/agent/run", json=payload)
                if r.is_success:
                    print("[OpenClaw] ✓ Post command sent successfully.")
                    return True
        except Exception as e:
            print(f"[OpenClaw] Posting failed: {e}")
        
        return False
