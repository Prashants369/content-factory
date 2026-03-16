# 🏭 AI Influencer Factory — Dashboard

Next.js 16 + FastAPI multi-agent system for autonomous AI influencer management. Generates content, images via ComfyUI, manages social posting, and evolves influencer DNA over time.

---

## ⚡ Quick Start

```powershell
# 1. Install dependencies
cd Z:\automation\factory-dashboard
npm install
pip install -r agent_engine\requirements.txt

# 2. Configure environment
copy .env.local.example .env.local   # edit with your keys

# 3. Start everything
.\start_factory.ps1                   # PowerShell (recommended)
# OR
start_factory.bat                     # Batch wrapper
```

**Dashboard:** http://localhost:3000  
**Agent Engine API:** http://localhost:8787/docs  
**ComfyUI:** http://localhost:8188

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    Browser (Port 3000)                       │
│  ┌─────────────┬──────────┬──────────┬──────────────────┐   │
│  │  Dashboard   │  Studio  │  Queue   │  Analytics/Radar │   │
│  └──────┬───────┴────┬─────┴────┬─────┴────────┬─────────┘   │
│         │            │          │              │              │
├─────────┼────────────┼──────────┼──────────────┼──────────────┤
│         ▼            ▼          ▼              ▼              │
│  ┌─────────────────────────────────────────────────────┐     │
│  │         Next.js API Routes (src/app/api/)           │     │
│  │  /influencers  /posts  /studio  /monitor  /launcher │     │
│  └──────────────────────┬──────────────────────────────┘     │
│                         │ HTTP / REST                        │
│  ┌──────────────────────▼──────────────────────────────┐     │
│  │         Agent Engine (FastAPI, Port 8787)            │     │
│  │  ┌──────────┬────────┬────────┬────────┬──────────┐ │     │
│  │  │Orchestr. │Creator │ Visual │ Scout  │ Analyst  │ │     │
│  │  ├──────────┼────────┼────────┼────────┼──────────┤ │     │
│  │  │ Memory   │Posting │Hashtag │ Persona│  Ghost   │ │     │
│  │  └──────────┴────────┴────────┴────────┴──────────┘ │     │
│  │          WebSocket: /ws/telemetry                    │     │
│  └───────┬──────────────┬──────────────┬───────────────┘     │
│          │              │              │                      │
│          ▼              ▼              ▼                      │
│  ┌──────────────┐ ┌──────────┐ ┌─────────────┐              │
│  │  ComfyUI     │ │  Ollama  │ │  SQLite DB  │              │
│  │  (Port 8188) │ │ (11434)  │ │ factory.db  │              │
│  │  GPU Image   │ │ Local LLM│ │             │              │
│  │  Generation  │ │ qwen3.5  │ │             │              │
│  └──────────────┘ └──────────┘ └─────────────┘              │
│                                                              │
│  Optional:  n8n (5678) │ Redis (6379) │ OpenClaw (18789)    │
└──────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Dashboard** → user creates influencer, triggers content generation
2. **Next.js API** → validates request, stores in SQLite
3. **Agent Engine** → orchestrates multi-agent pipeline:
   - **Scout** → finds trending topics
   - **Creator** → generates captions, hooks, hashtags
   - **Visual** → queues ComfyUI image generation
   - **Memory** → stores learnings per influencer
   - **Analyst** → pulls IG analytics, evolves DNA
   - **Posting** → publishes via Instagram Graph API + n8n
4. **ComfyUI** → GPU-accelerated image generation with custom workflows
5. **Dashboard** → real-time updates via WebSocket telemetry

---

## 📁 Project Structure

```
factory-dashboard/
├── start_factory.ps1          # PowerShell startup (all services)
├── start_factory.bat          # Batch wrapper
├── health_check.py            # Service health checker
├── test_integration.py        # Integration test suite
├── .env.local                 # Environment config (secrets)
├── data/
│   └── factory.db             # SQLite database
├── agent_engine/
│   ├── main.py                # FastAPI app (port 8787)
│   ├── agents/                # AI agent modules
│   │   ├── orchestrator.py    # Pipeline coordinator
│   │   ├── creator.py         # Content generation
│   │   ├── visual.py          # ComfyUI integration
│   │   ├── scout.py           # Trend research
│   │   ├── analyst.py         # Analytics & DNA evolution
│   │   ├── memory.py          # SQLite memory store
│   │   ├── posting.py         # Social publishing
│   │   └── ...
│   ├── scheduler.py           # Autonomous scheduler
│   └── requirements.txt       # Python dependencies
├── src/
│   ├── app/
│   │   ├── page.tsx           # Dashboard home
│   │   ├── api/               # Next.js API routes
│   │   │   ├── influencers/   # CRUD + image generation
│   │   │   ├── posts/         # Post management
│   │   │   ├── monitor/status/# Service health endpoint
│   │   │   ├── launcher/      # Service control
│   │   │   └── ...
│   │   ├── studio/            # AI image studio
│   │   ├── queue/             # Generation queue
│   │   ├── radar/             # Trend radar
│   │   └── ...
│   ├── components/            # React components
│   └── lib/db.ts              # SQLite connection
├── docker-compose.yml         # Optional containerized setup
└── package.json
```

---

## 🔧 Scripts

### Startup (`start_factory.ps1`)

Starts all services in order with health checks between each:

```powershell
# Full startup
.\start_factory.ps1

# Skip services that are already running
.\start_factory.ps1 -SkipComfyUI
.\start_factory.ps1 -SkipEngine -SkipDashboard

# Use CPU mode for ComfyUI
.\start_factory.ps1 -ComfyUIMode cpu
```

The script:
1. Loads `.env.local`
2. Checks if each service is already running (port check)
3. Starts ComfyUI if needed → waits for `/system_stats` response
4. Starts Agent Engine if needed → waits for `/health` response
5. Starts Dashboard if needed → waits for HTTP 200
6. Shows status summary and monitors health

### Health Check (`health_check.py`)

```powershell
# Human-readable report
python health_check.py

# JSON output
python health_check.py --json

# Wait for all core services to come up
python health_check.py --wait --timeout 120

# Check specific service
python health_check.py --service engine
```

### Integration Tests (`test_integration.py`)

```powershell
# Run all tests
python test_integration.py

# Verbose output
python test_integration.py -v

# JSON output
python test_integration.py --json

# Config-only tests (no running services needed)
python test_integration.py --skip-services
```

Tests cover:
- Database existence, schema, queries, integrity
- Python & npm dependencies
- ComfyUI connectivity and API responses
- Agent Engine health, agents list, WebSocket
- Dashboard pages and API routes

---

## 🗄️ Database

**Location:** `data/factory.db` (SQLite with WAL mode)

### Core Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `influencers` | AI influencer profiles | id, name, niche, dna_json, avatar_image_path |
| `posts` | Content calendar | id, influencer_id, caption, media_path, status, scheduled_at |
| `influencer_images` | Generated images | id, influencer_id, image_path, workflow_used |
| `influencer_memory` | Long-term learnings | influencer_id, memory_type, content, importance |
| `agent_tasks` | Async job tracking | id, agent_type, status, payload, result |
| `brand_kits` | Visual branding | influencer_id, colors, fonts, voice_tone |
| `platform_accounts` | Social connections | platform, account_id, access_token |
| `api_credentials` | Key-value config | key, value |
| `launcher_log` | Service start/stop log | service, action, pid, exit_code |

### Status Values

Posts flow through: `Idea` → `Drafted` → `Ready` → `Posted`

---

## 🔌 API Reference

### Dashboard API (Next.js, port 3000)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/influencers` | GET | List all influencers |
| `/api/influencers` | POST | Create influencer |
| `/api/influencers/[id]` | GET/PUT/DELETE | Manage single influencer |
| `/api/influencers/[id]/generate-image` | POST | Generate ComfyUI image |
| `/api/influencers/[id]/brand` | GET/PUT | Brand kit management |
| `/api/influencers/[id]/analytics` | GET | IG analytics |
| `/api/influencers/[id]/evolve` | POST | Evolve influencer DNA |
| `/api/posts/ready-to-post` | GET | Posts ready for publishing |
| `/api/posts/mark-posted` | POST | Mark post as published |
| `/api/posts/trigger-publish` | POST | Auto-publish post |
| `/api/monitor/status` | GET | Service health (Ollama, ComfyUI, n8n) |
| `/api/launcher` | GET/POST | Start/stop services |
| `/api/studio/generate` | POST | AI image generation |
| `/api/content/generate` | POST | Content generation |
| `/api/hashtags` | POST | Hashtag research |
| `/api/credentials` | GET/POST | API key management |

### Agent Engine API (FastAPI, port 8787)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health + agent list |
| `/ws/telemetry` | WS | Real-time job updates |
| `/agents/burst` | POST | Full burst session (scout→create→image→post) |
| `/agents/video-burst` | POST | Video content burst |
| `/agents/creator` | POST | Generate content from DNA |
| `/agents/scout` | POST | Research trending topics |
| `/agents/visual` | POST | Queue ComfyUI image |
| `/agents/visual/master-shot` | POST | High-fidelity character shot |
| `/agents/visual/refine` | POST | Structural refinement (I2I) |
| `/agents/visual/detail` | POST | Z-Image detailing |
| `/agents/visual/upscale` | POST | Z-Image upscaling |
| `/agents/hashtags` | POST | Hashtag research (4 tiers) |
| `/agents/hashtags/analyze-caption` | POST | Caption-aware hashtags |
| `/agents/analyst` | POST | Pull IG analytics |
| `/agents/analyst/evolve` | POST | Evolve influencer DNA |
| `/agents/memory` | GET | Get all memories (AGI brain view) |
| `/agents/memory/{id}` | GET | Get influencer memories |
| `/agents/memory` | POST | Save memory |
| `/agents/memory/search` | POST | Semantic memory search |
| `/agents/memory/sensory` | POST | Process image → sensory memory |
| `/agents/maintenance/sleep` | POST | REM consolidation cycle |
| `/agents/posting/trigger` | POST | Trigger single post |
| `/agents/posting/trigger-ready` | POST | Auto-post all ready posts |
| `/agents/jobs/{job_id}` | GET | Poll background job status |
| `/agents/tasks/{task_id}` | GET | Poll burst task progress |
| `/agents/openclaw/status` | GET | OpenClaw gateway status |
| `/agents/openclaw/fetch` | POST | Fetch URL via OpenClaw |
| `/agents/openclaw/hashtags` | POST | Scrape hashtags via OpenClaw |

### ComfyUI (port 8188)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/system_stats` | GET | GPU/VRAM/system info |
| `/queue` | GET | Current queue state |
| `/object_info` | GET | Available workflow nodes |
| `/prompt` | POST | Submit generation job |

---

## 🔑 Environment Variables (.env.local)

```bash
# Social APIs
META_APP_ID=                  # Facebook App ID
META_APP_SECRET=              # Facebook App Secret
META_USER_ACCESS_TOKEN=       # Long-lived user token

# Local AI
OLLAMA_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3.5:4b       # Local LLM model
GEMINI_API_KEY=               # Google Gemini (optional)

# Image Generation
COMFYUI_URL=http://127.0.0.1:8188
COMFYUI_BAT_GPU=C:\ComfyUI_windows_portable\run_nvidia_gpu.bat
COMFYUI_BAT_CPU=C:\ComfyUI_windows_portable\run_cpu.bat

# Automation
N8N_WEBHOOK_URL=http://localhost:5678
N8N_DIR=z:\n8n

# Engine
AGENT_ENGINE_URL=http://localhost:8787
INTERNAL_API_KEY=ai_factory_secret_2026

# OpenClaw (optional)
OPENCLAW_URL=http://127.0.0.1:18789
```

---

## 🐛 Troubleshooting

### Services won't start

```powershell
# Check what's using the ports
netstat -ano | findstr ":8188 :8787 :3000"

# Kill a stuck process
taskkill /PID <pid> /F

# Run health check to see what's down
python health_check.py
```

### ComfyUI not responding

- Check GPU driver: `nvidia-smi`
- Check VRAM: visit http://127.0.0.1:8188/system_stats
- Try CPU mode: `.\start_factory.ps1 -ComfyUIMode cpu`
- Ensure models are in `ComfyUI_windows_portable\ComfyUI\models\`

### Agent Engine crashes on startup

```powershell
# Check Python dependencies
cd agent_engine
pip install -r requirements.txt

# Run manually to see errors
python -m uvicorn main:app --host 0.0.0.0 --port 8787 --reload

# Common: missing __init__.py or import error
python -c "from agent_engine.main import app"
```

### Dashboard build errors

```powershell
# Reinstall dependencies
npm install

# Clear Next.js cache
Remove-Item -Recurse -Force .next
npm run build

# Check Node version (need 18+)
node --version
```

### Database issues

```powershell
# Check integrity
python -c "import sqlite3; conn=sqlite3.connect('data/factory.db'); print(conn.execute('PRAGMA integrity_check').fetchone()[0])"

# Backup
Copy-Item data/factory.db data/factory.db.backup

# Reinitialize (keeps data)
# Just restart the dashboard — it runs CREATE TABLE IF NOT EXISTS
```

### Ollama not found

```powershell
# Install Ollama
winget install Ollama.Ollama

# Pull the model
ollama pull qwen3.5:4b

# Verify
curl http://127.0.0.1:11434/api/tags
```

### WebSocket connection fails

- Engine must be running on port 8787
- Check firewall/antivirus isn't blocking
- The dashboard auto-reconnects — check browser console for errors

### "Cannot find module better-sqlite3"

```powershell
npm install better-sqlite3
# If still failing:
npm rebuild better-sqlite3
```

---

## 🔄 Development

```powershell
# Dev mode (hot reload)
npm run dev                    # Dashboard on :3000
cd agent_engine && python -m uvicorn main:app --reload --port 8787

# Build for production
npm run build

# Lint
npm run lint
```

---

## 📊 Monitoring

The dashboard includes built-in monitoring:

- **Monitor page** (`/api/monitor/status`) — checks Ollama, ComfyUI, n8n health
- **Launcher** (`/api/launcher`) — start/stop services from the UI
- **WebSocket** (`/ws/telemetry`) — real-time job progress updates
- **Health check** — `python health_check.py` for CLI monitoring

For production, consider running the health check on a schedule:
```powershell
# In Task Scheduler or cron
python Z:\automation\factory-dashboard\health_check.py --json >> health_log.json
```

---

## 📝 License

Private — Nexora Automations
