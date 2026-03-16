import { NextResponse } from 'next/server';
import { getDbSafe } from '@/lib/db';

export async function POST(req: Request) {
    try {
        const db = getDbSafe();
        if (!db) {
            return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
        }

        // Find all posts that are generated but not published
        const postsToSync = db.prepare(`
            SELECT p.id, p.influencer_id, p.caption, p.media_path, p.platform
            FROM posts p
            WHERE p.status = 'Ready' AND p.media_path IS NOT NULL AND p.media_path != ''
        `).all() as any[];

        if (postsToSync.length === 0) {
            return NextResponse.json({ ok: true, message: "No posts pending sync to Cloud Bridge." });
        }

        // Generate the massive JSON payload to send to the Cloudflare Worker
        const payload = [];
        for (const p of postsToSync) {
            // Get the integration token
            const credMap = db.prepare("SELECT key, value FROM api_credentials").all() as any[];
            const igToken = credMap.find((c: any) => c.key === 'META_USER_ACCESS_TOKEN')?.value;
            const igBusinessAcc = credMap.find((c: any) => c.key === 'IG_BUSINESS_ACCOUNT_ID')?.value;

            // This is a dummy example of creating a public URL from cloudflare R2 (in real production, we'd upload this file first using an R2 SDK)
            // For now, we simulate the public URL payload structure.
            const publicImageUrl = `https://mock.cdn.influencerfactory.com/assets/${p.media_path.split('/').pop()}`;

            payload.push({
                id: p.id,
                influencerId: p.influencer_id,
                platform: p.platform || 'instagram',
                accountId: igBusinessAcc,
                accessToken: igToken,
                imageUrl: publicImageUrl,
                caption: p.caption || '',
                scheduledTimeMs: Date.now() + 1000 * 60 * 60 * 2, // Post in 2 hours
                status: 'pending'
            });
        }

        const workerUrl = process.env.CLOUDFLARE_WORKER_URL || '';
        const bridgeToken = process.env.META_APP_SECRET || '';

        if (!workerUrl) {
            return NextResponse.json({ error: "CLOUDFLARE_WORKER_URL is missing from .env.local" }, { status: 400 });
        }

        const bridgeRes = await fetch(workerUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${bridgeToken}` // Secure bridge pass
            },
            body: JSON.stringify(payload)
        });

        if (!bridgeRes.ok) {
            const errDetail = await bridgeRes.text();
            throw new Error(`Cloud Bridge rejected payload: ${errDetail}`);
        }

        const successData = await bridgeRes.json();

        // Mark as synced with Cloud in our local status
        const updateStmt = db.prepare("UPDATE posts SET status = 'Scheduled (Cloud)' WHERE id = ?");
        for (const p of postsToSync) {
            updateStmt.run(p.id);
        }

        return NextResponse.json({
            ok: true,
            message: `Successfully pushed ${successData.queued} posts to the Ghost Publisher Cloud Bridge.`
        });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
