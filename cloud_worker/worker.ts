/**
 * AI Influencer Factory - Ghost Publisher (Cloudflare Worker)
 * 
 * This worker runs on a cron trigger (e.g., every 15 minutes) to publish
 * scheduled posts to social media platforms (Instagram, TikTok) while the 
 * local factory PC is offline. 
 * 
 * It reads from Cloudflare KV 'POST_QUEUE' and updates statuses.
 */

// Define standard Cloudflare Worker types to satisfy IDE lints
interface KVNamespace {
    put(key: string, value: string | ReadableStream | ArrayBuffer | ArrayBufferView, options?: { expiration?: number; expirationTtl?: number; metadata?: any }): Promise<void>;
    get(key: string, options?: { type?: 'text' | 'json' | 'arrayBuffer' | 'stream'; cacheTtl?: number }): Promise<any>;
    getWithMetadata(key: string, options?: { type?: 'text' | 'json' | 'arrayBuffer' | 'stream'; cacheTtl?: number }): Promise<{ value: any; metadata: any | null }>;
    delete(key: string): Promise<void>;
    list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{ keys: { name: string; expiration?: number; metadata?: any }[]; list_complete: boolean; cursor?: string }>;
}

interface ExecutionContext {
    waitUntil(promise: Promise<any>): void;
    passThroughOnException(): void;
}

interface ScheduledEvent {
    cron: string;
    type: string;
    scheduledTime: number;
}

export interface Env {
    // Example binding to KV. Learn more at https://developers.cloudflare.com/workers/runtime-apis/kv/
    POST_QUEUE: KVNamespace;
    // Secrets
    META_APP_SECRET: string;
}

interface QueuedPost {
    id: string;
    influencerId: string;
    platform: 'instagram' | 'tiktok';
    accountId: string; // The IG Business ID or TikTok OpenID
    accessToken: string;
    imageUrl?: string;
    videoUrl?: string;
    caption: string;
    scheduledTimeMs: number;
    status: 'pending' | 'published' | 'failed';
    errorMsg?: string;
    platformPostId?: string;
}

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        // HTTP endpoint for the Local PC to push the schedule payload to the Cloud!
        if (request.method === 'POST') {
            try {
                const authHeader = request.headers.get('Authorization');
                if (authHeader !== `Bearer ${env.META_APP_SECRET}`) { // Simple auth using existing secret
                    return new Response('Unauthorized', { status: 401 });
                }

                const payload: QueuedPost[] = await request.json();

                // Save each post to KV, keyed by its ID
                for (const post of payload) {
                    await env.POST_QUEUE.put(`post:${post.id}`, JSON.stringify(post));
                }

                return new Response(JSON.stringify({ ok: true, queued: payload.length }), {
                    headers: { 'Content-Type': 'application/json' }
                });
            } catch (e: any) {
                return new Response(JSON.stringify({ error: e.message }), { status: 500 });
            }
        }

        // GET endpoint for Local PC to check statuses upon wake up
        if (request.method === 'GET') {
            try {
                const list = await env.POST_QUEUE.list({ prefix: 'post:' });
                const results = [];
                for (const key of list.keys) {
                    const data = await env.POST_QUEUE.get(key.name);
                    if (data) {
                        const post: QueuedPost = JSON.parse(data);
                        // Only return ones that have been processed to update local SQLite
                        if (post.status !== 'pending') {
                            results.push(post);
                        }
                    }
                }
                return new Response(JSON.stringify({ results }), { headers: { 'Content-Type': 'application/json' } });
            } catch (e: any) {
                return new Response(JSON.stringify({ error: e.message }), { status: 500 });
            }
        }

        return new Response('Ghost Publisher Online.', { status: 200 });
    },

    // The CRON Trigger - this makes it fully autonomous!
    async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
        console.log(`Cron triggered at ${new Date(event.scheduledTime).toISOString()}`);

        const nowMs = Date.now();
        const list = await env.POST_QUEUE.list({ prefix: 'post:' });

        for (const key of list.keys) {
            const data = await env.POST_QUEUE.get(key.name);
            if (!data) continue;

            const post: QueuedPost = JSON.parse(data);

            // Check if it's time to post and not already done
            if (post.status === 'pending' && nowMs >= post.scheduledTimeMs) {
                try {
                    if (post.platform === 'instagram') {
                        const postId = await publishToInstagram(post);
                        post.status = 'published';
                        post.platformPostId = postId;
                    } else if (post.platform === 'tiktok') {
                        // Setup tiktok publish
                        post.status = 'failed';
                        post.errorMsg = 'TikTok not fully implemented in Bridge yet';
                    }

                    // Save updated status back to KV
                    await env.POST_QUEUE.put(key.name, JSON.stringify(post));

                } catch (e: any) {
                    console.error(`Failed to publish post ${post.id}`, e);
                    post.status = 'failed';
                    post.errorMsg = e.message;
                    await env.POST_QUEUE.put(key.name, JSON.stringify(post));
                }
            }
        }
    },
};

// --- Meta Graph API Implementation ---
async function publishToInstagram(post: QueuedPost): Promise<string> {
    if (!post.imageUrl) throw new Error("Instagram requires an image URL");

    const containerUrl = `https://graph.facebook.com/v21.0/${post.accountId}/media`;

    // Step 1: Create Container
    const containerRes = await fetch(`${containerUrl}?image_url=${encodeURIComponent(post.imageUrl)}&caption=${encodeURIComponent(post.caption)}&access_token=${post.accessToken}`, {
        method: 'POST'
    });

    const containerData: any = await containerRes.json();
    if (containerData.error) {
        throw new Error(`IG Container Error: ${containerData.error.message}`);
    }

    const creationId = containerData.id;

    // Step 2: Publish Container
    const publishUrl = `https://graph.facebook.com/v21.0/${post.accountId}/media_publish`;
    const publishRes = await fetch(`${publishUrl}?creation_id=${creationId}&access_token=${post.accessToken}`, {
        method: 'POST'
    });

    const publishData: any = await publishRes.json();
    if (publishData.error) {
        throw new Error(`IG Publish Error: ${publishData.error.message}`);
    }

    return publishData.id; // The live Post ID!
}
