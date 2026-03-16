# MIRA PATEL - PRODUCTION IMAGE FACTORY

## Quick Start

```bash
# Test mode (1 image, no posting)
python production_batch.py --mode single --skip-post

# Daily generation
python production_batch.py --mode daily

# Weekly batch (7 images)
python production_batch.py --mode batch --count 7

# Continuous mode (every 3 hours)
python production_batch.py --mode continuous --interval 180

# Or use the launcher
run_factory.bat
```

## Architecture

### Pipeline
1. **SDXL Base** (JuggernautXL Ragnarok) → ~45s per image
2. **SeedVR2 Upscale** → ~60s per image (optional)
3. **Quality Validation** → Auto-retry if score < 65
4. **Instagram Posting** → Graph API auto-post

### Content Rotation
- **28-day cycle** (4 weeks of unique content)
- Each day has a different theme:
  - Week 1: Kitchen & Cooking
  - Week 2: Wellness & Lifestyle
  - Week 3: Culture & Fashion
  - Week 4: Tech & Modern Life

### Performance
- **~54 seconds** per image (SDXL fast mode)
- **~2 minutes** with SeedVR2 upscale
- **~6 minutes** for 7-image weekly batch
- **VRAM usage**: ~3.5GB (fits in 4GB RTX 3050)

## Dashboard Integration

### Next.js Dashboard
```bash
cd Z:\automation\factory-dashboard
npm run dev  # Starts on localhost:3000
```

### API Endpoints
- `POST /api/influencers/[id]/generate-image` - Generate image
- `GET /api/influencers/[id]/generate-image` - Poll completion
- `POST /api/studio/generate` - Character generation
- `GET /api/influencers` - List all influencers

### ComfyUI Workflows
- `sdxl-fast.json` - SDXL fast generation (45s)
- `flux-9b-base-v2.json` - Flux 9B premium quality (3-5min)
- `upscale-seedvr2.json` - SeedVR2 diffusion upscale (60s)

## Automation

### Windows Task Scheduler
- `Nexora-health-check` - Every 2 min, auto-restart services
- `Nexora-daily-images` - Daily 08:00 IST
- `Nexora-daily-summary` - Daily 09:00 IST
- `Nexora-boot-monitor` - On startup
- `Nexora-boot-comfyui` - On startup

### Health Monitor
```bash
node automation/health-monitor.js
```

## Files

- `production_batch.py` - Main batch generator
- `production_factory.py` - Single image factory
- `run_factory.bat` - Windows launcher
- `src/lib/comfy-templates/` - ComfyUI workflow templates
- `src/app/api/` - Next.js API routes
- `automation/` - Health monitoring and service management

## Requirements

- ComfyUI running on port 8188
- Python 3.13+
- Node.js 24+
- NVIDIA GPU with 4GB+ VRAM
- Instagram Graph API token (optional, for auto-posting)

## Models

- **SDXL**: juggernautXL_ragnarokBy.safetensors
- **Flux 2**: flux-2-klein-9b-Q4_K_M.gguf (premium)
- **Upscale**: seedvr2_ema_3b-Q4_K_M.gguf
- **VAE**: flux2-vae.safetensors