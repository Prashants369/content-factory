import { NextResponse } from 'next/server';
import db from '@/lib/db';

const AGENT_ENGINE_URL = process.env.NEXT_PUBLIC_AGENT_ENGINE_URL || process.env.AGENT_ENGINE_URL || 'http://127.0.0.1:8787';

// ── POST: Generate a batch of content posts for a given influencer ───────────
export async function POST(req: Request) {
  try {
    if (!db) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
    }

    const body = await req.json().catch(() => null);
    if (!body || !body.influencer_id) {
      return NextResponse.json({ error: 'influencer_id is required' }, { status: 400 });
    }

    const { influencer_id, count = 7, content_themes, ollama_model } = body;

    const influencer = db.prepare('SELECT * FROM influencers WHERE id = ?').get(influencer_id) as any;
    if (!influencer) {
      return NextResponse.json({ error: 'Influencer not found' }, { status: 404 });
    }

    // Try Advanced Mode Engine First
    try {
      const engRes = await fetch(`${AGENT_ENGINE_URL}/agents/burst`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.INTERNAL_API_KEY || ''
        },
        body: JSON.stringify({
          influencer_ids: [influencer_id],
          days_ahead: Math.ceil(count / 2),
          mode: 'content_only'
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (engRes.ok) {
        const engData = await engRes.json();
        return NextResponse.json({
          success: true,
          message: "Advanced Burst Session initiated!",
          task_id: engData.task_id,
          count,
          model_used: 'Gemini-2.0-Flash (Advanced)',
          source: 'agent_engine'
        });
      }
    } catch {
      console.warn('[Content] Agent Engine not responding, using fallback.');
    }

    // Fallback if Agent Engine is offline
    const saved: any[] = [];
    const batchCount = Math.min(count, 5);
    const themes = content_themes || ['morning routine', 'behind the scenes', 'trend discussion'];

    for (let i = 0; i < batchCount; i++) {
      const theme = themes[i % themes.length];
      const post = generateFallbackPost(influencer, theme, i);
      savePost(db, influencer_id, post, saved);
    }

    return NextResponse.json({
      success: true,
      posts: saved,
      count: saved.length,
      model_used: 'fallback/offline',
      source: 'local_fallback'
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 });
  }
}

function savePost(database: any, influencer_id: string, post: any, saved: any[]) {
  const id = 'post_' + Date.now() + '_' + Math.floor(Math.random() * 9999);
  const hashtags = Array.isArray(post.hashtags) ? post.hashtags.join(' ') : (post.hashtags || '');
  const videoHooks = Array.isArray(post.video_hook_variations) ? JSON.stringify(post.video_hook_variations) : null;
  database.prepare(`
    INSERT INTO posts (id, influencer_id, viral_hook, caption, image_prompt, music_suggestion, engagement_strategy, video_hook_variations, monetization_angle, hashtags, platform, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'instagram', 'Idea')
  `).run(id, influencer_id, post.viral_hook || '', post.caption || '', post.image_prompt || post.image_direction || '', post.music_suggestion || null, post.engagement_strategy || null, videoHooks, post.monetization_angle || null, hashtags);
  saved.push({ id, ...post });
}

function generateFallbackPost(persona: any, theme: string, index: number) {
  const hooks = [
    `This is what nobody tells you about my life`,
    `POV: you just discovered this secret`,
    `Why I stopped doing this one thing`,
  ];
  return {
    viral_hook: hooks[index % hooks.length],
    caption: `Real talk about ${theme}. Authenticity always wins. 🎯\n\nDrop a 💜 if you agree!`,
    hashtags: `#lifestyle #creator`,
    image_prompt: `${persona.name} professional photography, cinematic lighting`,
  };
}

// ── GET: Fetch posts ──────────────────────────────────────────────────────────
export async function GET(req: Request) {
  try {
    if (!db) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
    }

    const { searchParams } = new URL(req.url);
    const influencer_id = searchParams.get('influencer_id');
    const status = searchParams.get('status');

    const conditions: string[] = [];
    const params: string[] = [];

    if (influencer_id) { conditions.push('p.influencer_id = ?'); params.push(influencer_id); }
    if (status) { conditions.push('p.status = ?'); params.push(status); }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    const query = `SELECT p.*, i.name as influencer_name, i.avatar_image_path FROM posts p LEFT JOIN influencers i ON p.influencer_id = i.id ${where} ORDER BY p.rowid DESC LIMIT 200`;

    const posts = db.prepare(query).all(...params);
    return NextResponse.json({ posts, total: posts.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 });
  }
}
