import asyncio
import sqlite3
import json
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import List

from .registry import registry
from .agents.orchestrator import OrchestratorAgent
from .agents.creator import CreatorAgent
from .agents.scout import ScoutAgent
from .agents.analyst import AnalystAgent
from .agents.visual import VisualAgent
from .agents.memory import MemoryAgent
from .agents.persona import PersonaAgent
from .agents.openclaw import OpenClawAgent
from .agents.ghost import GhostAgent

# DB Path relative to agent_engine
DB_PATH = Path(__file__).parent.parent / "data" / "factory.db"

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("factory-scheduler")

class FactoryScheduler:
    def __init__(self, orchestrator: OrchestratorAgent):
        self.orchestrator = orchestrator
        self.running = False

    async def start(self):
        self.running = True
        logger.info("Factory Scheduler started.")
        while self.running:
            try:
                await self.run_maintenance_cycle()
            except Exception as e:
                logger.error(f"Error in maintenance cycle: {e}")
            
            interval = registry.get("autonomous", {}).get("check_interval_seconds", 3600)
            await asyncio.sleep(interval)

    async def run_maintenance_cycle(self):
        logger.info("--- Starting Factory Maintenance Cycle ---")
        
        # 1. Fill Content Gaps
        await self.check_and_fill_content_gaps()
        
        # 2. Process Unrendered Ideas
        if registry.get("autonomous", {}).get("auto_render_ideas", True):
            await self.process_unrendered_ideas()
            
        # 3. Handle Auto-Posting (if enabled)
        if registry.get("autonomous", {}).get("auto_post_ready", False):
            await self.post_ready_content()

        logger.info("--- Maintenance Cycle Complete ---")

    async def check_and_fill_content_gaps(self):
        """
        MASTER ALGORITHM: Demand & Supply Scaling.
        Decides production volume based on 'Market Temperature' (trend analysis).
        """
        logger.info("Master Algorithm: Analyzing Market Temperature...")
        
        temperature = 0.5  # Default neutral temperature
        try:
            # 1. ANALYZE DEMAND (via Scout + Analyst)
            trends = await self.orchestrator.scout.find_trends("viral topics", ["instagram", "tiktok"], limit=5)
            market_analysis = await self.orchestrator.analyst.analyze_sentiment(
                f"Current Trends: {json.dumps(trends)}"
            )
            temperature = market_analysis.get("industry_vibe_score", 0.5) # 0.0 to 1.0
        except Exception as e:
            logger.warning(f"Market analysis failed, using default temperature: {e}")
        
        logger.info(f"Market Temperature: {temperature:.2f}")

        influencers = self._get_active_influencers()
        
        # 2. SCALE PRODUCTION (Supply)
        # Higher temperature = more content needed to 'surf the wave'
        min_days_base = registry.get("autonomous", {}).get("min_post_buffer_days", 3)
        dynamic_buffer = int(min_days_base * (1 + temperature)) # scales buffer up to 2x
        
        for inf in influencers:
            content_count = self._get_future_content_count(inf["id"])
            if content_count < dynamic_buffer:
                gap = dynamic_buffer - content_count
                intensity = "high" if temperature > 0.8 else "normal"
                
                logger.info(f"Influencer {inf['name']} (Demand: {intensity.upper()}): gap of {gap}. Triggering production...")
                
                task_id = f"auto_{inf['id']}_{datetime.now().strftime('%Y%m%d%H%M')}"
                tasks_store = {task_id: {"log": [], "progress": 0}}
                
                # Trigger a MORE AGGRESSIVE burst if intensity is high
                try:
                    await self.orchestrator.run_burst(
                        influencer_ids=[inf["id"]],
                        days_ahead=gap,
                        mode="full",
                        task_id=task_id,
                        tasks_store=tasks_store
                    )
                except Exception as e:
                    logger.error(f"Auto burst failed for {inf['name']}: {e}")

    async def process_unrendered_ideas(self):
        """Look for posts with status 'Idea' and trigger rendering."""
        try:
            conn = sqlite3.connect(str(DB_PATH))
            conn.row_factory = sqlite3.Row
            ideas = conn.execute("SELECT * FROM posts WHERE status = 'Idea' LIMIT 5").fetchall()
            conn.close()
        except Exception as e:
            logger.error(f"Failed to query unrendered ideas: {e}")
            return
        
        if not ideas:
            return

        logger.info(f"Found {len(ideas)} unrendered ideas. Processing...")
        for idea in ideas:
            try:
                logger.info(f"Rendering post {idea['id']} for influencer {idea['influencer_id']}")
                image_paths = await self.orchestrator.visual.generate(
                    influencer_id=idea["influencer_id"],
                    prompt=idea["image_prompt"],
                    workflow="image_base",
                    num_images=1
                )
                if image_paths:
                    self._update_post_status(idea["id"], "Ready", image_paths[0])
            except Exception as e:
                logger.error(f"Failed to render idea {idea['id']}: {e}")

    async def post_ready_content(self):
        """
        DISTRIBUTION MACHINE: Auto-posts content that is 'Ready'.
        Checks for 'Peak Hours' (simulated) to maximize virality.
        """
        now = datetime.now()
        # Peak Hours: 12 PM - 2 PM or 6 PM - 9 PM
        is_peak = (12 <= now.hour <= 14) or (18 <= now.hour <= 21)
        
        if not is_peak:
            # logger.info(f"Currently outside peak hours ({now.hour}:00). Skipping auto-post.")
            return

        logger.info("Auto-posting is enabled and it's peak hours. Checking for ready content...")

        # NEW: Sync ghost statuses before starting 
        ghost = GhostAgent()
        if ghost.enabled:
            await ghost.sync_statuses()

        conn = sqlite3.connect(str(DB_PATH))
        conn.row_factory = sqlite3.Row
        # Get one post that is ready and not yet posted
        post = conn.execute("SELECT * FROM posts WHERE status = 'Ready' LIMIT 1").fetchone()
        conn.close()

        if not post:
            return

        logger.info(f"Peak hour detected! Preparing post {post['id']}...")
        
        # HYBRID DISTRIBUTION: Ghost (Cloud) vs OpenClaw (Local)
        if ghost.enabled:
            logger.info(f"Attempting to push post {post['id']} to Cloudflare Ghost Publisher...")
            success = await ghost.push_post(post["id"])
            if success:
                logger.info(f"✓ Successfully pushed post {post['id']} to Ghost Publisher. Awaiting Cloudflare sync.")
                # We don't mark as 'Posted' yet, wait for sync_statuses to confirm
                return
            else:
                logger.warning("Ghost push failed or returned False. Falling back to Local OpenClaw.")

        # Local OpenClaw Fallback/Default
        oc = OpenClawAgent()
        success = await oc.post_to_instagram(
            media_path=post["media_path"],
            caption=f"{post['caption']}\n\n{post['hashtags']}"
        )
        
        if success:
            # We keep the media_path same, just update status
            self._update_post_status(post["id"], "Posted", post["media_path"])
            logger.info(f"✓ Successfully distributed post {post['id']} via OpenClaw.")
        else:
            logger.error(f"✗ Failed to distribute post {post['id']}. Retrying next cycle.")

    def _get_active_influencers(self) -> List[dict]:
        conn = sqlite3.connect(str(DB_PATH))
        conn.row_factory = sqlite3.Row
        rows = conn.execute("SELECT id, name FROM influencers").fetchall()
        conn.close()
        return [dict(r) for r in rows]

    def _get_future_content_count(self, influencer_id: str) -> int:
        conn = sqlite3.connect(str(DB_PATH))
        # Simple count of Ready or Idea posts that haven't been 'Posted'
        count = conn.execute(
            "SELECT COUNT(*) FROM posts WHERE influencer_id = ? AND status IN ('Ready', 'Idea')",
            (influencer_id,)
        ).fetchone()[0]
        conn.close()
        return count

    def _update_post_status(self, post_id: str, status: str, media_path: str):
        conn = sqlite3.connect(str(DB_PATH))
        conn.execute(
            "UPDATE posts SET status = ?, media_path = ? WHERE id = ?",
            (status, media_path, post_id)
        )
        conn.commit()
        conn.close()

async def run_scheduler():
    from .agents.creator import CreatorAgent
    from .agents.scout import ScoutAgent
    from .agents.analyst import AnalystAgent
    from .agents.visual import VisualAgent
    from .agents.memory import MemoryAgent
    from .agents.persona import PersonaAgent
    
    # Initialize agents (replicating main.py logic)
    creator = CreatorAgent()
    scout = ScoutAgent()
    analyst = AnalystAgent()
    visual = VisualAgent()
    memory = MemoryAgent()
    persona = PersonaAgent()
    
    orchestrator = OrchestratorAgent(creator, scout, analyst, visual, memory, persona)
    scheduler = FactoryScheduler(orchestrator)
    await scheduler.start()

if __name__ == "__main__":
    asyncio.run(run_scheduler())
