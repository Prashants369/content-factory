import { NextResponse } from 'next/server';
import { generateRandomDNA, dnaToComfyPrompt, dnaToNegativePrompt } from '@/lib/characterDNA';

export async function POST(req: Request) {
    try {
        const { niche, targetAge, gender = 'female', ethnicity = '', provider = 'ollama', modelName = 'qwen3:1.7b' } = await req.json();
        const ethnicityClean = (ethnicity || '').trim();

        if (!niche?.trim()) {
            return NextResponse.json({ error: 'Niche is required' }, { status: 400 });
        }

        const nicheClean = niche.trim();

        // Start with a structural skeleton
        const dna = generateRandomDNA(nicheClean, ethnicityClean, targetAge ? parseInt(targetAge, 10) : undefined);

        // ── Pre-lock user-supplied fields BEFORE Ollama runs ────────────────
        // This ensures the skeleton always has correct ethnicity/gender even if Ollama fails
        if (ethnicityClean) dna.identity.ethnicity = ethnicityClean;
        dna.identity.gender = gender as any;

        // ── Prompt — max creative entropy for infinite unique characters ───────
        const genderLabel = gender === 'male' ? 'male' : 'female';
        const genderPronouns = gender === 'male' ? 'he/him' : 'she/her';

        // Entropy seed: forces the model to generate something different every single call
        const entropySeed = `[SEED:${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36)}]`;

        // Pick a random creative directive to push variation into unexpected territory
        const CREATIVE_WILDCARDS = [
            'Give her an unexpected contradiction — e.g. a warrior poet, or a scientist who dresses like royalty.',
            'The character has an obsession with a very specific subculture nobody expects given their niche.',
            'Mix two completely different aesthetics that have never been combined before.',
            'The character has an unusual origin story rooted in a real cultural or historical event.',
            'Design the character around a very specific life philosophy that drives every post.',
            'Give the character a signature visual element that becomes instantly recognizable.',
            'The character subverts all expectations of what someone in their niche normally looks like.',
            'The character embodies a hyper-specific micro-aesthetic that exists nowhere else.',
            'Base the character around an emotion or mood rather than a typical niche topic.',
            'The character is defined by one extreme personality trait taken to its logical extreme.',
        ];
        const wildcard = CREATIVE_WILDCARDS[Math.floor(Math.random() * CREATIVE_WILDCARDS.length)];

        // Build ethnicity constraint
        const ethnicityConstraint = ethnicityClean
            ? `Ethnicity: ${ethnicityClean} — MANDATORY. Use ONLY ${ethnicityClean} facial features, skin tone, and name. Never substitute another ethnicity.`
            : `Ethnicity: infer from the concept — name, face, and cultural references must all match authentically.`;

        const prompt = `You are a world-class AI character designer and digital strategist. ${entropySeed}
Your task is to generate a comprehensive "Digital Identity Blueprint" for a new AI Influencer.

HARD CONSTRAINTS:
Gender: ${genderLabel} (${genderPronouns})
${ethnicityConstraint}
${targetAge ? `Age: exactly ${targetAge}` : 'Age: 18–35'}
Niche: "${nicheClean}"

CREATIVE DIRECTION:
${wildcard}

You must output a highly structured JSON object that defines the character's "DNA".
- IDENTITY: Create a cinematic backstory and unique name.
- PERSONALITY: Define their MBTI, OCEAN scores (0-100), and communication style.
- VIRAL STRATEGY: Define their hook archetype, aesthetic triggers, and visual composition rules.
- PERFORMANCE: Define their posting frequency, platform priority, and content mix.
- BIOMETRICS: Define their specific visual features (face shape, eye color, hair style, body type).
- STYLE: Define their primary aesthetic, color palette (hex), and clothing era.

Rules:
- NAMES: Never use generic names. Use unique, memorable, culturally relevant names (e.g. 'Sloane Vex', 'Arjun Zero', 'Neo-Priya').
- VARIETY: Ensure high entropy. Every character must be a distinct "brand".
- OUTPUT: Valid compact JSON only.

JSON STRUCTURE:
{
  "identity": { "name": "", "age": 0, "ethnicity": "", "backstory": "", "core_values": [], "fears": [], "goals": [] },
  "personality": {
    "mbti": "INTJ|ENFP|etc",
    "ocean": { "o": 0-100, "c": 0-100, "e": 0-100, "a": 0-100, "n": 0-100 },
    "communication": { "vocabulary": "simple|poetic|etc", "humor": "dry|dark|etc", "pace": "fast|slow", "recurring_phrases": [] }
  },
  "viral_strategy": {
    "hook_archetype": "The Expert|The Mystery|etc",
    "aesthetic_trigger": "high-contrast neon|soft grain minimalism|etc",
    "visual_rules": "Rule of thirds, subject center-weighted",
    "phrase_template": "What if I told you...",
    "monetization": "Brand deals|Merch|etc"
  },
  "biometrics": {
    "face_shape": "oval|heart|etc",
    "eye_color": "poetic description",
    "hair_style": "specific named style",
    "hair_color": "specific shade",
    "body_type": "mesomorph|hourglass|etc",
    "muscle_tone": "lean|strong|soft"
  },
  "style": { "aesthetic": "Cyber-Gothic|Old Money Luxe|etc", "era": "90s fusion|2044 futuristic|etc", "palette": ["#hex", "#hex"] }
}`;

        console.log(`[DNA] Prompting ${modelName} for Structured Blueprint...`);
        let aiData: any = null;

        try {
            const ollamaRes = await fetch((process.env.OLLAMA_URL || 'http://127.0.0.1:11434') + '/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: modelName,
                    prompt: prompt,
                    stream: false,
                    format: 'json',
                    options: { temperature: 0.9, num_predict: 1500, repeat_penalty: 1.2 }
                })
            });

            if (ollamaRes.ok) {
                const od = await ollamaRes.json();
                let raw = (od.response || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
                const jsonMatch = raw.match(/\{[\s\S]*\}/);
                if (jsonMatch) raw = jsonMatch[0];
                try {
                    aiData = JSON.parse(raw);
                    console.log(`[DNA] ✓ Blueprint generated for: ${aiData.identity?.name || aiData.name}`);
                } catch {
                    console.warn('[DNA] Blueprint JSON parse failed');
                }
            }
        } catch (err: any) {
            console.warn('Ollama failed:', err.message);
        }

        // Apply LLM Blueprint to the DNA Skeleton
        if (aiData) {
            const id = aiData.identity || aiData;
            const pers = aiData.personality || {};
            const viral = aiData.viral_strategy || {};
            const bio = aiData.biometrics || {};
            const style = aiData.style || {};

            // 1. Identity
            if (id.name) dna.identity.name = id.name;
            if (id.age) dna.identity.age = id.age;
            if (id.ethnicity) dna.identity.ethnicity = id.ethnicity;
            if (id.backstory) dna.identity.backstory = id.backstory;
            if (id.core_values) dna.identity.core_values = id.core_values;
            if (id.fears) dna.identity.fears = id.fears;
            if (id.goals) dna.identity.goals = id.goals;

            // 2. Personality & OCEAN
            if (pers.mbti) dna.personality.mbti.type = pers.mbti;
            if (pers.ocean) {
                if (pers.ocean.o) dna.personality.ocean.openness = pers.ocean.o;
                if (pers.ocean.c) dna.personality.ocean.conscientiousness = pers.ocean.o; // fix typo
                if (pers.ocean.c) dna.personality.ocean.conscientiousness = pers.ocean.c;
                if (pers.ocean.e) dna.personality.ocean.extraversion = pers.ocean.e;
                if (pers.ocean.a) dna.personality.ocean.agreeableness = pers.ocean.a;
                if (pers.ocean.n) dna.personality.ocean.neuroticism = pers.ocean.n;
            }
            if (pers.communication) {
                if (pers.communication.vocabulary) dna.personality.communication.vocabulary_level = pers.communication.vocabulary as any;
                if (pers.communication.humor) dna.personality.communication.humor_type = pers.communication.humor as any;
                if (pers.communication.recurring_phrases) dna.personality.communication.recurring_phrases = pers.communication.recurring_phrases;
            }

            // 3. Viral Strategy
            if (viral.hook_archetype) dna.viral_strategy.primary_hook_archetype = viral.hook_archetype as any;
            if (viral.aesthetic_trigger) dna.viral_strategy.aesthetic_trigger = viral.aesthetic_trigger;
            if (viral.visual_rules) dna.viral_strategy.visual_composition_rules = viral.visual_rules;
            if (viral.phrase_template) dna.viral_strategy.viral_phrase_template = viral.phrase_template;
            if (viral.monetization) dna.viral_strategy.monetization_angle = viral.monetization as any;

            // 4. Biometrics (Face/Body/Hair)
            if (bio.face_shape) dna.face.shape = bio.face_shape as any;
            if (bio.eye_color) dna.face.eye_color = bio.eye_color;
            if (bio.hair_style) dna.hair.style = bio.hair_style;
            if (bio.hair_color) dna.hair.color = bio.hair_color;
            if (bio.body_type) dna.body.body_type = bio.body_type as any;
            if (bio.muscle_tone) dna.body.muscle_tone = bio.muscle_tone as any;

            // 5. Style
            if (style.aesthetic) dna.style.primary_aesthetic = style.aesthetic;
            if (style.era) dna.style.clothing_era = style.era;
            if (style.palette) dna.style.color_palette = style.palette;

            dna.identity.niche = style.aesthetic ? `${style.aesthetic} — ${nicheClean}` : nicheClean;
        }

        // Final locking and prompt rebuild
        dna.identity.gender = gender as any;
        if (ethnicityClean) dna.identity.ethnicity = ethnicityClean;
        dna.render.comfy_prompt_base = dnaToComfyPrompt(dna);
        dna.render.negative_prompt = dnaToNegativePrompt(dna);
        dna.render.preferred_workflow = 'flux-9b-txt2img';

        return NextResponse.json(dna);

    } catch (error: any) {
        console.error('Character generation error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
