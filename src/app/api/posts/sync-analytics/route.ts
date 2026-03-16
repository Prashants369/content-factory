import { NextResponse } from 'next/server';
import db from '@/lib/db';

// POST — sync Instagram analytics for a specific post
export async function POST(req: Request) {
    try {
        if (!db) {
            return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
        }

        const body = await req.json().catch(() => null);
        if (!body || !body.post_id) {
            return NextResponse.json({ error: 'post_id is required' }, { status: 400 });
        }

        const { post_id, influencer_id } = body;

        const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(post_id) as any;
        if (!post?.ig_post_id) {
            return NextResponse.json({ error: 'Post not published on Instagram yet' }, { status: 400 });
        }

        // Get the access token
        const account = db.prepare(
            `SELECT * FROM platform_accounts WHERE influencer_id = ? AND platform = 'instagram' AND enabled = 1`
        ).get(influencer_id || post.influencer_id) as any;

        if (!account?.access_token) {
            return NextResponse.json({ error: 'No Instagram account configured for this influencer' }, { status: 404 });
        }

        // Pull insights from Instagram Graph API
        const insightsUrl = `https://graph.facebook.com/v19.0/${post.ig_post_id}/insights?metric=reach,impressions,saved,video_views&access_token=${account.access_token}`;
        const basicUrl = `https://graph.facebook.com/v19.0/${post.ig_post_id}?fields=like_count,comments_count,timestamp,permalink&access_token=${account.access_token}`;

        const [insightsRes, basicRes] = await Promise.allSettled([
            fetch(insightsUrl, { signal: AbortSignal.timeout(8000) }),
            fetch(basicUrl, { signal: AbortSignal.timeout(8000) })
        ]);

        let reach = 0, impressions = 0, saves = 0, video_views = 0, likes = 0, comments = 0;

        if (insightsRes.status === 'fulfilled' && insightsRes.value.ok) {
            const json = await insightsRes.value.json();
            for (const m of (json.data || [])) {
                if (m.name === 'reach') reach = m.values?.[0]?.value || 0;
                if (m.name === 'impressions') impressions = m.values?.[0]?.value || 0;
                if (m.name === 'saved') saves = m.values?.[0]?.value || 0;
                if (m.name === 'video_views') video_views = m.values?.[0]?.value || 0;
            }
        }

        if (basicRes.status === 'fulfilled' && basicRes.value.ok) {
            const basic = await basicRes.value.json();
            likes = basic.like_count || 0;
            comments = basic.comments_count || 0;
        }

        // Engagement rate = (likes + comments + saves) / reach * 100
        const engagementRate = reach > 0 ? ((likes + comments + saves) / reach) * 100 : 0;

        // Update post
        db.prepare(`
            UPDATE posts SET
                ig_likes = ?,
                ig_comments = ?,
                ig_reach = ?,
                ig_impressions = ?,
                ig_saves = ?,
                ig_video_views = ?,
                ig_engagement_rate = ?
            WHERE id = ?
        `).run(likes, comments, reach, impressions, saves, video_views, Math.round(engagementRate * 100) / 100, post_id);

        // Also update influencer-level averages
        const allPostedPosts = db.prepare(`
            SELECT ig_reach, ig_engagement_rate FROM posts 
            WHERE influencer_id = ? AND status = 'Posted' AND ig_reach > 0
        `).all(influencer_id || post.influencer_id) as any[];

        if (allPostedPosts.length > 0) {
            const avgReach = Math.round(allPostedPosts.reduce((s, p) => s + p.ig_reach, 0) / allPostedPosts.length);
            const avgEngagement = allPostedPosts.reduce((s, p) => s + p.ig_engagement_rate, 0) / allPostedPosts.length;
            db.prepare(`
                UPDATE influencers SET ig_avg_reach = ?, ig_avg_engagement = ?, ig_last_synced = ?
                WHERE id = ?
            `).run(avgReach, Math.round(avgEngagement * 100) / 100, new Date().toISOString(), influencer_id || post.influencer_id);
        }

        return NextResponse.json({
            success: true,
            analytics: { likes, comments, reach, impressions, saves, video_views, engagement_rate: engagementRate }
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// GET — get analytics summary for all posts of an influencer
export async function GET(req: Request) {
    try {
        if (!db) {
            return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
        }

        const { searchParams } = new URL(req.url);
        const influencerId = searchParams.get('influencer_id');

    if (!influencerId) return NextResponse.json({ error: 'influencer_id required' }, { status: 400 });

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
    `).get(influencerId) as any;

    const recentPosts = db.prepare(`
        SELECT id, viral_hook, caption, media_path, status, ig_post_id, ig_permalink,
               ig_likes, ig_comments, ig_reach, ig_impressions, ig_saves, ig_engagement_rate,
               posted_at, scheduled_at, autopost_enabled, platform, hashtags
        FROM posts WHERE influencer_id = ?
        ORDER BY COALESCE(posted_at, scheduled_at, post_date, created_at) DESC
        LIMIT 20
    `).all(influencerId) as any[];

    const influencer = db.prepare(
        `SELECT ig_followers, ig_total_posts, ig_avg_reach, ig_avg_engagement, ig_last_synced FROM influencers WHERE id = ?`
    ).get(influencerId) as any;

    return NextResponse.json({ stats, recentPosts, influencer });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 });
    }
}
