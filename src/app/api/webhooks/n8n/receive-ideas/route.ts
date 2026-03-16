import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function POST(req: Request) {
  try {
    if (!db) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { influencer_id, ideas } = body;

    if (!influencer_id || !Array.isArray(ideas)) {
      return NextResponse.json({ error: 'Missing influencer_id or ideas array' }, { status: 400 });
    }

    const influencer = db.prepare('SELECT id FROM influencers WHERE id = ?').get(influencer_id);
    if (!influencer) {
      return NextResponse.json({ error: 'Influencer not found' }, { status: 404 });
    }

    const insertPost = db.prepare(`
      INSERT INTO posts (id, influencer_id, post_date, viral_hook, image_prompt, caption, engagement_strategy, music_suggestion, video_hook_variations, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Idea')
    `);

    const transaction = db.transaction((ideasToInsert: any[]) => {
      for (const idea of ideasToInsert) {
        const postId = `post_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const postDate = new Date();
        postDate.setDate(postDate.getDate() + 1);

        insertPost.run(
          postId,
          influencer_id,
          postDate.toISOString(),
          idea.viral_hook || idea.hook || '',
          idea.image_prompt || idea.prompt || '',
          idea.caption || '',
          idea.engagement_strategy || '',
          idea.music_suggestion || idea.music_type || '',
          idea.video_hook_variations ? JSON.stringify(idea.video_hook_variations) : ''
        );
      }
    });

    transaction(ideas);
    return NextResponse.json({ success: true, inserted: ideas.length });
  } catch (e: any) {
    console.error('Webhook error:', e);
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 });
  }
}
