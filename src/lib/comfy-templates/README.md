# ComfyUI Pipeline Templates

## Active Workflows (4-Step Pipeline)

| Step | ID | File | Purpose |
|------|----|------|---------|
| 1 | `flux-9b-txt2img`  | `flux-9b-base-v2.json`          | Flux 9B txt2img + IPAdapter face lock |
| 2 | `flux-9b-i2i`      | `flux-9b-refine-i2i.json`       | Flux 9B img2img face consistency |
| 3 | `flux-9b-detailer` | `flux-9b-detailer-zimage.json`  | Z-Image ColorMatch + FastUnsharp |
| 4 | `seedvr2-upscaler` | `upscale-seedvr2.json`          | SeedVR2 upscale to 2048px |

## Pipeline Flow
```
User prompt
  ↓
Step 1 (flux-9b-txt2img)  → generates base image with face lock
  ↓ (optional, source_image)
Step 2 (flux-9b-i2i)      → face-consistent img2img edit
  ↓ (source_image required)
Step 3 (flux-9b-detailer) → photorealistic detail enhancement
  ↓ (source_image required)
Step 4 (seedvr2-upscaler) → 2048px diffusion upscale
```

## Template Placeholders

Each JSON template supports these placeholders:

| Placeholder | Description |
|-------------|-------------|
| `{{POSITIVE_PROMPT}}` | Full positive prompt with DNA and style tokens |
| `{{NEGATIVE_PROMPT}}` | Negative prompt from DNA |
| `{{WIDTH}}` / `{{HEIGHT}}` | Output dimensions (e.g. 1024 × 1280) |
| `{{SEED}}` | Noise seed (locked per batch for consistency) |
| `{{BASE_IMAGE}}` | Uploaded IPAdapter identity reference filename |
| `{{SOURCE_IMAGE}}` | Source image for img2img / detailer steps |
| `{{TARGET_RESOLUTION}}` | Upscale target px (SeedVR2 only) |

## LoRA Support

Steps 1 and 2 support LoRA injection via the `LoraLoaderModelOnly` node.
Place LoRA files in `ComfyUI/models/loras/` and pass the filename via the `lora` field.
