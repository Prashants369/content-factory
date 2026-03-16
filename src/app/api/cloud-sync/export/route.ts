import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
  try {
    if (!db) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
    }

    const query = `
      SELECT p.*, i.name as influencer_name, i.avatar_image_path 
      FROM posts p 
      LEFT JOIN influencers i ON p.influencer_id = i.id 
      WHERE p.status = 'Ready' AND p.autopost_enabled = 1
      ORDER BY p.scheduled_at ASC
    `;
    const scheduledPosts = db.prepare(query).all() as any[];

    const payload = {
      export_timestamp: new Date().toISOString(),
      total_scheduled: scheduledPosts.length,
      posts: scheduledPosts.map((post: any) => ({
        id: post.id,
        influencer_id: post.influencer_id,
        influencer_name: post.influencer_name,
        platform: post.platform,
        scheduled_for: post.scheduled_at,
        content: {
          hook: post.viral_hook,
          caption: post.caption,
          hashtags: post.hashtags,
          media_url: post.media_path
        }
      }))
    };

    return NextResponse.json(payload);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
