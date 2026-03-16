'use client';
import { useEffect, useState, useCallback } from 'react';
import { Cpu, Zap, GitBranch, Wifi, WifiOff, Loader2, RefreshCw, Server } from 'lucide-react';

interface Status {
    ollama: { ok: boolean; models: string[] };
    comfy: { ok: boolean; queue: { running: number; pending: number }; vram_free_gb: number | null };
    n8n: { ok: boolean };
    ts: number;
}

function Dot({ ok, pulsing }: { ok: boolean; pulsing?: boolean }) {
    return (
        <span className={`inline-block w-1.5 h-1.5 rounded-full ${ok ? 'bg-emerald-400' : 'bg-red-500'} ${pulsing && ok ? 'animate-pulse' : ''}`} />
    );
}

export default function SystemStatusBar() {
    const [status, setStatus] = useState<Status | null>(null);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState(false);

    const poll = useCallback(async () => {
        try {
            const r = await fetch('/api/monitor/status', { cache: 'no-store' });
            if (r.ok) setStatus(await r.json());
        } catch { /* silent */ }
        finally { setLoading(false); }
    }, []);

    useEffect(() => {
        poll();
        const t = setInterval(poll, 12000); // poll every 12s
        return () => clearInterval(t);
    }, [poll]);

    const allOk = status?.ollama.ok && status?.comfy.ok;
    const comfyBusy = (status?.comfy.queue.running ?? 0) > 0;

    return (
        <div className="sticky top-0 z-50 w-full border-b border-[#1a1a1a] bg-[#080808]/95 backdrop-blur-sm">
            <div className="flex items-center gap-3 px-4 h-8 text-[10px] font-mono">

                {/* Brand */}
                <span className="text-neutral-700 font-bold tracking-widest uppercase text-[9px] hidden md:block">
                    AI Factory
                </span>
                <span className="text-neutral-800 hidden md:block">|</span>

                {loading ? (
                    <Loader2 size={9} className="animate-spin text-neutral-700" />
                ) : (
                    <div className="flex items-center gap-3 flex-1">
                        {/* Ollama */}
                        <button
                            onClick={() => setExpanded(e => !e)}
                            className="flex items-center gap-1.5 hover:text-neutral-300 transition-colors"
                        >
                            <Dot ok={status?.ollama.ok ?? false} />
                            <Cpu size={9} className={status?.ollama.ok ? 'text-emerald-400' : 'text-red-500'} />
                            <span className={status?.ollama.ok ? 'text-neutral-400' : 'text-red-400'}>
                                Ollama{status?.ollama.ok ? ` · ${status.ollama.models.length}m` : ' ✗'}
                            </span>
                        </button>

                        <span className="text-neutral-800">·</span>

                        {/* ComfyUI */}
                        <div className="flex items-center gap-1.5">
                            <Dot ok={status?.comfy.ok ?? false} pulsing={comfyBusy} />
                            <Zap size={9} className={status?.comfy.ok ? (comfyBusy ? 'text-amber-400 animate-pulse' : 'text-emerald-400') : 'text-red-500'} />
                            <span className={status?.comfy.ok ? (comfyBusy ? 'text-amber-400' : 'text-neutral-400') : 'text-red-400'}>
                                ComfyUI{status?.comfy.ok
                                    ? comfyBusy
                                        ? ` · ${status.comfy.queue.running} gen${status.comfy.queue.pending > 0 ? ` +${status.comfy.queue.pending} wait` : ''}`
                                        : ' · idle'
                                    : ' ✗'}
                            </span>
                            {status?.comfy.ok && status.comfy.vram_free_gb !== null && (
                                <span className="text-neutral-700">{status.comfy.vram_free_gb}GB VRAM free</span>
                            )}
                        </div>

                        <span className="text-neutral-800">·</span>

                        {/* n8n */}
                        <div className="flex items-center gap-1.5">
                            <Dot ok={status?.n8n.ok ?? false} />
                            <GitBranch size={9} className={status?.n8n.ok ? 'text-emerald-400' : 'text-neutral-600'} />
                            <span className={status?.n8n.ok ? 'text-neutral-400' : 'text-neutral-700'}>
                                n8n{status?.n8n.ok ? ' · live' : ' · offline'}
                            </span>
                        </div>

                        {/* VRAM / overall health indicator */}
                        <div className="ml-auto flex items-center gap-2">
                            {!allOk && (
                                <span className="text-amber-400/80 text-[9px]">
                                    ⚠ Some services offline
                                </span>
                            )}
                            <button
                                onClick={poll}
                                className="text-neutral-800 hover:text-neutral-500 transition-colors"
                                title="Refresh status"
                            >
                                <RefreshCw size={9} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Expanded model list */}
            {expanded && status?.ollama.ok && status.ollama.models.length > 0 && (
                <div className="px-4 pb-2 flex flex-wrap gap-1.5 border-t border-[#111]">
                    {status.ollama.models.map(m => (
                        <span key={m} className="text-[9px] px-2 py-0.5 rounded bg-[#111] border border-[#1e1e1e] text-neutral-500 font-mono">
                            {m}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}
