"""
Orchestrator Agent — coordinates burst sessions.
Runs Scout → Creator → Visual → memory update in sequence.
"""
import asyncio
import json
import sqlite3
from pathlib import Path
from typing import Optional, List, Dict, TYPE_CHECKING

if TYPE_CHECKING:
    from .creator import CreatorAgent
    from .scout import ScoutAgent
    from .analyst import AnalystAgent
    from .visual import VisualAgent
    from .memory import MemoryAgent
    from .persona import PersonaAgent
    from .auditor import AuditorAgent
    from .prompt_engineer import PromptEngineerAgent

from .auditor import AuditorAgent
from .prompt_engineer import PromptEngineerAgent
from .video_editor import VideoEditorAgent
from ..registry import registry

DB_PATH = Path(__file__).parent.parent.parent / "data" / "factory.db"


def _get_influencers(influencer_ids: list[str]) -> list[dict]:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    placeholders = ",".join("?" * len(influencer_ids))
    rows = conn.execute(
        f"SELECT id, name, niche, dna_json, current_mood FROM influencers WHERE id IN ({placeholders})",
        influencer_ids
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def _save_posts(posts: list[dict]):
    import uuid
    conn = sqlite3.connect(str(DB_PATH))
    for post in posts:
        try:
            conn.execute(
                """INSERT OR IGNORE INTO posts
                   (id, influencer_id, viral_hook, caption, hashtags, image_prompt, shadow_virality_score, persona_feedback, media_path, status, monetization_angle)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    str(uuid.uuid4()),
                    post.get("influencer_id", ""),
                    post.get("viral_hook", ""),
                    post.get("caption", ""),
                    json.dumps(post.get("hashtags", [])),
                    post.get("image_prompt", ""),
                    post.get("shadow_virality_score", 0.0),
                    json.dumps(post.get("persona_feedback", {})),
                    post.get("media_path", ""),
                    post.get("status", "Idea"),
                    post.get("monetization_angle", ""),
                )
            )
        except Exception as e:
            print(f"[Orchestrator] Failed to save post: {e}")
    conn.commit()
    conn.close()


class OrchestratorAgent:
    def __init__(self, creator, scout, analyst, visual, memory, persona, video_editor=None, caption_agent=None, telemetry_callback=None):
        self.creator = creator
        self.scout = scout
        self.analyst = analyst
        self.visual = visual
        self.memory = memory
        self.persona = persona
        self.auditor = AuditorAgent() # new AQC agent
        self.prompt_engineer = PromptEngineerAgent(memory=self.memory)
        self.video_editor = video_editor
        self.caption_agent = caption_agent
        self.telemetry_callback = telemetry_callback

    async def _notify(self, agent: str, status: str, message: str, task_id: str = None):
        if self.telemetry_callback:
            data = {
                "agent": agent,
                "status": status,
                "message": message,
                "task_id": task_id,
                "timestamp": asyncio.get_event_loop().time()
            }
            try:
                if asyncio.iscoroutinefunction(self.telemetry_callback):
                    await self.telemetry_callback(data)
                else:
                    self.telemetry_callback(data)
            except Exception as e:
                print(f"[Orchestrator] Telemetry failed: {e}")

    def _log(self, task_id: str, tasks: dict, message: str, progress: int):
        if task_id in tasks:
            tasks[task_id]["log"].append(message)
            tasks[task_id]["progress"] = progress
        tid = str(task_id)[:8] if task_id else "NoTask"
        # Safe print for Windows console (handles Unicode)
        try:
            print(f"[Orchestrator:{tid}] {message}")
        except UnicodeEncodeError:
            safe_msg = message.encode('ascii', 'replace').decode('ascii')
            print(f"[Orchestrator:{tid}] {safe_msg}")

    async def run_burst(
        self,
        influencer_ids: list[str],
        days_ahead: int,
        mode: str,
        task_id: str,
        tasks_store: dict,
    ):
        await self._notify("Orchestrator", "IDLE", f"Starting burst for {len(influencer_ids)} influencers", task_id)
        influencers = _get_influencers(influencer_ids)
        total = len(influencers)
        if total == 0:
            self._log(task_id, tasks_store, "No influencers found with given IDs.", 100)
            return

        self._log(task_id, tasks_store, f"Starting burst for {total} influencer(s)", 0)

        # Step 1: Scout trends (once for all)
        trends: list[dict] = []
        if mode in ("full",):
            try:
                self._log(task_id, tasks_store, "Scout Agent: scouting trends...", 5)
                all_niches = " + ".join({i["niche"] for i in influencers})
                trends = await self.scout.find_trends(all_niches, ["instagram", "tiktok"], limit=8)
                self._log(task_id, tasks_store, f"Scout found {len(trends)} trending topics", 15)
            except Exception as e:
                self._log(task_id, tasks_store, f"Scout warning: {e}", 15)

        trend_context = "\n".join(f"- {t['topic']}" for t in trends[:5])

        # Step 2: Create content for each influencer (PARALLEL)
        all_posts: list[dict] = []
        self._log(task_id, tasks_store, f"Creator Agent: Generating content for {total} influencers...", 20)
        
        async def create_for_inf(inf):
            await self._notify("Creator", "IDLE", f"Evolving mood for {inf['name']}...", task_id)
            try:
                dna = json.loads(inf.get("dna_json") or "{}")
                # 1. Determine & Update Mood
                new_mood = await self.creator.determine_mood(inf["name"], inf["niche"], dna, inf.get("current_mood", "creative"))
                with sqlite3.connect(str(DB_PATH)) as conn:
                    conn.execute("UPDATE influencers SET current_mood = ? WHERE id = ?", (new_mood, inf["id"]))
                
                await self._notify("Creator", "IDLE", f"Generating {days_ahead} posts for {inf['name']} (Mood: {new_mood})...", task_id)
                
                # 2. Generate Posts
                posts = await self.creator.generate_posts(
                    influencer_id=inf["id"],
                    influencer_name=inf["name"],
                    niche=inf["niche"],
                    dna=dna,
                    num_posts=days_ahead,
                    trend_context=trend_context,
                    current_mood=new_mood
                )

                # 3. Shadow Audience Simulation (Parallel per post)
                async def simulate_and_score(post):
                    await self._notify("Persona", "IDLE", f"Simulating audience for {inf['name']}...", task_id)
                    sim = await self.persona.simulate_audience(post, dna)
                    post["shadow_virality_score"] = sim.get("overall_virality_score", 0.5)
                    post["persona_feedback"] = sim
                    post["dna"] = dna # Pass DNA for the visual loop
                    return post

                simulated_posts = await asyncio.gather(*(simulate_and_score(p) for p in posts))
                await self._notify("Creator", "IDLE", f"✓ Done with {inf['name']}", task_id)
                return simulated_posts
            except Exception as e:
                self._log(task_id, tasks_store, f"  ✗ Creator/Persona failed for {inf['name']}: {e}", 20)
                return []

        results = await asyncio.gather(*(create_for_inf(inf) for inf in influencers))
        for posts in results:
            all_posts.extend(posts)
        
        self._log(task_id, tasks_store, f"✓ Generated {len(all_posts)} post ideas across all models", 65)

        # Step 3: Send to Visual Agent (Queue Image Generation - PARALLEL)
        total_posts = len(all_posts)
        if mode in ("full", "images_only") and total_posts > 0:
            self._log(task_id, tasks_store, f"Visual Factory: processing {total_posts} renders in parallel...", 70)
            
            async def generate_image(post, idx):
                await self._notify("Visual", "IDLE", f"Rendering post {idx+1}/{total_posts}...", task_id)
                retries = 3
                for attempt in range(retries):
                    try:
                        raw_prompt = post.get("image_prompt", "")
                        neg_prompt = await self.prompt_engineer.get_negative_prompt()
                        
                        if raw_prompt:
                            # --- Prompt Engineering with RAG ---
                            post_dna = post.get("dna", {})
                            prompt = await self.prompt_engineer.engineer_prompt(raw_prompt, post_dna)
                            
                            image_paths = await self.visual.generate(
                                influencer_id=post["influencer_id"],
                                prompt=prompt,
                                negative_prompt=neg_prompt,
                                workflow="image_base",
                                num_images=1
                            )
                            if image_paths:
                                # --- AQC: Autonomous Quality Control ---
                                audit = await self.auditor.audit_image(image_paths[0], post_dna, prompt)
                                if not audit.get("pass", True):
                                    await self._notify("Orchestrator", "IDLE", f"⚠️ AQC rejected image for {post['id']}. Retrying...")
                                    # Retry once
                                    image_paths = await self.visual.generate(
                                        influencer_id=post["influencer_id"],
                                        prompt=prompt,
                                        workflow="image_base",
                                        num_images=1
                                    )
                                else:
                                    # Success! Record the pattern for RAG
                                    self.memory.record_success(post["influencer_id"], prompt, audit.get("feedback", "Excellent quality"))
                                
                                post["media_path"] = image_paths[0] if image_paths else None
                                post["status"] = "Ready" if image_paths else "Failed"
                                if audit.get("feedback"):
                                    post["audit_log"] = audit["feedback"]
                                await self._notify("Visual", "IDLE", f"✓ Render {idx+1} complete", task_id)
                                self._log(task_id, tasks_store, f"  ✓ Render {idx+1} complete", 75)
                                break # Success
                    except Exception as e:
                        if attempt < retries - 1:
                            self._log(task_id, tasks_store, f"  ! Visual retry {attempt+1} for post {idx+1}: {e}", 70)
                            await asyncio.sleep(2)
                        else:
                            self._log(task_id, tasks_store, f"  ✗ Visual failed on post {idx+1} after {retries} attempts: {e}", 70)

            await asyncio.gather(*(generate_image(post, i) for i, post in enumerate(all_posts)))

        # Step 4: Save posts to DB
        self._log(task_id, tasks_store, f"Saving {len(all_posts)} posts to database...", 85)
        _save_posts(all_posts)
        self._log(task_id, tasks_store, f"✓ {len(all_posts)} posts saved to pipeline queue", 90)

    async def run_video_burst(
        self,
        influencer_ids: list[str],
        num_videos: int,
        task_id: str,
        tasks_store: dict,
    ):
        """
        FULLY AUTONOMOUS VIDEO PRODUCTION:
        Scout → Creator → Visual (Video) → Editor (Dopamine) → Caption → Save.
        """
        await self._notify("Orchestrator", "IDLE", f"Starting Video Burst for {len(influencer_ids)} influencers", task_id)
        influencers = _get_influencers(influencer_ids)
        if not influencers:
            self._log(task_id, tasks_store, "No influencers found.", 100)
            return

        self._log(task_id, tasks_store, f"Starting Video Factory for {len(influencers)} models", 5)

        # 1. Scout trends
        trends = await self.scout.find_trends("trending viral social media topics", ["tiktok", "instagram"], limit=5)
        trend_context = "\n".join(f"- {t['topic']}" for t in trends)

        for inf in influencers:
            self._log(task_id, tasks_store, f"Processing {inf['name']}...", 15)
            dna = json.loads(inf.get("dna_json") or "{}")

            # 2. Create Scripts
            posts = await self.creator.generate_posts(
                influencer_id=inf["id"],
                influencer_name=inf["name"],
                niche=inf["niche"],
                dna=dna,
                num_posts=num_videos,
                trend_context=trend_context
            )

            for i, post in enumerate(posts):
                try:
                    self._log(task_id, tasks_store, f"[{inf['name']}] Video {i+1}: Generating Base Motion (AnimateDiff)...", 30)
                    await self._notify("Visual", "IDLE", f"Rendering scene {i+1} for {inf['name']}...", task_id)
                    
                    # 3. Generate Base Video Clip
                    video_base = await self.visual.generate_video_base(
                        influencer_id=inf["id"],
                        prompt=post.get("image_prompt", "cinematic viral video"),
                        workflow="video_base",
                        frames=24
                    )
                    
                    if not video_base:
                        self._log(task_id, tasks_store, f"  ✗ Video base generation failed for {inf['name']}", 30)
                        continue

                    # 4. DESIGN: Production Script (Creative Director)
                    self._log(task_id, tasks_store, f"[{inf['name']}] Designing production script...", 50)
                    prod_script = await self.creator.generate_production_script(
                        influencer_name=inf["name"],
                        niche=inf["niche"],
                        dna=dna,
                        base_idea=post.get("caption", ""),
                        num_clips=1
                    )

                    # 5. EXECUTION: Smart Assembly (Production Editor)
                    self._log(task_id, tasks_store, f"[{inf['name']}] Assembling final cut with effects...", 70)
                    
                    # Convert paths for moviepy
                    abs_video_base = str(Path(__file__).parent.parent.parent / "public" / video_base.lstrip("/"))
                    
                    polished_path = self.video_editor.produce_industry_video(
                        source_clips=[abs_video_base],
                        production_script=prod_script
                    )

                    # 6. POST: Burn Captions
                    self._log(task_id, tasks_store, f"[{inf['name']}] Video {i+1}: Burning AI Captions...", 80)
                    await self._notify("Visual", "IDLE", f"Synchronizing subtitles...", task_id)
                    
                    final_video_url = await self.caption_agent.process_video_with_captions(
                        str(Path(__file__).parent.parent.parent / "public" / polished_path.lstrip("/")),
                        post.get("caption", "Stay high performance.")
                    )

                    # 6. Save to DB
                    post["media_path"] = final_video_url or polished_path
                    post["status"] = "Ready"
                    _save_posts([post])
                    
                    self._log(task_id, tasks_store, f"  ✓ Video {i+1} complete: {post['media_path']}", 90)
                except Exception as e:
                    self._log(task_id, tasks_store, f"  ✗ Video pipeline error: {e}", 90)

        self._log(task_id, tasks_store, "✓ Video Burst Complete!", 100)

    def run_master_shot_sync(self, influencer_id: str, scenario: Optional[str] = None, job_id: Optional[str] = None) -> dict:
        """Synchronous Master Shot for Redis Worker."""
        print(f"[Orchestrator][{job_id}] Starting Master Shot for {influencer_id}...")
        
        # 1. Fetch Influencer
        infl_list = _get_influencers([influencer_id])
        if not infl_list:
            raise ValueError(f"Influencer {influencer_id} not found.")
        inf = infl_list[0]
        dna = json.loads(inf.get("dna_json") or "{}")

        # 2. Derive High-Fidelity Prompt (Creator LLM) - Use sync fallback if needed
        # Assuming creator has a generate_master_prompt_sync or can be called synchronously
        # For now, if creator is async-only, we might need a wrapper or use the existing one if it doesn't await much outside IO
        master_prompt = self.creator.generate_master_prompt_sync(
            influencer_name=inf["name"],
            niche=inf["niche"],
            dna=dna,
            scenario=scenario
        )
        
        # 3. Step-by-Step Visual Pipeline (SYNC)
        # Step A: Base Generation
        base_image = self.visual.generate_step_sync(
            influencer_id=influencer_id,
            prompt=master_prompt,
            workflow="image_base"
        )
        if not base_image:
             raise RuntimeError("Visual Base Generation failed.")

        # Step B: Refine Phase
        refined_image = self.visual.generate_step_sync(
            influencer_id=influencer_id,
            prompt=master_prompt,
            workflow="image_refine",
            source_image=base_image
        )
        if not refined_image:
             raise RuntimeError("Visual Structural Refinement failed.")

        # Step C: Z-Image Detailing
        detailed_image = self.visual.generate_step_sync(
            influencer_id=influencer_id,
            prompt=master_prompt,
            workflow="image_detail",
            source_image=refined_image
        )
        if not detailed_image:
             raise RuntimeError("Visual Z-Image Detailing failed.")

        # Step D: Final Z-Image Upscale
        upscaled_image = self.visual.generate_step_sync(
            influencer_id=influencer_id,
            prompt=master_prompt,
            workflow="image_upscale",
            source_image=detailed_image
        )
        if not upscaled_image:
             raise RuntimeError("Visual Final Upscale failed.")
            
        import time
        result = {
            "influencer_id": influencer_id,
            "influencer_name": inf["name"],
            "prompt": master_prompt,
            "image_url": upscaled_image,
            "timestamp": time.time()
        }
        
        # 4. Save to Memory
        self.memory.save(
            influencer_id=influencer_id,
            memory_type="master_shot",
            content=result,
            importance=0.8
        )
        
        print(f"[Orchestrator][{job_id}] ✅ Master Shot Complete!")
        return result

    async def run_master_shot(self, influencer_id: str, scenario: Optional[str] = None) -> dict:
        """One-Click Advanced Character Generation."""
        await self._notify("Orchestrator", "IDLE", f"Starting Master Shot for {influencer_id}...")
        
        # 1. Fetch Influencer
        infl_list = _get_influencers([influencer_id])
        if not infl_list:
            raise ValueError(f"Influencer {influencer_id} not found.")
        inf = infl_list[0]
        dna = json.loads(inf.get("dna_json") or "{}")

        # 2. Derive High-Fidelity Prompt using Creator LLM
        await self._notify("Creator", "IDLE", f"Designing master scenario for {inf['name']}...")
        master_prompt = await self.creator.generate_master_prompt(
            influencer_name=inf["name"],
            niche=inf["niche"],
            dna=dna,
            scenario=scenario
        )
        
        # 3. Step-by-Step Visual Pipeline
        # Step A: Base Generation (Flux 9B + IPAdapter)
        await self._notify("Visual", "IDLE", f"Rendering Base Image (Flux 9B)...")
        base_image = await self.visual.generate_step(
            influencer_id=influencer_id,
            prompt=master_prompt,
            workflow="image_base"
        )
        if not base_image:
             raise RuntimeError("Visual Base Generation failed.")

        # Step B: Refine Phase (Identity Master)
        await self._notify("Visual", "IDLE", f"Running Identity Master (Peak)...")
        refined_image = await self.visual.generate_step(
            influencer_id=influencer_id,
            prompt=master_prompt,
            workflow="image_refine",
            source_image=base_image
        )
        if not refined_image:
             raise RuntimeError("Visual Structural Refinement failed.")

        # Step C: Z-Image Detailing
        await self._notify("Visual", "IDLE", f"Running Z-Image Detailing...")
        detailed_image = await self.visual.generate_step(
            influencer_id=influencer_id,
            prompt=master_prompt,
            workflow="image_detail",
            source_image=refined_image
        )
        if not detailed_image:
             raise RuntimeError("Visual Z-Image Detailing failed.")

        # Step D: Final Z-Image Upscale
        await self._notify("Visual", "IDLE", f"Performing Final Z-Image Upscale...")
        upscaled_image = await self.visual.generate_step(
            influencer_id=influencer_id,
            prompt=master_prompt,
            workflow="image_upscale",
            source_image=detailed_image
        )
        if not upscaled_image:
             raise RuntimeError("Visual Final Upscale failed.")
            
        result = {
            "influencer_id": influencer_id,
            "influencer_name": inf["name"],
            "prompt": master_prompt,
            "image_url": upscaled_image,
            "timestamp": asyncio.get_event_loop().time()
        }
        
        # 4. Save to Memory
        self.memory.save(
            influencer_id=influencer_id,
            memory_type="master_shot",
            content=result,
            importance=0.8
        )
        
        await self._notify("Orchestrator", "IDLE", f"✅ Master Shot Complete for {inf['name']}!")
        return result
