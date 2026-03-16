'use client';
import { useState, useEffect, useCallback } from 'react';
import {
    Send, Sparkles, RefreshCw, Loader2, Instagram, Calendar,
    ToggleLeft, ToggleRight, ExternalLink, Heart, MessageCircle,
    Eye, Bookmark, TrendingUp, CheckCircle2, Zap, Music,
    ChevronDown, ChevronUp, User, Settings, Cpu,
    Play, Copy, Check, AlertCircle
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────
type PostStatus = 'Idea' | 'Image_Gen' | 'Ready' | 'Posted';

interface Influencer {
    id: string;
    name: string;
    niche: string;
    avatar_image_path?: string;
    ig_followers?: number;
    ig_avg_engagement?: number;
}

interface Post {
    id: string;
    influencer_id: string;
    influencer_name?: string;
    viral_hook: string;
    caption: string;
    hashtags?: string;
    music_suggestion?: string;
    engagement_strategy?: string;
    monetization_angle?: string;
    video_hook_variations?: string;
    image_prompt?: string;
    media_path?: string;
    status: PostStatus;
    scheduled_at?: string;
    posted_at?: string;
    autopost_enabled?: number;
    platform?: string;
    ig_post_id?: string;
    ig_permalink?: string;
    ig_likes?: number;
    ig_comments?: number;
    ig_reach?: number;
    ig_saves?: number;
    ig_engagement_rate?: number;
}

const COLUMNS: { id: PostStatus; label: string; dot: string; textColor: string }[] = [
    { id: 'Idea', label: '💡 Ideas', dot: 'bg-neutral-600', textColor: 'text-neutral-500' },
    { id: 'Image_Gen', label: '🎨 Rendering', dot: 'bg-amber-500', textColor: 'text-amber-400' },
    { id: 'Ready', label: '✅ Ready', dot: 'bg-cyan-500', textColor: 'text-cyan-400' },
    { id: 'Posted', label: '🚀 Posted', dot: 'bg-emerald-500', textColor: 'text-emerald-400' },
];

// ── Micro engagement bar ─────────────────────────────────────────────────────
function EngagementBar({ post }: { post: Post }) {
    if (!post.ig_post_id) return null;
    return (
        <div className="mt-2 pt-2 border-t border-[#1a1a1a] grid grid-cols-4 gap-0.5 text-center">
            {[
                { icon: Heart, val: post.ig_likes || 0, color: 'text-rose-400' },
                { icon: MessageCircle, val: post.ig_comments || 0, color: 'text-blue-400' },
                { icon: Eye, val: post.ig_reach || 0, color: 'text-cyan-400' },
                { icon: Bookmark, val: post.ig_saves || 0, color: 'text-violet-400' },
            ].map(({ icon: Icon, val, color }) => (
                <div key={color} className="flex flex-col items-center gap-0.5">
                    <Icon size={8} className={color} />
                    <span className="text-[7px] font-mono text-neutral-600">{val > 999 ? (val / 1000).toFixed(1) + 'K' : val}</span>
                </div>
            ))}
        </div>
    );
}

// ── Post Card ────────────────────────────────────────────────────────────────
function PostCard({ post, onMoveStatus, onSchedule, onSyncAnalytics, onPublishNow }: {
    post: Post;
    onMoveStatus: (id: string, status: PostStatus) => void;
    onSchedule: (post: Post) => void;
    onSyncAnalytics: (post: Post) => void;
    onPublishNow?: (post: Post) => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const [copying, setCopying] = useState(false);
    const hooks: string[] = (() => { try { return JSON.parse(post.video_hook_variations || '[]'); } catch { return []; } })();

    const copyCaption = async () => {
        await navigator.clipboard.writeText(`${post.viral_hook}\n\n${post.caption}\n\n${post.hashtags || ''}`);
        setCopying(true);
        setTimeout(() => setCopying(false), 1500);
    };

    const next: Record<PostStatus, PostStatus | null> = { 'Idea': 'Image_Gen', 'Image_Gen': 'Ready', 'Ready': 'Posted', 'Posted': null };

    return (
        <div className="bg-[#0c0c0c] border border-[#1e1e1e] rounded-xl overflow-hidden hover:border-[#2a2a2a] transition-all group">
            {post.media_path && (
                <div className="relative h-24 overflow-hidden">
                    <img src={post.media_path} alt="" className="w-full h-full object-cover object-[center_15%] group-hover:scale-105 transition-transform duration-500" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0c0c0c] via-transparent to-transparent" />
                    {post.ig_permalink && (
                        <a href={post.ig_permalink} target="_blank" className="absolute top-1.5 right-1.5 p-1 rounded bg-black/60 hover:bg-black/80 backdrop-blur-sm">
                            <Instagram size={9} className="text-pink-400" />
                        </a>
                    )}
                </div>
            )}

            <div className="p-2.5 space-y-1.5">
                <p className="text-[9px] font-bold text-neutral-200 line-clamp-2 leading-snug">
                    {post.viral_hook || 'Untitled'}
                </p>

                {post.music_suggestion && (
                    <div className="flex items-center gap-1 text-[7px] text-emerald-600 font-mono">
                        <Music size={7} />
                        <span className="truncate">{post.music_suggestion.slice(0, 20)}</span>
                    </div>
                )}

                <EngagementBar post={post} />

                {/* Expand */}
                {expanded && (
                    <div className="space-y-1.5 pt-1.5 border-t border-[#191919]">
                        {post.caption && <p className="text-[8px] text-neutral-600 leading-relaxed">{post.caption}</p>}
                        {post.hashtags && <p className="text-[7px] text-violet-700 font-mono">{post.hashtags.slice(0, 80)}...</p>}
                        {post.engagement_strategy && (
                            <div className="p-1.5 rounded bg-amber-500/5 border border-amber-500/10">
                                <p className="text-[7px] text-amber-600">🎯 {post.engagement_strategy}</p>
                            </div>
                        )}
                        {post.monetization_angle && (
                            <div className="p-1.5 rounded bg-emerald-500/5 border border-emerald-500/10 mt-1">
                                <p className="text-[7px] font-bold text-emerald-500 uppercase tracking-widest mb-0.5 flex items-center gap-1">💰 Monetization Vector</p>
                                <p className="text-[7px] text-emerald-400/80">{post.monetization_angle}</p>
                            </div>
                        )}
                        {hooks.length > 0 && (
                            <div className="space-y-0.5">
                                <p className="text-[7px] text-neutral-700 uppercase font-bold">A/B Hooks</p>
                                {hooks.slice(0, 2).map((h, i) => <p key={i} className="text-[7px] text-neutral-700 italic">"{h}"</p>)}
                            </div>
                        )}
                        {post.image_prompt && (
                            <div>
                                <p className="text-[7px] text-neutral-700 uppercase font-bold mb-0.5">Image Prompt</p>
                                <p className="text-[7px] text-neutral-700 leading-relaxed line-clamp-3">{post.image_prompt}</p>
                            </div>
                        )}
                    </div>
                )}

                <div className="flex items-center gap-1">
                    <button onClick={() => setExpanded(e => !e)}
                        className="flex-1 flex items-center justify-center gap-0.5 py-0.5 text-[7px] text-neutral-800 hover:text-neutral-600 transition-colors">
                        {expanded ? <ChevronUp size={7} /> : <ChevronDown size={7} />}
                        {expanded ? 'Less' : 'More'}
                    </button>
                    <button onClick={copyCaption}
                        className="p-1 rounded text-neutral-800 hover:text-neutral-500 transition-colors">
                        {copying ? <Check size={8} className="text-emerald-400" /> : <Copy size={8} />}
                    </button>
                </div>

                {/* Actions */}
                <div className="pt-1 border-t border-[#191919] space-y-1">
                    {post.status === 'Ready' && (
                        <div className="flex gap-1">
                            <button onClick={() => onSchedule(post)}
                                className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[8px] font-bold rounded-lg border border-[#2a2a2a] text-neutral-400 hover:text-white hover:border-[#3a3a3a] transition-all">
                                <Calendar size={8} /> {post.autopost_enabled ? 'Scheduled' : 'Schedule'}
                            </button>
                            <button onClick={() => onPublishNow?.(post)}
                                className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[8px] font-bold rounded-lg bg-gradient-to-r from-pink-700 to-violet-700 hover:from-pink-600 hover:to-violet-600 text-white transition-all shadow-sm">
                                <Send size={8} /> Publish Now
                            </button>
                        </div>
                    )}
                    {post.status === 'Posted' && post.ig_post_id && (
                        <button onClick={() => onSyncAnalytics(post)}
                            className="w-full flex items-center justify-center gap-1 py-1 text-[8px] rounded-lg border border-[#2a2a2a] text-neutral-700 hover:text-neutral-400 hover:border-[#3a3a3a] transition-colors">
                            <RefreshCw size={8} /> Sync Analytics
                        </button>
                    )}
                    {next[post.status] && (
                        <button onClick={() => onMoveStatus(post.id, next[post.status]!)}
                            className="w-full py-0.5 text-[7px] text-neutral-800 hover:text-neutral-500 transition-colors border border-[#191919] rounded-lg hover:border-[#252525]">
                            → Move to {next[post.status]}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Schedule Modal ───────────────────────────────────────────────────────────
function ScheduleModal({ post, onClose, onSave }: {
    post: Post;
    onClose: () => void;
    onSave: (postId: string, scheduledAt: string, autopost: boolean, hashtags: string) => void;
}) {
    const [scheduledAt, setScheduledAt] = useState(new Date(Date.now() + 3600000).toISOString().slice(0, 16));
    const [autopost, setAutopost] = useState(!!post.autopost_enabled);
    const [hashtags, setHashtags] = useState(post.hashtags || '#aiinfluencer #contentcreator #viral #trending #india #reels');

    const bestTimes = [
        { label: '7PM Tonight', time: () => { const d = new Date(); d.setHours(19, 0, 0, 0); return d.toISOString().slice(0, 16); } },
        { label: '9AM Tomorrow', time: () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d.toISOString().slice(0, 16); } },
        { label: '12PM Tomorrow', time: () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(12, 0, 0, 0); return d.toISOString().slice(0, 16); } },
        { label: 'Fri 8PM', time: () => { const d = new Date(); const diff = (5 - d.getDay() + 7) % 7 || 7; d.setDate(d.getDate() + diff); d.setHours(20, 0, 0, 0); return d.toISOString().slice(0, 16); } },
    ];

    return (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-2xl w-full max-w-md shadow-2xl">
                <div className="p-4 border-b border-[#1e1e1e] flex items-center justify-between">
                    <h3 className="text-xs font-black text-neutral-100 flex items-center gap-2">
                        <Instagram size={12} className="text-pink-400" /> Schedule to Instagram
                    </h3>
                    <button onClick={onClose} className="text-neutral-600 hover:text-white">&times;</button>
                </div>
                <div className="p-4 space-y-4">
                    <div>
                        <label className="text-[8px] font-black uppercase tracking-widest text-neutral-600 block mb-2">⚡ Best Times (India)</label>
                        <div className="grid grid-cols-4 gap-1.5">
                            {bestTimes.map(t => (
                                <button key={t.label} onClick={() => setScheduledAt(t.time())}
                                    className="p-2 rounded-xl border border-[#1e1e1e] hover:border-pink-500/30 hover:bg-pink-500/5 text-center transition-all">
                                    <div className="text-[8px] font-bold text-neutral-400">{t.label}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="text-[8px] font-black uppercase tracking-widest text-neutral-600 block mb-1">Date & Time</label>
                        <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)}
                            className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl px-3 py-2 text-xs text-neutral-300 outline-none" />
                    </div>
                    <div>
                        <label className="text-[8px] font-black uppercase tracking-widest text-neutral-600 block mb-1">Hashtags</label>
                        <textarea value={hashtags} onChange={e => setHashtags(e.target.value)} rows={2}
                            className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl px-3 py-2 text-[9px] text-violet-400 font-mono outline-none resize-none leading-relaxed" />
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-xl bg-[#111] border border-[#1e1e1e]">
                        <div>
                            <div className="text-[9px] font-bold text-neutral-300 flex items-center gap-1"><Zap size={9} className={autopost ? 'text-pink-400' : 'text-neutral-700'} />Auto-Post via n8n</div>
                            <div className="text-[7px] text-neutral-700">n8n posts automatically at scheduled time</div>
                        </div>
                        <button onClick={() => setAutopost(a => !a)}>
                            {autopost ? <ToggleRight size={20} className="text-pink-500" /> : <ToggleLeft size={20} className="text-neutral-700" />}
                        </button>
                    </div>
                </div>
                <div className="p-4 border-t border-[#1e1e1e] flex gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-xs text-neutral-600 hover:text-white transition-colors">Cancel</button>
                    <button onClick={() => onSave(post.id, scheduledAt, autopost, hashtags)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-black bg-gradient-to-r from-pink-600 to-violet-600 text-white rounded-xl">
                        <Calendar size={10} /> Save Schedule
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Workflow Test Panel ──────────────────────────────────────────────────────
function WorkflowTestPanel({ influencers }: { influencers: Influencer[] }) {
    const [selectedInf, setSelectedInf] = useState('');
    const [testType, setTestType] = useState<'ollama' | 'comfyui' | 'n8n'>('ollama');
    const [ollamaModels, setOllamaModels] = useState<string[]>([]);
    const [selectedModel, setSelectedModel] = useState('');
    const [testing, setTesting] = useState(false);
    const [result, setResult] = useState<{ success: boolean; message: string; data?: any } | null>(null);

    useEffect(() => {
        fetch('http://127.0.0.1:11434/api/tags')
            .then(r => r.json())
            .then(d => {
                const names = (d.models || []).map((m: any) => m.name);
                setOllamaModels(names);
                if (names.length > 0) setSelectedModel(names[0]);
            })
            .catch(() => { });
    }, []);

    const runTest = async () => {
        setTesting(true);
        setResult(null);
        try {
            if (testType === 'ollama') {
                const r = await fetch('http://127.0.0.1:11434/api/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ model: selectedModel, prompt: 'Generate one viral Instagram hook about fitness in India. Return only the hook text.', stream: false, options: { num_predict: 80 } }),
                    signal: AbortSignal.timeout(30000)
                });
                const d = await r.json();
                setResult({ success: true, message: `✓ ${selectedModel} responded`, data: d.response?.trim() });
            } else if (testType === 'comfyui') {
                const settings = JSON.parse(localStorage.getItem('integrationSettings') || '{}');
                const url = settings.comfyuiUrl || 'http://127.0.0.1:8188';
                const r = await fetch(`${url}/system_stats`);
                const d = await r.json();
                setResult({ success: true, message: '✓ ComfyUI online', data: JSON.stringify(d, null, 2).slice(0, 300) });
            } else {
                if (!selectedInf) { setResult({ success: false, message: '⚠ Select an influencer first' }); setTesting(false); return; }
                const settings = JSON.parse(localStorage.getItem('integrationSettings') || '{}');
                const webhookUrl = settings.n8nWebhookUrl || 'http://localhost:5678/webhook/generate-ideas';
                const influencer = influencers.find(i => i.id === selectedInf);
                const r = await fetch('/api/influencers/' + selectedInf + '/n8n/trigger', { method: 'POST' });
                const d = await r.json();
                setResult({ success: !!d.triggered || !!d.success, message: d.message || (d.triggered ? '✓ n8n webhook triggered' : '✗ Trigger failed'), data: JSON.stringify(d, null, 2) });
            }
        } catch (e: any) {
            setResult({ success: false, message: `✗ ${e.message}` });
        } finally {
            setTesting(false);
        }
    };

    return (
        <div className="p-3 space-y-3">
            <div className="text-[8px] font-black text-neutral-700 uppercase tracking-widest">Workflow Tester</div>
            <div className="grid grid-cols-3 gap-1">
                {(['ollama', 'comfyui', 'n8n'] as const).map(t => (
                    <button key={t} onClick={() => setTestType(t)}
                        className={`py-1.5 text-[8px] font-bold rounded-lg border transition-all ${testType === t ? 'border-violet-500/40 bg-violet-500/10 text-violet-400' : 'border-[#1e1e1e] text-neutral-700 hover:text-neutral-500'}`}>
                        {t === 'ollama' ? '🦙' : t === 'comfyui' ? '🎨' : '⚙️'} {t}
                    </button>
                ))}
            </div>

            {testType === 'ollama' && (
                <div>
                    <label className="text-[7px] text-neutral-700 uppercase font-bold block mb-1">Model</label>
                    {ollamaModels.length > 0 ? (
                        <select value={selectedModel} onChange={e => setSelectedModel(e.target.value)}
                            className="w-full bg-[#111] border border-[#1e1e1e] rounded-lg px-2 py-1.5 text-[9px] text-neutral-300">
                            {ollamaModels.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    ) : (
                        <div className="text-[8px] text-neutral-700 italic">Ollama offline or no models</div>
                    )}
                </div>
            )}

            {testType === 'n8n' && (
                <div>
                    <label className="text-[7px] text-neutral-700 uppercase font-bold block mb-1">Influencer</label>
                    <select value={selectedInf} onChange={e => setSelectedInf(e.target.value)}
                        className="w-full bg-[#111] border border-[#1e1e1e] rounded-lg px-2 py-1.5 text-[9px] text-neutral-300">
                        <option value="">Select influencer</option>
                        {influencers.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                </div>
            )}

            <button onClick={runTest} disabled={testing}
                className="w-full flex items-center justify-center gap-1.5 py-2 text-[9px] font-black bg-violet-800 hover:bg-violet-700 text-white rounded-lg transition-colors disabled:opacity-50">
                {testing ? <Loader2 size={9} className="animate-spin" /> : <Play size={9} />}
                Run Test
            </button>

            {result && (
                <div className={`p-2 rounded-xl border text-[8px] leading-relaxed ${result.success ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' : 'bg-red-500/5 border-red-500/20 text-red-400'}`}>
                    <p className="font-bold mb-1">{result.message}</p>
                    {result.data && <p className="text-neutral-600 font-mono text-[7px] whitespace-pre-wrap break-all line-clamp-6">{result.data}</p>}
                </div>
            )}
        </div>
    );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function QueuePage() {
    const [influencers, setInfluencers] = useState<Influencer[]>([]);
    const [activeInfId, setActiveInfId] = useState<string>('');
    const [posts, setPosts] = useState<Post[]>([]);
    const [ollamaModels, setOllamaModels] = useState<string[]>([]);
    const [selectedOllamaModel, setSelectedOllamaModel] = useState('');
    const [genCount, setGenCount] = useState(5);
    const [generating, setGenerating] = useState(false);
    const [genStatus, setGenStatus] = useState('');
    const [schedulePost, setSchedulePost] = useState<Post | null>(null);
    const [loading, setLoading] = useState(true);
    const [showTestPanel, setShowTestPanel] = useState(false);

    // Burst Session State
    const [bursting, setBursting] = useState(false);
    const [burstTaskId, setBurstTaskId] = useState('');
    const [burstProgress, setBurstProgress] = useState<{ status: string, progress: number, log: string[] } | null>(null);

    // Load influencers + Ollama models on mount
    useEffect(() => {
        Promise.allSettled([
            fetch('/api/influencers').then(r => r.ok ? r.json() : []),
            fetch('http://127.0.0.1:11434/api/tags').then(r => r.ok ? r.json() : { models: [] }).catch(() => ({ models: [] }))
        ]).then(([infResult, ollamaResult]) => {
            const infData = infResult.status === 'fulfilled' ? infResult.value : [];
            const ollamaData = ollamaResult.status === 'fulfilled' ? ollamaResult.value : { models: [] };

            const infs: Influencer[] = Array.isArray(infData) ? infData : (infData?.influencers || []);
            setInfluencers(infs);
            if (infs.length > 0) setActiveInfId(infs[0].id);

            const models = (ollamaData?.models || []).map((m: any) => m.name);
            setOllamaModels(models);

            try {
                const settings = JSON.parse(localStorage.getItem('integrationSettings') || '{}');
                const saved = settings.defaultOllamaModel || models[0] || 'qwen3:1.7b';
                setSelectedOllamaModel(saved);
            } catch {
                if (models.length > 0) setSelectedOllamaModel(models[0]);
            }
        }).finally(() => setLoading(false));
    }, []);

    // Fetch posts whenever active influencer changes
    const fetchPosts = useCallback(async (infId: string) => {
        if (!infId) return;
        try {
            const r = await fetch(`/api/content/generate?influencer_id=${infId}`);
            if (!r.ok) { setPosts([]); return; }
            const d = await r.json();
            setPosts(d?.posts || (Array.isArray(d) ? d : []));
        } catch {
            setPosts([]);
        }
    }, []);

    useEffect(() => {
        if (activeInfId) fetchPosts(activeInfId);
    }, [activeInfId, fetchPosts]);

    const generateContent = async () => {
        if (!activeInfId) return;
        setGenerating(true);
        setGenStatus(`Generating ${genCount} ideas with ${selectedOllamaModel}…`);
        try {
            const r = await fetch('/api/content/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    influencer_id: activeInfId,
                    count: genCount,
                    ollama_model: selectedOllamaModel
                })
            });
            const d = await r.json();
            setGenStatus(`✓ Generated ${d.count} ideas with ${d.model_used}`);
            await fetchPosts(activeInfId);
            setTimeout(() => setGenStatus(''), 3000);
        } catch (e: any) {
            setGenStatus(`✗ ${e.message}`);
        } finally {
            setGenerating(false);
        }
    };

    const startBurst = async () => {
        if (!activeInfId) return;
        setBursting(true);
        setBurstProgress({ status: 'starting', progress: 0, log: ['Initializing burst session...'] });
        try {
            const AGENT_ENGINE_BASE = `${window.location.protocol}//${window.location.hostname}:8787`;
            const r = await fetch(`${AGENT_ENGINE_BASE}/agents/burst`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': localStorage.getItem('INTERNAL_API_KEY') || ''
                },
                body: JSON.stringify({
                    influencer_ids: [activeInfId],
                    days_ahead: genCount,
                    mode: 'full'
                })
            });
            const d = await r.json();
            setBurstTaskId(d.task_id);
        } catch (e: any) {
            setBurstProgress({ status: 'failed', progress: 0, log: [e.message] });
            setBursting(false);
        }
    };

    useEffect(() => {
        if (!burstTaskId || !bursting) return;
        const interval = setInterval(async () => {
            try {
                const AGENT_ENGINE_BASE = `${window.location.protocol}//${window.location.hostname}:8787`;
                const r = await fetch(`${AGENT_ENGINE_BASE}/agents/tasks/${burstTaskId}`, {
                    headers: { 'X-API-Key': localStorage.getItem('INTERNAL_API_KEY') || '' }
                });
                if (r.ok) {
                    const d = await r.json();
                    setBurstProgress(d);
                    if (d.status === 'done' || d.status === 'failed') {
                        setBursting(false);
                        setBurstTaskId('');
                        clearInterval(interval);
                        fetchPosts(activeInfId);
                    }
                }
            } catch { }
        }, 2000);
        return () => clearInterval(interval);
    }, [burstTaskId, bursting, activeInfId, fetchPosts]);

    const handleMoveStatus = async (postId: string, status: PostStatus) => {
        await fetch('/api/posts/mark-posted', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ post_id: postId, status })
        });
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, status } : p));
    };

    const handleSaveSchedule = async (postId: string, scheduledAt: string, autopost: boolean, hashtags: string) => {
        await fetch('/api/posts/mark-posted', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ post_id: postId, scheduled_at: scheduledAt, autopost_enabled: autopost, hashtags })
        });
        setPosts(prev => prev.map(p => p.id === postId
            ? { ...p, scheduled_at: scheduledAt, autopost_enabled: autopost ? 1 : 0, hashtags }
            : p));
        setSchedulePost(null);
    };

    const handleSyncAnalytics = async (post: Post) => {
        await fetch('/api/posts/sync-analytics', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ post_id: post.id, influencer_id: post.influencer_id })
        });
        await fetchPosts(activeInfId);
    };

    const handlePublishNow = async (post: Post) => {
        setGenerating(true);
        setGenStatus(`🚀 Publishing to Instagram...`);
        try {
            const res = await fetch('/api/posts/trigger-publish', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ post_id: post.id })
            });
            const data = await res.json();
            if (data.ok) {
                setGenStatus(`✓ Published! ID: ${data.ig_result?.ig_post_id || 'OK'}`);
                fetchPosts(activeInfId);
            } else {
                setGenStatus(`✗ Fail: ${data.error || 'Unknown error'}`);
            }
        } catch (e: any) {
            setGenStatus(`✗ Error: ${e.message}`);
        } finally {
            setGenerating(false);
        }
        setTimeout(() => setGenStatus(''), 5000);
    };

    const grouped = COLUMNS.reduce((acc, col) => {
        acc[col.id] = posts.filter(p => p.status === col.id);
        return acc;
    }, {} as Record<PostStatus, Post[]>);

    const activeInf = influencers.find(i => i.id === activeInfId);
    const totalPosted = posts.filter(p => p.status === 'Posted').length;
    const autoScheduled = posts.filter(p => p.autopost_enabled && p.status === 'Ready').length;
    const readyCount = posts.filter(p => p.status === 'Ready').length;

    if (loading) return (
        <div className="h-full flex items-center justify-center bg-[#080808]">
            <Loader2 size={24} className="text-neutral-700 animate-spin" />
        </div>
    );

    return (
        <div className="h-full flex bg-[#080808] text-neutral-300 overflow-hidden">
            {/* ── Left Sidebar: Model Selector ─────────────────────────────── */}
            <div className="w-56 flex-col flex border-r border-[#1e1e1e] bg-[#090909] overflow-hidden">
                <div className="p-3 border-b border-[#1e1e1e]">
                    <div className="text-[8px] font-black text-neutral-700 uppercase tracking-widest mb-2">AI Models</div>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                        {influencers.map(inf => (
                            <button key={inf.id} onClick={() => setActiveInfId(inf.id)}
                                className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left transition-all ${activeInfId === inf.id ? 'bg-[#1a1a1a] border border-violet-500/20' : 'hover:bg-[#111] border border-transparent'}`}>
                                <div className="w-6 h-6 rounded-full overflow-hidden bg-[#1a1a1a] shrink-0 border border-[#2a2a2a]">
                                    {inf.avatar_image_path
                                        ? <img src={inf.avatar_image_path} className="w-full h-full object-cover object-top" />
                                        : <div className="w-full h-full flex items-center justify-center"><User size={10} className="text-neutral-700" /></div>
                                    }
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className={`text-[9px] font-bold truncate ${activeInfId === inf.id ? 'text-neutral-200' : 'text-neutral-600'}`}>{inf.name}</div>
                                    <div className="text-[7px] text-neutral-800 truncate">{inf.niche}</div>
                                </div>
                                {activeInfId === inf.id && <div className="w-1 h-1 rounded-full bg-violet-500 shrink-0" />}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Generate Section */}
                <div className="p-3 border-b border-[#1e1e1e] space-y-2">
                    <div className="text-[8px] font-black text-neutral-700 uppercase tracking-widest">Generate Content</div>

                    {/* Ollama Model Picker */}
                    <div>
                        <label className="text-[7px] text-neutral-700 block mb-1 flex items-center gap-1">
                            <Cpu size={7} /> Ollama Model
                        </label>
                        {ollamaModels.length > 0 ? (
                            <select value={selectedOllamaModel} onChange={e => setSelectedOllamaModel(e.target.value)}
                                className="w-full bg-[#111] border border-[#1e1e1e] rounded-lg px-2 py-1.5 text-[9px] text-neutral-300 font-mono">
                                {ollamaModels.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        ) : (
                            <div className="flex items-center gap-1 p-2 rounded-lg bg-red-500/5 border border-red-500/20">
                                <AlertCircle size={8} className="text-red-500 shrink-0" />
                                <span className="text-[7px] text-red-500">Ollama offline</span>
                            </div>
                        )}
                    </div>

                    {/* Count slider */}
                    <div className="flex items-center gap-2">
                        <span className="text-[7px] text-neutral-700">Count:</span>
                        <input type="range" min={1} max={15} value={genCount} onChange={e => setGenCount(Number(e.target.value))}
                            className="flex-1 h-1 accent-violet-500" />
                        <span className="text-[9px] text-neutral-500 font-mono w-3">{genCount}</span>
                    </div>

                    {genStatus && (
                        <p className={`text-[7px] font-mono leading-relaxed ${genStatus.startsWith('✓') ? 'text-emerald-500' : genStatus.startsWith('✗') ? 'text-red-500' : 'text-neutral-600'}`}>
                            {genStatus}
                        </p>
                    )}

                    <button onClick={generateContent} disabled={generating || !activeInfId || ollamaModels.length === 0}
                        className="w-full flex items-center justify-center gap-1.5 py-2 text-[9px] font-black bg-violet-700 hover:bg-violet-600 text-white rounded-lg transition-colors disabled:opacity-40">
                        {generating ? <Loader2 size={9} className="animate-spin" /> : <Sparkles size={9} />}
                        Generate
                    </button>
                </div>

                {/* Stats for active influencer */}
                {activeInf && (
                    <div className="p-3 space-y-1.5 border-b border-[#1e1e1e]">
                        <div className="text-[8px] font-black text-neutral-700 uppercase tracking-widest">Pipeline Stats</div>
                        {[
                            { label: 'Total Ideas', val: posts.length, color: 'text-neutral-400' },
                            { label: 'Posted on IG', val: totalPosted, color: 'text-emerald-400' },
                            { label: 'Ready to Post', val: readyCount, color: 'text-cyan-400' },
                            { label: 'Auto-Scheduled', val: autoScheduled, color: 'text-pink-400' },
                        ].map(s => (
                            <div key={s.label} className="flex items-center justify-between">
                                <span className="text-[8px] text-neutral-700">{s.label}</span>
                                <span className={`text-[9px] font-mono font-bold ${s.color}`}>{s.val}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Autonomous Burst UI */}
                <div className="p-3 space-y-2 border-b border-[#1e1e1e]">
                    <div className="text-[8px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-1">
                        <Cpu size={10} /> Factory Floor Core
                    </div>
                    <p className="text-[8px] text-neutral-500 leading-relaxed mb-2">
                        Trigger full autonomous cycle: Scout → Creator → Visual → Publisher.
                    </p>

                    {burstProgress && (
                        <div className="bg-[#111] border border-[#2a2a2a] rounded-lg p-2 mb-2">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-[7px] font-bold text-neutral-400">Agent Progress</span>
                                <span className="text-[7px] text-violet-400 font-mono">{burstProgress.progress}%</span>
                            </div>
                            <div className="h-1 bg-[#1a1a1a] rounded-full overflow-hidden mb-2">
                                <div className="h-full bg-violet-600 transition-all duration-500" style={{ width: `${burstProgress.progress}%` }} />
                            </div>
                            <div className="space-y-0.5 max-h-20 overflow-y-auto">
                                {burstProgress.log.slice(-3).map((l, i) => (
                                    <div key={i} className="text-[7px] font-mono text-neutral-500 leading-tight">
                                        &gt; {l}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <button onClick={startBurst} disabled={bursting || !activeInfId}
                        className="w-full relative group overflow-hidden flex items-center justify-center gap-1.5 py-2.5 text-[10px] font-black rounded-lg transition-all disabled:opacity-50
                            bg-gradient-to-r from-amber-600 to-rose-600 text-white shadow-[0_0_15px_rgba(217,119,6,0.2)] hover:shadow-[0_0_20px_rgba(217,119,6,0.4)]">
                        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform" />
                        {bursting ? <Loader2 size={11} className="animate-spin relative z-10" /> : <Play size={11} className="relative z-10" />}
                        <span className="relative z-10">{bursting ? 'Running Cycle...' : 'Run Burst Session'}</span>
                    </button>
                    <p className="text-[7px] text-center text-neutral-600">Uses Scout (Exa/Playwright) + Creator (Gemini)</p>
                </div>

                {/* Workflow Test Toggle */}
                <div className="mt-auto">
                    <button onClick={() => setShowTestPanel(s => !s)}
                        className={`w-full flex items-center gap-2 px-3 py-2.5 text-[8px] font-bold transition-colors border-t border-[#1e1e1e] ${showTestPanel ? 'text-violet-400 bg-violet-500/5' : 'text-neutral-700 hover:text-neutral-500'}`}>
                        <Settings size={9} /> Workflow Tester
                    </button>
                </div>
            </div>

            {/* ── Main Area ──────────────────────────────────────────────── */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Active model header */}
                <div className="px-4 py-2.5 border-b border-[#1e1e1e] bg-[#090909] flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        {activeInf?.avatar_image_path && (
                            <img src={activeInf.avatar_image_path} className="w-7 h-7 rounded-full object-cover object-top border border-[#2a2a2a]" />
                        )}
                        <div>
                            <h2 className="text-xs font-black text-neutral-200">{activeInf?.name || 'Select a model'}</h2>
                            <p className="text-[8px] text-neutral-600">{activeInf?.niche} • {posts.length} posts in pipeline</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        {/* Pipeline Legend Inline */}
                        <div className="hidden lg:flex items-center gap-4 border-l border-[#2a2a2a] pl-4">
                            <div className="flex items-center gap-1.5">
                                <div className="w-1 h-1 rounded-full bg-violet-500" />
                                <span className="text-[8px] text-neutral-600 uppercase font-bold tracking-widest">Ollama:</span>
                                <span className="text-[8px] text-neutral-700">Ideas</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-1 h-1 rounded-full bg-cyan-500" />
                                <span className="text-[8px] text-neutral-600 uppercase font-bold tracking-widest">Comfy:</span>
                                <span className="text-[8px] text-neutral-700">Visuals</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-1 h-1 rounded-full bg-emerald-500" />
                                <span className="text-[8px] text-neutral-600 uppercase font-bold tracking-widest">n8n:</span>
                                <span className="text-[8px] text-neutral-700">Post</span>
                            </div>
                        </div>

                        {autoScheduled > 0 && (
                            <span className="flex items-center gap-1 text-[8px] px-2 py-1 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-400">
                                <Zap size={7} /> {autoScheduled} auto-scheduled
                            </span>
                        )}
                        <button onClick={() => fetchPosts(activeInfId)} className="p-1.5 rounded-lg border border-[#2a2a2a] hover:bg-[#1a1a1a] text-neutral-600 transition-colors">
                            <RefreshCw size={10} />
                        </button>
                    </div>
                </div>

                {/* Kanban */}
                <div className="flex-1 flex overflow-hidden">
                    {showTestPanel ? (
                        <div className="w-72 border-r border-[#1e1e1e] overflow-y-auto bg-[#0a0a0a]">
                            <WorkflowTestPanel influencers={influencers} />
                        </div>
                    ) : null}

                    <div className="flex-1 flex overflow-x-auto overflow-y-hidden">
                        {!activeInfId ? (
                            <div className="flex-1 flex items-center justify-center text-neutral-700 text-sm">← Select a model from the sidebar</div>
                        ) : (
                            <div className="flex gap-0 h-full min-w-max">
                                {COLUMNS.map(col => {
                                    const colPosts = grouped[col.id] || [];
                                    return (
                                        <div key={col.id} className="w-60 flex flex-col border-r border-[#1e1e1e] last:border-r-0">
                                            <div className="px-3 py-2 border-b border-[#1e1e1e] bg-[#0a0a0a] flex items-center justify-between shrink-0">
                                                <div className="flex items-center gap-1.5">
                                                    <div className={`w-1.5 h-1.5 rounded-full ${col.dot}`} />
                                                    <span className={`text-[9px] font-black uppercase tracking-wider ${col.textColor}`}>{col.label}</span>
                                                </div>
                                                <span className="text-[8px] font-mono text-neutral-700 bg-[#111] px-1.5 py-0.5 rounded">{colPosts.length}</span>
                                            </div>
                                            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                                                {colPosts.length === 0 ? (
                                                    <div className="h-12 flex items-center justify-center text-[8px] text-neutral-800">Empty</div>
                                                ) : colPosts.map(post => (
                                                    <PostCard
                                                        key={post.id}
                                                        post={post}
                                                        onMoveStatus={handleMoveStatus}
                                                        onSchedule={setSchedulePost}
                                                        onSyncAnalytics={handleSyncAnalytics}
                                                        onPublishNow={handlePublishNow}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {schedulePost && (
                <ScheduleModal
                    post={schedulePost}
                    onClose={() => setSchedulePost(null)}
                    onSave={handleSaveSchedule}
                />
            )}
        </div>
    );
}
