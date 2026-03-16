import { NextResponse } from 'next/server';
import db from '@/lib/db';

const AGENT_ENGINE_URL = process.env.AGENT_ENGINE_URL || 'http://127.0.0.1:8787';

// GET — Return analytics data from database for this influencer
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!db) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
    }

    const { id } = await params;

    const influencer = db.prepare('SELECT * FROM influencers WHERE id = ?').get(id) as any;
    if (!influencer) {
      return NextResponse.json({ error: 'Influencer not found' }, { status: 404 });
    }

    // Post-level analytics
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total_posts,
        COUNT(CASE WHEN status = 'Posted' THEN 1 END) as posted,
        COUNT(CASE WHEN status = 'Ready' THEN 1 END) as ready,
        COUNT(CASE WHEN status = 'Idea' THEN 1 END) as ideas,
        COALESCE(SUM(ig_likes), 0) as total_likes,
        COALESCE(SUM(ig_comments), 0) as total_comments,
        COALESCE(SUM(ig_reach), 0) as total_reach,
        COALESCE(SUM(ig_impressions), 0) as total_impressions,
        COALESCE(SUM(ig_saves), 0) as total_saves,
        COALESCE(AVG(CASE WHEN ig_engagement_rate > 0 THEN ig_engagement_rate END), 0) as avg_engagement_rate,
        COALESCE(MAX(ig_engagement_rate), 0) as best_engagement_rate,
        COALESCE(MAX(ig_reach), 0) as best_reach
      FROM posts WHERE influencer_id = ?
    `).get(id) as any;

    // Recent posts with analytics
    const recentPosts = db.prepare(`
      SELECT id, viral_hook, caption, media_path, status, ig_post_id, ig_permalink,
             ig_likes, ig_comments, ig_reach, ig_impressions, ig_saves, ig_engagement_rate,
             posted_at, scheduled_at
      FROM posts WHERE influencer_id = ?
      ORDER BY COALESCE(posted_at, scheduled_at, post_date) DESC
      LIMIT 20
    `).all(id) as any[];

    // Image count
    const imageCount = (db.prepare('SELECT COUNT(*) as count FROM influencer_images WHERE influencer_id = ?').get(id) as any)?.count || 0;

    return NextResponse.json({
      influencer_id: id,
      name: influencer.name,
      niche: influencer.niche,
      stats: stats || { total_posts: 0, posted: 0, ready: 0, ideas: 0 },
      recentPosts,
      imageCount,
      ig_followers: influencer.ig_followers || 0,
      ig_avg_reach: influencer.ig_avg_reach || 0,
      ig_avg_engagement: influencer.ig_avg_engagement || 0,
      ig_last_synced: influencer.ig_last_synced || null,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 });
  }
}

// POST — Trigger AI-powered analysis via Agent Engine (handles offline gracefully)
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!db) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
    }

    const { id } = await params;

    // Verify influencer exists
    const influencer = db.prepare('SELECT id, name FROM influencers WHERE id = ?').get(id) as any;
    if (!influencer) {
      return NextResponse.json({ error: 'Influencer not found' }, { status: 404 });
    }

    // Try calling the Python Agent Engine
    try {
      const res = await fetch(`${AGENT_ENGINE_URL}/agents/analyst`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ influencer_id: id }),
        signal: AbortSignal.timeout(10000),
      });

      if (res.ok) {
        const data = await res.json();
        return NextResponse.json({ ...data, source: 'agent_engine' });
      }

      return NextResponse.json({
        error: `Agent Engine returned ${res.status}`,
        message: 'Agent engine is running but returned an error. Check engine logs.',
        influencer_id: id,
      }, { status: res.status });
    } catch (fetchErr: any) {
      // Agent Engine is offline — return graceful fallback
      return NextResponse.json({
        error: 'Agent Engine offline',
        message: `Cannot reach Agent Engine at ${AGENT_ENGINE_URL}. Start the engine or use GET for database analytics.`,
        influencer_id: id,
        fallback: 'Use GET /api/influencers/[id]/analytics for database-level analytics.',
      }, { status: 503 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 });
  }
}
