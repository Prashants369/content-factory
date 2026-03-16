'use client';
import { useState, useEffect } from 'react';
import {
    Network, CheckCircle2, XCircle, Loader2, RefreshCw, Settings,
    Image, Zap, Brain, AlertTriangle, ChevronRight, Play, ExternalLink,
    Terminal, HardDrive, Wifi, WifiOff, RotateCcw
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────
interface ServiceStatus {
    online: boolean;
    latency?: number;
    version?: string;
    details?: string;
    loading: boolean;
}

interface ComfyTemplate {
    id: string;
    name: string;
    file: string;
    description: string;
}

interface OllamaModel {
    name: string;
    size: number;
    modified_at: string;
}

const COMFY_TEMPLATES: ComfyTemplate[] = [
    { id: 'flux-9b-txt2img', name: '⚡ Generate (Step 1)', file: 'flux-9b-base-v2.json', description: 'Flux 9B txt2img + IPAdapter face lock. The base generation step.' },
    { id: 'flux-9b-i2i', name: '🔄 Refine (Step 2)', file: 'flux-9b-refine-i2i.json', description: 'Flux 9B img2img + IPAdapter. Face-consistent edits on an existing image.' },
    { id: 'flux-9b-detailer', name: '✨ Detail (Step 3)', file: 'flux-9b-detailer-zimage.json', description: 'Z-Image ColorMatch + FastUnsharp — makes skin/texture photorealistic.' },
    { id: 'seedvr2-upscaler', name: '🚀 Upscale (Step 4)', file: 'upscale-seedvr2.json', description: 'SeedVR2 diffusion upscale to 2048px. Final export quality.' },
];

// ── Status Ping ─────────────────────────────────────────────────────────
async function pingService(url: string, path = ''): Promise<{ ok: boolean; latency: number; data?: any }> {
    const start = Date.now();
    try {
        const res = await fetch(`/api/integrations/ping?url=${encodeURIComponent(url + path)}`, { signal: AbortSignal.timeout(4000) });
        const json = await res.json();
        return { ok: json.ok, latency: Date.now() - start, data: json.data };
    } catch {
        return { ok: false, latency: Date.now() - start };
    }
}

// ── Service Card ─────────────────────────────────────────────────────────
function ServiceCard({
    name, icon: Icon, accent, status, url, onTest, children
}: {
    name: string; icon: any; accent: string; status: ServiceStatus;
    url: string; onTest: () => void; children?: React.ReactNode;
}) {
    const online = status.online;
    return (
        <div className={`border rounded-2xl overflow-hidden ${online ? `border-${accent}-500/20 bg-${accent}-500/3` : 'border-[#1e1e1e] bg-[#0c0c0c]'}`}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a1a1a]">
                <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${online ? `bg-${accent}-500/15` : 'bg-[#141414]'}`}>
                        <Icon className={`w-5 h-5 ${online ? `text-${accent}-400` : 'text-neutral-700'}`} />
                    </div>
                    <div>
                        <div className="font-bold text-sm text-neutral-200">{name}</div>
                        <div className="text-[9px] text-neutral-600 font-mono">{url}</div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {status.loading ? (
                        <Loader2 size={14} className="text-neutral-600 animate-spin" />
                    ) : online ? (
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[9px] text-emerald-400 font-mono">{status.latency}ms</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-red-500" />
                            <span className="text-[9px] text-red-500 font-mono">OFFLINE</span>
                        </div>
                    )}
                    <button onClick={onTest} className="p-1.5 rounded-lg border border-[#2a2a2a] hover:bg-[#1a1a1a] text-neutral-600 hover:text-neutral-300 transition-colors">
                        <RotateCcw size={11} />
                    </button>
                </div>
            </div>
            {children && (
                <div className="px-5 py-4">
                    {children}
                </div>
            )}
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function WorkflowsPage() {
    const [comfyStatus, setComfyStatus] = useState<ServiceStatus>({ online: false, loading: true });
    const [n8nStatus, setN8nStatus] = useState<ServiceStatus>({ online: false, loading: true });
    const [ollamaStatus, setOllamaStatus] = useState<ServiceStatus>({ online: false, loading: true });

    const [comfyUrl, setComfyUrl] = useState(process.env.NEXT_PUBLIC_COMFYUI_URL || 'http://127.0.0.1:8188');
    const [n8nUrl, setN8nUrl] = useState(process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/generate-ideas');
    const [ollamaUrl, setOllamaUrl] = useState(process.env.NEXT_PUBLIC_OLLAMA_URL || 'http://127.0.0.1:11434');

    const [ollamaModels, setOllamaModels] = useState<OllamaModel[]>([]);
    const [selectedOllamaModel, setSelectedOllamaModel] = useState('');
    const [defaultWorkflow, setDefaultWorkflow] = useState('flux-9b-txt2img');
    const [testOutput, setTestOutput] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);

    const [launcherError, setLauncherError] = useState<string | null>(null);

    const startService = async (service: 'comfyui' | 'n8n' | 'ollama', testFn: () => void, statusSetter: any) => {
        statusSetter((s: any) => ({ ...s, loading: true }));
        setLauncherError(null);
        try {
            const res = await fetch('/api/launcher', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ service, action: 'start' })
            });
            const data = await res.json();
            if (!data.ok) {
                setLauncherError(`${service.toUpperCase()} Error: ${data.error}`);
                statusSetter((s: any) => ({ ...s, loading: false }));
                return;
            }
            // Wait for service to warm up then test
            setTimeout(testFn, 5000);
        } catch (e: any) {
            setLauncherError(`Network fail: ${e.message}`);
            statusSetter((s: any) => ({ ...s, loading: false }));
        }
    };

    const testComfy = async () => {
        setComfyStatus(s => ({ ...s, loading: true }));
        try {
            const res = await fetch(`${comfyUrl}/system_stats`, { signal: AbortSignal.timeout(4000) });
            if (res.ok) {
                const data = await res.json();
                setComfyStatus({ online: true, loading: false, latency: 0, version: data?.system?.python_version, details: `${data?.devices?.[0]?.name || 'GPU'}` });
            } else throw new Error();
        } catch {
            setComfyStatus({ online: false, loading: false });
        }
    };

    const testN8n = async () => {
        setN8nStatus(s => ({ ...s, loading: true }));
        try {
            const baseUrl = n8nUrl.split('/webhook')[0];
            const res = await fetch(`${baseUrl}/healthz`, { signal: AbortSignal.timeout(4000) });
            setN8nStatus({ online: res.ok, loading: false, latency: 0 });
        } catch {
            setN8nStatus({ online: false, loading: false });
        }
    };

    const testOllama = async () => {
        setOllamaStatus(s => ({ ...s, loading: true }));
        try {
            const res = await fetch(`${ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(4000) });
            if (res.ok) {
                const data = await res.json();
                const models = data?.models || [];
                setOllamaModels(models);
                if (models.length > 0 && !selectedOllamaModel) setSelectedOllamaModel(models[0].name);
                setOllamaStatus({ online: true, loading: false, details: `${models.length} models available` });
            } else throw new Error();
        } catch {
            setOllamaStatus({ online: false, loading: false });
        }
    };

    const sendTestIdeaToN8n = async () => {
        setTestOutput(p => ({ ...p, n8n: 'Sending test payload...' }));
        try {
            const res = await fetch(n8nUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    influencer_id: 'test',
                    name: 'Test Influencer',
                    niche: 'AI Luxury Lifestyle — India',
                    dna: {
                        viral_strategy: {
                            market_focus: 'India', pacing_bpm: 130,
                            reading_grade_level: 5, target_cpm: 15,
                            psychological_hooks: ['Status Signaling', 'FOMO'],
                            platform_priority: ['Instagram', 'Pinterest'],
                            primary_hook_archetype: 'The Contrarian',
                            target_retention_curve: '3s shock → 12s build → 0.4s loop'
                        }
                    }
                })
            });
            setTestOutput(p => ({ ...p, n8n: res.ok ? `✓ n8n received payload! Status: ${res.status}` : `✗ n8n returned ${res.status}` }));
        } catch (e: any) {
            setTestOutput(p => ({ ...p, n8n: `✗ Connection failed: ${e.message}` }));
        }
    };

    const testOllamaGenerate = async () => {
        if (!selectedOllamaModel) return;
        setTestOutput(p => ({ ...p, ollama: 'Generating test idea...' }));
        try {
            const res = await fetch(`${ollamaUrl}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: selectedOllamaModel,
                    prompt: 'Write 1 viral Instagram hook (max 10 words) for a luxury lifestyle AI influencer targeting India.',
                    stream: false
                }),
                signal: AbortSignal.timeout(30000)
            });
            const data = await res.json();
            setTestOutput(p => ({ ...p, ollama: `✓ ${data.response?.trim() || 'Empty response'}` }));
        } catch (e: any) {
            setTestOutput(p => ({ ...p, ollama: `✗ ${e.message}` }));
        }
    };

    const saveSettings = async () => {
        setSaving(true);
        try {
            await fetch('/api/integrations/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ comfyUrl, n8nUrl, ollamaUrl, defaultWorkflow, selectedOllamaModel })
            });
            setTestOutput(p => ({ ...p, settings: '✓ Settings saved!' }));
        } catch {
            setTestOutput(p => ({ ...p, settings: '✗ Save failed' }));
        } finally { setSaving(false); setTimeout(() => setTestOutput(p => ({ ...p, settings: '' })), 2000); }
    };

    useEffect(() => {
        testComfy(); testN8n(); testOllama();
        // Load saved settings
        const saved = localStorage.getItem('factory_settings');
        if (saved) {
            const s = JSON.parse(saved);
            if (s.comfyUrl) setComfyUrl(s.comfyUrl);
            if (s.n8nUrl) setN8nUrl(s.n8nUrl);
            if (s.ollamaUrl) setOllamaUrl(s.ollamaUrl);
            if (s.defaultWorkflow) setDefaultWorkflow(s.defaultWorkflow);
            if (s.selectedOllamaModel) setSelectedOllamaModel(s.selectedOllamaModel);
        }
    }, []);

    const saveToLocalStorage = () => {
        localStorage.setItem('factory_settings', JSON.stringify({ comfyUrl, n8nUrl, ollamaUrl, defaultWorkflow, selectedOllamaModel }));
        setTestOutput(p => ({ ...p, settings: '✓ Config saved to browser!' }));
        setTimeout(() => setTestOutput(p => ({ ...p, settings: '' })), 2000);
    };

    const allOnline = comfyStatus.online && n8nStatus.online && ollamaStatus.online;
    const anyOnline = comfyStatus.online || n8nStatus.online || ollamaStatus.online;

    return (
        <div className="h-full overflow-y-auto bg-[#080808] text-neutral-300">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e1e1e] bg-[#0a0a0a] sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <Network size={16} className="text-violet-400" />
                    <span className="font-bold text-sm tracking-widest uppercase">Integration Hub</span>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full border font-mono font-bold ${allOnline ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                        anyOnline ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
                            'bg-red-500/10 border-red-500/20 text-red-400'
                        }`}>
                        {allOnline ? 'ALL SYSTEMS GO' : anyOnline ? 'PARTIAL' : 'OFFLINE'}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => { testComfy(); testN8n(); testOllama(); }}
                        className="flex items-center gap-1.5 text-[10px] px-3 py-1.5 rounded-lg border border-[#2a2a2a] hover:bg-[#1a1a1a] text-neutral-500 transition-colors">
                        <RefreshCw size={10} /> Test All
                    </button>
                    <button onClick={saveToLocalStorage}
                        className="flex items-center gap-1.5 text-[10px] px-3 py-1.5 rounded-lg bg-violet-700 hover:bg-violet-600 text-white font-bold transition-colors">
                        <Settings size={10} /> Save Config
                    </button>
                </div>
            </div>

            <div className="p-6 space-y-6 max-w-4xl mx-auto">
                {launcherError && (
                    <div className="flex items-start gap-4 p-4 rounded-2xl bg-red-500/5 border border-red-500/20 animate-in fade-in slide-in-from-top-4 duration-300">
                        <AlertTriangle className="text-red-500 mt-1 shrink-0" size={20} />
                        <div className="flex-1">
                            <h3 className="text-sm font-bold text-red-500 uppercase tracking-widest">Service Launch Failed</h3>
                            <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed">{launcherError}</p>
                            <p className="text-[9px] text-neutral-600 mt-3 font-mono">Check if the executable exists in the path defined in <span className="text-violet-400 font-bold uppercase cursor-pointer" onClick={() => window.location.href = '/settings'}>API Vault / Settings</span>.</p>
                        </div>
                        <button onClick={() => setLauncherError(null)} className="px-3 py-1.5 rounded-lg border border-red-500/20 text-red-500 text-[10px] font-bold hover:bg-red-500/10 transition-colors uppercase">Dismiss</button>
                    </div>
                )}

                {/* ── ComfyUI ─────────────────────────────────── */}
                <div>
                    <h2 className="text-[10px] font-black uppercase tracking-widest text-neutral-600 mb-3 flex items-center gap-2">
                        <Image size={10} /> ComfyUI — Image Generation
                    </h2>
                    <div className="space-y-3">
                        <div className="bg-[#0c0c0c] border border-[#1e1e1e] rounded-2xl overflow-hidden">
                            <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a1a1a]">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2.5 rounded-xl ${comfyStatus.online ? 'bg-violet-500/15' : 'bg-[#141414]'}`}>
                                        <Image className={`w-5 h-5 ${comfyStatus.online ? 'text-violet-400' : 'text-neutral-700'}`} />
                                    </div>
                                    <div>
                                        <div className="font-bold text-sm text-neutral-200">ComfyUI</div>
                                        <div className="text-[9px] text-neutral-600 font-mono">{comfyUrl}</div>
                                        {comfyStatus.details && <div className="text-[8px] text-neutral-700 mt-0.5">{comfyStatus.details}</div>}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {comfyStatus.loading ? <Loader2 size={14} className="text-neutral-600 animate-spin" /> : comfyStatus.online ? (
                                        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /><span className="text-[9px] text-emerald-400 font-mono">ONLINE</span></div>
                                    ) : (
                                        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500" /><span className="text-[9px] text-red-500 font-mono">OFFLINE</span></div>
                                    )}
                                    <button onClick={testComfy} className="p-1.5 rounded-lg border border-[#2a2a2a] hover:bg-[#1a1a1a] text-neutral-600 hover:text-neutral-300 transition-colors"><RotateCcw size={11} /></button>
                                </div>
                            </div>
                            <div className="px-5 py-4 space-y-4">
                                <div className="flex gap-3 items-center">
                                    <div className="flex-1">
                                        <label className="text-[8px] font-bold uppercase tracking-widest text-neutral-700 mb-1 block">URL</label>
                                        <input value={comfyUrl} onChange={e => setComfyUrl(e.target.value)}
                                            className="w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs text-neutral-300 outline-none font-mono" />
                                    </div>
                                    {!comfyStatus.online && (
                                        <a href={process.env.NEXT_PUBLIC_COMFYUI_URL || "http://127.0.0.1:8188"} target="_blank" className="text-[9px] flex items-center gap-1 mt-5 px-2 py-1.5 border border-[#2a2a2a] rounded-lg text-neutral-600 hover:text-neutral-400 transition-colors whitespace-nowrap">
                                            <ExternalLink size={9} /> Open ComfyUI
                                        </a>
                                    )}
                                </div>

                                <div>
                                    <label className="text-[8px] font-bold uppercase tracking-widest text-neutral-700 mb-2 block">Default Workflow for Image Generation</label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {COMFY_TEMPLATES.map(t => (
                                            <button key={t.id} onClick={() => setDefaultWorkflow(t.id)}
                                                className={`flex items-start gap-2 p-3 rounded-xl border text-left transition-all ${defaultWorkflow === t.id ? 'border-violet-500/40 bg-violet-500/10' : 'border-[#1e1e1e] bg-[#0d0d0d] hover:border-[#2a2a2a]'}`}>
                                                <div className={`w-2 h-2 rounded-full mt-1 shrink-0 ${defaultWorkflow === t.id ? 'bg-violet-500' : 'bg-neutral-700'}`} />
                                                <div>
                                                    <div className={`text-[10px] font-bold ${defaultWorkflow === t.id ? 'text-violet-300' : 'text-neutral-400'}`}>{t.name}</div>
                                                    <div className="text-[8px] text-neutral-600 mt-0.5">{t.description}</div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {!comfyStatus.online && (
                                    <div className="flex items-center justify-between p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
                                        <div className="flex items-start gap-2">
                                            <AlertTriangle size={12} className="text-amber-500 mt-0.5 shrink-0" />
                                            <div>
                                                <p className="text-[10px] text-amber-400 font-bold">ComfyUI is offline</p>
                                                <p className="text-[9px] text-neutral-600 mt-0.5">Start ComfyUI directly from the dashboard engine.</p>
                                            </div>
                                        </div>
                                        <button onClick={() => startService('comfyui', testComfy, setComfyStatus)} disabled={comfyStatus.loading} className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg text-amber-400 text-[9px] font-bold font-mono transition-colors disabled:opacity-50">
                                            {comfyStatus.loading ? <Loader2 size={10} className="animate-spin" /> : <Play size={10} />}
                                            START COMFYUI
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── n8n ─────────────────────────────────────── */}
                <div>
                    <h2 className="text-[10px] font-black uppercase tracking-widest text-neutral-600 mb-3 flex items-center gap-2">
                        <Zap size={10} /> n8n — Viral Idea Automation
                    </h2>
                    <div className="bg-[#0c0c0c] border border-[#1e1e1e] rounded-2xl overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a1a1a]">
                            <div className="flex items-center gap-3">
                                <div className={`p-2.5 rounded-xl ${n8nStatus.online ? 'bg-amber-500/15' : 'bg-[#141414]'}`}>
                                    <Zap className={`w-5 h-5 ${n8nStatus.online ? 'text-amber-400' : 'text-neutral-700'}`} />
                                </div>
                                <div>
                                    <div className="font-bold text-sm text-neutral-200">n8n Automation</div>
                                    <div className="text-[9px] text-neutral-600 font-mono">{n8nUrl.split('/webhook')[0]}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {n8nStatus.loading ? <Loader2 size={14} className="text-neutral-600 animate-spin" /> : n8nStatus.online ? (
                                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /><span className="text-[9px] text-emerald-400 font-mono">ONLINE</span></div>
                                ) : (
                                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500" /><span className="text-[9px] text-red-500 font-mono">OFFLINE</span></div>
                                )}
                                <button onClick={testN8n} className="p-1.5 rounded-lg border border-[#2a2a2a] hover:bg-[#1a1a1a] text-neutral-600 hover:text-neutral-300 transition-colors"><RotateCcw size={11} /></button>
                            </div>
                        </div>
                        <div className="px-5 py-4 space-y-4">
                            <div>
                                <label className="text-[8px] font-bold uppercase tracking-widest text-neutral-700 mb-1 block">Webhook URL (receive-ideas webhook)</label>
                                <input value={n8nUrl} onChange={e => setN8nUrl(e.target.value)}
                                    className="w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs text-neutral-300 outline-none font-mono" />
                            </div>

                            <div>
                                <label className="text-[8px] font-bold uppercase tracking-widest text-neutral-700 mb-2 block">n8n Workflows in This Project</label>
                                <div className="grid grid-cols-1 gap-2">
                                    {[
                                        { name: 'Trend Mining + Viral Script Engine v2', desc: 'Exa + Google Trends + Gemini 2.0 + Ollama fallback for 5 DNA-aligned ideas', file: 'n8n-1-trend-mining.json', color: 'text-amber-400' },
                                        { name: 'Auto Caption + Hook Writer', desc: 'AI-powered captions, hashtags, AIDA formula, and A/B hooks for each post', file: 'n8n-2-auto-caption-hook.json', color: 'text-violet-400' },
                                        { name: 'Viral Feedback Loop', desc: 'Pulls IG analytics and adjusts DNA based on engagement data', file: 'n8n-3-viral-feedback-loop.json', color: 'text-emerald-400' },
                                        { name: '📸 Instagram Auto-Post Engine', desc: 'Runs every 30 min — picks up Ready posts and auto-publishes to Instagram', file: 'n8n-4-instagram-autopost.json', color: 'text-pink-400' },
                                        { name: 'n8n Viral Ideas (Legacy)', desc: 'Legacy direct idea generation workflow', file: 'n8n-viral-ideas.json', color: 'text-cyan-400' },
                                    ].map(wf => (
                                        <div key={wf.name} className="flex items-center gap-3 p-3 rounded-xl bg-[#0d0d0d] border border-[#1a1a1a]">
                                            <Zap size={10} className={wf.color} />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-[10px] font-bold text-neutral-300">{wf.name}</div>
                                                <div className="text-[8px] text-neutral-600">{wf.desc}</div>
                                                <div className="text-[7px] text-neutral-800 font-mono mt-0.5">src/lib/n8n-workflows/{wf.file}</div>
                                            </div>
                                            <span className="text-[7px] px-1.5 py-0.5 rounded bg-[#1a1a1a] border border-[#252525] text-neutral-700 font-mono uppercase">JSON</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {!n8nStatus.online && (
                                <div className="flex items-center justify-between p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 mb-4">
                                    <div className="flex items-start gap-2">
                                        <AlertTriangle size={12} className="text-amber-500 mt-0.5 shrink-0" />
                                        <div>
                                            <p className="text-[10px] text-amber-400 font-bold">n8n is offline</p>
                                            <p className="text-[9px] text-neutral-600 mt-0.5">Start n8n directly from the dashboard engine.</p>
                                        </div>
                                    </div>
                                    <button onClick={() => startService('n8n', testN8n, setN8nStatus)} disabled={n8nStatus.loading} className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg text-amber-400 text-[9px] font-bold font-mono transition-colors disabled:opacity-50">
                                        {n8nStatus.loading ? <Loader2 size={10} className="animate-spin" /> : <Play size={10} />}
                                        START N8N
                                    </button>
                                </div>
                            )}

                            <div className="flex items-center gap-2">
                                <button onClick={sendTestIdeaToN8n}
                                    className="flex items-center gap-1.5 text-[10px] px-3 py-2 rounded-lg bg-amber-600/80 hover:bg-amber-500 text-white font-bold transition-colors">
                                    <Play size={9} /> Send Test Payload to n8n
                                </button>
                                <a href={process.env.NEXT_PUBLIC_N8N_URL || "http://localhost:5678"} target="_blank"
                                    className="flex items-center gap-1.5 text-[10px] px-3 py-2 rounded-lg border border-[#2a2a2a] text-neutral-500 hover:text-neutral-300 transition-colors">
                                    <ExternalLink size={9} /> Open n8n Editor
                                </a>
                            </div>
                            {testOutput.n8n && (
                                <div className={`text-[10px] font-mono p-2 rounded-lg ${testOutput.n8n.startsWith('✓') ? 'text-emerald-400 bg-emerald-500/5 border border-emerald-500/20' : 'text-red-400 bg-red-500/5 border border-red-500/20'}`}>
                                    {testOutput.n8n}
                                </div>
                            )}

                            <div className="p-3 rounded-xl bg-[#0d0d0d] border border-[#1a1a1a]">
                                <p className="text-[8px] font-bold text-neutral-600 uppercase tracking-widest mb-2">Import Instructions</p>
                                <ol className="text-[9px] text-neutral-600 space-y-1 list-decimal list-inside">
                                    <li>Open n8n at localhost:5678</li>
                                    <li>Click <strong className="text-neutral-500">New Workflow → Import from File</strong></li>
                                    <li>Import each JSON from <span className="font-mono text-neutral-700">src/lib/n8n-workflows/</span></li>
                                    <li>Add your <strong className="text-neutral-500">Exa AI / Google API keys</strong> in n8n credentials</li>
                                    <li>Activate workflow and click <strong className="text-neutral-500">Test Webhook</strong></li>
                                </ol>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Ollama ─────────────────────────────────── */}
                <div>
                    <h2 className="text-[10px] font-black uppercase tracking-widest text-neutral-600 mb-3 flex items-center gap-2">
                        <Brain size={10} /> Ollama — Local LLM Engine
                    </h2>
                    <div className="bg-[#0c0c0c] border border-[#1e1e1e] rounded-2xl overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a1a1a]">
                            <div className="flex items-center gap-3">
                                <div className={`p-2.5 rounded-xl ${ollamaStatus.online ? 'bg-emerald-500/15' : 'bg-[#141414]'}`}>
                                    <Brain className={`w-5 h-5 ${ollamaStatus.online ? 'text-emerald-400' : 'text-neutral-700'}`} />
                                </div>
                                <div>
                                    <div className="font-bold text-sm text-neutral-200">Ollama</div>
                                    <div className="text-[9px] text-neutral-600 font-mono">{ollamaUrl}</div>
                                    {ollamaStatus.details && <div className="text-[8px] text-emerald-600 mt-0.5">{ollamaStatus.details}</div>}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {ollamaStatus.loading ? <Loader2 size={14} className="text-neutral-600 animate-spin" /> : ollamaStatus.online ? (
                                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /><span className="text-[9px] text-emerald-400 font-mono">ONLINE</span></div>
                                ) : (
                                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500" /><span className="text-[9px] text-red-500 font-mono">OFFLINE</span></div>
                                )}
                                <button onClick={testOllama} className="p-1.5 rounded-lg border border-[#2a2a2a] hover:bg-[#1a1a1a] text-neutral-600 hover:text-neutral-300 transition-colors"><RotateCcw size={11} /></button>
                            </div>
                        </div>

                        <div className="px-5 py-4 space-y-4">
                            <div className="flex gap-3">
                                <div className="flex-1">
                                    <label className="text-[8px] font-bold uppercase tracking-widest text-neutral-700 mb-1 block">Ollama URL</label>
                                    <input value={ollamaUrl} onChange={e => setOllamaUrl(e.target.value)}
                                        className="w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs text-neutral-300 outline-none font-mono" />
                                </div>
                            </div>

                            {ollamaModels.length > 0 && (
                                <div>
                                    <label className="text-[8px] font-bold uppercase tracking-widest text-neutral-700 mb-2 block">Installed Models — Select for Content Generation</label>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                        {ollamaModels.map(m => (
                                            <button key={m.name} onClick={() => setSelectedOllamaModel(m.name)}
                                                className={`flex items-start gap-2 p-2.5 rounded-xl border text-left transition-all ${selectedOllamaModel === m.name ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-[#1e1e1e] bg-[#0d0d0d] hover:border-[#2a2a2a]'}`}>
                                                <div className={`w-1.5 h-1.5 rounded-full mt-1 shrink-0 ${selectedOllamaModel === m.name ? 'bg-emerald-500' : 'bg-neutral-700'}`} />
                                                <div>
                                                    <div className={`text-[9px] font-bold font-mono ${selectedOllamaModel === m.name ? 'text-emerald-300' : 'text-neutral-500'}`}>{m.name}</div>
                                                    <div className="text-[7px] text-neutral-700 mt-0.5">{(m.size / 1e9).toFixed(1)} GB</div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {ollamaStatus.online && ollamaModels.length === 0 && (
                                <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
                                    <AlertTriangle size={12} className="text-amber-500 mt-0.5 shrink-0" />
                                    <div>
                                        <p className="text-[10px] text-amber-400 font-bold">Ollama running but no models installed</p>
                                        <p className="text-[9px] text-neutral-600 mt-0.5 font-mono">Run: <span className="text-amber-500">ollama pull gemma3:4b</span> or <span className="text-amber-500">ollama pull llama3.2</span></p>
                                    </div>
                                </div>
                            )}

                            {!ollamaStatus.online && (
                                <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                                    <div className="flex items-start gap-2">
                                        <AlertTriangle size={12} className="text-emerald-500 mt-0.5 shrink-0" />
                                        <div>
                                            <p className="text-[10px] text-emerald-400 font-bold">Ollama is offline</p>
                                            <p className="text-[9px] text-neutral-600 mt-0.5 font-mono">Start Ollama directly from the dashboard engine.</p>
                                        </div>
                                    </div>
                                    <button onClick={() => startService('ollama', testOllama, setOllamaStatus)} disabled={ollamaStatus.loading} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg text-emerald-400 text-[9px] font-bold font-mono transition-colors disabled:opacity-50">
                                        {ollamaStatus.loading ? <Loader2 size={10} className="animate-spin" /> : <Play size={10} />}
                                        START OLLAMA
                                    </button>
                                </div>
                            )}

                            <div className="flex items-center gap-2">
                                <button onClick={testOllamaGenerate} disabled={!ollamaStatus.online || !selectedOllamaModel}
                                    className="flex items-center gap-1.5 text-[10px] px-3 py-2 rounded-lg bg-emerald-700/80 hover:bg-emerald-600 text-white font-bold transition-colors disabled:opacity-40">
                                    <Play size={9} /> Test Idea Generation
                                </button>
                            </div>
                            {testOutput.ollama && (
                                <div className={`text-[10px] font-mono p-2 rounded-lg leading-relaxed ${testOutput.ollama.startsWith('✓') ? 'text-emerald-400 bg-emerald-500/5 border border-emerald-500/20' : 'text-red-400 bg-red-500/5 border border-red-500/20'}`}>
                                    {testOutput.ollama}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Save */}
                <div className="flex items-center justify-between pb-8">
                    <div className="text-[9px] text-neutral-700">Config is stored in your browser. All URLs are used live by the factory.</div>
                    <button onClick={saveToLocalStorage}
                        className="flex items-center gap-1.5 text-[10px] px-4 py-2 rounded-lg bg-violet-700 hover:bg-violet-600 text-white font-bold transition-colors">
                        <Settings size={10} /> Save All Settings
                    </button>
                </div>
                {testOutput.settings && (
                    <div className="text-[10px] font-mono text-emerald-400 text-center">{testOutput.settings}</div>
                )}
            </div>
        </div>
    );
}
