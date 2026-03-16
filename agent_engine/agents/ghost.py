import httpx
import json
import logging
import sqlite3
from pathlib import Path
from typing import Optional, List, Dict, Any
from ..registry import registry

logger = logging.getLogger(__name__)

DB_PATH = Path(__file__).parent.parent.parent / "data" / "factory.db"

class GhostAgent:
    """
    Ghost Publisher Agent: Manages 24/7 cloud distribution via Cloudflare Workers.
    Pushes scheduled posts to the Cloudflare KV queue.
    """
    def __init__(self):
        conf = registry.get("autonomous", {}).get("ghost_publisher", {})
        self.enabled = conf.get("enabled", False)
        self.worker_url = conf.get("worker_url", "")
        self.secret = conf.get("secret", "")
        self.public_base_url = conf.get("public_base_url", "")

    async def push_post(self, post_id: str) -> bool:
        """
        Prepares and pushes a post to the Cloudflare Ghost queue.
        """
        if not self.enabled or not self.worker_url:
            logger.warning("Ghost Publisher is disabled or missing URL.")
            return False

        post = self._get_post_details(post_id)
        if not post:
            return False

        # Get influencer credentials
        creds = self._get_instagram_creds(post["influencer_id"])
        if not creds:
            logger.error(f"No Instagram credentials found for influencer {post['influencer_id']}")
            return False

        # Construct public media URL
        # Assumes /outputs/image.png -> http://public.com/outputs/image.png
        media_path = post["media_path"]
        if media_path.startswith("/"):
            public_media_url = f"{self.public_base_url}{media_path}"
        else:
            public_media_url = media_path

        payload = [{
            "id": str(post["id"]),
            "influencerId": post["influencer_id"],
            "platform": "instagram",
            "accountId": creds["ig_business_account_id"],
            "accessToken": creds["access_token"],
            "imageUrl": public_media_url,
            "caption": f"{post['caption']}\n\n{post['hashtags']}",
            "scheduledTimeMs": int(post.get("scheduled_at_ms") or 0), # Placeholder for future timing
            "status": "pending"
        }]

        try:
            headers = {"Authorization": f"Bearer {self.secret}"}
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.worker_url, json=payload, headers=headers)
                resp.raise_for_status()
                data = resp.json()
                if data.get("ok"):
                    logger.info(f"✓ Post {post_id} pushed to Ghost Publisher.")
                    return True
                return False
        except Exception as e:
            logger.error(f"Failed to push post to Ghost: {e}")
            return False

    async def sync_statuses(self):
        """
        Polls Cloudflare for processed posts and updates local DB.
        """
        if not self.enabled or not self.worker_url:
            return

        try:
            headers = {"Authorization": f"Bearer {self.secret}"}
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.get(self.worker_url, headers=headers)
                resp.raise_for_status()
                data = resp.json()
                results = data.get("results", [])
                
                for res in results:
                    if res.get("status") == "published":
                        self._mark_as_posted(res["id"])
                        logger.info(f"Ghost Sync: Post {res['id']} confirmed as Published.")
                    elif res.get("status") == "failed":
                        logger.warning(f"Ghost Sync: Post {res['id']} FAILED in cloud: {res.get('errorMsg')}")
        except Exception as e:
            logger.error(f"Ghost Status Sync failed: {e}")

    def _get_post_details(self, post_id: str) -> Optional[Dict]:
        conn = sqlite3.connect(str(DB_PATH))
        conn.row_factory = sqlite3.Row
        row = conn.execute("SELECT * FROM posts WHERE id = ?", (post_id,)).fetchone()
        conn.close()
        return dict(row) if row else None

    def _get_instagram_creds(self, influencer_id: str) -> Optional[Dict]:
        conn = sqlite3.connect(str(DB_PATH))
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            "SELECT access_token, ig_business_account_id FROM platform_accounts WHERE influencer_id = ? AND platform = 'instagram'",
            (influencer_id,)
        ).fetchone()
        conn.close()
        return dict(row) if row else None

    def _mark_as_posted(self, post_id: str):
        conn = sqlite3.connect(str(DB_PATH))
        conn.execute("UPDATE posts SET status = 'Posted', posted_at = CURRENT_TIMESTAMP WHERE id = ?", (post_id,))
        conn.commit()
        conn.close()
