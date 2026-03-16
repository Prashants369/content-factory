// ============================================================
// Full Biometric + Psychological Character DNA Schema
// ============================================================

// ── PERSONALITY FRAMEWORKS ──────────────────────────────────

export interface OceanProfile {
    // The Big Five — most validated scientific personality model
    // Each 0–100 (0 = extremely low, 100 = extremely high)
    openness: number;           // Creativity, curiosity, imagination vs. routine-loving
    conscientiousness: number;  // Organized, disciplined, reliable vs. spontaneous
    extraversion: number;       // Sociable, assertive, talkative vs. reserved
    agreeableness: number;      // Cooperative, trusting, empathetic vs. competitive
    neuroticism: number;        // Anxious, moody, sensitive vs. emotionally stable
}

export interface MBTIProfile {
    // Myers-Briggs 16 Types
    type: 'INTJ' | 'INTP' | 'ENTJ' | 'ENTP' | 'INFJ' | 'INFP' | 'ENFJ' | 'ENFP' |
    'ISTJ' | 'ISFJ' | 'ESTJ' | 'ESFJ' | 'ISTP' | 'ISFP' | 'ESTP' | 'ESFP';
    // Raw dimension scores 0–100
    energy: number;             // 0=pure Introvert … 100=pure Extravert
    information: number;        // 0=pure Sensing  … 100=pure iNtuition
    decisions: number;          // 0=pure Thinking … 100=pure Feeling
    lifestyle: number;          // 0=pure Judging  … 100=pure Perceiving
}

export interface EnneagramProfile {
    type: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
    // Type labels for reference
    // 1=Perfectionist, 2=Helper, 3=Achiever, 4=Individualist
    // 5=Investigator, 6=Loyalist, 7=Enthusiast, 8=Challenger, 9=Peacemaker
    wing: number;               // Adjacent type that flavours the core
    instinct: 'self-preservation' | 'social' | 'sexual'; // Instinctual drive
    stress_direction: number;   // Which type they disintegrate to under stress
    growth_direction: number;   // Which type they grow toward when healthy
}

export interface DarkTriadProfile {
    // Optional — useful for antiheroes, femme fatales, complex villains
    // 0=not present, 100=extreme
    narcissism: number;         // Self-admiration, entitlement
    machiavellianism: number;   // Manipulation, strategic cunning
    psychopathy: number;        // Lack of empathy, impulsivity
}

export interface CommunicationStyle {
    vocabulary_level: 'simple' | 'conversational' | 'articulate' | 'academic' | 'poetic';
    humor_type: 'none' | 'dry' | 'sarcastic' | 'wholesome' | 'absurdist' | 'dark';
    emotional_expression: 'suppressed' | 'controlled' | 'moderate' | 'expressive' | 'dramatic';
    speaking_pace: 'slow' | 'measured' | 'natural' | 'fast' | 'rapid-fire';
    primary_language_patterns: string[];  // e.g. ["uses rhetorical questions", "heavy on metaphors"]
    recurring_phrases: string[];          // e.g. ["literally", "honestly though"]
    topics_they_love: string[];
    topics_they_avoid: string[];
}

export interface SocialMediaAlgorithm {
    // HOW she behaves on social media — drives the content engine
    posting_frequency_per_week: number;                   // 1–21
    best_posting_times: string[];                          // e.g. ["07:00", "19:00", "22:00"]
    content_mix: {                                         // must sum to 100
        lifestyle: number;
        educational: number;
        promotional: number;
        behind_scenes: number;
        controversial: number;
        interactive: number;  // polls, Q&A
    };
    engagement_style: 'ignores_all' | 'selective' | 'replies_to_top_fans' | 'replies_to_everyone';
    controversy_tolerance: number;     // 0=avoids drama … 100=loves controversy
    brand_deal_openness: number;       // 0=refuses all … 100=takes everything
    authenticity_score: number;        // 0=pure performance … 100=fully authentic
    growth_strategy: 'viral_bait' | 'niche_authority' | 'collab_farming' | 'consistency' | 'shock_value';
    caption_style: 'ultra_short' | 'one_liner' | 'paragraph' | 'storytelling' | 'emoji_heavy';
    hook_type: 'question' | 'bold_claim' | 'relatability' | 'curiosity_gap' | 'controversy';
    platform_priority: ('Instagram' | 'TikTok' | 'YouTube' | 'Twitter' | 'OnlyFans')[];
}

// ── CONTENT BOUNDARY (NSFW LEVELS) ─────────────────────────────

export type ContentLevel = 1 | 2 | 3 | 4 | 5;

export interface ContentBoundary {
    // Level 1: SFW — fully clothed, family-friendly, no suggestive content
    // Level 2: Mild — bikini, crop tops, form-fitting, fashion-forward
    // Level 3: Suggestive — lingerie, provocative poses, implied sensuality
    // Level 4: Mature — artistic nudity, explicit posing, body-focused
    // Level 5: Explicit — no restrictions, fully NSFW
    level: ContentLevel;
    // Allowed content platforms (auto-restricted based on level)
    allowed_platforms: string[];
    // Additional custom restrictions
    custom_restrictions: string[];   // e.g. ["no alcohol", "no violence"]
    // Whether face must always be visible (for brand safety)
    face_always_visible: boolean;
}

// ── FULL DNA ─────────────────────────────────────────────────

export interface CharacterDNA {
    // === IDENTITY ===
    identity: {
        name: string;
        age: number;
        gender: 'female' | 'male' | 'non-binary' | 'other';
        ethnicity: string;
        niche: string;
        backstory: string;
        core_values: string[];   // e.g. ["freedom", "authenticity", "power"]
        fears: string[];          // e.g. ["being ignored", "mediocrity"]
        goals: string[];          // e.g. ["1M followers in 6 months", "brand deal with Gucci"]
    };

    // === VIRAL STRATEGY ===
    viral_strategy: {
        primary_hook_archetype: 'The Contrarian' | 'The Expert' | 'The Relatable Mess' | 'The Mystery' | 'The Shock Factor';
        aesthetic_trigger: string;
        content_format_focus: 'Fast-paced edits' | 'Aesthetic vlogs' | 'Direct-to-camera storytelling' | 'POV skits';
        monetization_angle: 'Digital products' | 'Brand sponsorships' | 'Subscription / OF' | 'Merch / E-commerce';
        viral_phrase_template: string;

        // Mathematical / Algorithmic Precision parameters
        visual_composition_rules: string;
        color_contrast_ratio: string;
        target_retention_curve: string;
        pacing_bpm: number;
        reading_grade_level: number;

        // Market & Economics (Monetization focus)
        market_focus: 'Global' | 'India' | 'US/Europe' | 'Asia-Pacific';
        target_cpm: number; // Estimated CPM in USD
        psychological_hooks: string[]; // e.g. ["Status Signaling", "FOMO", "Escapism"]
        platform_priority: ('Instagram' | 'Pinterest' | 'Patreon' | 'TikTok' | 'YouTube')[];
    };

    // === CONTENT BOUNDARY (NSFW) ===
    content_boundary: ContentBoundary;

    // === PERSONALITY ENGINE ===
    personality: {
        ocean: OceanProfile;
        mbti: MBTIProfile;
        enneagram: EnneagramProfile;
        dark_triad: DarkTriadProfile;
        communication: CommunicationStyle;
        social_algorithm: SocialMediaAlgorithm;
    };

    // === FACE GEOMETRY (in cm unless noted) ===
    face: {
        shape: 'oval' | 'round' | 'square' | 'heart' | 'diamond' | 'oblong' | 'triangle';
        symmetry_score: number;
        total_height: number;
        total_width: number;
        forehead_height: number;
        forehead_width: number;
        cheekbone_width: number;
        jaw_width: number;
        chin_height: number;
        chin_shape: 'pointed' | 'rounded' | 'square' | 'cleft';
        eye_color: string;
        eye_shape: 'almond' | 'round' | 'hooded' | 'monolid' | 'upturned' | 'downturned';
        eye_size: number;
        eye_spacing: number;
        brow_thickness: 'thin' | 'medium' | 'thick' | 'bushy';
        brow_arch: 'flat' | 'soft' | 'medium' | 'high';
        nose_length: number;
        nose_width: number;
        nose_bridge_height: 'low' | 'medium' | 'high';
        nose_tip: 'upturned' | 'downturned' | 'bulbous' | 'pointed' | 'flat';
        lip_upper_thickness: number;
        lip_lower_thickness: number;
        lip_width: number;
        lip_fullness: 'thin' | 'medium' | 'full' | 'very_full';
        skin_tone: string;
        skin_texture: 'smooth' | 'natural' | 'textured';
        skin_undertone: 'warm' | 'cool' | 'neutral';
        freckles: boolean;
        birthmarks: string;
    };

    // === HAIR ===
    hair: {
        color: string;
        highlight_color: string;
        length: 'buzz' | 'short' | 'chin' | 'shoulder' | 'mid_back' | 'waist' | 'hip';
        texture: 'straight' | 'wavy' | 'curly' | 'coily';
        density: 'thin' | 'medium' | 'thick';
        style: string;
    };

    // === BODY MEASUREMENTS (cm) ===
    body: {
        height_cm: number;
        weight_kg: number;
        body_type: 'ectomorph' | 'mesomorph' | 'endomorph' | 'hourglass' | 'pear' | 'apple' | 'rectangle';
        bust_cm: number;
        waist_cm: number;
        hips_cm: number;
        shoulder_width_cm: number;
        arm_length_cm: number;
        leg_length_cm: number;
        neck_circumference_cm: number;
        wrist_circumference_cm: number;
        foot_size_eu: number;
        muscle_tone: 'very_lean' | 'lean' | 'athletic' | 'curvy' | 'soft' | 'strong';
    };

    // === STYLE & AESTHETIC ===
    style: {
        primary_aesthetic: string;
        color_palette: string[];
        clothing_era: string;
        accessories: string[];
        makeup_style: 'bare' | 'natural' | 'glam' | 'editorial' | 'avant_garde' | 'theatrical';
        tattoos: string;
        piercings: string;
    };

    // === COMFYUI RENDERING CONFIG ===
    render: {
        comfy_prompt_base: string;
        negative_prompt: string;
        preferred_model: string;
        preferred_workflow: string;    // workflow template ID from comfy-templates
        lora_tags: string[];
        suggested_aspect_ratio: '1:1' | '4:5' | '9:16' | '16:9';
    };
}

// ── DEFAULTS ─────────────────────────────────────────────────

export const BLANK_DNA: CharacterDNA = {
    identity: {
        name: '',
        age: 24,
        gender: 'female',
        ethnicity: '',
        niche: '',
        backstory: '',
        core_values: [],
        fears: [],
        goals: []
    },
    viral_strategy: {
        primary_hook_archetype: 'The Expert',
        aesthetic_trigger: 'Clean luxury minimalist',
        content_format_focus: 'Aesthetic vlogs',
        monetization_angle: 'Brand sponsorships',
        viral_phrase_template: 'Here is what nobody tells you about...',
        visual_composition_rules: 'Golden Ratio, Subject center-weighted at 33%',
        color_contrast_ratio: '4.5:1 High Contrast',
        target_retention_curve: '3s shock -> 15s build -> 0.5s loop reset',
        pacing_bpm: 120,
        reading_grade_level: 6,
        market_focus: 'India',
        target_cpm: 2.5,
        psychological_hooks: ['Status Signaling', 'Curiosity'],
        platform_priority: ['Instagram', 'Pinterest', 'Patreon'],
    },
    content_boundary: {
        level: 2,
        allowed_platforms: ['Instagram', 'TikTok'],
        custom_restrictions: [],
        face_always_visible: true,
    },
    personality: {
        ocean: { openness: 70, conscientiousness: 60, extraversion: 65, agreeableness: 55, neuroticism: 40 },
        mbti: { type: 'ENFP', energy: 70, information: 65, decisions: 55, lifestyle: 60 },
        enneagram: { type: 3, wing: 4, instinct: 'social', stress_direction: 9, growth_direction: 6 },
        dark_triad: { narcissism: 35, machiavellianism: 20, psychopathy: 10 },
        communication: {
            vocabulary_level: 'conversational',
            humor_type: 'dry',
            emotional_expression: 'expressive',
            speaking_pace: 'natural',
            primary_language_patterns: [],
            recurring_phrases: [],
            topics_they_love: [],
            topics_they_avoid: []
        },
        social_algorithm: {
            posting_frequency_per_week: 7,
            best_posting_times: ['07:30', '12:00', '20:00'],
            content_mix: { lifestyle: 30, educational: 15, promotional: 15, behind_scenes: 20, controversial: 5, interactive: 15 },
            engagement_style: 'replies_to_top_fans',
            controversy_tolerance: 40,
            brand_deal_openness: 60,
            authenticity_score: 70,
            growth_strategy: 'niche_authority',
            caption_style: 'one_liner',
            hook_type: 'curiosity_gap',
            platform_priority: ['Instagram', 'TikTok']
        }
    },
    face: {
        shape: 'oval', symmetry_score: 85, total_height: 18.5, total_width: 13.5,
        forehead_height: 5.5, forehead_width: 12.0, cheekbone_width: 13.5, jaw_width: 11.0,
        chin_height: 3.0, chin_shape: 'rounded',
        eye_color: 'brown', eye_shape: 'almond', eye_size: 11, eye_spacing: 3.2,
        brow_thickness: 'medium', brow_arch: 'soft',
        nose_length: 4.5, nose_width: 3.2, nose_bridge_height: 'medium', nose_tip: 'pointed',
        lip_upper_thickness: 7, lip_lower_thickness: 9, lip_width: 5.0, lip_fullness: 'medium',
        skin_tone: 'warm ivory', skin_texture: 'smooth', skin_undertone: 'warm',
        freckles: false, birthmarks: 'none'
    },
    hair: { color: 'dark brown', highlight_color: 'none', length: 'shoulder', texture: 'wavy', density: 'medium', style: 'loose waves' },
    body: {
        height_cm: 170, weight_kg: 58, body_type: 'hourglass',
        bust_cm: 88, waist_cm: 68, hips_cm: 92,
        shoulder_width_cm: 38, arm_length_cm: 60, leg_length_cm: 88,
        neck_circumference_cm: 33, wrist_circumference_cm: 15, foot_size_eu: 38,
        muscle_tone: 'lean'
    },
    style: {
        primary_aesthetic: '', color_palette: [], clothing_era: 'contemporary',
        accessories: [], makeup_style: 'natural', tattoos: 'none', piercings: 'ear lobes'
    },
    render: {
        comfy_prompt_base: '',
        negative_prompt: 'ugly, deformed, blurry, disfigured, bad anatomy, watermark, text, lowres',
        preferred_model: 'juggernautXL_ragnarokBy.safetensors',
        preferred_workflow: 'flux-9b-txt2img',
        lora_tags: [],
        suggested_aspect_ratio: '9:16'
    }
};

// ── OCEAN → ARCHETYPE DERIVER ─────────────────────────────────

export function deriveArchetype(ocean: OceanProfile): string {
    const { openness: O, conscientiousness: C, extraversion: E, agreeableness: A, neuroticism: N } = ocean;
    if (E > 70 && O > 70) return 'The Visionary — charismatic, idea-driven, inspires others through passion';
    if (E > 70 && A > 70) return 'The Connector — warm, magnetic, everyone loves her, loves everyone';
    if (E > 70 && N > 60) return 'The Performer — attention-seeking, intense, volatile but captivating';
    if (E < 30 && O > 70) return 'The Mystic — quiet depth, artistic soul, followers project meaning onto her';
    if (C > 80 && A < 40) return 'The Strategist — calculated, precise, builds empire through relentless work';
    if (N > 70 && O > 60) return 'The Artist — emotional, unpredictable, raw authenticity drives viral moments';
    if (A > 80 && E > 50) return 'The Empath — nurturing brand, community-first, high trust, low controversy';
    if (O < 30 && C > 70) return 'The Authority — consistent, reliable, niche expert, authority positioning';
    return 'The Hybrid — balanced across traits, adapts to context and audience needs';
}

export function oceanToCaption(ocean: OceanProfile): string {
    const style = ocean.extraversion > 60 ? 'energetic, personal' : 'thoughtful, reserved';
    const depth = ocean.openness > 60 ? 'creative, metaphorical' : 'direct, concrete';
    const warmth = ocean.agreeableness > 60 ? 'inclusive "we" language' : 'empowering "you" language';
    return `Tends toward ${style} tone, ${depth} word choices, and ${warmth}`;
}

// ── PERSONALITY → PROMPT MODIFIERS ─────────────────────────────────────────

export function personalityToPromptTokens(dna: CharacterDNA): string[] {
    const p = dna.personality;
    const tokens: string[] = [];
    const { openness: O, conscientiousness: C, extraversion: E, agreeableness: A, neuroticism: N } = p.ocean;
    const { narcissism: Narc, psychopathy: Psyc } = p.dark_triad;
    const mbti = p.mbti.type;
    const niche = dna.identity.niche.toLowerCase();

    // ── Pose & Expression (driven by Extraversion + Neuroticism) ──
    if (E > 75) tokens.push('confident direct gaze into lens', 'bold open posture', 'radiant magnetic expression');
    else if (E > 55) tokens.push('relaxed natural pose', 'genuine soft smile', 'approachable demeanor');
    else if (E > 35) tokens.push('subtle introspective expression', 'gaze slightly off-camera', 'thoughtful look');
    else tokens.push('mysterious averted gaze', 'reserved composed stillness', 'quiet intensity');

    if (N > 70) tokens.push('intense emotional depth in eyes', 'raw expressive face', 'visible inner tension');
    else if (N < 25) tokens.push('serene unshakeable calm', 'grounded stillness', 'zen-like composure');

    // ── Energy & Power (Dark Triad + Conscientiousness) ──
    if (Narc > 65) tokens.push('commanding magazine-cover presence', 'unapologetic power pose', 'alpha energy');
    if (Psyc > 55) tokens.push('cold penetrating stare', 'controlled predatory aura', 'calculated stillness');
    if (C > 78) tokens.push('flawlessly precise elegant posture', 'impeccable grooming', 'disciplined bearing');

    // ── Openness → Artistic/Creative Styling ──
    if (O > 78) tokens.push('avant-garde experimental styling', 'bold artistic composition', 'creative risk-taking outfit');
    else if (O < 30) tokens.push('classic structured composition', 'clean traditional framing', 'timeless wardrobe');

    // ── MBTI cognitive energy ──
    if (mbti.startsWith('E') && mbti[2] === 'F') tokens.push('warm radiant approachability', 'inviting open smile', 'heart-forward energy');
    if (mbti.startsWith('I') && mbti[2] === 'T') tokens.push('analytical intelligent expression', 'sharp laser-focused eyes', 'cerebral stillness');
    if (mbti.includes('NJ')) tokens.push('visionary determined look', 'eyes on a distant horizon');
    if (mbti.startsWith('E') && mbti[2] === 'T') tokens.push('high-intensity ambition', 'assertive jaw-forward tilt', 'unstoppable drive');

    // ── Agreeableness → Warmth vs Sharpness ──
    if (A > 72) tokens.push('radiating warmth and genuine care', 'inviting open body language');
    else if (A < 30) tokens.push('sharp detached edge', 'unapproachable cool', 'lone wolf energy');

    // ── Niche-specific environment, camera, & lighting ──────────────────────
    if (/gym|fit|sport|athlet|wellness|yoga|crossfit|pilates/.test(niche)) {
        tokens.push(
            'modern gym or outdoor fitness park setting',
            'Litemons LED panel athletic lighting with slight lens flare',
            'performance activewear, form-fitting',
            'post-workout golden-hour glow, micro sweat on skin',
        );
    } else if (/dj|rave|club|edm|music|beats|festival/.test(niche)) {
        tokens.push(
            'neon-soaked club stage or DJ booth',
            'Godox AD200 strobe with colored gels — magenta and cyan rim lights',
            'bokeh LED crowd in background',
            'dramatic festival stage lighting',
        );
    } else if (/luxury|fashion|model|glam|vogue|haute|couture/.test(niche)) {
        tokens.push(
            'Hasselblad H6D studio editorial setting, seamless white cyclorama backdrop',
            'Profoto B10X softbox key light, silver reflector fill, rim separation',
            'designer fashion forward outfit, impeccable styling',
            'high-end fashion magazine aesthetic',
        );
    } else if (/cyber|hack|code|neon|glitch|matrix|ai|robot|sci-fi|tech|dev/.test(niche)) {
        tokens.push(
            'cyberpunk rooftop cityscape at night',
            'practical neon sign light sources — cyan and magenta',
            'holographic interface reflections on face',
            'futuristic techwear outfit',
        );
    } else if (/dark|goth|punk|rebel|villain|occult|witch|shadow/.test(niche)) {
        tokens.push(
            'abandoned gothic cathedral or dark industrial warehouse',
            'Rembrandt chiaroscuro lighting — single key from sharp 45-degree angle',
            'deep dramatic shadows, volumetric smoke',
            'dark atmospheric moody environment',
        );
    } else if (/korean|kpop|k-beauty|kdrama|hanbok/.test(niche)) {
        tokens.push(
            'minimal clean white studio, soft diffused daylight',
            'Godox SL-60 through large silk diffuser — ultra-soft shadowless beauty lighting',
            'glass-skin flawless complexion, dewy highlight',
            'K-beauty idol aesthetic, monochromatic outfit',
        );
    } else if (/indian|desi|bollywood|hindi|punjabi|saree|south asian/.test(niche)) {
        tokens.push(
            'golden hour rooftop or ornate Indian palace courtyard',
            'warm Tungsten fill with natural sunlight key light',
            'rich jewel-toned sari or ethnic fashion',
            'mehndi or traditional accessories detail',
        );
    } else if (/fintech|finance|crypto|invest|wealth|startup|entrepreneur|ceo/.test(niche)) {
        tokens.push(
            'sleek modern glass-wall office or city skyline backdrop',
            'clean corporate window light, subtle backlight separation',
            'sharp tailored power blazer or business attire',
            'confident professional energy',
        );
    } else if (/travel|explore|adventure|nomad|backpack|world/.test(niche)) {
        tokens.push(
            'exotic travel location — Santorini cliffside, Bali rice terrace, or Moroccan medina',
            'natural golden hour or blue-hour ambient light',
            'relaxed adventurer outfit, travel-chic styling',
            'immersive environmental storytelling',
        );
    } else if (/afrobeat|nigerian|african|naija/.test(niche)) {
        tokens.push(
            'vibrant African market or luxury Lagos setting',
            'bold warm direct sunlight, saturated colors',
            'Ankara fashion or modern Afro-luxe styling',
            'powerful confident commanding stance',
        );
    } else {
        // Generic premium photorealism fallback
        tokens.push(
            'premium lifestyle editorial environment',
            'Godox AD600 Pro strobe with octabox — clean professional lighting',
            'contemporary fashion-forward outfit',
        );
    }

    return tokens;
}

// ── COMFYUI / IMAGEN PROMPT BUILDER (personality-aware) ──────────────────

/**
 * Converts raw centimeter face measurements to human-readable visual descriptors
 * that diffusion models actually understand. Raw numbers like "forehead 5.5cm" do nothing.
 */
function faceMeasurementsToVisual(f: CharacterDNA['face']): string {
    const parts: string[] = [];

    // Eye description — combine size + shape + color into a natural phrase
    const eyeSize = f.eye_size;
    const eyeSizeDesc = eyeSize >= 13 ? 'large expressive' : eyeSize >= 11 ? 'prominent' : 'delicate';
    const eyeSpacingDesc = f.eye_spacing >= 3.8 ? 'wide-set' : f.eye_spacing <= 3.0 ? 'close-set' : '';
    parts.push(`${eyeSizeDesc} ${f.eye_shape} ${f.eye_color} eyes${eyeSpacingDesc ? ', ' + eyeSpacingDesc : ''}`);

    // Brow description
    parts.push(`${f.brow_thickness} ${f.brow_arch}-arch eyebrows`);

    // Symmetry as a visual quality
    if (f.symmetry_score >= 92) parts.push('near-perfect facial symmetry');
    else if (f.symmetry_score >= 80) parts.push('highly symmetrical face');
    else parts.push('naturally asymmetric character face');

    // Facial structure as visual descriptors
    const cheekboneDesc = f.cheekbone_width >= 14 ? 'prominent high cheekbones' : f.cheekbone_width >= 12.5 ? 'defined cheekbones' : 'soft cheekbones';
    const jawDesc = f.jaw_width >= 12.5 ? 'strong defined jawline' : f.jaw_width >= 10.5 ? 'clean jawline' : 'soft delicate jawline';
    const foreheadDesc = f.forehead_height >= 6.5 ? 'high broad forehead' : f.forehead_height <= 4.8 ? 'low subtle forehead' : 'balanced forehead';
    parts.push(cheekboneDesc, jawDesc, foreheadDesc, `${f.chin_shape} chin`);

    // Nose
    const noseDesc = `${f.nose_bridge_height} nose bridge, ${f.nose_tip} nose tip`;
    parts.push(noseDesc);

    // Lips as visual descriptors
    const lipDesc: string[] = [`${f.lip_fullness} lips`];
    if (f.lip_upper_thickness >= 12) lipDesc.push('pronounced Cupid\'s bow');
    if (f.lip_lower_thickness >= 16) lipDesc.push('lush full lower lip');
    parts.push(lipDesc.join(', '));

    // Skin
    const freckleDesc = f.freckles ? 'delicate natural freckles across nose bridge' : 'clear luminous skin';
    parts.push(`${f.skin_tone} skin, ${f.skin_undertone} undertone, ${f.skin_texture} complexion, ${freckleDesc}`);

    return parts.join(', ');
}

/** Camera body + lens preset based on niche for maximum visual authenticity */
function nicheToCamera(niche: string, aesthetic: string): string {
    const n = (niche + ' ' + aesthetic).toLowerCase();
    if (/gym|fit|sport|athlet|wellness|yoga/.test(n))
        return 'shot on Sony A7 IV with 35mm f/1.8 lens, slight motion blur on hair, sports editorial style';
    if (/fashion|glam|vogue|luxury|editorial|model/.test(n))
        return 'shot on Hasselblad X2D with 80mm f/1.9 lens, ultra-sharp medium format detail, studio editorial';
    if (/cyber|tech|neon|glitch|sci-fi/.test(n))
        return 'shot on Sony A7R V with Sigma 50mm f/1.4 Art, anamorphic lens flare, cyan bokeh';
    if (/dark|goth|punk|moody|villain/.test(n))
        return 'shot on Leica M11 with 50mm Summilux, dramatic contrast, rich shadow detail';
    if (/travel|adventure|nomad|explore/.test(n))
        return 'shot on Sony A7C II with 24mm f/2.8 environmental wide, golden hour ambient';
    if (/korean|kpop|k-beauty/.test(n))
        return 'shot on Canon EOS R5 with 85mm f/1.2L, creamy bokeh, ultra-soft beauty lighting';
    if (/indian|desi|bollywood/.test(n))
        return 'shot on Phase One XF with 80mm f/2.8 Blue Ring, warm Tungsten color grade';
    return 'shot on Sony A7R V with 85mm f/1.4 GM lens, shallow depth of field, cinematic color grade';
}

export function dnaToComfyPrompt(dna: CharacterDNA): string {
    const f = dna.face;
    const b = dna.body;
    const h = dna.hair;
    const s = dna.style;
    const id = dna.identity;
    const v = dna.viral_strategy;
    const personalityTokens = personalityToPromptTokens(dna);

    // === PROFESSIONAL PHOTOREALISM BASE + CAMERA ===
    const cameraGear = nicheToCamera(id.niche, s.primary_aesthetic);
    const qualityBase = [
        'RAW photograph, hyperrealistic, NOT a painting or digital art,',
        cameraGear + ',',
        'sharp focus on eyes, natural skin pores and texture visible, real person,',
        '8K ultra-detailed, photojournalistic quality',
    ].join(' ');

    // === SUBJECT IDENTITY ===
    const genderWord = id.gender === 'male' ? 'man' : id.gender === 'non-binary' ? 'person' : 'woman';
    const subjectLine = [
        id.ethnicity ? `${id.ethnicity} ${genderWord},` : `${genderWord},`,
        `${id.age} years old,`,
        'real human being, not a CGI model, not a cartoon,',
    ].join(' ');

    // === FACE (visual descriptors, no raw numbers) ===
    const faceBlueprint = [
        `${f.shape} face shape,`,
        faceMeasurementsToVisual(f) + ',',
    ].join(' ');

    // === HAIR (rich descriptive) ===
    const hairHighlight = h.highlight_color && h.highlight_color !== 'none' ? ` with ${h.highlight_color} highlights` : '';
    const hairLengthMap: Record<string, string> = {
        buzz: 'buzz-cut', short: 'short', chin: 'chin-length', shoulder: 'shoulder-length',
        mid_back: 'mid-back length', waist: 'waist-length', hip: 'hip-length'
    };
    const hairDesc = [
        `${h.color}${hairHighlight} ${h.texture} ${hairLengthMap[h.length] || h.length} hair,`,
        h.style ? `${h.style} hairstyle,` : '',
        `${h.density} density hair,`,
    ].filter(Boolean).join(' ');

    // === BODY (qualitative descriptors only) ===
    const heightDesc = b.height_cm >= 175 ? 'tall' : b.height_cm >= 165 ? 'average height' : 'petite';
    const bodyDesc = [
        `${b.body_type} body type, ${b.muscle_tone} build,`,
        `${heightDesc} stature,`,
    ].join(' ');

    // === STYLE & AESTHETIC ===
    const styleTokens: string[] = [];
    if (s.primary_aesthetic) styleTokens.push(`${s.primary_aesthetic} aesthetic`);
    if (s.clothing_era) styleTokens.push(`${s.clothing_era} fashion sensibility`);
    styleTokens.push(s.makeup_style !== 'bare' ? `${s.makeup_style} makeup` : 'minimal no-makeup look');
    if (s.color_palette?.length > 0) styleTokens.push(`outfit palette: ${s.color_palette.slice(0, 3).join(', ')}`);
    if (s.accessories?.length > 0) styleTokens.push(`wearing ${s.accessories.slice(0, 2).join(' and ')}`);
    if (s.tattoos && s.tattoos !== 'none') styleTokens.push(s.tattoos);
    if (s.piercings && s.piercings !== 'none') styleTokens.push(s.piercings);
    const styleDesc = styleTokens.join(', ') + ',';

    // === CINEMATIC VIRALITY LAYER ===
    const viralParts: string[] = [];
    if (v?.aesthetic_trigger) viralParts.push(`SCROLL-STOPPING VISUAL: ${v.aesthetic_trigger}`);
    if (v?.visual_composition_rules) viralParts.push(`COMPOSITION: ${v.visual_composition_rules}`);
    else viralParts.push('COMPOSITION: rule of thirds, face on 1/3 vertical line, golden ratio face placement');
    if (v?.color_contrast_ratio) viralParts.push(`CONTRAST: ${v.color_contrast_ratio}`);
    else viralParts.push('CONTRAST: cinematic 4.5:1 lighting ratio, soft key light, hard rim light edge separation');
    const viralLayer = viralParts.join(', ') + ',';

    return [
        qualityBase,
        subjectLine,
        faceBlueprint,
        hairDesc,
        bodyDesc,
        styleDesc,
        personalityTokens.length > 0 ? personalityTokens.join(', ') + ',' : '',
        viralLayer,
    ].filter(Boolean).join('\n');
}

/**
 * Generates a comprehensive negative prompt from Character DNA.
 * This is the single source of truth for what we DON'T want.
 */
export function dnaToNegativePrompt(dna: CharacterDNA): string {
    const contentNeg = getContentBoundaryNegativePrompt(dna.content_boundary.level);

    // Universal anatomical and quality errors to always block
    const anatomyBlocks = [
        'deformed', 'bad anatomy', 'bad hands', 'bad feet', 'extra fingers', 'missing fingers',
        'extra limbs', 'missing limbs', 'fused fingers', 'malformed hands',
        'wrong number of fingers', 'mutated', 'mutation', 'disfigured',
        'extra head', 'duplicate', 'cloned face', 'two faces',
        'extra arms', 'floating limbs', 'disconnected limbs',
        'long neck', 'elongated neck', 'short neck',
    ];

    // Face-specific artifacts (critical for consistency)
    const faceBlocks = [
        'ugly face', 'asymmetrical face', 'crossed eyes', 'floating eyes',
        'dead eyes', 'glassy eyes', 'artificial looking', 'plastic face',
        'paint-on face', 'too much makeup', 'caricature',
        'distorted face', 'warped features', 'melting', 'smeared',
    ];

    // Technical image quality issues
    const qualityBlocks = [
        'blurry', 'blur', 'out of focus', 'motion blur', 'jpeg artifacts',
        'low quality', 'lowres', 'bad quality', 'worst quality',
        'pixelated', 'noisy', 'grainy', 'oversaturated', 'overexposed',
        'underexposed', 'dark noise', 'flat lighting', 'harsh shadows',
        'watermark', 'logo', 'signature', 'text', 'caption',
        'border', 'frame', 'cropped head', 'cut off face',
    ];

    // Style inconsistency blocks
    const styleBlocks = [
        'cartoon', 'anime', 'illustration', 'drawing', 'painting', 'sketch',
        'digital art', '3D render', 'CGI', 'fake', 'artificial', 'mannequin',
        'doll', 'plastic', 'wax figure',
    ];

    return [contentNeg, ...anatomyBlocks, ...faceBlocks, ...qualityBlocks, ...styleBlocks]
        .filter(Boolean).join(', ');
}


// ── SEEDED RANDOM DNA GENERATOR ────────────────────────────────────────────

// Simple seeded LCG PRNG so the same niche always produces a consistent starting point
function seededRand(seed: number) {
    let s = seed;
    return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
}

function pick<T>(arr: readonly T[], r: () => number): T { return arr[Math.floor(r() * arr.length)]; }
function between(min: number, max: number, r: () => number, dec = 1): number {
    return parseFloat((min + r() * (max - min)).toFixed(dec));
}
function pct(r: () => number, bias = 50): number {
    return Math.min(100, Math.max(0, Math.round(bias + (r() - 0.5) * 60)));
}

export function generateRandomDNA(niche: string, ethnicityHint = '', ageHint?: number): CharacterDNA {
    let seed = 0;
    const cleanNiche = niche.trim().toLowerCase();
    for (let i = 0; i < cleanNiche.length; i++) seed += cleanNiche.charCodeAt(i) * (i + 1);
    // Combine with current time and a high-entropy random component
    seed = (seed + Date.now() + Math.floor(Math.random() * 1000000)) % 2147483647;
    const r = seededRand(seed);

    // Niche-based personality biases
    const isArtsy = /art|music|dj|dance|paint|poet|theatre/i.test(niche);
    const isFit = /fit|gym|sport|athlet|wellness|yoga/i.test(niche);
    const isTech = /tech|cyber|code|hack|ai|robot|sci/i.test(niche);
    const isDark = /dark|goth|villain|punk|rebel|anarchi/i.test(niche);
    const isLuxury = /luxury|fashion|model|glam|elite|high/i.test(niche);

    // OCEAN biases based on niche archetype
    const ocean: OceanProfile = {
        openness: pct(r, isArtsy ? 80 : isTech ? 75 : 60),
        conscientiousness: pct(r, isFit ? 80 : isLuxury ? 75 : 55),
        extraversion: pct(r, isDark ? 35 : isLuxury ? 70 : 65),
        agreeableness: pct(r, isDark ? 25 : isFit ? 65 : 55),
        neuroticism: pct(r, isArtsy ? 60 : isDark ? 70 : 35),
    };

    const mbtiTypes = ['INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP', 'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP'] as const;
    const enneaTypes = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
    const engagements = ['ignores_all', 'selective', 'replies_to_top_fans', 'replies_to_everyone'] as const;
    const growthStrategies = ['viral_bait', 'niche_authority', 'collab_farming', 'consistency', 'shock_value'] as const;
    const captionStyles = ['ultra_short', 'one_liner', 'paragraph', 'storytelling', 'emoji_heavy'] as const;
    const hookTypes = ['question', 'bold_claim', 'relatability', 'curiosity_gap', 'controversy'] as const;
    const faceShapes = ['oval', 'round', 'square', 'heart', 'diamond', 'oblong', 'triangle'] as const;
    const eyeShapes = ['almond', 'round', 'hooded', 'monolid', 'upturned', 'downturned'] as const;
    const browThickness = ['thin', 'medium', 'thick', 'bushy'] as const;
    const browArch = ['flat', 'soft', 'medium', 'high'] as const;
    const noseBridge = ['low', 'medium', 'high'] as const;
    const noseTips = ['upturned', 'downturned', 'bulbous', 'pointed', 'flat'] as const;
    const lipFullness = ['thin', 'medium', 'full', 'very_full'] as const;
    const hairLengths = ['short', 'chin', 'shoulder', 'mid_back', 'waist'] as const;
    const hairTextures = ['straight', 'wavy', 'curly', 'coily'] as const;
    const bodyTypes = ['ectomorph', 'mesomorph', 'hourglass', 'pear', 'rectangle'] as const;
    const muscleTonesArr = ['very_lean', 'lean', 'athletic', 'curvy', 'soft', 'strong'] as const;
    const makeupStyles = ['natural', 'glam', 'editorial', 'avant_garde'] as const;

    const ethnicities = ethnicityHint ? [ethnicityHint] : ['East Asian', 'South Asian', 'Afro-Caribbean', 'Latin', 'Eastern European', 'West African', 'Middle Eastern', 'Southeast Asian', 'Mixed Heritage'];
    const skinTones = ['warm ivory', 'golden tan', 'warm beige', 'deep mahogany', 'rich ebony', 'caramel', 'olive', 'porcelain', 'warm sand', 'cool ivory'];
    const eyeColors = ['deep brown', 'hazel green', 'amber', 'blue-grey', 'dark brown', 'emerald green', 'ice blue', 'golden brown'];
    const hairColors = ['jet black', 'dark brown', 'auburn', 'platinum blonde', 'honey blonde', 'copper red', 'silver', 'violet-black', 'warm chestnut'];
    const highlights = ['none', 'none', 'rose gold', 'caramel', 'ash blonde', 'subtle copper'];

    const height = between(158, 182, r, 0);
    const waist = between(60, 78, r, 0);
    const hips = between(85, 105, r, 0);
    const bust = between(80, 105, r, 0);

    const postFreq = isDark ? between(3, 7, r, 0) : isLuxury ? between(5, 10, r, 0) : between(5, 14, r, 0);
    const controv = isDark ? pct(r, 70) : isFit ? pct(r, 20) : pct(r, 40);
    const authScore = isDark ? pct(r, 55) : isFit ? pct(r, 80) : pct(r, 65);

    const lifestyle = Math.round(10 + r() * 30);
    const educational = Math.round(10 + r() * 25);
    const promotional = Math.round(5 + r() * 20);
    const behindScenes = Math.round(10 + r() * 20);
    const controversial = Math.round(controv * 0.2);
    const interactive = Math.max(5, 100 - lifestyle - educational - promotional - behindScenes - controversial);

    const dna: CharacterDNA = {
        identity: {
            name: '',      // filled by API
            age: ageHint || Math.round(between(19, 32, r, 0)),
            gender: 'female' as const, // overridden by API/user
            ethnicity: pick(ethnicities, r),
            niche,
            backstory: '', // filled by API
            core_values: pick([['freedom', 'creativity', 'expression'], ['power', 'discipline', 'excellence'], ['connection', 'love', 'community'], ['truth', 'knowledge', 'mastery']], r),
            fears: pick([['being forgotten', 'irrelevance'], ['failure', 'mediocrity'], ['loss of control', 'vulnerability'], ['rejection', 'isolation']], r),
            goals: pick([['1M followers in 12 months', 'luxury brand deal'], ['build a community', 'launch merch line'], ['go viral', 'monetize through subscriptions'], ['become a niche authority', 'speaking engagements']], r),
        },
        viral_strategy: {
            primary_hook_archetype: pick(['The Contrarian', 'The Expert', 'The Relatable Mess', 'The Mystery', 'The Shock Factor'], r),
            aesthetic_trigger: '', // filled by API
            content_format_focus: pick(['Fast-paced edits', 'Aesthetic vlogs', 'Direct-to-camera storytelling', 'POV skits'], r),
            monetization_angle: pick(['Digital products', 'Brand sponsorships', 'Subscription / OF', 'Merch / E-commerce'], r),
            viral_phrase_template: '', // filled by API
            visual_composition_rules: '', // filled by API
            color_contrast_ratio: '', // filled by API
            target_retention_curve: '', // filled by API
            pacing_bpm: Math.round(between(90, 150, r, 0)),
            reading_grade_level: Math.round(between(4, 9, r, 0)),
            market_focus: pick(['Global', 'India', 'US/Europe', 'Asia-Pacific'], r),
            target_cpm: between(1.5, 12, r, 2),
            psychological_hooks: pick([['Status Signaling', 'Aspirational'], ['FOMO', 'Urgency'], ['Community', 'Relatability'], ['Educational', 'Authority']], r),
            platform_priority: pick([['Instagram', 'Pinterest', 'Patreon'], ['TikTok', 'Instagram', 'YouTube'], ['Pinterest', 'Instagram']], r),
        },
        // NSFW boundary — auto-detected from niche
        content_boundary: deriveContentBoundary(niche, r),
        personality: {
            ocean,
            mbti: {
                type: pick(mbtiTypes, r),
                energy: pct(r, ocean.extraversion),
                information: pct(r, ocean.openness),
                decisions: pct(r, ocean.agreeableness),
                lifestyle: pct(r, 100 - ocean.neuroticism),
            },
            enneagram: {
                type: pick(enneaTypes, r),
                wing: pick(enneaTypes, r),
                instinct: pick(['self-preservation', 'social', 'sexual'], r),
                stress_direction: pick([1, 2, 3, 4, 5, 6, 7, 8, 9], r),
                growth_direction: pick([1, 2, 3, 4, 5, 6, 7, 8, 9], r),
            },
            dark_triad: {
                narcissism: pct(r, isDark ? 65 : isLuxury ? 50 : 30),
                machiavellianism: pct(r, isDark ? 60 : isTech ? 45 : 25),
                psychopathy: pct(r, isDark ? 40 : 15),
            },
            communication: {
                vocabulary_level: pick(['conversational', 'articulate', 'simple', 'poetic'], r),
                humor_type: pick(['dry', 'sarcastic', 'wholesome', 'absurdist', 'dark', 'none'], r),
                emotional_expression: pick(['expressive', 'moderate', 'controlled', 'dramatic'], r),
                speaking_pace: pick(['natural', 'fast', 'measured', 'rapid-fire'], r),
                primary_language_patterns: [],
                recurring_phrases: [],
                topics_they_love: niche.split(' '),
                topics_they_avoid: pick([['politics', 'religion'], ['finances', 'family'], ['past relationships'], ['competitors']], r),
            },
            social_algorithm: {
                posting_frequency_per_week: Math.round(postFreq),
                best_posting_times: ['07:30', '12:30', '20:00'],
                content_mix: { lifestyle, educational, promotional, behind_scenes: behindScenes, controversial, interactive },
                engagement_style: pick(engagements, r),
                controversy_tolerance: controv,
                brand_deal_openness: pct(r, isLuxury ? 80 : 60),
                authenticity_score: authScore,
                growth_strategy: pick(growthStrategies, r),
                caption_style: pick(captionStyles, r),
                hook_type: pick(hookTypes, r),
                platform_priority: ['Instagram', 'TikTok'],
            }
        },
        face: {
            shape: pick(faceShapes, r),
            symmetry_score: between(72, 97, r, 0),
            total_height: between(16.5, 21, r),
            total_width: between(12, 15.5, r),
            forehead_height: between(4.5, 7, r),
            forehead_width: between(10.5, 14, r),
            cheekbone_width: between(12, 15.5, r),
            jaw_width: between(9.5, 13.5, r),
            chin_height: between(2, 4.5, r),
            chin_shape: pick(['pointed', 'rounded', 'square', 'cleft'], r),
            eye_color: pick(eyeColors, r),
            eye_shape: pick(eyeShapes, r),
            eye_size: between(9, 14, r),
            eye_spacing: between(2.8, 4.2, r),
            brow_thickness: pick(browThickness, r),
            brow_arch: pick(browArch, r),
            nose_length: between(3.8, 6, r),
            nose_width: between(2.5, 4.5, r),
            nose_bridge_height: pick(noseBridge, r),
            nose_tip: pick(noseTips, r),
            lip_upper_thickness: between(5, 14, r),
            lip_lower_thickness: between(7, 20, r),
            lip_width: between(3.5, 6.5, r),
            lip_fullness: pick(lipFullness, r),
            skin_tone: pick(skinTones, r),
            skin_texture: pick(['smooth', 'natural', 'natural'], r),
            skin_undertone: pick(['warm', 'cool', 'neutral'], r),
            freckles: r() > 0.75,
            birthmarks: 'none',
        },
        hair: {
            color: pick(hairColors, r),
            highlight_color: pick(highlights, r),
            length: pick(hairLengths, r),
            texture: pick(hairTextures, r),
            density: pick(['thin', 'medium', 'medium', 'thick'], r),
            style: '',     // filled by API
        },
        body: {
            height_cm: height,
            weight_kg: between(48, 72, r, 0),
            body_type: pick(bodyTypes, r),
            bust_cm: bust,
            waist_cm: waist,
            hips_cm: hips,
            shoulder_width_cm: between(34, 44, r),
            arm_length_cm: between(56, 68, r),
            leg_length_cm: between(78, 98, r),
            neck_circumference_cm: between(30, 38, r),
            wrist_circumference_cm: between(14, 17, r),
            foot_size_eu: between(36, 41, r, 0),
            muscle_tone: pick(muscleTonesArr, r),
        },
        style: {
            primary_aesthetic: niche,
            color_palette: [],    // filled by API
            clothing_era: pick(['contemporary', 'futuristic', '90s retro', 'Y2K', 'art deco', 'minimalist'], r),
            accessories: [],      // filled by API
            makeup_style: pick(makeupStyles, r),
            tattoos: r() > 0.6 ? 'subtle tattoo' : 'none',
            piercings: pick(['ear lobes', 'multiple ear', 'septum', 'ear lobes'], r),
        },
        render: {
            comfy_prompt_base: '',
            negative_prompt: 'ugly, deformed, blurry, disfigured, bad anatomy, watermark, text, lowres',
            preferred_model: 'juggernautXL_ragnarokBy.safetensors',
            preferred_workflow: 'flux-9b-txt2img',
            lora_tags: [],
            suggested_aspect_ratio: '9:16',
        },
    };

    // Auto-build the ComfyUI prompt (with NSFW-aware modifiers)
    dna.render.comfy_prompt_base = dnaToComfyPrompt(dna);
    // Build comprehensive DNA-aware negative prompt
    dna.render.negative_prompt = dnaToNegativePrompt(dna);
    return dna;
}

// ══════════════════════════════════════════════════════════════════════
// ── NSFW CONTENT BOUNDARY SYSTEM ─────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════

// Auto-detect content boundary from niche + random seed
function deriveContentBoundary(niche: string, r: () => number): ContentBoundary {
    const n = niche.toLowerCase();
    const isNSFW = /nsfw|adult|onlyfans|18\+|xxx|lewd|spicy|explicit/i.test(n);
    const isMature = /glam|boudoir|seductive|sensual|sultry|provocative|dark.*model/i.test(n);
    const isSuggestive = /bikini|lingerie|swim|beach.*model|body.*pos/i.test(n);
    const isMild = /fitness|gym|yoga|dance|fashion|model/i.test(n);
    const isSFW = /tech|education|cook|book|travel|family|kids|gaming|art|music|comedy/i.test(n);

    let level: ContentLevel;
    if (isNSFW) level = 5;
    else if (isMature) level = 4;
    else if (isSuggestive) level = 3;
    else if (isMild) level = 2;
    else if (isSFW) level = 1;
    else level = Math.min(3, Math.max(1, Math.round(1 + r() * 2))) as ContentLevel;

    // Auto-restrict platforms based on level
    const platformMap: Record<ContentLevel, string[]> = {
        1: ['Instagram', 'TikTok', 'YouTube', 'Twitter'],
        2: ['Instagram', 'TikTok', 'YouTube', 'Twitter'],
        3: ['Instagram', 'Twitter', 'Patreon'],
        4: ['Twitter', 'Patreon', 'OnlyFans'],
        5: ['OnlyFans', 'Fansly', 'Patreon'],
    };

    return {
        level,
        allowed_platforms: platformMap[level],
        custom_restrictions: [],
        face_always_visible: level <= 3, // levels 4-5 can have faceless shots
    };
}

/**
 * Returns negative prompt additions to block content ABOVE the model's level.
 * This is injected into ComfyUI negative prompts.
 */
export function getContentBoundaryNegativePrompt(level: ContentLevel): string {
    const blocks: Record<ContentLevel, string> = {
        1: 'nsfw, nude, naked, topless, bikini, lingerie, cleavage, revealing clothing, suggestive, provocative, sexual, sensual, seductive, underwear, bra visible, see-through, crop top, midriff, thong, sideboob, underboob, wet t-shirt, swimwear',
        2: 'nsfw, nude, naked, topless, lingerie, nipples, genitalia, sexual, explicit, pornographic, spread legs, see-through clothing, thong visible, underboob, wet clothing clinging',
        3: 'nsfw, nude, naked, nipples, genitalia, explicit, pornographic, sexual intercourse, spread legs, fully naked',
        4: 'genitalia, explicit sexual intercourse, pornographic, extreme graphic content',
        5: '',
    };
    return blocks[level];
}

/**
 * Returns positive prompt clothing/style tokens allowed at the model's level.
 * Ensures the ComfyUI prompt includes appropriate clothing.
 */
export function getContentBoundaryPositiveTokens(level: ContentLevel): string[] {
    const tokens: Record<ContentLevel, string[]> = {
        1: ['fully clothed', 'professional attire', 'modest clothing', 'covered shoulders', 'full coverage outfit'],
        2: ['fashionable outfit', 'stylish clothing', 'form-fitting attire', 'trendy streetwear', 'athletic wear'],
        3: ['glamorous outfit', 'form-fitting dress', 'fashionable revealing clothing'],
        4: ['artistic styling', 'editorial fashion'],
        5: [],
    };
    return tokens[level];
}

/**
 * Filters content types based on the model's boundary level.
 * Removes content categories that would push beyond the allowed level.
 */
export function filterContentTypesForBoundary(level: ContentLevel): string[] {
    const sfwTypes = [
        'lifestyle & daily life',
        'editorial portrait',
        'behind the scenes',
        'brand collab / product moment',
        'candid social interaction',
        'travel & environment',
        'morning or evening routine',
    ];
    const mildTypes = [
        ...sfwTypes,
        'fashion & styling',
        'action & performance',
        'fitness & workout',
        'beach & poolside',
    ];
    const suggestiveTypes = [
        ...mildTypes,
        'glamour shoot',
        'sensual editorial',
        'night out / party',
    ];
    const matureTypes = [
        ...suggestiveTypes,
        'boudoir',
        'artistic nude',
        'body art',
    ];
    const explicitTypes = [
        ...matureTypes,
        'explicit content',
        'adult content',
    ];

    const typeMap: Record<ContentLevel, string[]> = {
        1: sfwTypes,
        2: mildTypes,
        3: suggestiveTypes,
        4: matureTypes,
        5: explicitTypes,
    };
    return typeMap[level];
}

/**
 * UI label for a content boundary level
 */
export function getContentBoundaryLabel(level: ContentLevel): string {
    const labels: Record<ContentLevel, string> = {
        1: 'SFW — Family Friendly',
        2: 'Mild — Fashion & Fitness',
        3: 'Suggestive — Glamour & Lingerie',
        4: 'Mature — Artistic Nudity',
        5: 'Explicit — No Restrictions',
    };
    return labels[level];
}

/**
 * UI color class for a content boundary level
 */
export function getContentBoundaryColor(level: ContentLevel): string {
    const colors: Record<ContentLevel, string> = {
        1: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        2: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
        3: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
        4: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
        5: 'text-red-400 bg-red-500/10 border-red-500/20',
    };
    return colors[level];
}
