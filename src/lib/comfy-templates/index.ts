// ============================================================
// ComfyUI Workflow Template Registry — 4 Clean Production Workflows
// ============================================================
//
//  Workflow 1: flux-9b-txt2img  → Flux 2 Klein 9B + IPAdapter (face lock, txt2img)
//  Workflow 2: flux-9b-i2i      → Flux 2 Klein 9B img2img + IPAdapter (face-consistent edits)
//  Workflow 3: flux-9b-detailer → Z-Image detailer pass (ColorMatch + FastUnsharp)
//  Workflow 4: seedvr2-upscaler → SeedVR2 diffusion upscale to 2048px
//
// All workflows use {{TEMPLATE_VARIABLE}} syntax (injected by visual.py).
// ============================================================

export type WorkflowId = 'flux-9b-txt2img' | 'flux-9b-i2i' | 'flux-9b-detailer' | 'seedvr2-upscaler' | 'sdxl-fast';

export interface WorkflowTemplate {
    id: WorkflowId;
    name: string;
    description: string;
    shortDesc: string;
    templateFile: string;
    model: string;
    architecture: 'flux2-klein' | 'seedvr2' | 'sdxl';
    category: 'txt2img' | 'img2img' | 'detail' | 'upscale';
    stepNumber: 1 | 2 | 3 | 4;
    vramEstimate: string;
    speedEstimate: string;
    requiresIdentityImage: boolean;   // IPAdapter face lock (dna base_image)
    requiresSourceImage: boolean;     // Source image to be processed/chained
    supportsLora: boolean;
    variables: string[];
    quality: 1 | 2 | 3 | 4 | 5;
    nextStep?: WorkflowId;            // Which step logically follows this
    badge: string;                    // UI badge
    color: string;                    // Tailwind color class for UI
    icon: string;                     // Icon label
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
    // ─── FAST PATH: SDXL (Production Daily Driver) ───────────────
    {
        id: 'sdxl-fast',
        name: 'SDXL · Fast Generate',
        description: 'Ultra-fast SDXL generation using JuggernautXL Ragnarok. Optimized for production throughput on 4GB VRAM GPUs. ~45 seconds per image at 1216x832. Perfect for daily content.',
        shortDesc: 'SDXL fast (45s)',
        templateFile: 'sdxl-fast.json',
        model: 'juggernautXL_ragnarokBy.safetensors',
        architecture: 'sdxl',
        category: 'txt2img',
        stepNumber: 1,
        vramEstimate: '~3.5 GB',
        speedEstimate: '~45s',
        requiresIdentityImage: false,
        requiresSourceImage: false,
        supportsLora: true,
        variables: ['POSITIVE_PROMPT', 'NEGATIVE_PROMPT', 'SEED', 'WIDTH', 'HEIGHT'],
        quality: 4,
        nextStep: 'seedvr2-upscaler',
        badge: 'FAST',
        color: 'text-green-400',
        icon: '⚡',
    },

    // ─── STEP 1: BASE GENERATION ─────────────────────────────────
    {
        id: 'flux-9b-txt2img',
        name: 'Flux 9B · Generate',
        description: 'Base image generation with Flux 2 Klein 9B. IPAdapter face-locks the influencer identity from the reference image. The foundation of every content pipeline.',
        shortDesc: 'txt2img + identity lock',
        templateFile: 'flux-9b-base-v2.json',
        model: 'flux-2-klein-9b-Q4_K_M.gguf',
        architecture: 'flux2-klein',
        category: 'txt2img',
        stepNumber: 1,
        vramEstimate: '~4.5 GB',
        speedEstimate: '3–5 min',
        requiresIdentityImage: true,
        requiresSourceImage: false,
        supportsLora: true,
        variables: ['POSITIVE_PROMPT', 'NEGATIVE_PROMPT', 'SEED', 'BASE_IMAGE'],
        quality: 5,
        nextStep: 'flux-9b-detailer',
        badge: 'STEP 1',
        color: 'text-violet-400',
        icon: '⚡',
    },

    // ─── STEP 2: IMG2IMG CONSISTENCY ─────────────────────────────
    {
        id: 'flux-9b-i2i',
        name: 'Flux 9B · Refine',
        description: 'Image-to-image consistency pass. Uses IPAdapter to re-inject influencer identity while processing a source image. Perfect for outfit changes, lighting corrections, and scene edits while preserving the face.',
        shortDesc: 'img2img + face consistency',
        templateFile: 'flux-9b-refine-i2i.json',
        model: 'flux-2-klein-9b-Q4_K_M.gguf',
        architecture: 'flux2-klein',
        category: 'img2img',
        stepNumber: 2,
        vramEstimate: '~4.5 GB',
        speedEstimate: '3–5 min',
        requiresIdentityImage: true,
        requiresSourceImage: true,
        supportsLora: true,
        variables: ['POSITIVE_PROMPT', 'NEGATIVE_PROMPT', 'SEED', 'BASE_IMAGE', 'SOURCE_IMAGE'],
        quality: 5,
        nextStep: 'flux-9b-detailer',
        badge: 'STEP 2',
        color: 'text-cyan-400',
        icon: '🔄',
    },

    // ─── STEP 3: DETAILER ────────────────────────────────────────
    {
        id: 'flux-9b-detailer',
        name: 'Z-Image · Detailer',
        description: 'Z-Image detail enhancement pass. Applies hyper-realistic skin texture, micro-detail sharpening, and color matching to the reference. Runs ColorMatch + FastUnsharpSharpen after the diffusion pass.',
        shortDesc: 'Z-Image ColorMatch + Sharpen',
        templateFile: 'flux-9b-detailer-zimage.json',
        model: 'flux-2-klein-9b-Q4_K_M.gguf',
        architecture: 'flux2-klein',
        category: 'detail',
        stepNumber: 3,
        vramEstimate: '~4 GB',
        speedEstimate: '2 min',
        requiresIdentityImage: true,
        requiresSourceImage: true,
        supportsLora: false,
        variables: ['POSITIVE_PROMPT', 'NEGATIVE_PROMPT', 'SEED', 'BASE_IMAGE', 'SOURCE_IMAGE'],
        quality: 5,
        nextStep: 'seedvr2-upscaler',
        badge: 'STEP 3',
        color: 'text-emerald-400',
        icon: '✨',
    },

    // ─── STEP 4: UPSCALER ────────────────────────────────────────
    {
        id: 'seedvr2-upscaler',
        name: 'SeedVR2 · Upscale',
        description: 'Diffusion-based upscaling to 2048px using the SeedVR2 3B GGUF model. Reconstructs photorealistic detail at high resolution. Tiled VAE encoding/decoding for memory efficiency. The final export step.',
        shortDesc: 'Diffusion upscale to 2048px',
        templateFile: 'upscale-seedvr2.json',
        model: 'seedvr2_ema_3b-Q4_K_M.gguf',
        architecture: 'seedvr2',
        category: 'upscale',
        stepNumber: 4,
        vramEstimate: '~3 GB',
        speedEstimate: '2–3 min',
        requiresIdentityImage: false,
        requiresSourceImage: true,
        supportsLora: false,
        variables: ['SEED', 'IMAGE_FILENAME', 'TARGET_RESOLUTION'],
        quality: 5,
        nextStep: undefined,
        badge: 'STEP 4',
        color: 'text-amber-400',
        icon: '🚀',
    },
];

// ─── HELPER FUNCTIONS ────────────────────────────────────────────────

/** Get all 4 workflows in pipeline order */
export function getPipelineSteps(): WorkflowTemplate[] {
    return WORKFLOW_TEMPLATES.sort((a, b) => a.stepNumber - b.stepNumber);
}

/** Get a workflow by ID */
export function getWorkflowById(id: WorkflowId): WorkflowTemplate | undefined {
    return WORKFLOW_TEMPLATES.find(t => t.id === id);
}

/** Build a standard pipeline: Generate → Upscale (production speed) */
export const STANDARD_PIPELINE: WorkflowId[] = [
    'sdxl-fast',
    'seedvr2-upscaler',
];

/** Build a full quality pipeline: SDXL Fast → Upscale (daily driver) */
export const FAST_PIPELINE: WorkflowId[] = [
    'sdxl-fast',
    'seedvr2-upscaler',
];

/** Build a premium quality pipeline: Flux 9B → Detail → Upscale (hero shots) */
export const PREMIUM_PIPELINE: WorkflowId[] = [
    'flux-9b-txt2img',
    'flux-9b-detailer',
    'seedvr2-upscaler',
];

/** Build a full consistency pipeline: Generate → Refine → Detail → Upscale */
export const FULL_PIPELINE: WorkflowId[] = [
    'flux-9b-txt2img',
    'flux-9b-i2i',
    'flux-9b-detailer',
    'seedvr2-upscaler',
];

/** Model → workflow mapping */
export const MODEL_WORKFLOW_MAP: Record<string, WorkflowId[]> = {
    'juggernautXL_ragnarokBy.safetensors': ['sdxl-fast'],
    'flux-2-klein-9b-Q4_K_M.gguf': ['flux-9b-txt2img', 'flux-9b-i2i', 'flux-9b-detailer'],
    'seedvr2_ema_3b-Q4_K_M.gguf': ['seedvr2-upscaler'],
};
