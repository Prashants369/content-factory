"""
Posting Agent — smart caption refinement + scheduling + IG posting + n8n trigger.
Uses local Ollama for caption polish. Pure local, no paid APIs.
"""
import os
import json
import asyncio
import httpx
import sqlite3
from pathlib import Path
from typing import Optional, Dict, Any
from datetime import datetime, timezone

DB_PATH = Path(__file__).parent.parent.parent / "data" / "factory.db"
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:7b")


# ── Optimal posting times by niche (UTC hours) ─────────────────────────────
OPTIMAL_HOURS = {
    "fashion": [9, 12, 18],
    "fitness": [6, 12, 17],
    "luxury": [10, 14, 20],
    "tech": [8, 12, 19],
    "lifestyle": [8, 12, 17, 20],
    "food": [11, 17, 19],
    "travel": [9, 14, 20],
    "beauty": [9, 13, 19],
    "default": [9, 12, 18],
}


class PostingAgent:
    def __init__(self):
        self.meta_token = os.getenv("META_USER_ACCESS_TOKEN", "")
        self.ig_account = os.getenv("IG_BUSINESS_ACCOUNT_ID", "")
        self.n8n_webhook = os.getenv("N8N_WEBHOOK_URL", "")
        self.graph_url = "https://graph.facebook.com/v21.0"

    # ── Caption Refinement (Ollama) ─────────────────────────────────────────
    async def refine_caption(self, post: dict, platform: str = "instagram", dna: Optional[dict] = None) -> str:
        """Use local Ollama to refine the caption in the influencer's authentic voice."""
        original = post.get("caption", "")
        hook = post.get("viral_hook", "")
        tags = " ".join(f"#{t}" for t in post.get("hashtags", []))

        # Extract DNA voice profile if provided
        influencer_name = ""
        voice_context = ""
        if dna:
            comm = dna.get("personality", {}).get("communication", {})
            social = dna.get("personality", {}).get("social_algorithm", {})
            id_data = dna.get("identity", {})
            influencer_name = id_data.get("name", "")
            vocab_level = comm.get("vocabulary_level", "conversational")
            humor_type = comm.get("humor_type", "none")
            emotional_expr = comm.get("emotional_expression", "moderate")
            caption_style = social.get("caption_style", "one_liner")
            recurring_phrases = comm.get("recurring_phrases", [])
            voice_context = (
                f"\nINFLUENCER VOICE PROFILE (preserve this voice exactly):\n"
                f"- Name: {influencer_name}\n"
                f"- Vocabulary: {vocab_level}\n"
                f"- Humor: {humor_type}\n"
                f"- Emotional expression: {emotional_expr}\n"
                f"- Caption style: {caption_style}\n"
                + (f"- Signature phrases to include naturally: {', '.join(recurring_phrases[:3])}\n" if recurring_phrases else "")
            )

        name_ref = f" for {influencer_name}" if influencer_name else ""
        system = (
            f"You are a viral social media copywriter{name_ref}. "
            "Preserve the influencer's authentic voice — never flatten it into generic copy. "
            "Output ONLY the final refined caption as plain text, no quotes."
        )
        prompt = (
            f"Platform: {platform.upper()}\n"
            f"Hook: {hook}\n"
            f"Original caption: {original}\n"
            f"Hashtags: {tags}\n"
            f"{voice_context}\n"
            "Refine this caption for maximum engagement. Keep it under 280 words. "
            "Include the hook naturally, maintain the voice profile above, end with a question or CTA. "
            "Output ONLY the final caption text."
        )

        try:
            payload = {
                "model": OLLAMA_MODEL,
                "prompt": prompt,
                "system": system,
                "stream": False,
                "options": {"temperature": 0.65, "num_predict": 512},
            }
            async with httpx.AsyncClient(timeout=60) as client:
                r = await client.post(f"{OLLAMA_URL}/api/generate", json=payload)
                r.raise_for_status()
                refined = r.json().get("response", "").strip()
                return refined if refined else original
        except Exception as e:
            print(f"[Posting] Caption refinement failed: {e}. Using original.")
            return original

    # ── Optimal Schedule ────────────────────────────────────────────────────
    def get_optimal_hour(self, niche: str) -> int:
        """Return the next best UTC posting hour for this niche."""
        niche_key = niche.lower().split()[0]
        hours = OPTIMAL_HOURS.get(niche_key, OPTIMAL_HOURS["default"])
        current_hour = datetime.now(timezone.utc).hour
        # Find next upcoming window
        upcoming = [h for h in hours if h > current_hour]
        return upcoming[0] if upcoming else hours[0]  # wrap around if past all windows

    # ── Instagram Posting ────────────────────────────────────────────────────
    async def post_to_instagram(self, post: dict, meta_token: Optional[str] = None, ig_account: Optional[str] = None) -> dict:
        """
        Publish an image post to Instagram via Meta Graph API.
        Returns { ok, ig_post_id } or { error }.
        """
        token = meta_token or self.meta_token
        account = ig_account or self.ig_account

        if not token or not account:
            return {"error": "Instagram credentials (token/account) not configured."}

        image_url = post.get("media_url") or post.get("media_path", "")
        caption = post.get("caption", "")
        hashtags = " ".join(f"#{t}" for t in post.get("hashtags", []))
        full_caption = f"{caption}\n\n{hashtags}".strip()

        if not image_url:
            return {"error": "No image URL for this post."}

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                # Step 1: Create media container
                container_res = await client.post(
                    f"{self.graph_url}/{account}/media",
                    params={
                        "image_url": image_url,
                        "caption": full_caption,
                        "access_token": token,
                    }
                )
                if not container_res.is_success:
                    return {"error": f"IG container error: {container_res.text}"}

                container_id = container_res.json().get("id")
                if not container_id:
                    return {"error": "No container ID returned from IG."}

                # Step 2: Publish container
                publish_res = await client.post(
                    f"{self.graph_url}/{account}/media_publish",
                    params={
                        "creation_id": container_id,
                        "access_token": token,
                    }
                )
                if not publish_res.is_success:
                    return {"error": f"IG publish error: {publish_res.text}"}

                ig_post_id = publish_res.json().get("id")
                return {"ok": True, "ig_post_id": ig_post_id, "caption_length": len(full_caption)}

        except Exception as e:
            return {"error": f"IG posting failed: {e}"}

    # ── n8n Webhook Trigger ──────────────────────────────────────────────────
    async def trigger_n8n(self, event: str, data: dict) -> bool:
        """Fire n8n webhook with an event payload for cross-platform automation."""
        if not self.n8n_webhook:
            print("[Posting] N8N_WEBHOOK_URL not set. Skipping n8n trigger.")
            return False
        payload = {
            "event": event,
            "timestamp": datetime.utcnow().isoformat(),
            "data": data,
        }
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.post(self.n8n_webhook, json=payload)
                if r.is_success:
                    print(f"[Posting] n8n triggered: {event}")
                    return True
                else:
                    print(f"[Posting] n8n returned {r.status_code}: {r.text[:200]}")
                    return False
        except Exception as e:
            print(f"[Posting] n8n trigger failed: {e}")
            return False
        return False

    # ── Full Post Trigger Pipeline ───────────────────────────────────────────
    async def trigger_post(self, post_id: str) -> dict:
        """
        Full pipeline: fetch post → refine caption → post to IG → trigger n8n → mark posted.
        """
        # Fetch post from DB
        try:
            conn = sqlite3.connect(str(DB_PATH))
            conn.row_factory = sqlite3.Row
            row = conn.execute("SELECT * FROM posts WHERE id = ?", (post_id,)).fetchone()
            conn.close()
            if not row:
                return {"error": f"Post {post_id} not found in DB."}
            post = dict(row)
        except Exception as e:
            return {"error": f"DB read failed: {e}"}

        # Get influencer niche for scheduling
        niche = "lifestyle"
        try:
            conn = sqlite3.connect(str(DB_PATH))
            inf_row = conn.execute(
                "SELECT niche FROM influencers WHERE id = ?", (post.get("influencer_id", ""),)
            ).fetchone()
            conn.close()
            if inf_row:
                niche = inf_row[0]
        except Exception:
            pass

        # Refine caption via Ollama
        refined_caption = await self.refine_caption(post)
        post["caption"] = refined_caption

        # Build public URL for image (requires the factory server to serve static files)
        media_path = post.get("media_path", "")
        if media_path.startswith("/outputs/"):
            # Assumes Next.js serves /public at http://localhost:3000
            post["media_url"] = f"http://localhost:3000{media_path}"
        else:
            post["media_url"] = media_path

        # Fetch per-influencer social credentials
        inf_token = None
        inf_account = None
        try:
            conn = sqlite3.connect(str(DB_PATH))
            conn.row_factory = sqlite3.Row
            acc_row = conn.execute(
                "SELECT access_token, ig_business_account_id FROM platform_accounts WHERE influencer_id = ? AND platform = 'instagram'",
                (post.get("influencer_id"),)
            ).fetchone()
            conn.close()
            if acc_row:
                inf_token = acc_row["access_token"]
                inf_account = acc_row["ig_business_account_id"]
                print(f"[Posting] Using linked Instagram account for influencer {post.get('influencer_id')}")
        except Exception as e:
            print(f"[Posting] Credential fetch failed: {e}")

        # Post to Instagram
        ig_result = await self.post_to_instagram(post, meta_token=inf_token, ig_account=inf_account)

        # Trigger n8n for cross-platform
        await self.trigger_n8n("post_published", {
            "post_id": post_id,
            "influencer_id": post.get("influencer_id"),
            "caption": refined_caption,
            "ig_result": ig_result,
            "niche": niche,
        })

        # Mark as posted in DB
        if ig_result.get("ok"):
            try:
                conn = sqlite3.connect(str(DB_PATH))
                conn.execute(
                    "UPDATE posts SET status = 'Posted' WHERE id = ?", (post_id,)
                )
                conn.commit()
                conn.close()
            except Exception as e:
                print(f"[Posting] DB update failed: {e}")

        return {
            "ok": ig_result.get("ok", False),
            "post_id": post_id,
            "refined_caption": refined_caption,
            "ig_result": ig_result,
            "next_optimal_hour_utc": self.get_optimal_hour(niche),
        }
