import { NextResponse } from 'next/server';
import db from '@/lib/db';
import fs from 'fs';
import path from 'path';

// The set of keys the factory recognises — safe to read / write
const ALLOWED_KEYS = new Set([
    'GEMINI_API_KEY',
    'AGENT_ENGINE_URL',
    'INTERNAL_API_KEY',
    'META_APP_ID',
    'META_APP_SECRET',
    'META_USER_ACCESS_TOKEN',
    'FB_PAGE_ID',
    'FB_PAGE_ACCESS_TOKEN',
    'IG_BUSINESS_ACCOUNT_ID',
    'TIKTOK_CLIENT_KEY',
    'TIKTOK_CLIENT_SECRET',
    'TIKTOK_ACCESS_TOKEN',
    'TIKTOK_OPEN_ID',
    'YOUTUBE_API_KEY',
    'YOUTUBE_CLIENT_ID',
    'YOUTUBE_CLIENT_SECRET',
    'PINTEREST_APP_ID',
    'PINTEREST_APP_SECRET',
    'PINTEREST_ACCESS_TOKEN',
    'REDDIT_CLIENT_ID',
    'REDDIT_CLIENT_SECRET',
    'REDDIT_USERNAME',
    'REDDIT_PASSWORD',
    'ONLYFANS_AUTH_ID',
    'ONLYFANS_SESS',
    'ONLYFANS_USER_AGENT',
    'ONLYFANS_X_BC',
    'EXA_API_KEY',
    'CLOUDFLARE_API_TOKEN',
    'CLOUDFLARE_ACCOUNT_ID',
    'COMFYUI_URL',
    'OLLAMA_URL',
    'N8N_WEBHOOK_URL',
    'COMFYUI_BAT_GPU',
    'COMFYUI_BAT_CPU',
    'N8N_DIR',
]);

function mask(value: string): string {
    if (!value || value.length < 8) return '••••••••';
    return value.slice(0, 4) + '••••' + value.slice(-4);
}

function readEnvLocal(): Record<string, string> {
    const envPath = path.join(process.cwd(), '.env.local');
    if (!fs.existsSync(envPath)) return {};
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
    const result: Record<string, string> = {};
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq === -1) continue;
        const k = trimmed.slice(0, eq).trim();
        const v = trimmed.slice(eq + 1).trim();
        result[k] = v;
    }
    return result;
}

function writeEnvLocal(overrides: Record<string, string>) {
    const envPath = path.join(process.cwd(), '.env.local');
    const existing = readEnvLocal();
    const merged = { ...existing, ...overrides };

    // Build file content — keep comments from existing file, append new keys
    let content = '';
    const existingLines = fs.existsSync(envPath)
        ? fs.readFileSync(envPath, 'utf-8').split('\n')
        : [];

    const written = new Set<string>();
    for (const line of existingLines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) {
            content += line + '\n';
            continue;
        }
        const eq = trimmed.indexOf('=');
        if (eq === -1) { content += line + '\n'; continue; }
        const k = trimmed.slice(0, eq).trim();
        if (merged[k] !== undefined) {
            content += `${k}=${merged[k]}\n`;
            written.add(k);
        } else {
            content += line + '\n';
        }
    }
    // Append any new keys not already in file
    for (const [k, v] of Object.entries(overrides)) {
        if (!written.has(k)) {
            content += `${k}=${v}\n`;
        }
    }
    fs.writeFileSync(envPath, content, 'utf-8');
}

// ── GET /api/credentials ──────────────────────────────────────────────────
export async function GET() {
    try {
        if (!db) {
            return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
        }

        const envVars = readEnvLocal();
        const rows = db.prepare('SELECT key, value, updated_at FROM api_credentials').all() as any[];
        const dbMap: Record<string, { value: string; updated_at: string }> = {};
        for (const r of rows) dbMap[r.key] = r;

        const result: Record<string, { masked: string; set: boolean; updated_at?: string }> = {};
        for (const key of ALLOWED_KEYS) {
            const dbEntry = dbMap[key];
            const envValue = envVars[key];
            const value = dbEntry?.value || envValue || '';
            result[key] = {
                masked: mask(value),
                set: !!value,
                updated_at: dbEntry?.updated_at,
            };
        }
        return NextResponse.json(result);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// ── POST /api/credentials — { key, value } ───────────────────────────────
export async function POST(req: Request) {
    try {
        if (!db) {
            return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
        }

        const body = await req.json().catch(() => null);
        if (!body) {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }

        const { key, value } = body;
        if (!key || !ALLOWED_KEYS.has(key)) {
            return NextResponse.json({ error: 'Unknown key' }, { status: 400 });
        }
        if (typeof value !== 'string') {
            return NextResponse.json({ error: 'Value must be a string' }, { status: 400 });
        }

        // Save to SQLite
        db.prepare(`
      INSERT INTO api_credentials (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run(key, value);

        // Patch .env.local so Python agent_engine picks it up too
        writeEnvLocal({ [key]: value });

        return NextResponse.json({ ok: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// ── DELETE /api/credentials — { key } ───────────────────────────────────
export async function DELETE(req: Request) {
    try {
        if (!db) {
            return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
        }

        const body = await req.json().catch(() => null);
        if (!body) {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }

        const { key } = body;
        if (!key || !ALLOWED_KEYS.has(key)) {
            return NextResponse.json({ error: 'Unknown key' }, { status: 400 });
        }
        db.prepare('DELETE FROM api_credentials WHERE key = ?').run(key);
        return NextResponse.json({ ok: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
