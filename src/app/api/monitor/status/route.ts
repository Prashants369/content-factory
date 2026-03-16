import { NextResponse } from 'next/server';

const OLLAMA = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const COMFY = process.env.COMFYUI_URL || 'http://127.0.0.1:8188';
const N8N = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678';

async function checkOllama() {
    try {
        const r = await fetch(`${OLLAMA}/api/tags`, { signal: AbortSignal.timeout(3000) });
        if (!r.ok) return { ok: false, models: [] };
        const j = await r.json();
        return { ok: true, models: (j.models || []).map((m: any) => m.name) as string[] };
    } catch { return { ok: false, models: [] }; }
}

async function checkComfy() {
    try {
        const [queueRes, statsRes] = await Promise.allSettled([
            fetch(`${COMFY}/queue`, { signal: AbortSignal.timeout(3000) }),
            fetch(`${COMFY}/system_stats`, { signal: AbortSignal.timeout(3000) }),
        ]);

        let queue = { running: 0, pending: 0 };
        let vram_free_gb: number | null = null;

        if (queueRes.status === 'fulfilled' && queueRes.value.ok) {
            const qj = await queueRes.value.json();
            queue.running = (qj.queue_running || []).length;
            queue.pending = (qj.queue_pending || []).length;
        }

        if (statsRes.status === 'fulfilled' && statsRes.value.ok) {
            const sj = await statsRes.value.json();
            const vram = sj.system?.vram_free;
            if (vram) vram_free_gb = Math.round((vram / 1024 / 1024 / 1024) * 10) / 10;
        }

        return { ok: queueRes.status === 'fulfilled', queue, vram_free_gb };
    } catch { return { ok: false, queue: { running: 0, pending: 0 }, vram_free_gb: null }; }
}

async function checkN8n() {
    try {
        const r = await fetch(`${N8N}/healthz`, { signal: AbortSignal.timeout(3000) });
        return { ok: r.ok };
    } catch {
        // Try alternate n8n health endpoint
        try {
            const r2 = await fetch(`${N8N}/api/v1/workflows?limit=1`, { signal: AbortSignal.timeout(3000) });
            return { ok: r2.status < 500 };
        } catch { return { ok: false }; }
    }
}

export async function GET() {
    const [ollama, comfy, n8n] = await Promise.all([checkOllama(), checkComfy(), checkN8n()]);
    return NextResponse.json(
        { ollama, comfy, n8n, ts: Date.now() },
        { headers: { 'Cache-Control': 'no-store' } }
    );
}
