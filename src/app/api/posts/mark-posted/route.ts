import { NextResponse } from 'next/server';
import db from '@/lib/db';

// POST — mark a post as Published and store IG data
export async function POST(req: Request) {
    try {
        if (!db) {
            return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
        }

        const body = await req.json().catch(() => null);
        if (!body) {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }

        const { post_id, ig_post_id, ig_permalink, ig_likes, ig_comments, posted_at } = body;

        if (!post_id) return NextResponse.json({ error: 'post_id is required' }, { status: 400 });

        db.prepare(`
            UPDATE posts SET
                status = 'Posted',
                ig_post_id = ?,
                ig_permalink = ?,
                ig_likes = ?,
                ig_comments = ?,
                posted_at = ?
            WHERE id = ?
        `).run(ig_post_id || null, ig_permalink || null, ig_likes || 0, ig_comments || 0, posted_at || new Date().toISOString(), post_id);

        return NextResponse.json({ success: true, post_id, ig_post_id, ig_permalink });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// PATCH — manually update post status (for Kanban drag-and-drop)
export async function PATCH(req: Request) {
    try {
        if (!db) {
            return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
        }

        const body = await req.json().catch(() => null);
        if (!body) {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }

        const { post_id, status, scheduled_at, autopost_enabled, hashtags, caption } = body;

        if (!post_id) return NextResponse.json({ error: 'post_id required' }, { status: 400 });

        const updates: string[] = [];
        const values: any[] = [];

        if (status !== undefined) { updates.push('status = ?'); values.push(status); }
        if (scheduled_at !== undefined) { updates.push('scheduled_at = ?'); values.push(scheduled_at); }
        if (autopost_enabled !== undefined) { updates.push('autopost_enabled = ?'); values.push(autopost_enabled ? 1 : 0); }
        if (hashtags !== undefined) { updates.push('hashtags = ?'); values.push(hashtags); }
        if (caption !== undefined) { updates.push('caption = ?'); values.push(caption); }

        if (updates.length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 });

        values.push(post_id);
        db.prepare(`UPDATE posts SET ${updates.join(', ')} WHERE id = ?`).run(...values);

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
