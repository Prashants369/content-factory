import { NextResponse } from 'next/server';

const AGENT_ENGINE_URL = process.env.NEXT_PUBLIC_AGENT_ENGINE_URL || 'http://127.0.0.1:8787';
const OLLAMA_URL = (process.env.OLLAMA_URL || 'http://127.0.0.1:11434') + '/api/generate';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b';

// ── Evergreen fallback sets per niche (mirrors hashtag.py) ──────────────────
const EVERGREEN: Record<string, Record<string, string[]>> = {
    fashion:  { trending_now: ['#fashionweek','#ootd','#fashionblogger','#outfitinspo','#streetstyle'], niche_authority: ['#wiwt','#fashionista','#styleinspo','#lookoftheday','#fashionphotography'], engagement_bait: ['#fashionlovers','#fashionaddict','#styleoftheday','#whatiwore','#outfitcheck'] },
    fitness:  { trending_now: ['#fitcheck','#gymlife','#workoutmotivation','#fitnessgirls','#gainz'], niche_authority: ['#fitnessjourney','#fitnessmotivation','#gymrat','#bodybuilding','#personaltrainer'], engagement_bait: ['#fitfam','#fitspo','#healthylifestyle','#workoutoftheday','#gymflow'] },
    luxury:   { trending_now: ['#luxurylifestyle','#richlife','#millionairemindset','#luxurycar','#designerfashion'], niche_authority: ['#luxuryfashion','#luxuryliving','#highfashion','#luxury','#wealthymindset'], engagement_bait: ['#luxurylooks','#luxurylovers','#lifestyleoftherich','#opulence','#affluent'] },
    beauty:   { trending_now: ['#makeupoftheday','#glowup','#makeuptutorial','#skincare2025','#beautytrends'], niche_authority: ['#makeupartist','#skincareroutine','#beautyblogger','#glowskin','#makeuplover'], engagement_bait: ['#beautylovers','#makeupjunkie','#skincarecheck','#naturalmakeup','#makeuptransformation'] },
    travel:   { trending_now: ['#travelgram','#wanderlust','#travelblogger','#travelreels','#instatravel'], niche_authority: ['#travellife','#travelphotography','#solotravel','#travelcouple','#luxurytravel'], engagement_bait: ['#traveladdict','#wanderer','#exploreeverything','#travelgoals','#travelbabe'] },
    tech:     { trending_now: ['#aiinfluencer','#techindustry','#aiart','#digitalnomad','#futuretech'], niche_authority: ['#techblogger','#artificialintelligence','#machinelearning','#coding','#techgirl'], engagement_bait: ['#techlovers','#techlife','#techcommunity','#womenintech','#aitools'] },
    indian:   { trending_now: ['#indianfashion','#indianblogger','#desi','#bollywood','#indianinfluencer'], niche_authority: ['#indianmodel','#desivibes','#mumbaiinfluencer','#indiangirl','#ethnicwear'], engagement_bait: ['#indians','#indianstyle','#traditionalindian','#desigirl','#saree'] },
    kbeauty:  { trending_now: ['#kbeauty','#kpop','#koreanmakeup','#kbeautyroutine','#glassskin'], niche_authority: ['#koreanfashion','#kdrama','#koreanskincare','#kpopidol','#koreanstyle'], engagement_bait: ['#kbeautylover','#kstyle','#koreanbeauty','#asianskincare','#skindumplings'] },
    dark:     { trending_now: ['#darkacademia','#gothfashion','#darkstyle','#villainess','#alternativefashion'], niche_authority: ['#darkfashion','#gothicstyle','#edgyfashion','#alternativemodel','#darkvibes'], engagement_bait: ['#darkbeauty','#gothgirl','#darkfeed','#aestheticgoth','#darkaesthetic'] },
    default:  { trending_now: ['#viral','#trending','#explore','#fyp','#reels'], niche_authority: ['#influencer','#content','#creator','#lifestyle','#aesthetic'], engagement_bait: ['#instalike','#follow','#instagood','#photooftheday','#beautiful'] },
};

function getNicheCategory(niche: string): string {
    const n = niche.toLowerCase();
    if (/fashion|model|glam|vogue|style|couture|outfit|ootd/.test(n)) return 'fashion';
    if (/gym|fit|sport|athlet|yoga|wellness|crossfit|pilates/.test(n)) return 'fitness';
    if (/luxury|wealth|rich|elite|opulen|premium/.test(n)) return 'luxury';
    if (/beauty|makeup|skincare|glow|cosmetic/.test(n)) return 'beauty';
    if (/travel|nomad|adventure|explore|wander|backpack/.test(n)) return 'travel';
    if (/tech|cyber|ai|code|hack|robot|fintech|startup/.test(n)) return 'tech';
    if (/indian|desi|bollywood|hindi|punjabi|saree/.test(n)) return 'indian';
    if (/korean|kpop|k-beauty|kdrama|hanbok/.test(n)) return 'kbeauty';
    if (/dark|goth|punk|rebel|villain|occult|shadow/.test(n)) return 'dark';
    return 'default';
}

interface HashtagStrategy {
    trending_now: string[];
    niche_authority: string[];
    engagement_bait: string[];
    brand_signature: string[];
    niche_category?: string;
    source?: string;
}

function buildCaptionBlocks(strategy: HashtagStrategy) {
    const trending = strategy.trending_now || [];
    const authority = strategy.niche_authority || [];
    const engagement = strategy.engagement_bait || [];
    const brand = strategy.brand_signature || [];

    const minTags = [...trending.slice(0, 2), ...authority.slice(0, 2), ...brand.slice(0, 1)];
    const stdTags = [...trending.slice(0, 4), ...authority.slice(0, 6), ...engagement.slice(0, 3), ...brand.slice(0, 2)];
    const allTags = [...new Set([...trending, ...authority, ...engagement, ...brand])];

    return {
        minimal: minTags.slice(0, 5).join(' '),
        standard: stdTags.slice(0, 15).join(' '),
        full: allTags.slice(0, 30).join(' '),
    };
}

// ── GET /api/hashtags?niche=...&influencer_id=...&name=...&force=1 ────────────
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const niche = searchParams.get('niche') || 'lifestyle';
    const influencerName = searchParams.get('name') || 'influencer';
    const platform = searchParams.get('platform') || 'instagram';
    const forceRefresh = searchParams.get('force') === '1';

    // Step 1: Try the Python HashtagAgent via Agent Engine
    try {
        const agentRes = await fetch(`${AGENT_ENGINE_URL}/agents/hashtags`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-API-Key': process.env.INTERNAL_API_KEY || '' },
            body: JSON.stringify({ niche, influencer_name: influencerName, platforms: [platform], force_refresh: forceRefresh }),
            signal: AbortSignal.timeout(20000),
        });
        if (agentRes.ok) {
            const data = await agentRes.json();
            if (data?.trending_now?.length) {
                return NextResponse.json({ ...data, caption_blocks: buildCaptionBlocks(data), route_source: 'agent_engine' });
            }
        }
    } catch {
        // Agent Engine offline — fall through to direct Ollama
    }

    // Step 2: Ask Ollama directly
    try {
        const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
        const brand_slug = influencerName.toLowerCase().replace(/\s+/g, '');
        const nicheCategory = getNicheCategory(niche);

        const ollamaRes = await fetch(OLLAMA_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: OLLAMA_MODEL,
                prompt: `Find the BEST trending hashtags for an Instagram influencer. Today is ${today}.

NICHE: ${niche} (category: ${nicheCategory})
INFLUENCER: ${influencerName}
PLATFORM: ${platform}

Rules:
- trending_now: 8 hashtags currently viral this week (500k-5M posts range)
- niche_authority: 10 niche-specific discovery hashtags (50k-500k posts) 
- engagement_bait: 6 community/interaction hashtags
- brand_signature: 3 custom hashtags for ${influencerName} (must include #${brand_slug})
- No boring generic tags (#love #instagood) — must be niche-specific
- Include region tags if niche is India-specific

Return ONLY this JSON:
{"trending_now":["#tag1","#tag2","#tag3","#tag4","#tag5","#tag6","#tag7","#tag8"],"niche_authority":["#tag1","#tag2","#tag3","#tag4","#tag5","#tag6","#tag7","#tag8","#tag9","#tag10"],"engagement_bait":["#tag1","#tag2","#tag3","#tag4","#tag5","#tag6"],"brand_signature":["#${brand_slug}","#tag2","#tag3"]}`,
                stream: false,
                format: 'json',
                options: { temperature: 0.7, num_predict: 600, top_k: 40, top_p: 0.9 },
            }),
            signal: AbortSignal.timeout(60000),
        });

        if (ollamaRes.ok) {
            const od = await ollamaRes.json();
            let raw = (od.response || '')
                .replace(/<think>[\s\S]*?<\/think>/gi, '')
                .replace(/```json/gi, '').replace(/```/g, '')
                .trim();

            const match = raw.match(/\{[\s\S]*\}/);
            if (match) {
                const parsed = JSON.parse(match[0]);

                // Normalize: ensure all tags start with #
                const normalize = (tags: any[]) =>
                    (Array.isArray(tags) ? tags : [])
                        .filter((t: any) => typeof t === 'string' && t.length > 1)
                        .map((t: string) => t.startsWith('#') ? t : `#${t}`);

                const strategy = {
                    trending_now: normalize(parsed.trending_now),
                    niche_authority: normalize(parsed.niche_authority),
                    engagement_bait: normalize(parsed.engagement_bait),
                    brand_signature: normalize(parsed.brand_signature),
                    niche_category: nicheCategory,
                    source: 'ollama',
                };

                return NextResponse.json({ ...strategy, caption_blocks: buildCaptionBlocks(strategy) });
            }
        }
    } catch (err: any) {
        console.warn('[Hashtags] Ollama failed:', err.message);
    }

    // Step 3: Evergreen fallback
    const category = getNicheCategory(niche);
    const eg = EVERGREEN[category] || EVERGREEN.default;
    const brand_slug = influencerName.toLowerCase().replace(/\s+/g, '');
    const strategy = {
        trending_now: eg.trending_now,
        niche_authority: eg.niche_authority,
        engagement_bait: eg.engagement_bait,
        brand_signature: [`#${brand_slug}`, `#${brand_slug}official`, `#by${brand_slug.slice(0, 6)}`],
        niche_category: category,
        source: 'evergreen_fallback',
    };

    return NextResponse.json({ ...strategy, caption_blocks: buildCaptionBlocks(strategy) });
}

// ── POST /api/hashtags — Analyze a caption and suggest optimized hashtags ─────
export async function POST(req: Request) {
    const { caption, niche, influencer_name, dna, platform = 'instagram' } = await req.json();

    if (!caption && !niche) {
        return NextResponse.json({ error: 'caption or niche required' }, { status: 400 });
    }

    const nicheForSearch = niche || 'lifestyle';
    const nameForSearch = influencer_name || 'influencer';

    // Try Ollama to analyze caption context + suggest hashtags
    try {
        const brand_slug = nameForSearch.toLowerCase().replace(/\s+/g, '');
        const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

        // Extract DNA context
        let dnaCtx = '';
        if (dna) {
            const v = dna?.viral_strategy || {};
            const id = dna?.identity || {};
            dnaCtx = `\nInfluencer context: ${id.ethnicity || ''} ${id.age || ''}y, ${v.market_focus || 'Global'} market, ${v.primary_hook_archetype || ''} archetype, aesthetic: ${dna?.style?.primary_aesthetic || ''}`;
        }

        const ollamaRes = await fetch(OLLAMA_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: OLLAMA_MODEL,
                prompt: `Analyze this caption and suggest the BEST hashtags for maximum reach. Today is ${today}.

CAPTION: "${caption}"
NICHE: ${nicheForSearch}
PLATFORM: ${platform}
INFLUENCER: ${nameForSearch}${dnaCtx}

Strategy:
- trending_now: 6 hashtags currently going viral that fit this caption
- niche_authority: 8 hashtags in the ideal discovery range (50k-500k posts)
- engagement_bait: 4 community tags that will drive saves + comments
- brand_signature: 2 custom tags for ${nameForSearch}

The hashtags must MATCH THE VIBE of this specific caption, not just be generic.
Return ONLY this JSON:
{"trending_now":["#tag1","#tag2","#tag3","#tag4","#tag5","#tag6"],"niche_authority":["#tag1","#tag2","#tag3","#tag4","#tag5","#tag6","#tag7","#tag8"],"engagement_bait":["#tag1","#tag2","#tag3","#tag4"],"brand_signature":["#${brand_slug}","#tag2"]}`,
                stream: false,
                format: 'json',
                options: { temperature: 0.72, num_predict: 500 },
            }),
            signal: AbortSignal.timeout(60000),
        });

        if (ollamaRes.ok) {
            const od = await ollamaRes.json();
            let raw = (od.response || '')
                .replace(/<think>[\s\S]*?<\/think>/gi, '')
                .replace(/```json/gi, '').replace(/```/g, '')
                .trim();
            const match = raw.match(/\{[\s\S]*\}/);
            if (match) {
                const parsed = JSON.parse(match[0]);
                const normalize = (tags: any[]) =>
                    (Array.isArray(tags) ? tags : [])
                        .filter((t: any) => typeof t === 'string' && t.length > 1)
                        .map((t: string) => t.startsWith('#') ? t : `#${t}`);

                const strategy = {
                    trending_now: normalize(parsed.trending_now),
                    niche_authority: normalize(parsed.niche_authority),
                    engagement_bait: normalize(parsed.engagement_bait),
                    brand_signature: normalize(parsed.brand_signature),
                    niche_category: getNicheCategory(nicheForSearch),
                    source: 'ollama_caption_analysis',
                };
                return NextResponse.json({ ...strategy, caption_blocks: buildCaptionBlocks(strategy) });
            }
        }
    } catch (err: any) {
        console.warn('[Hashtags POST] Ollama failed:', err.message);
    }

    // Fallback to evergreen
    const category = getNicheCategory(nicheForSearch);
    const eg = EVERGREEN[category] || EVERGREEN.default;
    const brand_slug = nameForSearch.toLowerCase().replace(/\s+/g, '');
    const strategy = {
        trending_now: eg.trending_now.slice(0, 6),
        niche_authority: eg.niche_authority,
        engagement_bait: eg.engagement_bait.slice(0, 4),
        brand_signature: [`#${brand_slug}`, `#${brand_slug}official`],
        niche_category: category,
        source: 'evergreen_fallback',
    };
    return NextResponse.json({ ...strategy, caption_blocks: buildCaptionBlocks(strategy) });
}
