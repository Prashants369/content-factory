import { NextResponse } from 'next/server';
import db from '@/lib/db';

// GET — fetch all posts with status=Ready, autopost_enabled=1, scheduled for now
export async function GET(req: Request) {
    try {
        if (!db) {
            return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
        }

        const url = new URL(req.url);
        const host = url.host;
        const protocol = url.protocol;
        const now = new Date().toISOString();

        const posts = db.prepare(`
            SELECT 
                p.*,
                i.name as influencer_name,
                i.avatar_image_path,
                pa.ig_business_account_id,
                pa.access_token as ig_access_token,
                pa.account_name as ig_account_name
            FROM posts p
            LEFT JOIN influencers i ON p.influencer_id = i.id
            LEFT JOIN platform_accounts pa ON pa.influencer_id = p.influencer_id AND pa.platform = 'instagram' AND pa.enabled = 1
            WHERE p.status = 'Ready'
              AND p.autopost_enabled = 1
              AND (p.scheduled_at IS NULL OR p.scheduled_at <= ?)
              AND p.ig_post_id IS NULL
            ORDER BY p.scheduled_at ASC
            LIMIT 10
        `).all(now) as any[];

        // Build public image URLs dynamically using the incoming request host
        const postsWithUrls = posts.map(p => ({
            ...p,
            public_image_url: p.media_path
                ? `${protocol}//${host}${p.media_path}`
                : null
        }));

        return NextResponse.json({ posts: postsWithUrls, count: postsWithUrls.length });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
