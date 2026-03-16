"""
Scout Agent — scrapes trending topics, viral hooks, and audio trends
using Playwright for real browser automation.
Falls back to Exa AI web search if Playwright is unavailable.
"""
import os
import sys
import json
import asyncio
import httpx
from datetime import datetime

# Playwright doesn't work on Python 3.13+ / Windows due to asyncio subprocess issues
_PLAYWRIGHT_BROKEN = sys.platform == "win32" and sys.version_info >= (3, 13)


class ScoutAgent:
    def __init__(self):
        self.exa_key = os.getenv("EXA_API_KEY", "")
        self._cache = {} # Key: niche+platforms, Value: (timestamp, trends)
        self._cache_expiry = 3600 # 1 hour
        self._openclaw = None

    def _get_openclaw(self):
        if self._openclaw is None:
            try:
                from .openclaw import OpenClawAgent
                self._openclaw = OpenClawAgent()
            except Exception as e:
                print(f"[Scout] OpenClaw import failed: {e}")
        return self._openclaw

    async def find_trends(self, niche: str, platforms: list[str], limit: int = 10) -> list[dict]:
        cache_key = f"{niche}:{''.join(platforms)}"
        now = datetime.utcnow().timestamp()

        if cache_key in self._cache:
            ts, cached_trends = self._cache[cache_key]
            if now - ts < self._cache_expiry:
                print(f"[Scout] Returning cached trends for {niche}")
                return cached_trends[:limit]

        trends: list[dict] = []

        # Step 0: OpenClaw — scrapes Reddit JSON + HackerNews (free, no API key)
        openclaw = self._get_openclaw()
        if openclaw:
            try:
                oc_trends = await openclaw.scrape_trending_topics(niche, limit)
                if oc_trends:
                    trends.extend(oc_trends)
                    print(f"[Scout] ✓ OpenClaw: {len(oc_trends)} live trends for {niche}")
            except Exception as e:
                print(f"[Scout] OpenClaw trend scrape failed: {e}")

        # Step 1: Exa AI (most reliable if key is set)
        if self.exa_key and len(trends) < limit:
            exa = await self._scout_via_exa(niche, platforms, limit)
            trends.extend(exa)

        # Step 2: Playwright scraping as supplement/fallback
        if len(trends) < limit and not _PLAYWRIGHT_BROKEN:
            try:
                playwright_trends = await self._scout_via_playwright(niche, platforms)
                trends.extend(playwright_trends)
            except Exception as e:
                print(f"[Scout] Playwright unavailable: {e}")

        # Deduplicate by topic
        seen = set()
        unique: list[dict] = []
        for t in trends:
            key = t.get("topic", "")[:40]
            if key and key not in seen:
                seen.add(key)
                unique.append(t)

        unique_limited = unique[:limit]
        self._cache[cache_key] = (now, unique_limited)
        return unique_limited

    async def _scout_via_exa(self, niche: str, platforms: list[str], limit: int) -> list[dict]:
        """Use Exa AI neural search to find trending content in the niche."""
        today = datetime.utcnow().strftime("%Y-%m-%d")
        query = f"viral {niche} content trends {' '.join(platforms)} {today}"

        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.post(
                "https://api.exa.ai/search",
                headers={"x-api-key": self.exa_key, "Content-Type": "application/json"},
                json={
                    "query": query,
                    "numResults": limit,
                    "useAutoprompt": True,
                    "startPublishedDate": f"{today}T00:00:00.000Z",
                    "contents": {"text": {"maxCharacters": 500}},
                },
            )
            if not r.is_success:
                return []

            data = r.json()
            results = data.get("results", [])
            trends = []
            for item in results:
                trends.append({
                    "topic": item.get("title", ""),
                    "url": item.get("url", ""),
                    "summary": item.get("text", "")[:300],
                    "platform": "web",
                    "source": "exa",
                    "discovered_at": today,
                    "virality_score": 0.7,
                })
            return trends

    async def _scout_via_playwright(self, niche: str, platforms: list[str]) -> list[dict]:
        """Use Playwright to scrape real trending data from social platforms."""
        from playwright.async_api import async_playwright

        trends: list[dict] = []
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(headless=True)
            page = await browser.new_page(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            )

            # Scrape Google Trends for niche
            try:
                topic_query = niche.replace(" ", "+")
                await page.goto(
                    f"https://trends.google.com/trends/explore?q={topic_query}&date=now+7-d",
                    wait_until="domcontentloaded",
                    timeout=15000,
                )
                await page.wait_for_timeout(3000)

                # Extract rising topics
                rising = await page.evaluate("""
                    () => {
                        const items = document.querySelectorAll('.related-queries-item');
                        return Array.from(items).slice(0, 5).map(el => el.textContent?.trim() || '');
                    }
                """)
                for topic in rising:
                    if topic:
                        trends.append({
                            "topic": topic,
                            "platform": "google_trends",
                            "source": "playwright",
                            "virality_score": 0.8,
                        })
            except Exception as e:
                print(f"[Scout:Playwright] Google Trends scrape failed: {e}")

            # Scrape Reddit (Hot posts in niche)
            try:
                sub_query = niche.split(' ')[0].lower() # e.g. "luxury"
                await page.goto(
                    f"https://www.reddit.com/r/{sub_query}/hot/",
                    wait_until="domcontentloaded",
                    timeout=15000,
                )
                await page.wait_for_timeout(3000)
                reddit_posts = await page.evaluate("""
                    () => {
                        const items = document.querySelectorAll('a[slot="title"]'); // Modern Reddit UI
                        return Array.from(items).slice(0, 5).map(el => el.textContent?.trim() || '');
                    }
                """)
                for post in reddit_posts:
                    if post and post not in [t['topic'] for t in trends]:
                        trends.append({
                            "topic": post[:100],
                            "platform": "reddit",
                            "source": "playwright",
                            "virality_score": 0.9,
                        })
            except Exception as e:
                print(f"[Scout:Playwright] Reddit scrape failed: {e}")

            # Scrape YouTube (Recent high-view videos for niche)
            try:
                yt_query = niche.replace(" ", "+")
                await page.goto(
                    f"https://www.youtube.com/results?search_query={yt_query}&sp=CAM%253D", # Search, sort by upload date
                    wait_until="domcontentloaded",
                    timeout=15000,
                )
                await page.wait_for_timeout(3000)
                yt_videos = await page.evaluate("""
                    () => {
                        const titles = document.querySelectorAll('a#video-title');
                        return Array.from(titles).slice(0, 5).map(el => el.textContent?.trim() || '');
                    }
                """)
                for vid in yt_videos:
                    if vid and vid not in [t['topic'] for t in trends]:
                        trends.append({
                            "topic": vid,
                            "platform": "youtube",
                            "source": "playwright",
                            "virality_score": 0.85,
                        })
            except Exception as e:
                print(f"[Scout:Playwright] YouTube scrape failed: {e}")

            await browser.close()

        return trends
    async def shadow_competitors(self, niche: str, limit: int = 5) -> list[dict]:
        """Scans for top competitors in the niche and extracts their viral hooks."""
        if not self.exa_key: return []
        
        query = f"top performing {niche} influencers viral hooks and strategies"
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.post(
                "https://api.exa.ai/search",
                headers={"x-api-key": self.exa_key, "Content-Type": "application/json"},
                json={
                    "query": query,
                    "numResults": limit,
                    "useAutoprompt": True,
                    "contents": {"text": {"maxCharacters": 1000}},
                },
            )
            if not r.is_success: return []
            
            data = r.json()
            results = data.get("results", [])
            competitors = []
            for item in results:
                competitors.append({
                    "competitor_name": item.get("title", "Unknown"),
                    "hooks": item.get("text", "")[:500],
                    "url": item.get("url", ""),
                    "virality_insight": "High"
                })
            return competitors
