import { NextResponse } from 'next/server';
import db from '@/lib/db';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
    dnaToComfyPrompt,
    getContentBoundaryNegativePrompt,
    getContentBoundaryPositiveTokens,
    filterContentTypesForBoundary,
    type ContentLevel,
} from '@/lib/characterDNA';

const COMFY_URL = process.env.COMFYUI_URL || 'http://127.0.0.1:8188';
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'generated');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// Cross-platform temp log path
const DEBUG_LOG = path.join(os.tmpdir(), 'comfy_debug.log');

// 4 canonical pipeline workflows — matches WORKFLOW_MAP in visual.py
const TEMPLATE_MAP: Record<string, string> = {
    'sdxl-fast': 'sdxl-fast.json',
    'flux-9b-txt2img': 'flux-9b-base-v2.json',
    'flux-9b-i2i': 'flux-9b-refine-i2i.json',
    'flux-9b-detailer': 'flux-9b-detailer-zimage.json',
    'seedvr2-upscaler': 'upscale-seedvr2.json',
};

async function loadComfyTemplate(
    templateId: string,
    prompt: string,
    negPrompt: string,
    width: number,
    height: number,
    contentLevel: ContentLevel,
    forcedSeed?: number, // pass a fixed seed for consistency locks
    baseImage?: string,   // relative path to base image, e.g. /generated/xyz.png
    sourceImage?: string, // relative path to source image
    loraName?: string,    // LoRA name
    stepsOverride?: number,
    cfgOverride?: number,
    configOverride?: any  // NEW: dynamic parameters from Advanced Mode
) {
    const templateName = TEMPLATE_MAP[templateId] || 'txt2img.json';
    const templatePath = path.join(process.cwd(), 'src', 'lib', 'comfy-templates', templateName);

    let rawJson = '';
    try {
        rawJson = await fs.promises.readFile(templatePath, 'utf8');
    } catch {
        // Fallback to simple dictionary if template not found
        return null;
    }

    // NSFW safety injection
    const safeTokens = getContentBoundaryPositiveTokens(contentLevel);
    const enhancedPrompt = safeTokens.length > 0 ? (prompt + ', ' + safeTokens.join(', ')) : prompt;
    const nsfwNeg = getContentBoundaryNegativePrompt(contentLevel);
    const enhancedNeg = nsfwNeg ? (nsfwNeg + ', ' + negPrompt) : negPrompt;

    // Use forced seed if provided (critical for character consistency turning), else random
    const randomSeed = forcedSeed ?? Math.floor(Math.random() * 1000000000000);
    const escPrompt = enhancedPrompt.replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
    const escNeg = enhancedNeg.replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r');

    rawJson = rawJson.replace(/\{\{POSITIVE_PROMPT\}\}/g, escPrompt);
    rawJson = rawJson.replace(/\{\{NEGATIVE_PROMPT\}\}/g, escNeg);
    rawJson = rawJson.replace(/"\{\{WIDTH(?::(\d+))?\}\}"/g, String(width));
    rawJson = rawJson.replace(/"\{\{HEIGHT(?::(\d+))?\}\}"/g, String(height));
    rawJson = rawJson.replace(/\{\{SEED(?::(\d+))?\}\}/g, String(randomSeed));

    const loraFile = loraName || 'none.safetensors';
    const loraStrength = loraName ? 0.75 : 0.0;
    rawJson = rawJson.replace(/\{\{LORA_NAME\}\}/g, loraFile.replace(/"/g, '\\"'));
    rawJson = rawJson.replace(/"\{\{LORA_STRENGTH(?::([\d.]+))?\}\}"/g, String(loraStrength));
    rawJson = rawJson.replace(/"\{\{LORA_CLIP_STRENGTH(?::([\d.]+))?\}\}"/g, String(loraStrength));

    // SeedVR2 target resolution
    rawJson = rawJson.replace(/"\{\{TARGET_RESOLUTION(?::(\d+))?\}\}"/g, String(2048));

    let uploadedImageName = 'default_empty.png';
    if (baseImage) {
        try {
            const localPath = path.join(process.cwd(), 'public', baseImage);
            if (fs.existsSync(localPath)) {
                const buffer = await fs.promises.readFile(localPath);
                const form = new FormData();
                const blob = new Blob([buffer]);
                const filename = 'base_' + Date.now() + '.png';
                form.append('image', blob, filename);
                const uploadRes = await fetch(`${COMFY_URL}/upload/image`, {
                    method: 'POST',
                    body: form as any
                });
                const uploaded = await uploadRes.json();
                if (uploaded?.name) {
                    uploadedImageName = uploaded.name;
                }
            }
        } catch (e) { console.error('Base image upload failed:', e); }
    }
    rawJson = rawJson.replace(/\{\{BASE_IMAGE\}\}/g, uploadedImageName);

    let sourceImageName = 'default_empty.png';
    if (sourceImage) {
        try {
            const localPath = path.join(process.cwd(), 'public', sourceImage);
            if (fs.existsSync(localPath)) {
                const buffer = await fs.promises.readFile(localPath);
                const form = new FormData();
                const blob = new Blob([buffer]);
                const filename = 'src_' + Date.now() + '.png';
                form.append('image', blob, filename);
                const uploadRes = await fetch(`${COMFY_URL}/upload/image`, {
                    method: 'POST',
                    body: form as any
                });
                const uploaded = await uploadRes.json();
                if (uploaded?.name) {
                    sourceImageName = uploaded.name;
                }
            }
        } catch (e) { console.error('Source image upload failed:', e); }
    }
    rawJson = rawJson.replace(/\{\{SOURCE_IMAGE\}\}/g, sourceImageName);
    rawJson = rawJson.replace(/\{\{IMAGE_FILENAME\}\}/g, sourceImageName);

    const parsed = JSON.parse(rawJson);

    // Dynamically safely override steps and cfg if requested by UI
    for (const key of Object.keys(parsed)) {
        const node = parsed[key];
        if (node?.inputs) {
            if (stepsOverride && typeof node.inputs.steps === 'number') {
                node.inputs.steps = stepsOverride;
            }
            if (cfgOverride && typeof node.inputs.cfg === 'number') {
                node.inputs.cfg = cfgOverride;
            }
            
            // Advanced Mode / Custom Workflow Overrides
            if (configOverride) {
                if (node.class_type === 'UnetLoaderGGUF' && configOverride.unet_name) node.inputs.unet_name = configOverride.unet_name;
                else if (node.class_type === 'CheckpointLoaderSimple' && configOverride.unet_name) node.inputs.ckpt_name = configOverride.unet_name;
                else if (node.class_type === 'CLIPLoaderGGUF' && configOverride.clip_name) node.inputs.clip_name = configOverride.clip_name;
                else if (node.class_type === 'VAELoader' && configOverride.vae_name) node.inputs.vae_name = configOverride.vae_name;
                else if (node.class_type === 'KSamplerSelect' && configOverride.sampler_name) node.inputs.sampler_name = configOverride.sampler_name;
            }
        }
    }

    delete parsed._meta_workflow;
    return parsed;
}

// ── POST — Generate image for an influencer (ComfyUI only) ───────────────────
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        if (!db) {
            return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
        }

        const { id } = await params;
        const body = await req.json().catch(() => ({})) as {
            content_type?: string;
            custom_prompt?: string;
            set_as_avatar?: boolean;
            workflow?: string;            // 'flux-9b-txt2img' | 'flux-9b-i2i' | 'flux-9b-detailer' | 'seedvr2-upscaler'
            library_category?: string;   // 'Face' | 'Upper Body' | 'Full Body' | 'Expression' | 'All'
            base_image?: string;         // Identity reference image path (for IPAdapter)
            source_image?: string;       // Source image for img2img/detailer/upscaler chaining
            lora?: string;               // LoRA filename e.g. 'style_v1.safetensors'
            steps?: number;
            cfg?: number;
            workflow_config?: any;       // Advanced mode overrides
        };

        const influencer = db.prepare('SELECT * FROM influencers WHERE id = ?').get(id) as any;
        if (!influencer) return NextResponse.json({ error: 'Influencer not found' }, { status: 404 });

        let dna: any = {};
        try { dna = JSON.parse(influencer.dna_json || '{}'); } catch { }

        // Fetch Brand Kit for additional context
        const brandKit = db.prepare('SELECT * FROM brand_kits WHERE influencer_id = ?').get(id) as any;

        // Get content boundary level (default to 2 = mild/fashion)
        const contentLevel: ContentLevel = dna?.content_boundary?.level || 2;

        // Filter content types based on NSFW boundary
        const allowedContentTypes = filterContentTypesForBoundary(contentLevel);
        const contentType = body.content_type && allowedContentTypes.includes(body.content_type)
            ? body.content_type
            : allowedContentTypes[Math.floor(Math.random() * allowedContentTypes.length)];

        // Resolve aspect ratio and dimensions
        const ratio = dna?.render?.suggested_aspect_ratio || '9:16';
        // Get the saved negative prompt (DNA-specific, rich anatomy+quality blocks)
        const negPrompt = dna?.render?.negative_prompt
            || 'ugly, deformed, blurry, bad anatomy, watermark, text, lowres, nsfw, extra limbs, bad hands, ' +
            'cartoon, anime, bad quality, disfigured, mutation, extra fingers, cross-eyed, artificial, plastic face';

        // Build the prompt: custom override → DNA-generated → fallback
        let comfyPrompt: string;
        if (body.custom_prompt) {
            comfyPrompt = body.custom_prompt;
        } else if (dna?.render?.comfy_prompt_base) {
            comfyPrompt = dna.render.comfy_prompt_base;
        } else {
            comfyPrompt = dnaToComfyPrompt(dna);
        }

        // ── CINEMATIC STYLE SUFFIX MATRIX ──────────────────────────────────
        // Combines niche + content level to produce specific, cinematic scene descriptors
        const nicheL = (dna?.identity?.niche || '').toLowerCase();
        const isThemePage = /cartoon|stylized|anime|illustration|2d/.test(nicheL);
        const isFashion = /fashion|glam|model|vogue|couture|luxury|editorial/.test(nicheL);
        const isFitness = /gym|fit|sport|athlet|yoga|wellness|crossfit/.test(nicheL);
        const isDark = /dark|goth|punk|rebel|villain|shadow|occult/.test(nicheL);
        const isIndian = /indian|desi|bollywood|hindi|punjabi|saree/.test(nicheL);
        const isTech = /tech|cyber|ai|code|hack|glitch|robot|sci-fi|fintech/.test(nicheL);
        const isTravel = /travel|nomad|adventure|explore|backpack/.test(nicheL);
        const isKorean = /korean|kpop|k-beauty|kdrama/.test(nicheL);
        const isMusic = /dj|rave|festival|edm|beats|music/.test(nicheL);

        let styleSuffix = '';

        if (isThemePage) {
            styleSuffix = `\n${contentType} scene, ultra-stylized high-detail 2D illustration, rich vibrant colors, clean cell shading, dynamic composition, trending on ArtStation`;
        } else if (isFashion && contentLevel >= 3) {
            styleSuffix = `\n${contentType} scene, high-fashion editorial, Vogue Italia aesthetic, Profoto Octabox soft key light, rim separation, seamless studio, designer couture outfit, story-driven visual metaphor, film look`;
        } else if (isFashion) {
            styleSuffix = `\n${contentType} scene, Vogue editorial RAW photo, clean white cyclorama backdrop, Hasselblad medium format, Profoto B10X soft key light, designer styling, impeccable composition`;
        } else if (isFitness && contentLevel >= 3) {
            styleSuffix = `\n${contentType} scene, sports editorial, outdoor golden-hour athletic setting, micro-sweat on temples, form-fitting activewear, slight motion in hair, Litemons LED panel side lighting`;
        } else if (isFitness) {
            styleSuffix = `\n${contentType} scene, sports editorial RAW photo, gym or outdoor fitness park, golden-hour natural sidelight, performance activewear, clean sharp focus`;
        } else if (isDark) {
            styleSuffix = `\n${contentType} scene, dark cinematic RAW photo, abandoned gothic environment, Rembrandt chiaroscuro lighting, volumetric fog, deep contrast shadows, moody atmospheric color grade`;
        } else if (isIndian) {
            styleSuffix = `\n${contentType} scene, cinematic Indian editorial, ornate palace courtyard or Mumbai rooftop golden hour, warm Tungsten fill, rich jewel-tone ethnic fashion, mehndi detail, Phase One medium format color grade`;
        } else if (isTech) {
            styleSuffix = `\n${contentType} scene, cyberpunk RAW photo, rain-slicked rooftop at night, practical neon sign lighting cyan and magenta, holographic screen reflections on face, futuristic techwear, anamorphic lens flare`;
        } else if (isTravel) {
            styleSuffix = `\n${contentType} scene, travel editorial RAW photo, Santorini cliffside or Bali rice terrace, natural golden-hour ambient light, relaxed travel-chic outfit, environmental storytelling wide perspective`;
        } else if (isKorean) {
            styleSuffix = `\n${contentType} scene, K-beauty editorial RAW photo, clean white minimal studio, Godox SL-60 through silk diffuser, glass-skin dewy complexion, monochromatic idol aesthetic`;
        } else if (isMusic) {
            styleSuffix = `\n${contentType} scene, festival editorial RAW photo, neon-soaked stage or DJ booth, Godox AD200 strobe with colored gels magenta and cyan, bokeh LED crowd, dramatic stage lighting`;
        } else if (contentLevel >= 3) {
            // Spicy / Sensual — hyper-realistic candid
            styleSuffix = `\n${contentType} scene, (iPhone 15 Pro Max photo:1.2), raw authentic photography, unedited mirror selfie aesthetic, natural uneven ambient light, realistic skin texture with pores visible, slight film grain, completely unfiltered, genuine candid snap`;
        } else {
            // Standard photorealism fallback
            styleSuffix = `\n${contentType} scene, RAW photo, candid lifestyle photography, golden-hour natural sidelight, highly detailed sharp focus, 8K photorealistic, cinematic color grading`;
        }

        comfyPrompt += styleSuffix;

        // ── BRAND IDENTITY INJECTION ────────────────────────────────────────
        if (brandKit) {
            let brandContext = '';
            if (brandKit.primary_color) {
                brandContext += `, accentuated by ${brandKit.primary_color} lighting accents and brand tones`;
            }
            if (brandKit.voice_tone) {
                const toneMap: Record<string, string> = {
                    'Professional': 'corporate, clean, sharp, precise, authoritative',
                    'Playful': 'upbeat, energetic, colorful, dynamic, cheerful',
                    'Sarcastic': 'edgy, cool, slightly rebellious, expressive, gritty',
                    'Empathetic': 'warm, soft, inviting, gentle, authentic lighting',
                    'Luxury': 'ostentatious, opulent, gold and silk textures, premium studio',
                    'Stoic': 'minimalist, neutral tones, powerful, calm, statuesque'
                };
                brandContext += `, ${toneMap[brandKit.voice_tone] || brandKit.voice_tone.toLowerCase()} mood`;
            }
            if (brandKit.signature_catchphrase) {
                // Use catchphrase to flavor the overall vibe
                brandContext += `, themed around "${brandKit.signature_catchphrase}"`;
            }
            comfyPrompt += brandContext;
        }

        const filterCategory = body.library_category || null;
        let width = 1024;
        let height = 1280;

        if (!filterCategory) {
            const [rw, rh] = ratio.split(':').map(Number);
            width = rw >= rh ? 1024 : Math.round(1024 * (rw / rh) / 64) * 64;
            height = rh >= rw ? 1024 : Math.round(1024 * (rh / rw) / 64) * 64;
        }

        const modelObj = dna?.render?.preferred_model || 'juggernautXL_ragnarokBy.safetensors';

        // Verify ComfyUI is running
        try {
            const ping = await fetch(`${COMFY_URL}/system_stats`, { signal: AbortSignal.timeout(3000) });
            if (!ping.ok) throw new Error('NOPING');
        } catch {
            db.prepare("UPDATE influencers SET image_status = 'error' WHERE id = ?").run(id);
            return NextResponse.json({
                error: 'ComfyUI not running at port 8188. Start ComfyUI first.',
                tip: 'Launch ComfyUI from the portable installation, then retry.'
            }, { status: 503 });
        }
        const promptIds: string[] = [];

        // 20 professionally categorized angles for a LoRA Training Dataset
        // Each has: category (for gallery sections), angle description, prompt suffix
        const LORA_ANGLES: { category: string; label: string; prompt: string }[] = [
            // ── FACE CLOSE-UPS (5) ──────────────────────────────────────
            { category: 'Face', label: 'Front Portrait', prompt: 'extreme close-up portrait, dead center front view, looking directly at camera, neutral relaxed expression, perfect symmetry' },
            { category: 'Face', label: 'Side Profile', prompt: 'perfect side profile, 90 degree angle, looking away, chin slightly raised, clean side silhouette' },
            { category: 'Face', label: '3/4 Angle', prompt: 'three-quarter face angle, 45 degrees to camera, soft natural smile, slight head turn' },
            { category: 'Face', label: 'Low Angle', prompt: 'close-up portrait, low camera angle looking up, powerful expression, slight chin tilt down, dramatic perspective' },
            { category: 'Face', label: 'High Angle', prompt: 'close-up portrait, high camera angle looking down, soft innocent expression, eyes looking up at camera' },

            // ── UPPER BODY (5) ───────────────────────────────────────────
            { category: 'Upper Body', label: 'Front Upper', prompt: 'medium shot, upper body, front view, arms relaxed at sides, looking at camera, clean posture' },
            { category: 'Upper Body', label: 'Side Upper', prompt: 'medium shot, upper body, 90 degree side view, looking forward, hands visible, natural standing pose' },
            { category: 'Upper Body', label: '3/4 Upper', prompt: 'medium shot, upper body, 45 degree three-quarter view, slight body twist toward camera, confident pose' },
            { category: 'Upper Body', label: 'Back Upper', prompt: 'medium shot, upper body, rear view from behind, looking over right shoulder back at camera, hair visible' },
            { category: 'Upper Body', label: 'Hands Detail', prompt: 'medium close-up, upper body, front view, hands raised near face or chin, thoughtful editorial pose' },

            // ── FULL BODY (5) ────────────────────────────────────────────
            { category: 'Full Body', label: 'Front Standing', prompt: 'full body shot, front view, standing straight, feet visible, arms at sides, clean white background, studio lighting' },
            { category: 'Full Body', label: 'Back Standing', prompt: 'full body shot, rear back view, standing, looking over shoulder, symmetrical, full length' },
            { category: 'Full Body', label: 'Side Standing', prompt: 'full body shot, perfect 90 degree side profile, standing, full length silhouette' },
            { category: 'Full Body', label: 'Sitting', prompt: 'full body shot, sitting on imaginary stool or chair, front view, relaxed posture, legs visible' },
            { category: 'Full Body', label: 'Walking', prompt: 'full body shot, walking towards camera, mid-stride, natural motion, slight smile, dynamic energy' },

            // ── EXPRESSIONS (5) ──────────────────────────────────────────
            { category: 'Expression', label: 'Smile', prompt: 'medium close-up portrait, genuine wide smile showing teeth, happy joyful expression, eyes crinkled, natural warmth' },
            { category: 'Expression', label: 'Serious', prompt: 'medium close-up portrait, intense serious expression, strong eye contact, slight jaw tension, powerful presence' },
            { category: 'Expression', label: 'Candid', prompt: 'medium shot, candid laughing expression, head slightly tilted, eyes partially closed in laughter, genuine emotion' },
            { category: 'Expression', label: 'Fierce', prompt: 'medium close-up, fierce confident expression, raised eyebrow, direct eye contact, boss energy, slightly pouty' },
            { category: 'Expression', label: 'Neutral Calm', prompt: 'tight close-up portrait, perfectly neutral calm expression, mouth relaxed closed, soft eyes, serenity, ideal for LoRA face reference' },
        ];

        // Update status
        db.prepare("UPDATE influencers SET image_status = 'rendering' WHERE id = ?").run(id);

        // Auto-select best workflow:
        // - Library mode: always use identity-master
        // - Single portrait: use DNA's preferred workflow, fallback to Identity Master
        const dnaPreferredWorkflow = dna?.render?.preferred_workflow || 'flux-9b-txt2img';
        const avatarImage = body.base_image || influencer.avatar_image_path || influencer.generated_image_path;
        const sourceImage = body.source_image || '';
        
        let workflowId = filterCategory ? 'flux-9b-txt2img' : (body.workflow || dnaPreferredWorkflow);
        let configOverride = body.workflow_config || null;

        // See if workflow is a custom workflow
        try {
            const customWf = db.prepare('SELECT * FROM custom_workflows WHERE id = ?').get(workflowId) as any;
            if (customWf) {
                workflowId = customWf.base_template;
                configOverride = JSON.parse(customWf.config_json);
            }
        } catch (err: any) {
            console.warn('Could not fetch custom workflow:', err.message);
        }

        let anglesToGenerate = filterCategory
            ? (filterCategory === 'All' ? LORA_ANGLES : LORA_ANGLES.filter(a => a.category === filterCategory))
            : [];

        if (filterCategory) {
            // Smart generation: only generate angles that don't yet exist in the DB
            const existingImages = db.prepare('SELECT angle FROM influencer_images WHERE influencer_id = ? AND image_type = ?').all(id, 'library') as any[];
            const existingAngles = new Set(existingImages.map(img => img.angle));

            anglesToGenerate = anglesToGenerate.filter(a => !existingAngles.has(`${a.category}::${a.label}`));

            if (anglesToGenerate.length === 0) {
                // Set status back to done if it was stuck on rendering
                db.prepare("UPDATE influencers SET image_status = 'done' WHERE id = ?").run(id);
                return NextResponse.json({ message: "All angles for this category are already generated.", success: true, status: 'done' });
            }
        }

        const batchCount = filterCategory ? anglesToGenerate.length : 1;

        for (let i = 0; i < batchCount; i++) {
            const angleData = filterCategory ? anglesToGenerate[i] : null;
            let finalPrompt = comfyPrompt;
            if (angleData) {
                // Add face-lock tokens and specific angle direction
                finalPrompt = [
                    comfyPrompt,
                    angleData.prompt,
                    'SAME IDENTITY same person same face, consistent facial features, consistent skin tone, consistent hair,',
                    'plain white studio background, professional studio lighting, crisp sharp focus'
                ].join('\n');
            }

            // Always apply the avatar for identity lock if available (IPAdapter uses it)
            const useBaseImage = avatarImage;
            // Generate a random seed per shot to prevent the noise from locking the structural pose
            const shotSeed = Math.floor(Math.random() * 1000000000000);

            let workflow = await loadComfyTemplate(
                workflowId,
                finalPrompt,
                negPrompt,
                width,
                height,
                contentLevel,
                shotSeed,
                useBaseImage,
                sourceImage,
                body.lora || (dna?.render?.lora_tags?.[0] || ''),
                body.steps,
                body.cfg,
                configOverride
            );

            if (!workflow) {
                // Hardcoded safety fallback if JSON template missing
                workflow = {
                    "3": {
                        "inputs": { "seed": Math.floor(Math.random() * 1000000000000), "steps": 25, "cfg": 7, "sampler_name": "dpmpp_2m", "scheduler": "karras", "denoise": 1, "model": ["4", 0], "positive": ["6", 0], "negative": ["7", 0], "latent_image": ["5", 0] },
                        "class_type": "KSampler"
                    },
                    "4": { "inputs": { "ckpt_name": modelObj }, "class_type": "CheckpointLoaderSimple" },
                    "5": { "inputs": { "width": width, "height": height, "batch_size": 1 }, "class_type": "EmptyLatentImage" },
                    "6": { "inputs": { "text": comfyPrompt, "clip": ["4", 1] }, "class_type": "CLIPTextEncode" },
                    "7": { "inputs": { "text": negPrompt, "clip": ["4", 1] }, "class_type": "CLIPTextEncode" },
                    "8": { "inputs": { "samples": ["3", 0], "vae": ["4", 2] }, "class_type": "VAEDecode" },
                    "9": { "inputs": { "filename_prefix": "dna_gen", "images": ["8", 0] }, "class_type": "SaveImage" }
                };
            }

            const queueRes = await fetch(`${COMFY_URL}/prompt`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: workflow })
            });

            if (queueRes.ok) {
                const { prompt_id } = await queueRes.json();
                promptIds.push(prompt_id);
                // Track with category + label for organized gallery display
                db.prepare(`INSERT INTO comfyui_jobs (prompt_id, influencer_id, image_type, angle) VALUES (?, ?, ?, ?)`).run(
                    prompt_id, id,
                    filterCategory ? 'library' : 'content',
                    angleData ? `${angleData.category}::${angleData.label}` : null
                );
            } else {
                const errText = await queueRes.text();
                const logMsg = `[${new Date().toISOString()}] [ComfyUI] Failed to queue job. Status: ${queueRes.status}, Error: ${errText}\n`;
                try { fs.appendFileSync(DEBUG_LOG, logMsg); } catch { /* non-fatal */ }
                console.error(logMsg);
            }
        }

        if (promptIds.length === 0) {
            db.prepare("UPDATE influencers SET image_status = 'error' WHERE id = ?").run(id);
            return NextResponse.json({ error: 'Failed to queue in ComfyUI' }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            prompt_id: promptIds[0], // primary for backwards compat
            prompt_ids: promptIds,
            status: 'rendering',
            content_type: contentType,
            content_level: contentLevel,
            nsfw_boundary: `Level ${contentLevel}`,
            set_as_avatar: body.set_as_avatar || false,
        });
    } catch (err: any) {
        console.error("GENERATE IMAGE ERROR:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// ── GET — Poll ComfyUI completion ────────────────────────────────────────────
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        if (!db) {
            return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
        }

        const { id } = await params;
    const { searchParams } = new URL(req.url);
    const setAsAvatar = searchParams.get('set_avatar') === 'true';

    const influencer = db.prepare('SELECT * FROM influencers WHERE id = ?').get(id) as any;
    if (!influencer) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Find all outstanding jobs in the database for this influencer
    const jobs = db.prepare('SELECT prompt_id, image_type, angle FROM comfyui_jobs WHERE influencer_id = ?').all(id) as Array<{ prompt_id: string, image_type: string, angle: string | null }>;

    if (jobs.length === 0) {
        return NextResponse.json({ status: influencer.image_status || 'none' });
    }

    let processedCount = 0;
    const newlyProcessedPaths: string[] = [];

    for (const job of jobs) {
        try {
            const histRes = await fetch(`${COMFY_URL}/history/${job.prompt_id}`);
            if (!histRes.ok) continue; // Still rendering

            const hist = await histRes.json();
            const record = hist[job.prompt_id];

            // If the job errored out in ComfyUI, remove it from the queue so we don't block forever
            if (record?.status?.status_str === 'error' || record?.error) {
                db.prepare('DELETE FROM comfyui_jobs WHERE prompt_id = ?').run(job.prompt_id);
                continue;
            }

            if (!record?.outputs) continue; // Not finished

            let filename: string | null = null;
            for (const nodeId of Object.keys(record.outputs)) {
                const imgs = record.outputs[nodeId]?.images;
                if (imgs?.[0]) { filename = imgs[0].filename; break; }
            }
            if (!filename) {
                // finished but no file? remove to prevent infinite loop
                db.prepare('DELETE FROM comfyui_jobs WHERE prompt_id = ?').run(job.prompt_id);
                continue;
            }

            const viewRes = await fetch(`${COMFY_URL}/view?filename=${encodeURIComponent(filename)}&type=output`);
            if (!viewRes.ok) continue;

            const buffer = Buffer.from(await viewRes.arrayBuffer());
            const isUpscaled = job.image_type?.includes('upscale') ? '_upscaled' : '';
            const randomSuffix = crypto.randomUUID().split('-')[0];
            const saveName = `comfy_${id}_${Date.now()}_${randomSuffix}${isUpscaled}.png`;
            fs.writeFileSync(path.join(OUTPUT_DIR, saveName), buffer);
            const publicPath = `/generated/${saveName}`;

            // Save to influencer record (always update the latest generated image so UI feels responsive)
            db.prepare("UPDATE influencers SET generated_image_path = ? WHERE id = ?").run(publicPath, id);

            // Set Avatar if requested, or if none exists
            if (setAsAvatar || !influencer.avatar_image_path) {
                db.prepare("UPDATE influencers SET avatar_image_path = ? WHERE id = ?")
                    .run(publicPath, id);
                influencer.avatar_image_path = publicPath;
            }

            // Save to images gallery — carry over the angle label from the job
            const imgId = 'img_' + crypto.randomUUID();
            db.prepare(`INSERT INTO influencer_images (id, influencer_id, image_path, image_type, angle, workflow_used)
                         VALUES (?, ?, ?, ?, ?, 'comfyui')`)
                .run(imgId, id, publicPath, job.image_type || 'content', job.angle || null);

            // Remove from job queue
            db.prepare('DELETE FROM comfyui_jobs WHERE prompt_id = ?').run(job.prompt_id);

            processedCount++;
            newlyProcessedPaths.push(publicPath);
        } catch (e: any) {
            console.error(`Failed parsing history for job ${job.prompt_id}`, e.message);
        }
    }

    const remainingJobs = jobs.length - processedCount;

    // Only set status back to 'done' when the queue is fully cleared
    if (remainingJobs === 0 && influencer.image_status !== 'done') {
        db.prepare("UPDATE influencers SET image_status = 'done' WHERE id = ?").run(id);
    }

    return NextResponse.json({
        status: remainingJobs > 0 ? 'rendering' : 'done',
        message: `Processed ${processedCount} images. ${remainingJobs} remaining.`,
        latest_images: newlyProcessedPaths
    });
    } catch (err: any) {
        console.error("POLL IMAGE ERROR:", err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}
