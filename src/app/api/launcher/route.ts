import { NextResponse } from 'next/server';
import { spawn, ChildProcess } from 'child_process';
import db from '@/lib/db';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs';

// ── PID registry (lives for the Node process lifetime) ─────────────────────
const processes: Map<string, { proc: ChildProcess; log: string[]; startedAt: number }> = new Map();

type Service = 'comfyui' | 'n8n' | 'ollama' | 'agent_engine';

function getComfyBat(mode: 'gpu' | 'cpu' = 'gpu'): string {
    // Try to read from DB/env first, fall back to portable install default
    if (!db) return mode === 'gpu'
        ? 'C:\\ComfyUI_windows_portable\\run_nvidia_gpu.bat'
        : 'C:\\ComfyUI_windows_portable\\run_cpu.bat';

    const row = db.prepare("SELECT value FROM api_credentials WHERE key = ?")
        .get(mode === 'gpu' ? 'COMFYUI_BAT_GPU' : 'COMFYUI_BAT_CPU') as any;
    if (row?.value) return row.value;
    return mode === 'gpu'
        ? 'C:\\ComfyUI_windows_portable\\run_nvidia_gpu.bat'
        : 'C:\\ComfyUI_windows_portable\\run_cpu.bat';
}

function getN8nDir(): string {
    if (!db) return 'z:\\n8n';
    try {
        const row = db.prepare("SELECT value FROM api_credentials WHERE key = 'N8N_DIR'").get() as any;
        return row?.value || 'z:\\n8n';
    } catch { return 'z:\\n8n'; }
}

function appendLog(service: string, line: string) {
    const entry = processes.get(service);
    if (!entry) return;
    entry.log.push(line);
    if (entry.log.length > 50) entry.log.shift(); // keep last 50 lines
}

function startService(service: Service, mode?: string): { pid?: number; error?: string } {
    if (processes.get(service)?.proc.exitCode === null) {
        return { error: 'Already running' };
    }

    let proc: ChildProcess;

    try {
        if (service === 'comfyui') {
            const bat = getComfyBat((mode as 'gpu' | 'cpu') || 'gpu');
            if (!fs.existsSync(bat)) return { error: `Batch file not found: ${bat}` };

            proc = spawn('cmd.exe', ['/c', bat], {
                detached: true,
                windowsHide: false,
                shell: true,
            });
        } else if (service === 'n8n') {
            const n8nDir = getN8nDir();
            if (!fs.existsSync(n8nDir)) return { error: `n8n directory not found: ${n8nDir}` };

            proc = spawn('npx.cmd', ['n8n', 'start'], {
                cwd: n8nDir,
                detached: true,
                windowsHide: false,
                shell: true,
                env: { ...process.env, N8N_RUNNERS_ENABLED: 'true' },
            });
        } else if (service === 'ollama') {
            proc = spawn('ollama', ['serve'], {
                detached: true,
                windowsHide: true,
                shell: true,
            });
        } else if (service === 'agent_engine') {
            const engineDir = path.join(process.cwd(), 'agent_engine');
            proc = spawn('python', ['-m', 'uvicorn', 'main:app', '--host', '0.0.0.0', '--port', '8787', '--reload'], {
                cwd: engineDir,
                detached: true,
                windowsHide: true,
                shell: true,
            });
        } else {
            return { error: 'Unknown service' };
        }
    } catch (e: any) {
        return { error: `Spawn error: ${e.message}` };
    }

    processes.set(service, { proc, log: [], startedAt: Date.now() });

    proc.stdout?.on('data', (d) => appendLog(service, d.toString().trim()));
    proc.stderr?.on('data', (d) => appendLog(service, d.toString().trim()));
    proc.on('exit', (code) => {
        appendLog(service, `[EXIT] code=${code}`);
        // log to DB
        try {
            if (db) {
                db.prepare(`
                    INSERT INTO launcher_log (id, service, action, pid, exit_code, log_tail, started_at)
                    VALUES (?, ?, 'stop', ?, ?, ?, CURRENT_TIMESTAMP)
                `).run(randomUUID(), service, proc.pid ?? null, code ?? null,
                    processes.get(service)?.log.slice(-10).join('\n') ?? '');
            }
        } catch { /* non-fatal */ }
    });

    // Log start event
    try {
        if (db) {
            db.prepare(`
                INSERT INTO launcher_log (id, service, action, pid, started_at)
                VALUES (?, ?, 'start', ?, CURRENT_TIMESTAMP)
            `).run(randomUUID(), service, proc.pid ?? null);
        }
    } catch { /* non-fatal */ }

    return { pid: proc.pid };
}

// ── POST /api/launcher ─────────────────────────────────────────────────────
export async function POST(req: Request) {
    try {
        const { service, action, mode } = await req.json() as {
            service: Service; action: 'start' | 'stop'; mode?: string;
        };

        if (!service || !['comfyui', 'n8n', 'ollama', 'agent_engine'].includes(service)) {
            return NextResponse.json({ error: 'Invalid service' }, { status: 400 });
        }

        if (action === 'start') {
            const result = startService(service, mode);
            if (result.error) return NextResponse.json({ ok: false, error: result.error }, { status: 409 });
            return NextResponse.json({ ok: true, pid: result.pid });
        }

        if (action === 'stop') {
            const entry = processes.get(service);
            if (!entry || entry.proc.exitCode !== null) {
                return NextResponse.json({ ok: false, error: 'Not running' }, { status: 409 });
            }
            entry.proc.kill('SIGTERM');
            // Force kill after 3s if still alive
            setTimeout(() => {
                try { entry.proc.kill('SIGKILL'); } catch { }
            }, 3000);
            return NextResponse.json({ ok: true });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// ── GET /api/launcher — status of all services ───────────────────────────
export async function GET() {
    const services: Service[] = ['comfyui', 'n8n', 'ollama', 'agent_engine'];
    const status: Record<string, any> = {};
    for (const s of services) {
        const entry = processes.get(s);
        const running = !!entry && entry.proc.exitCode === null;
        status[s] = {
            running,
            pid: running ? entry?.proc.pid : null,
            uptime: running ? Math.floor((Date.now() - (entry?.startedAt ?? 0)) / 1000) : 0,
            log: entry?.log.slice(-20) ?? [],
        };
    }
    return NextResponse.json(status);
}
