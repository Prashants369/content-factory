# AI Influencer Factory: Comprehensive Implementation Plan & Audit

This document outlines the full task list to bring the **AI Influencer Factory** to its "Advance Mode." It includes a systematic file audit, efficiency optimizations, and the implementation of state-of-the-art AI features.

---

## 🛠️ Phase 1: File Audit & Stability (Stability First)
- [x] **`main.py`**: 
    - [x] Move hardcoded CORS origins to `.env.local`.
    - [x] Implement a global error handler for FastAPI to return JSON errors.
    - [x] Add request logging.
- [x] **`agents/orchestrator.py`**:
    - [x] Parallelize influencer processing using `asyncio.gather`.
    - [x] Implement a retry mechanism for Visual Agent failures.
- [ ] **`agents/visual.py`**:
    - [ ] Refactor `_inject_prompt` to be more robust.
    - [ ] Add a connection pool/health check for ComfyUI.
- [x] **`agents/scout.py`**:
    - [x] Implement a caching layer for trends.

### 📂 Next.js Frontend Audit
- [x] **`src/app/page.tsx`**:
    - [x] Replace `fetch` calls with `SWR` for better caching.
- [x] **`src/app/api/video/generate/route.ts`**:
    - [x] Add input validation (Zod).
- [x] **`src/app/brain/page.tsx`**:
    - [x] Fix hardcoded Agent Engine URL.

---

## ⚡ Phase 2: Efficiency & Optimization (High Velocity)
- [x] **Asynchronous Parallelization**: Orchestrator runs all Image Generation jobs simultaneously.
- [x] **Prompt Engineering Premium**: `CreatorAgent` supports Negative Prompts.
- [x] **Model Selection**: Switch between Gemini Flash and Pro for all agents.
- [x] **Vector Search**: Memory Agent supports Semantic Retrieval using embeddings.
- [x] **Image Optimization**: Auto-resize/compress ComfyUI renders.

---

## 🧠 Phase 3: "Advance Mode" Features (Innovative Edge)
- [x] **3D AGI Brain (Three.js)**: Migration complete.
- [x] **Real-Time Telemetry**: WebSocket infrastructure implemented.
- [x] **Neural Inspector v2**: Detailed sidebar to view memory clusters and DNA evolution weights.
- [x] **Live Pulse Sync**: Make the 3D Brain nodes glow in sync with WebSocket telemetry events.
- [x] **REM Sleep (Consolidation)**: Automated nightly "synaptic pruning" of underperforming ideas.
- [x] **Multi-Agent Debate**: Two LLM personas "debate" a viral hook before execution to improve ER.
- [x] **Sensory Grounding**: Upload images for the AGI to "digest" into its memory matrix.
- [x] **Predictive Performance Shadowing**: Simulate posts through an "Audience Persona" agent.

---

## 📅 Immediate Next Steps
1. **[x] Pulse Sync**: Update `BrainVisualization3D.tsx` to listen to the telemetry WebSocket and pulse nodes.
2. **[x] Neural Inspector**: Build the React sidebar for deep node inspection.
3. **[x] REM Cycle**: Create the `/agents/maintenance/sleep` endpoint for vector consolidation.
