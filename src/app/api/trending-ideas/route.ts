import { NextResponse } from 'next/server';

const AGENT_ENGINE_URL = process.env.NEXT_PUBLIC_AGENT_ENGINE_URL || process.env.AGENT_ENGINE_URL || 'http://127.0.0.1:8787';
const N8N_URL = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678';
const OLLAMA_URL = 'http://127.0.0.1:11434/api/generate';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const forceRefresh = searchParams.get('refresh') === '1';

    // Only fetch when user explicitly requests it
    if (!forceRefresh) {
      return NextResponse.json({
        ideas: [],
        source: 'idle',
        message: 'Click "Live Scan" to scrape real trending ideas from Reddit + Google Trends',
        count: 0
      });
    }

    let ideas: any[] = [];
    let source = 'failed';

    // --- Step 1: Try Advanced Agent Engine (ScoutAgent via Exa AI + Gemini) ---
    try {
      const scoutRes = await fetch(`${AGENT_ENGINE_URL}/agents/scout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.INTERNAL_API_KEY || ''
        },
        body: JSON.stringify({ niche: 'AI Influencers and Content Creators', platforms: ['instagram', 'tiktok', 'pinterest'], limit: 8 }),
        signal: AbortSignal.timeout(15000)
      });

      if (scoutRes.ok) {
        const data = await scoutRes.json();
        if (data?.trends?.length) {
          ideas = data.trends.map((t: any) => ({
            title: t.title || "Viral Trend",
            niche: t.hook || t.description || "Niche directive",
            why_trending: (t.metrics || "") + " " + (t.analysis || ""),
            aesthetic: "Modern",
            platform: t.platform || "Instagram",
            emoji: t.emoji || "🔥"
          }));
          source = 'advanced-scout';
        }
      }
    } catch {
      console.warn('[TrendingIdeas] ScoutAgent offline, trying n8n...');
    }

    // --- Step 2: Try n8n ---
    if (ideas.length === 0) {
      try {
        const n8nRes = await fetch(`${N8N_URL}/webhook/trending-character-ideas`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source: 'dashboard', timestamp: Date.now() }),
          signal: AbortSignal.timeout(20000)
        });

        if (n8nRes.ok) {
          const data = await n8nRes.json();
          if (data?.ideas?.length >= 2) {
            ideas = data.ideas as any[];
            source = 'n8n-scrape';
          }
        }
      } catch {
        console.warn('[TrendingIdeas] n8n not reachable, trying Ollama...');
      }
    }

    // --- Step 3: Fallback to Ollama directly ---
    if (ideas.length === 0) {
      try {
        const today = new Date().toLocaleDateString('en-US', {
          weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
        });

        const creativeAxes = [
          'Futuristic & Sci-Fi Fusion', 'Hyper-Realistic Minimalist', 'Traditional Culture vs Modern Era',
          'Dark, Gritty & Atmospheric', 'Vibrant, Pop-Art & Maximalist', 'Quiet Luxury & Aesthetic Minimalism'
        ];
        const axis = creativeAxes[Math.floor(Math.random() * creativeAxes.length)];

        const ollamaRes = await fetch(OLLAMA_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'qwen3:1.7b',
            prompt: `You are a top Instagram growth strategist. Today is ${today}. Focus Axis: ${axis}.

Generate 8 unique AI virtual influencer character concepts that are TRENDING RIGHT NOW, leaning toward the "${axis}" style.

Rules:
- Each character must have a unique ethnicity, age, and a hyper-specific 3-sentence niche directive.
- Avoid generic concepts. Think subcultures, niche hobbies, and visual contradictions.
- Return ONLY a compact JSON array of 8 objects:
[{"title":"short archetype name","niche":"2-3 sentence specific character directive including ethnicity, age, what they post, visual style","why_trending":"exact reason this is blowing up RIGHT NOW","aesthetic":"3 words visual style","platform":"Instagram|TikTok|Pinterest","emoji":"1 emoji"}]`,
            stream: false,
            format: 'json',
            options: { temperature: 0.92, num_predict: 1400, top_p: 0.92, top_k: 50 }
          }),
          signal: AbortSignal.timeout(30000)
        });

        if (ollamaRes.ok) {
          const od = await ollamaRes.json();
          let raw = (od.response || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
          if (raw && !raw.endsWith(']')) {
            const lastBracket = raw.lastIndexOf('}');
            if (lastBracket > 0) raw = raw.substring(0, lastBracket + 1) + ']';
          }
          const match = raw.match(/\[[\s\S]*\]/);
          if (match) {
            const parsed: any[] = JSON.parse(match[0]);
            if (parsed?.length >= 2) {
              ideas = parsed;
              source = 'ollama-direct';
            }
          }
        }
      } catch {
        console.warn('[TrendingIdeas] Ollama also failed.');
      }
    }

    if (ideas.length === 0) {
      return NextResponse.json({
        ideas: [],
        source: 'failed',
        message: 'Could not fetch ideas — Agent Engine, n8n, and Ollama all offline. Start at least one service.',
        count: 0
      }, { status: 503 });
    }

    return NextResponse.json({
      ideas,
      source,
      refreshed_at: new Date().toISOString(),
      count: ideas.length
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 });
  }
}
