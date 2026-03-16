"""
AI Influencer Factory — Python Agent Engine
Runs on port 8787. Called by the Next.js dashboard.
"""
import os
from dotenv import load_dotenv

# Load .env.local from the parent directory (Next.js project root)
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env.local'))

from fastapi import FastAPI, HTTPException, BackgroundTasks, WebSocket, WebSocketDisconnect, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import APIKeyHeader
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List
import asyncio
import uuid
import json
import re
from datetime import datetime
import redis
import logging
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# Configure logging early
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("ai-factory")

# Security / Auth
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

def verify_api_key(api_key: str = Depends(api_key_header)):
    expected_key = os.getenv("INTERNAL_API_KEY")
    if not expected_key:
        return None # Unprotected in dev
    if api_key != expected_key:
        raise HTTPException(status_code=403, detail="Unauthorized: Invalid API Key")
    return api_key

# Initialize Rate Limiter
limiter = Limiter(key_func=get_remote_address)

# Global Jobs State (for tracking background tasks without Redis)
# In a production multi-worker setup, this would be in Redis.
jobs = {}

# Initialize Redis (Optional fallback for Pub/Sub features)
try:
    redis_conn = redis.from_url(
        os.getenv("REDIS_URL", "redis://localhost:6379/0"),
        socket_timeout=2,
        socket_connect_timeout=2
    )
    # Check if redis is actually reachable
    redis_conn.ping()
    HAS_REDIS = True
except Exception:
    logger.info("Redis not available, falling back to in-memory state for real-time updates.")
    HAS_REDIS = False
    redis_conn = None

# Telemetry Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                # Silently fail if connection is stale
                pass

manager = ConnectionManager()

# ── Agent imports (each is a standalone module) ───────────────────────────
from .agents.creator import CreatorAgent
from .agents.scout import ScoutAgent
from .agents.analyst import AnalystAgent
from .agents.visual import VisualAgent
from .agents.memory import MemoryAgent
from .agents.orchestrator import OrchestratorAgent
from .agents.posting import PostingAgent
from .agents.hashtag import HashtagAgent
from .agents.openclaw import OpenClawAgent
from .agents.video_editor import VideoEditorAgent
from .agents.caption_agent import CaptionAgent
from .scheduler import FactoryScheduler

app = FastAPI(
    title="AI Factory Agent Engine",
    description="Multi-agent AI engine for the AI Influencer Factory",
    version="1.0.0",
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Global Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"Global error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"ok": False, "error": str(exc), "type": type(exc).__name__}
    )

# CORS Configuration from environment
cors_origins = os.getenv("CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Relaxed for local debugging
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Secure Headers Middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

from .agents.persona import PersonaAgent
# ... (rest of imports)

# ── Singleton agents ───────────────────────────────────────────────────────
creator  = CreatorAgent()
scout    = ScoutAgent()
analyst  = AnalystAgent(notify_callback=manager.broadcast)
visual   = VisualAgent()
memory   = MemoryAgent()
persona  = PersonaAgent()
posting  = PostingAgent()
hashtag  = HashtagAgent()
openclaw_agent = OpenClawAgent()
video_editor = VideoEditorAgent()
caption_agent = CaptionAgent()
orchestrator = OrchestratorAgent(
    creator, scout, analyst, visual, memory, persona, 
    video_editor=video_editor, 
    caption_agent=caption_agent,
    telemetry_callback=manager.broadcast
)
factory_scheduler = FactoryScheduler(orchestrator)

# In-memory task store (persisted to SQLite by MemoryAgent)
active_tasks: dict[str, dict] = {}
jobs: dict[str, dict] = {} # Production job tracking

# ── Request / Response models ─────────────────────────────────────────────
class BurstRequest(BaseModel):
    influencer_ids: list[str]
    days_ahead: int = 7
    mode: str = "full"  # full | content_only | images_only

class VideoBurstRequest(BaseModel):
    influencer_ids: list[str]
    num_videos: int = 1

class ContentRequest(BaseModel):
    influencer_id: str
    influencer_name: str
    niche: str
    dna_json: dict
    num_posts: int = 7
    model_id: Optional[str] = None

class MemorySearchRequest(BaseModel):
    influencer_id: str
    query: str
    limit: int = 5

class ScoutRequest(BaseModel):
    niche: str
    platforms: list[str] = ["instagram", "tiktok"]
    limit: int = 10

class HashtagRequest(BaseModel):
    niche: str
    influencer_name: str = "influencer"
    platforms: list[str] = ["instagram"]
    dna: Optional[dict] = None
    force_refresh: bool = False

class HashtagCaptionRequest(BaseModel):
    caption: str
    niche: str
    influencer_name: str = "influencer"
    dna: Optional[dict] = None
    platform: str = "instagram"

class AnalystRequest(BaseModel):
    influencer_id: str
    ig_business_account_id: Optional[str] = None
    access_token: Optional[str] = None
    model_id: Optional[str] = None

from pydantic import BaseModel, Field, field_validator

class VisualRequest(BaseModel):
    influencer_id: str = Field(..., pattern=r"^[a-zA-Z0-9_\-]+$")
    prompt: str = Field(..., min_length=3, max_length=1000)
    workflow: str = Field("txt2img-juggernautxl", pattern=r"^[a-zA-Z0-9_\-]+$")
    num_images: int = Field(1, ge=1, le=4)
    
    @field_validator("prompt")
    @classmethod
    def sanitize_prompt(cls, v: str) -> str:
        clean = re.sub(r'<[^>]*>', '', v)
        clean = re.sub(r'[;&|]', '', clean)
        return clean.strip()

class MasterShotRequest(BaseModel):
    influencer_id: str = Field(..., pattern=r"^[a-zA-Z0-9_\-]+$")
    scenario: Optional[str] = Field(None, max_length=500)

    @field_validator("scenario")
    @classmethod
    def sanitize_scenario(cls, v: Optional[str]) -> Optional[str]:
        if v is None: return v
        return re.sub(r'<[^>]*>', '', v).strip()

class PostTriggerRequest(BaseModel):
    post_id: str


class StepRequest(BaseModel):
    influencer_id: str
    source_image: str
    prompt: Optional[str] = None


# ── Root ──────────────────────────────────────────────────────────────────
@app.get("/")
async def root():
    return {
        "service": "AI Factory Agent Engine",
        "version": "2.0.0",
        "status": "online",
        "docs": "/docs",
        "health": "/health",
    }

# ── Health ────────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    # Check Ollama availability
    ollama_ok = False
    ollama_url = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434")
    ollama_model = os.getenv("OLLAMA_MODEL", "qwen2.5:7b")
    try:
        async with aiohttp.ClientSession() as s:
            async with s.get(f"{ollama_url}/api/tags", timeout=aiohttp.ClientTimeout(total=2)) as r:
                ollama_ok = r.status == 200
    except Exception:
        pass

    return {
        "status": "online",
        "version": "2.0.0",
        "agents": ["orchestrator", "creator", "scout", "analyst", "visual", "memory", "posting", "hashtag", "openclaw"],
        "timestamp": datetime.utcnow().isoformat(),
        "llm": {
            "provider": "ollama (local)",
            "model": ollama_model,
            "status": "online" if ollama_ok else "offline",
            "url": ollama_url,
        },
        "gemini_configured": bool(os.getenv("GEMINI_API_KEY")),
        "comfyui_url": os.getenv("COMFYUI_URL", "http://127.0.0.1:8188"),
        "openclaw_url": os.getenv("OPENCLAW_URL", "http://127.0.0.1:18789"),
    }


@app.websocket("/ws/telemetry")
async def websocket_endpoint(websocket: WebSocket):
    print(f" [WS] New connection attempt from {websocket.client}")
    logger.info(f"Incoming WebSocket connection from {websocket.client}")
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive, we mostly broadcast TO the client
            await websocket.receive_text()
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected from {websocket.client}")
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)

# ── Burst Session ─────────────────────────────────────────────────────────
@app.post("/agents/burst")
async def burst_session(req: BurstRequest, background: BackgroundTasks):
    """
    Full burst session: Scout → Create content → Queue images → Schedule posts.
    Runs in background. Poll /agents/tasks/{task_id} for progress.
    """
    task_id = str(uuid.uuid4())
    active_tasks[task_id] = {"status": "running", "progress": 0, "log": []}

    async def run():
        try:
            await orchestrator.run_burst(
                influencer_ids=req.influencer_ids,
                days_ahead=req.days_ahead,
                mode=req.mode,
                task_id=task_id,
                tasks_store=active_tasks,
            )
            active_tasks[task_id]["status"] = "done"
        except Exception as e:
            active_tasks[task_id]["status"] = "failed"
            active_tasks[task_id]["error"] = str(e)

    background.add_task(run)
    return {"task_id": task_id, "status": "started"}

@app.post("/agents/video-burst")
async def burst_video_session(req: VideoBurstRequest, background: BackgroundTasks):
    """
    Autonomous Video Factory: Scout → Create → Visual (Video) → Editor → Caption.
    """
    task_id = str(uuid.uuid4())
    active_tasks[task_id] = {"status": "running", "progress": 0, "log": []}

    async def run():
        try:
            await orchestrator.run_video_burst(
                influencer_ids=req.influencer_ids,
                num_videos=req.num_videos,
                task_id=task_id,
                tasks_store=active_tasks,
            )
            active_tasks[task_id]["status"] = "done"
        except Exception as e:
            logger.error(f"Video Burst failed: {e}")
            active_tasks[task_id]["status"] = "failed"
            active_tasks[task_id]["error"] = str(e)

    background.add_task(run)
    return {"task_id": task_id, "status": "started"}


# ── Creator Agent ─────────────────────────────────────────────────────────
@app.post("/agents/creator")
async def generate_content(req: ContentRequest):
    """Generate N posts (captions, hooks, hashtags, image prompts) from influencer DNA."""
    try:
        result = await creator.generate_posts(
            influencer_id=req.influencer_id,
            influencer_name=req.influencer_name,
            niche=req.niche,
            dna=req.dna_json,
            num_posts=req.num_posts,
            model_id=req.model_id,
        )
        return {"ok": True, "posts": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Scout Agent ───────────────────────────────────────────────────────────
@app.post("/agents/scout")
async def scout_trends(req: ScoutRequest):
    """Scrape trending topics/hooks for a niche across platforms."""
    try:
        trends = await scout.find_trends(
            niche=req.niche,
            platforms=req.platforms,
            limit=req.limit,
        )
        return {"ok": True, "trends": trends}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Hashtag Agent ─────────────────────────────────────────────────────────
@app.post("/agents/hashtags")
async def find_hashtags(req: HashtagRequest):
    """
    Find trending + niche-authority hashtags for an influencer.
    Returns 4 tiers: trending_now, niche_authority, engagement_bait, brand_signature.
    Also returns caption_blocks.minimal / standard / full for easy copy-paste.
    """
    try:
        result = await hashtag.find_hashtags(
            niche=req.niche,
            influencer_name=req.influencer_name,
            dna=req.dna,
            platforms=req.platforms,
            force_refresh=req.force_refresh,
        )
        return {"ok": True, **result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/agents/hashtags/analyze-caption")
async def analyze_caption_hashtags(req: HashtagCaptionRequest):
    """
    Analyzes a specific caption text and returns context-aware hashtags
    matched to the vibe and intent of that post.
    """
    try:
        result = await hashtag.find_hashtags(
            niche=req.niche,
            influencer_name=req.influencer_name,
            dna=req.dna,
            platforms=[req.platform],
        )
        return {"ok": True, **result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── OpenClaw Agent ────────────────────────────────────────────────────────
@app.get("/agents/openclaw/status")
async def openclaw_status():
    """Check if the OpenClaw gateway is running and reachable."""
    openclaw_agent.reset_cache()
    available = await openclaw_agent.is_available()
    return {
        "ok": True,
        "openclaw_available": available,
        "gateway_url": os.getenv("OPENCLAW_URL", "http://127.0.0.1:18789"),
        "note": "If False, the agent will use direct httpx fallback for static pages.",
    }

class OpenClawFetchRequest(BaseModel):
    url: str
    use_browser: bool = False

class OpenClawScrapeRequest(BaseModel):
    niche: str
    platforms: list[str] = ["instagram"]

@app.post("/agents/openclaw/fetch")
async def openclaw_fetch(req: OpenClawFetchRequest):
    """
    Test endpoint: fetch any URL via OpenClaw and return the cleaned markdown text.
    Useful for debugging what OpenClaw sees on hashtag/trend sites.
    """
    try:
        content = await openclaw_agent.web_fetch(req.url, use_browser=req.use_browser)
        return {
            "ok": True,
            "url": req.url,
            "content_length": len(content),
            "preview": content[:500],
            "full_content": content,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/agents/openclaw/hashtags")
async def openclaw_scrape_hashtags(req: OpenClawScrapeRequest):
    """Scrape live hashtags for a niche using OpenClaw (bypasses cache)."""
    try:
        tags = await openclaw_agent.scrape_hashtag_trends(req.niche, req.platforms)
        return {"ok": True, "niche": req.niche, "tags": tags, "count": len(tags)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/agents/openclaw/trends")
async def openclaw_scrape_trends(req: OpenClawScrapeRequest):
    """Scrape live trending topics for a niche using OpenClaw."""
    try:
        trends = await openclaw_agent.scrape_trending_topics(req.niche)
        return {"ok": True, "niche": req.niche, "trends": trends, "count": len(trends)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Analyst Agent ─────────────────────────────────────────────────────────
@app.post("/agents/analyst")
async def analyse_performance(req: AnalystRequest):
    """Pull IG analytics, rank posts, return insights for DNA evolution."""
    try:
        insights = await analyst.analyse(
            influencer_id=req.influencer_id,
            ig_account_id=req.ig_business_account_id,
            access_token=req.access_token,
            model_id=req.model_id,
        )
        return {"ok": True, "insights": insights}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/agents/analyst/evolve")
async def evolve_dna(req: AnalystRequest):
    """Trigger the DNA evolution loop."""
    try:
        result = await analyst.evolve_dna(influencer_id=req.influencer_id, model_id=req.model_id)
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class SensoryRequest(BaseModel):
    influencer_id: str
    image_path: str
    description: str = ""

@app.post("/agents/memory/sensory")
async def process_sensory(req: SensoryRequest):
    """Process an image and generate sensory memory weights."""
    try:
        from pathlib import Path
        memory.sensory_grounding(
            influencer_id=req.influencer_id,
            image_path=Path(req.image_path),
            description=req.description
        )
        return {"ok": True, "message": "Sensory input processed."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── Visual Agent ──────────────────────────────────────────────────────────
@app.post("/agents/visual", dependencies=[Depends(verify_api_key)])
@limiter.limit("5/minute")
async def queue_image(req: VisualRequest, request: Request, background_tasks: BackgroundTasks):
    """Queue a ComfyUI image generation job using FastAPI BackgroundTasks."""
    job_id = f"job_{uuid.uuid4()}"
    
    # Define the task wrapper
    async def run_visual_task(j_id, r_influencer_id, r_prompt, r_workflow, r_num_images):
        try:
            jobs[j_id]["status"] = "processing"
            # Call the agent directly (visual is an instance of VisualAgent)
            result = await visual.generate_sync(
                influencer_id=r_influencer_id,
                prompt=r_prompt,
                workflow=r_workflow,
                num_images=r_num_images
            )
            jobs[j_id]["status"] = "done"
            jobs[j_id]["result"] = result
            
            # Publish update if Redis is available
            if HAS_REDIS:
                msg = json.dumps({"job_id": j_id, "status": "done", "result": result, "influencer_id": r_influencer_id})
                redis_conn.publish("ai_factory_updates", msg)
        except Exception as e:
            logger.error(f"Visual Task Error: {e}")
            jobs[j_id]["status"] = "error"
            jobs[j_id]["error"] = str(e)

    background_tasks.add_task(run_visual_task, job_id, req.influencer_id, req.prompt, req.workflow, req.num_images)
    
    jobs[job_id] = {"status": "pending", "type": "visual", "created_at": datetime.now().isoformat()}
    return {"ok": True, "job_id": job_id, "status": "queued"}

@app.post("/agents/visual/master-shot", dependencies=[Depends(verify_api_key)])
@limiter.limit("2/minute")
async def generate_master_shot(req: MasterShotRequest, request: Request, background_tasks: BackgroundTasks):
    """One-click high-fidelity character generation as a background task."""
    job_id = f"job_{uuid.uuid4()}"

    async def run_master_shot_task(j_id, r_influencer_id, r_scenario):
        try:
            jobs[j_id]["status"] = "processing"
            # orchestrator is an instance of OrchestratorAgent
            result = await orchestrator.run_master_shot_sync(
                influencer_id=r_influencer_id,
                scenario=r_scenario
            )
            jobs[j_id]["status"] = "done"
            jobs[j_id]["result"] = result
            
            if HAS_REDIS:
                msg = json.dumps({"job_id": j_id, "status": "done", "result": result, "influencer_id": r_influencer_id})
                redis_conn.publish("ai_factory_updates", msg)
        except Exception as e:
            logger.error(f"Master Shot Error: {e}")
            jobs[j_id]["status"] = "error"
            jobs[j_id]["error"] = str(e)

    background_tasks.add_task(run_master_shot_task, job_id, req.influencer_id, req.scenario)
    
    jobs[job_id] = {"status": "pending", "type": "master_shot", "created_at": datetime.now().isoformat()}
    return {"ok": True, "job_id": job_id, "status": "queued"}

@app.post("/agents/visual/refine")
async def manual_refine(req: StepRequest):
    """Manually trigger structural refinement (I2I) for an existing image."""
    try:
        result = await visual.generate_step(
            influencer_id=req.influencer_id,
            prompt=req.prompt or "high quality, structural refinement",
            workflow="flux-9b-refine",
            source_image=req.source_image
        )
        return {"ok": True, "image_path": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/agents/visual/detail")
async def manual_detail(req: StepRequest):
    """Manually trigger Z-Image detailing for an existing image."""
    try:
        result = await visual.generate_step(
            influencer_id=req.influencer_id,
            prompt=req.prompt or "high quality, Z-Image detailing",
            workflow="flux-9b-detailer",
            source_image=req.source_image
        )
        return {"ok": True, "image_path": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/agents/visual/upscale")
async def manual_upscale(req: StepRequest):
    """Manually trigger Z-Image upscaling for an existing image."""
    try:
        result = await visual.generate_step(
            influencer_id=req.influencer_id,
            prompt=req.prompt or "high quality, Z-Image upscaling",
            workflow="flux-9b-upscaler",
            source_image=req.source_image
        )
        return {"ok": True, "image_path": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Posting Agent ─────────────────────────────────────────────────────────
class PostTriggerRequest(BaseModel):
    post_id: str

class ReadyTriggerRequest(BaseModel):
    influencer_id: str

@app.post("/agents/posting/trigger")
async def trigger_post(req: PostTriggerRequest):
    """Refine caption via Ollama, publish to IG, trigger n8n. All local."""
    try:
        result = await posting.trigger_post(req.post_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/agents/posting/trigger-ready")
async def trigger_ready_posts(req: ReadyTriggerRequest):
    """Auto-post all 'Ready' posts for a given influencer."""
    import sqlite3
    from pathlib import Path
    db_path = Path(__file__).parent.parent / "data" / "factory.db"
    try:
        conn = sqlite3.connect(str(db_path))
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            "SELECT id FROM posts WHERE influencer_id = ? AND status = 'Ready'",
            (req.influencer_id,)
        ).fetchall()
        conn.close()
        results = []
        for row in rows:
            r = await posting.trigger_post(row["id"])
            results.append(r)
        return {"ok": True, "triggered": len(results), "results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── n8n Integration ───────────────────────────────────────────────────────
async def call_n8n_webhook(event_type: str, data: dict):
    """Securely call an n8n webhook with the given payload."""
    webhook_url = os.getenv("N8N_WEBHOOK_URL")
    api_key = os.getenv("N8N_API_KEY")
    if not webhook_url: return
        
    payload = {"event": event_type, "timestamp": datetime.utcnow().isoformat(), "data": data}
    headers = {"X-Api-Key": api_key} if api_key else {}
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(webhook_url, json=payload, headers=headers)
    except Exception as e:
        logger.error(f"[n8n] Failed to call webhook: {e}")


# ── Memory Agent ──────────────────────────────────────────────────────────
@app.get("/agents/memory")
def get_all_memories(limit: int = 200):
    """Fetch global memory state (all influencers) for the AGI brain view."""
    data = memory.get_all(limit)
    # Format for the brain view (id, type, content summary, importance, mock connections)
    nodes = []
    for i, m in enumerate(data):
        nodes.append({
            "id": f"node_{i}",
            "type": m["memory_type"],
            "content": str(m["content"]),
            "importance": m["importance"],
            "connections": [f"node_{(i+1) % len(data)}", f"node_{(i+3) % len(data)}"] if len(data) > 3 else []
        })
    return nodes

@app.get("/agents/memory/{influencer_id}")
def get_memory(influencer_id: str, memory_type: Optional[str] = None):
    """Fetch an influencer's long-term learnings from SQLite."""
    data = memory.get(influencer_id, memory_type)
    return {"ok": True, "memories": data}

@app.post("/agents/memory")
async def save_memory(req: dict):
    """Manually save a cognitive node (Sensory Grounding)."""
    try:
        memory.save(
            influencer_id=req["influencer_id"],
            memory_type=req.get("memory_type", "manual_entry"),
            content=req["content"],
            importance=req.get("importance", 0.7)
        )
        return {"ok": True, "message": "Memory grounded."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/agents/memory/search")
async def search_memory(req: MemorySearchRequest):
    """Semantic search for influencer memories."""
    results = memory.search_semantic(req.influencer_id, req.query, req.limit)
    return {"ok": True, "results": results}

@app.post("/agents/maintenance/sleep")
async def rem_sleep_cycle(req: AnalystRequest):
    """Trigger the nightly REM sleep cycle for an influencer."""
    try:
        stats = await memory.consolidate(influencer_id=req.influencer_id)
        await manager.broadcast({
            "agent": "Analyst",
            "status": "CONSOLIDATING",
            "message": f"REM Cycle: Pruned {stats['pruned']} items. Consolidated {stats['consolidated']} into patterns.",
            "influencer_id": req.influencer_id
        })
        return {"ok": True, "stats": stats}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Job Status ───────────────────────────────────────────────────────────
@app.get("/agents/jobs/{job_id}")
async def get_job_status(job_id: str):
    """Poll the status of a background job."""
    try:
        job = Job.fetch(job_id, connection=redis_conn)
        status = job.get_status()
        
        # Update our local tracking if needed
        if job_id in jobs:
            jobs[job_id]["status"] = status
            if status == "finished":
                jobs[job_id]["result"] = job.result
            elif status == "failed":
                jobs[job_id]["error"] = str(job.exc_info)

        return {
            "job_id": job_id,
            "status": status,
            "result": job.result if status == "finished" else None,
            "error": str(job.exc_info) if status == "failed" else None,
            "meta": jobs.get(job_id, {})
        }
    except Exception as e:
        # Fallback to local memory if RQ job is purged
        if job_id in jobs:
            return {"job_id": job_id, **jobs[job_id]}
        raise HTTPException(status_code=404, detail="Job not found")

# ── Task Status ───────────────────────────────────────────────────────────
@app.get("/agents/tasks/{task_id}")
def get_task(task_id: str):
    if task_id not in active_tasks:
        raise HTTPException(status_code=404, detail="Task not found")
    return active_tasks[task_id]

@app.get("/agents/tasks")
def list_tasks():
    return list(active_tasks.values())



@app.post("/agents/post")
async def trigger_manual_post(req: PostTriggerRequest):
    """Manually trigger the posting agent for a specific post."""
    try:
        result = await posting.trigger_post(req.post_id)
        return {"ok": result.get("ok", False), **result}
    except Exception as e:
        logger.error(f"[ManualPost] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── Auto-Posting Background Job ─────────────────────────────────────────
import httpx
async def redis_listener():
    """Listen for job updates from Redis and broadcast via WebSockets."""
    if not HAS_REDIS:
        logger.info("Redis listener skipped (no Redis connection)")
        return

    pubsub = redis_conn.pubsub()
    
    while True:
        try:
            message = pubsub.get_message(ignore_subscribe_messages=True)
            if message:
                data = json.loads(message['data'])
                # Broadcast to all connected clients
                await manager.broadcast({
                    "event": "job_update",
                    "job_id": data["job_id"],
                    "status": data["status"],
                    "result": data.get("result"),
                    "error": data.get("error"),
                    "influencer_id": data.get("influencer_id")
                })
        except Exception as e:
            logger.error(f"[RedisBridge] Error: {e}")
        await asyncio.sleep(0.1)

async def autopost_loop():
    """Poll for ready posts and fire them via PostingAgent + n8n."""
    while True:
        try:
            import sqlite3
            from pathlib import Path
            db_path = Path(__file__).parent.parent / "data" / "factory.db"
            conn = sqlite3.connect(str(db_path))
            conn.row_factory = sqlite3.Row
            ready_posts = conn.execute(
                "SELECT id FROM posts WHERE status = 'Ready' LIMIT 5"
            ).fetchall()
            conn.close()

            for row in ready_posts:
                try:
                    result = await posting.trigger_post(row["id"])
                    if result.get("ok"):
                        logger.info(f"[AutoPost] Posted: {row['id']}")
                    else:
                        logger.warning(f"[AutoPost] Failed: {result.get('error', 'unknown')}")
                except Exception as post_err:
                    logger.error(f"[AutoPost] Post error: {post_err}")
        except Exception as e:
            logger.error(f"[AutoPost] Loop error: {e}")
        await asyncio.sleep(60)

@app.on_event("startup")
async def startup_event():
    logger.info("Starting Autonomous Factory Scheduler...")
    try:
        asyncio.create_task(factory_scheduler.start())
    except Exception as e:
        logger.error(f"Failed to start scheduler: {e}")
    asyncio.create_task(autopost_loop())
    asyncio.create_task(redis_listener())
    logger.info("Real-time Bridges (AutoPost & Redis Pub/Sub) Started")

# ── Entry point ───────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("agent_engine.main:app", host="0.0.0.0", port=8787, reload=True)
