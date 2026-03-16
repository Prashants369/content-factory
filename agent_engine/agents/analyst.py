"""
Analyst Agent — pulls Instagram metrics via Graph API, processes with Pandas,
returns ranked post insights and DNA evolution recommendations.
Uses LOCAL Ollama for LLM tasks. Gemini is optional fallback.
"""
import os
import asyncio
import httpx
import pandas as pd
import json
import sqlite3
from pathlib import Path
from typing import Optional
from datetime import datetime

DB_PATH = Path(__file__).parent.parent.parent / "data" / "factory.db"

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:7b")


async def _ollama_chat(prompt: str, system: str = "", timeout: int = 90) -> str:
    """Call Ollama for a single inference."""
    payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "system": system,
        "stream": False,
        "options": {"temperature": 0.3, "num_predict": 2048},
    }
    async with httpx.AsyncClient(timeout=timeout) as client:
        r = await client.post(f"{OLLAMA_URL}/api/generate", json=payload)
        r.raise_for_status()
        return r.json().get("response", "").strip()


class AnalystAgent:
    def __init__(self, notify_callback=None):
        self.ig_token = os.getenv("META_USER_ACCESS_TOKEN", "")
        self.api_version = "v21.0"
        self.base_url = f"https://graph.facebook.com/{self.api_version}"
        self.notify_callback = notify_callback

    async def _notify(self, status: str, message: str, influencer_id: str = None):
        if self.notify_callback:
            await self.notify_callback({
                "agent": "Analyst",
                "status": status,
                "message": message,
                "influencer_id": influencer_id,
                "timestamp": asyncio.get_event_loop().time()
            })

    async def analyse(
        self,
        influencer_id: str,
        ig_account_id: Optional[str] = None,
        access_token: Optional[str] = None,
        model_id: Optional[str] = None,
    ) -> dict:
        token = access_token or self.ig_token
        if not token:
            return {"error": "No Meta access token. Configure in Settings → API Vault."}

        if not ig_account_id:
            ig_account_id = os.getenv("IG_BUSINESS_ACCOUNT_ID", "")
        if not ig_account_id:
            return {"error": "No IG Business Account ID configured."}

        async with httpx.AsyncClient(timeout=20) as client:
            media_res = await client.get(
                f"{self.base_url}/{ig_account_id}/media",
                params={
                    "fields": "id,timestamp,like_count,comments_count,reach,impressions,saved,shares,video_views,media_type,permalink,caption",
                    "limit": 25,
                    "access_token": token,
                }
            )
            if not media_res.is_success:
                return {"error": f"IG API error: {media_res.status_code}"}

            media_data = media_res.json().get("data", [])
            if not media_data:
                return {"posts": [], "insights": {"message": "No posts found yet."}}

            df = pd.DataFrame(media_data)
            numeric_cols = ["like_count", "comments_count", "reach", "impressions", "saved", "video_views"]
            for col in numeric_cols:
                if col not in df.columns:
                    df[col] = 0
                df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

            df["engagement_rate"] = (
                (df["like_count"] + df["comments_count"] + df.get("saved", 0)) /
                df["reach"].replace(0, 1)
            ).round(4)

            df["score"] = (
                df["engagement_rate"] * 0.5 +
                df["reach"] / df["reach"].max() * 0.3 +
                df["video_views"] / (df["video_views"].max() or 1) * 0.2
            )

            top_posts = df.nlargest(5, "score")[
                ["id", "timestamp", "like_count", "comments_count",
                 "reach", "engagement_rate", "score", "permalink", "caption", "media_type"]
            ].to_dict(orient="records")

            bottom_posts = df.nsmallest(3, "score")[
                ["id", "engagement_rate", "score", "media_type"]
            ].to_dict(orient="records")

            insights = {
                "total_posts_analysed": len(df),
                "avg_reach": int(df["reach"].mean()),
                "avg_engagement_rate": round(df["engagement_rate"].mean(), 4),
                "avg_likes": int(df["like_count"].mean()),
                "best_media_type": df.groupby("media_type")["engagement_rate"].mean().idxmax()
                    if "media_type" in df.columns else "unknown",
                "top_posts": top_posts,
                "underperforming_posts": bottom_posts,
                "dna_recommendation": self._build_dna_recommendation(df),
                "virality_analysis": await self._analyze_virality(top_posts)
            }

        return {"ok": True, "influencer_id": influencer_id, "insights": insights}

    async def _analyze_virality(self, top_posts: list[dict]) -> str:
        """Use local Ollama to explain WHY these posts went viral."""
        if not top_posts:
            return "No posts to analyze."

        context = "Top performing Instagram posts:\n"
        for p in top_posts:
            caption = (p.get("caption") or "")[:200]
            context += (
                f"- Type: {p.get('media_type')} | "
                f"Engagement: {p.get('engagement_rate')} | "
                f"Reach: {p.get('reach')}\n"
                f"  Caption: {caption}\n"
            )

        system = (
            "You are an expert Instagram algorithm analyst. "
            "Be concise and practical. Focus on psychology, format, and hook structure."
        )
        prompt = (
            f"{context}\n\n"
            "Why did these posts go viral? Give a 2-3 sentence sharp analysis. "
            "Mention psychology (curiosity, FOMO, identity), format (Reels vs Image), and hook structure."
        )

        try:
            return await _ollama_chat(prompt, system=system, timeout=60)
        except Exception as e:
            # Try Gemini fallback
            try:
                gemini_key = os.getenv("GEMINI_API_KEY", "")
                if gemini_key:
                    from google.generativeai import configure, GenerativeModel
                    configure(api_key=gemini_key)
                    model = GenerativeModel("gemini-2.0-flash")
                    response = await asyncio.to_thread(model.generate_content, f"{system}\n\n{prompt}")
                    return response.text
            except Exception:
                pass
            return f"Analysis unavailable (Ollama offline): {str(e)}"

    def _build_dna_recommendation(self, df: pd.DataFrame) -> dict:
        """Generate DNA tweak recommendations from analytics data."""
        avg_er = df["engagement_rate"].mean()
        recommendations = []

        if avg_er < 0.02:
            recommendations.append("Increase shock/controversy level in hooks — engagement is low.")
        elif avg_er > 0.08:
            recommendations.append("Current strategy working well. Maintain hook archetype.")
        else:
            recommendations.append("Moderate engagement. Test more provocative hooks in next burst.")

        if "media_type" in df.columns and len(df["media_type"].unique()) > 1:
            best = df.groupby("media_type")["engagement_rate"].mean().idxmax()
            if best == "VIDEO":
                recommendations.append("Prioritise Reels over static images — video outperforms.")
            elif best == "IMAGE":
                recommendations.append("High-quality static images outperform Reels for this account.")

        if "timestamp" in df.columns:
            try:
                df["hour"] = pd.to_datetime(df["timestamp"]).dt.hour
                best_hour = df.groupby("hour")["engagement_rate"].mean().idxmax()
                recommendations.append(f"Best posting hour: {best_hour}:00 UTC based on engagement data.")
            except Exception:
                pass

        return {
            "recommendations": recommendations,
            "suggested_pacing_bpm": 135 if avg_er < 0.03 else 115,
        }

    async def evolve_dna(self, influencer_id: str, model_id: Optional[str] = None) -> dict:
        """Fetch analytics, assess performance, and rewrite influencer DNA using local Ollama."""
        await self._notify("IDLE", f"Starting DNA evolution cycle for {influencer_id}", influencer_id)

        analysis = await self.analyse(influencer_id)
        if analysis.get("error"):
            return {"error": analysis["error"]}

        insights = analysis.get("insights", {})
        if insights.get("total_posts_analysed", 0) < 3:
            return {"error": "Need at least 3 posts to justify DNA evolution."}

        # Fetch current DNA
        try:
            conn = sqlite3.connect(str(DB_PATH))
            conn.row_factory = sqlite3.Row
            row = conn.execute(
                "SELECT name, dna_json FROM influencers WHERE id = ?", (influencer_id,)
            ).fetchone()
            if not row:
                conn.close()
                return {"error": "Influencer not found."}
            name = row["name"]
            current_dna = row["dna_json"]
        except Exception as e:
            return {"error": f"DB access failed: {e}"}

        # LLM DNA mutation via Ollama
        system = (
            "You are an AI influencer DNA mutation engine. "
            "You ONLY output valid JSON. No markdown, no explanation."
        )
        prompt = (
            f"Influencer: {name}\n"
            f"Performance insights:\n{json.dumps(insights, indent=2)}\n\n"
            f"Current DNA:\n{current_dna}\n\n"
            "Based on the data (low engagement → more controversy, high video → prefer video format, etc.), "
            "output an updated, improved version of this DNA JSON. "
            "Keep the same root keys. Evolve only the values. Output ONLY raw JSON."
        )

        try:
            raw = await _ollama_chat(prompt, system=system, timeout=120)
            # Strip markdown fences
            raw = raw.replace("```json", "").replace("```", "").strip()
            new_dna_dict = json.loads(raw)
            new_dna_str = json.dumps(new_dna_dict, indent=2)

            conn.execute(
                "UPDATE influencers SET dna_json = ? WHERE id = ?",
                (new_dna_str, influencer_id)
            )
            conn.commit()
            conn.close()

            await self._notify("IDLE", f"✓ DNA mutation successful for {name}", influencer_id)

            return {
                "ok": True,
                "message": f"DNA memory evolved for {name} via local Ollama",
                "old_dna": current_dna,
                "new_dna": new_dna_str,
                "insights_used": insights
            }
        except json.JSONDecodeError:
            # Gemini fallback for DNA mutation
            try:
                gemini_key = os.getenv("GEMINI_API_KEY", "")
                if gemini_key:
                    from google.generativeai import configure, GenerativeModel
                    configure(api_key=gemini_key)
                    model_obj = GenerativeModel("gemini-2.0-flash")
                    resp = await asyncio.to_thread(model_obj.generate_content, f"{system}\n\n{prompt}")
                    raw2 = resp.text.replace("```json", "").replace("```", "").strip()
                    new_dna_dict = json.loads(raw2)
                    new_dna_str = json.dumps(new_dna_dict, indent=2)
                    conn.execute("UPDATE influencers SET dna_json = ? WHERE id = ?", (new_dna_str, influencer_id))
                    conn.commit()
                    conn.close()
                    return {"ok": True, "message": f"DNA evolved for {name} via Gemini fallback", "new_dna": new_dna_str}
            except Exception as fe:
                return {"error": f"Both Ollama and Gemini failed: {fe}"}

            if 'conn' in locals():
                conn.close()
            return {"error": "Ollama returned invalid JSON for DNA mutation. Try again."}
        except Exception as e:
            if 'conn' in locals():
                conn.close()
            return {"error": f"Evolution failed: {e}"}
    async def analyze_sentiment(self, text: str) -> dict:
        """
        MARKET BRAIN: Analyzes raw trend text to produce a 'Vibe Score' (0-1).
        Used by the Scheduler to scale 'Demand & Supply'.
        """
        system = "You are a Quant Trend Analyst. You output ONLY valid JSON."
        prompt = (
            f"Context: {text}\n\n"
            "Analyze the market demand for this content. Output a JSON object:\n"
            "{\n"
            "  'industry_vibe_score': 0.85, \n"
            "  'trending_keywords': ['tech', 'viral', 'ai'],\n"
            "  'market_hunger': 'exponential'\n"
            "}\n"
            "A high score means people are hungry for this content. Output ONLY JSON."
        )
        try:
            raw = await _ollama_chat(prompt, system=system, timeout=60)
            # Basic cleanup if Ollama adds banter
            import re
            match = re.search(r"\{.*\}", raw, re.DOTALL)
            if match:
                return json.loads(match.group())
            return json.loads(raw)
        except Exception as e:
            print(f"[Analyst] Sentiment analysis failed: {e}. Using neutral.")
            return {"industry_vibe_score": 0.5, "trending_keywords": [], "market_hunger": "steady"}
