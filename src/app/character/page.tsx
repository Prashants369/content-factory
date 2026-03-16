'use client';
import { useState, useCallback, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { CharacterDNA, BLANK_DNA, dnaToComfyPrompt, deriveArchetype, oceanToCaption } from '@/lib/characterDNA';
import { Fingerprint, Wand2, Download, Save, ChevronDown, ChevronRight, Copy, Loader2, Brain, BarChart3, Sparkles, RefreshCw, Zap, TrendingUp, Flame, Radio, AlertCircle } from 'lucide-react';

// ─── Reusable mini UI ──────────────────────────────────────────────────────
const SectionHeader = ({ title, color = 'text-amber-500', open, onToggle }: any) => (
    <button onClick={onToggle} className="w-full flex items-center justify-between px-5 py-3 bg-[#111] border-b border-[#2a2a2a] hover:bg-[#161616] transition-colors text-left">
        <div className={`flex items-center gap-2 font-semibold text-xs tracking-widest uppercase ${color}`}>{title}</div>
        {open ? <ChevronDown size={12} className="text-neutral-600" /> : <ChevronRight size={12} className="text-neutral-600" />}
    </button>
);

const Sub = ({ label }: { label: string }) => (
    <div className="text-[9px] text-neutral-600 font-bold uppercase tracking-widest pt-3 pb-0.5 border-t border-[#1a1a1a] mt-1">{label}</div>
);

const Slider = ({ label, value, min, max, step = 0.1, unit = '', color = 'accent-amber-500', onChange }: any) => (
    <div className="space-y-0.5">
        <div className="flex justify-between text-[10px]">
            <span className="text-neutral-500">{label}</span>
            <span className="font-mono text-amber-400">{value}{unit}</span>
        </div>
        <input type="range" min={min} max={max} step={step} value={value}
            onChange={e => onChange(parseFloat(e.target.value))}
            className={`w-full h-1 rounded-full appearance-none bg-[#222] cursor-pointer ${color}`}
        />
    </div>
);

const PctBar = ({ label, value, color = 'bg-amber-500', onChange }: any) => (
    <div className="space-y-0.5">
        <div className="flex justify-between text-[10px]">
            <span className="text-neutral-500">{label}</span>
            <span className="font-mono text-neutral-400">{value}%</span>
        </div>
        <div className="relative h-3 bg-[#222] rounded-full overflow-hidden group cursor-pointer"
            onClick={e => { const rect = (e.currentTarget as HTMLElement).getBoundingClientRect(); onChange(Math.round(((e.clientX - rect.left) / rect.width) * 100)); }}>
            <div className={`h-full ${color} transition-all rounded-full`} style={{ width: `${value}%` }} />
        </div>
    </div>
);

const Sel = ({ label, value, options, onChange }: any) => (
    <div className="space-y-0.5">
        <label className="text-[10px] text-neutral-500 uppercase tracking-wider">{label}</label>
        <select value={value} onChange={e => onChange(e.target.value)}
            className="w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded px-2 py-1.5 text-xs text-neutral-300 focus:outline-none focus:border-amber-500/50 appearance-none cursor-pointer">
            {options.map((o: string) => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}
        </select>
    </div>
);

const Txt = ({ label, value, onChange, placeholder = '' }: any) => (
    <div className="space-y-0.5">
        <label className="text-[10px] text-neutral-500 uppercase tracking-wider">{label}</label>
        <input type="text" value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)}
            className="w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded px-2 py-1.5 text-xs text-neutral-300 focus:outline-none focus:border-amber-500/50 placeholder:text-neutral-700" />
    </div>
);

const Tog = ({ label, value, onChange }: any) => (
    <div className="flex items-center justify-between py-0.5">
        <span className="text-[10px] text-neutral-500 uppercase tracking-wider">{label}</span>
        <button onClick={() => onChange(!value)} className={`w-9 h-4 rounded-full relative transition-colors ${value ? 'bg-amber-500' : 'bg-[#2a2a2a]'}`}>
            <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
    </div>
);

const MBTI_TYPES = ['INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP', 'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP'];

// Derive human-readable MBTI labels FROM the 4-letter type string (not sliders)
function mbtiDescription(type: string): string {
    if (!type || type.length < 4) return '';
    const E = type[0] === 'E' ? 'Extraverted' : 'Introverted';
    const N = type[1] === 'N' ? 'Intuitive' : 'Sensing';
    const F = type[2] === 'F' ? 'Feeling' : 'Thinking';
    const J = type[3] === 'J' ? 'Judging' : 'Perceiving';
    return `${E} · ${N} · ${F} · ${J}`;
}

// ─── Setup Screen ──────────────────────────────────────────────────────────
type SetupConfig = { niche: string; ethnicity: string; age: string; gender: string; modelName: string; mode: 'ai' | 'manual' };

const NICHE_PRESETS = [
    'Indian Fitness Influencer', 'High Fantasy Elven Royalty', 'UK Fashion Model',
    'US Tech Entrepreneur', 'Indian Classical Dancer', 'Dark Fantasy Sorceress',
    'NYC Streetwear Lifestyle', 'London Luxury Aesthetics',
];

type TrendingIdea = {
    title: string;
    niche: string;
    why_trending: string;
    aesthetic: string;
    platform: string;
    emoji: string;
};

function SetupScreen({ onStart }: { onStart: (cfg: SetupConfig) => void }) {
    const [niche, setNiche] = useState('');
    const [ethnicity, setEthnicity] = useState('');
    const [age, setAge] = useState('');
    const [gender, setGender] = useState('female');
    const [modelName, setModelName] = useState('qwen3:1.7b');
    const [ollamaModels, setOllamaModels] = useState<string[]>(['qwen3:1.7b', 'huihui_ai/qwen3-abliterated:4b', 'lama3']);
    const [ideaTab, setIdeaTab] = useState<'trending' | 'presets'>('trending');
    const [trendingIdeas, setTrendingIdeas] = useState<TrendingIdea[]>([]);
    const [loadingIdeas, setLoadingIdeas] = useState(false);
    const [ideasSource, setIdeasSource] = useState('');
    const [ideasError, setIdeasError] = useState('');

    const fetchTrendingIdeas = async (forceRefresh = false) => {
        setLoadingIdeas(true);
        setIdeasError('');
        try {
            const res = await fetch(`/api/trending-ideas${forceRefresh ? '?refresh=1' : ''}`);
            const json = await res.json();
            if (json.ideas?.length) {
                setTrendingIdeas(json.ideas);
                setIdeasSource(json.source || 'unknown');
                setIdeasError('');
            } else if (json.message && !json.ideas?.length) {
                // idle or error state
                if (json.source === 'failed') setIdeasError(json.message);
            }
        } catch (e) {
            setIdeasError('Network error — could not reach the dashboard API');
        } finally {
            setLoadingIdeas(false);
        }
    };

    useEffect(() => {
        // try to fetch local ollama models, ignore if CORS fails
        fetch('http://127.0.0.1:11434/api/tags')
            .then(res => { if (!res.ok) throw new Error(); return res.json(); })
            .then(data => data?.models && setOllamaModels(data.models.map((m: any) => m.name)))
            .catch(() => { });
        // NOTE: we do NOT auto-load ideas — user must click Live Scan
    }, []);

    const go = (mode: 'ai' | 'manual') => {
        if (!niche.trim()) { alert('Enter a niche or character type first!'); return; }
        onStart({ niche: niche.trim(), ethnicity: ethnicity.trim(), age: age.trim(), gender, modelName, mode });
    };

    return (
        <div className="h-full flex items-center justify-center bg-[#080808] overflow-y-auto py-8">
            <div className="w-full max-w-2xl space-y-5 px-8">
                {/* Header */}
                <div className="text-center space-y-1">
                    <div className="flex justify-center mb-3">
                        <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                            <Fingerprint size={22} className="text-amber-500" />
                        </div>
                    </div>
                    <h1 className="text-lg font-black text-neutral-100 tracking-tight">Character DNA Studio</h1>
                    <p className="text-[11px] text-neutral-500">Click a trending idea or write your own concept — AI fills everything else</p>
                </div>

                {/* === TRENDING IDEAS PANEL === */}
                <div className="bg-[#0d0d0d] border border-[#1e1e1e] rounded-xl overflow-hidden">
                    {/* Panel header */}
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1e1e1e]">
                        <div className="flex items-center gap-1">
                            <button onClick={() => setIdeaTab('trending')}
                                className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded transition-colors ${ideaTab === 'trending' ? 'text-orange-400 bg-orange-500/10' : 'text-neutral-600 hover:text-neutral-400'
                                    }`}>
                                <Flame size={10} /> Trending Ideas
                            </button>
                            <button onClick={() => setIdeaTab('presets')}
                                className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded transition-colors ${ideaTab === 'presets' ? 'text-violet-400 bg-violet-500/10' : 'text-neutral-600 hover:text-neutral-400'
                                    }`}>
                                <Sparkles size={10} /> Quick Presets
                            </button>
                        </div>
                        <div className="flex items-center gap-2">
                            {ideasSource && (
                                <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-mono border ${ideasSource === 'n8n-scrape' || ideasSource === 'ollama-direct'
                                    ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5'
                                    : 'text-neutral-700 border-neutral-800'
                                    }`}>
                                    {ideasSource === 'n8n-scrape' ? '⚡ n8n live scrape' :
                                        ideasSource === 'ollama-direct' ? '🤖 Ollama direct' :
                                            ideasSource}
                                </span>
                            )}
                            <button
                                onClick={() => fetchTrendingIdeas(true)}
                                disabled={loadingIdeas}
                                title="Scrapes Reddit + Google Trends → Ollama generates ideas (no API key needed)"
                                className="flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-lg border border-orange-500/40 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 transition-colors disabled:opacity-40">
                                {loadingIdeas ? <Loader2 size={10} className="animate-spin" /> : <TrendingUp size={10} />}
                                {loadingIdeas ? 'Scanning...' : '🔥 Live Scan'}
                            </button>
                        </div>
                    </div>

                    {/* Tab content */}
                    <div className="p-3">
                        {ideaTab === 'trending' ? (
                            loadingIdeas ? (
                                <div className="flex flex-col items-center justify-center h-28 gap-3 text-neutral-700">
                                    <Loader2 size={20} className="animate-spin text-orange-500/60" />
                                    <div className="text-center">
                                        <div className="text-xs text-neutral-400">Scraping Reddit + Google Trends...</div>
                                        <div className="text-[9px] text-neutral-700 mt-0.5">Ollama is analyzing signals (~30-45s)</div>
                                    </div>
                                </div>
                            ) : ideasError ? (
                                <div className="flex flex-col items-center justify-center h-28 gap-2">
                                    <div className="text-[10px] text-red-400/80 text-center px-4">{ideasError}</div>
                                    <button onClick={() => fetchTrendingIdeas(true)}
                                        className="text-[9px] px-3 py-1.5 rounded border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors">
                                        Try Again
                                    </button>
                                </div>
                            ) : trendingIdeas.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-28 gap-3">
                                    <div className="text-3xl">🔥</div>
                                    <div className="text-center">
                                        <div className="text-xs text-neutral-400">No ideas loaded yet</div>
                                        <div className="text-[9px] text-neutral-600 mt-0.5">Click <span className="text-orange-400 font-bold">Live Scan</span> to scrape Reddit + Google Trends → Ollama generates ideas</div>
                                    </div>
                                    <button onClick={() => fetchTrendingIdeas(true)}
                                        className="flex items-center gap-1.5 text-[10px] font-bold px-4 py-2 rounded-lg bg-orange-500/15 border border-orange-500/40 text-orange-400 hover:bg-orange-500/25 transition-colors">
                                        <TrendingUp size={11} /> 🔥 Live Scan Now
                                    </button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-2">
                                    {trendingIdeas.map((idea, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setNiche(idea.niche)}
                                            className={`text-left p-3 rounded-lg border transition-all group ${niche === idea.niche
                                                ? 'border-orange-500/50 bg-orange-500/8'
                                                : 'border-[#222] bg-[#111] hover:border-[#333] hover:bg-[#161616]'
                                                }`}
                                        >
                                            <div className="flex items-start justify-between gap-2 mb-1">
                                                <span className="text-base leading-none">{idea.emoji}</span>
                                                <span className={`text-[7px] px-1 py-0.5 rounded border font-mono shrink-0 ${idea.platform === 'TikTok' ? 'text-pink-400 border-pink-500/20' :
                                                    idea.platform === 'Pinterest' ? 'text-red-400 border-red-500/20' :
                                                        'text-violet-400 border-violet-500/20'
                                                    }`}>{idea.platform}</span>
                                            </div>
                                            <div className="font-bold text-[11px] text-neutral-200 mb-0.5 group-hover:text-orange-300 transition-colors">{idea.title}</div>
                                            <div className="text-[9px] text-neutral-600 italic mb-1">{idea.aesthetic}</div>
                                            <div className="text-[8px] text-emerald-500/80 flex items-start gap-1">
                                                <TrendingUp size={7} className="mt-0.5 shrink-0" />
                                                {idea.why_trending}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )
                        ) : (
                            <div className="flex flex-wrap gap-1.5">
                                {NICHE_PRESETS.map(p => (
                                    <button key={p} onClick={() => setNiche(p)}
                                        className={`text-[9px] px-2 py-1 rounded-full border transition-colors ${niche === p ? 'border-amber-500/60 bg-amber-500/10 text-amber-400' : 'border-[#2a2a2a] text-neutral-600 hover:text-neutral-400 hover:border-[#3a3a3a]'
                                            }`}>
                                        {p}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Custom concept input */}
                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Your Concept / Custom Directives <span className="text-amber-500">*</span></label>
                    <textarea
                        autoFocus
                        value={niche}
                        onChange={e => setNiche(e.target.value)}
                        rows={3}
                        placeholder="Click a trending idea above, or write your own: e.g. '45-year-old Indian woman, posts fitness and tech, cyberpunk neon style with traditional jewelry...'"
                        className="w-full bg-[#111] border border-[#2a2a2a] focus:border-amber-500/60 rounded-lg px-4 py-3 text-sm text-neutral-200 outline-none placeholder:text-neutral-700 transition-colors resize-none"
                    />
                </div>

                {/* Gender selector */}
                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Character Gender</label>
                    <div className="grid grid-cols-2 gap-2">
                        {[
                            { value: 'female', label: '♀️ Female', color: 'text-pink-400 border-pink-500/40 bg-pink-500/10' },
                            { value: 'male', label: '♂️ Male', color: 'text-sky-400 border-sky-500/40 bg-sky-500/10' },
                        ].map(g => (
                            <button
                                key={g.value}
                                onClick={() => setGender(g.value)}
                                className={`flex-1 py-2 rounded-lg border text-[10px] font-bold transition-all active:scale-95 ${gender === g.value
                                    ? g.color
                                    : 'border-[#2a2a2a] text-neutral-600 hover:text-neutral-400 hover:border-[#3a3a3a]'
                                    }`}
                            >
                                {g.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Ethnicity (optional override) */}
                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Ethnicity Override <span className="text-neutral-700">(optional — auto-detected from niche)</span></label>
                    <input
                        value={ethnicity}
                        onChange={e => setEthnicity(e.target.value)}
                        placeholder="e.g. South Asian, East Asian, Latin, West African..."
                        className="w-full bg-[#111] border border-[#2a2a2a] focus:border-violet-500/50 rounded-lg px-4 py-2.5 text-sm text-neutral-200 outline-none placeholder:text-neutral-700 transition-colors"
                    />
                </div>

                {/* Age & Model Selection */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Target Age</label>
                        <input
                            type="number"
                            value={age}
                            onChange={e => setAge(e.target.value)}
                            placeholder="e.g. 24"
                            className="w-full bg-[#111] border border-[#2a2a2a] focus:border-amber-500/50 rounded-lg px-4 py-2.5 text-sm text-neutral-200 outline-none placeholder:text-neutral-700 transition-colors"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Ollama Engine</label>
                        <select
                            value={modelName}
                            onChange={e => setModelName(e.target.value)}
                            className="w-full bg-[#111] border border-[#2a2a2a] focus:border-amber-500/50 rounded-lg px-2 py-2.5 text-xs text-neutral-200 outline-none cursor-pointer transition-colors"
                        >
                            {ollamaModels.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </div>
                </div>

                {/* CTA Buttons */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                    <button onClick={() => go('ai')}
                        className="flex items-center justify-center gap-2 py-3 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-bold text-sm transition-all active:scale-95">
                        <Sparkles size={14} /> Generate with AI
                    </button>
                    <button onClick={() => go('manual')}
                        className="flex items-center justify-center gap-2 py-3 rounded-lg bg-[#1a1a1a] hover:bg-[#222] border border-[#2a2a2a] text-neutral-300 font-semibold text-sm transition-all active:scale-95">
                        <Fingerprint size={14} /> Edit Manually
                    </button>
                </div>

                <div className="flex items-center gap-2 justify-center p-2 rounded-lg bg-violet-500/5 border border-violet-500/10 mb-2">
                    <AlertCircle size={10} className="text-violet-400" />
                    <p className="text-[9px] text-violet-300/80">
                        AI DNA Generation requires <strong>Ollama</strong> (Local) to be active.
                    </p>
                </div>

                <p className="text-center text-[9px] text-neutral-700">
                    AI generates all biometrics, personality scores, measurements, and ComfyUI prompt instantly.
                </p>
            </div>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────
export default function CharacterMakerPage() {
    return (
        <Suspense fallback={<div className="h-full flex items-center justify-center bg-[#080808]"><Loader2 className="animate-spin text-violet-500" /></div>}>
            <CharacterStudioContent />
        </Suspense>
    );
}

function CharacterStudioContent() {
    const searchParams = useSearchParams();
    const editId = searchParams.get('id');

    const [dna, setDna] = useState<CharacterDNA>(BLANK_DNA);
    const [tab, setTab] = useState<'identity' | 'personality' | 'viral' | 'face' | 'hair' | 'body' | 'style' | 'gate' | 'render'>('identity');
    const [generating, setGenerating] = useState(false);
    const [autoPrompt, setAutoPrompt] = useState(true);
    const [genStatus, setGenStatus] = useState('');
    // Setup screen state
    const [setupDone, setSetupDone] = useState(false);
    const [loadingExisting, setLoadingExisting] = useState(false);
    const [activeNiche, setActiveNiche] = useState('');
    const [activeModel, setActiveModel] = useState('qwen3:1.7b');
    const [activeAge, setActiveAge] = useState('');
    const [activeGender, setActiveGender] = useState('female');
    const [activeEthnicity, setActiveEthnicity] = useState('');

    // Load existing DNA if ID provided
    useEffect(() => {
        const load = async () => {
            if (!editId) return;
            setLoadingExisting(true);
            try {
                const res = await fetch(`/api/influencers/${editId}`);
                if (!res.ok) throw new Error('Could not load character');
                const data = await res.json();
                if (data.dna_json) {
                    const parsed = JSON.parse(data.dna_json);
                    setDna(parsed);
                    setActiveNiche(data.niche || '');
                    setSetupDone(true);
                }
            } catch (err: any) {
                console.error(err);
                alert('Error loading existing character: ' + err.message);
            } finally {
                setLoadingExisting(false);
            }
        };
        load();
    }, [editId]);

    const generateDNA = async (niche: string, targetAge: string, model: string, gender: string, ethnicity: string) => {
        setGenerating(true);
        setGenStatus('Generating locally via Ollama...');
        try {
            const res = await fetch('/api/character/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ niche, provider: 'ollama', modelName: model, targetAge, gender, ethnicity })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Unknown error');
            setDna(data);
            const genderIcon = gender === 'male' ? '♂️' : gender === 'non-binary' ? '⚧️' : gender === 'other' ? '✨' : '♀️';
            const ethLabel = ethnicity ? ` · ${ethnicity}` : '';
            setGenStatus(`✓ ${data.identity?.name || 'Character'} ${genderIcon}${ethLabel} generated!`);
            setTimeout(() => setGenStatus(''), 4000);
        } catch (e: any) {
            setGenStatus('Error: ' + e.message);
            setTimeout(() => setGenStatus(''), 5000);
        } finally { setGenerating(false); }
    };

    const handleSetup = (cfg: SetupConfig) => {
        setActiveNiche(cfg.niche);
        setActiveModel(cfg.modelName);
        setActiveAge(cfg.age);
        setActiveGender(cfg.gender);
        setActiveEthnicity(cfg.ethnicity);
        setSetupDone(true);
        if (cfg.mode === 'ai') generateDNA(cfg.niche, cfg.age, cfg.modelName, cfg.gender, cfg.ethnicity);
    };

    const update = useCallback((path: string, value: any) => {
        setDna(prev => {
            const parts = path.split('.');
            const next = JSON.parse(JSON.stringify(prev));
            let cur: any = next;
            for (let i = 0; i < parts.length - 1; i++) cur = cur[parts[i]];
            cur[parts[parts.length - 1]] = value;
            if (autoPrompt) next.render.comfy_prompt_base = dnaToComfyPrompt(next);
            return next;
        });
    }, [autoPrompt]);

    const exportDNA = () => {
        const blob = new Blob([JSON.stringify(dna, null, 2)], { type: 'application/json' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = `${dna.identity.name || 'character'}_DNA.json`; a.click();
    };

    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');
    const [savedId, setSavedId] = useState<string>('');

    const saveDNA = async () => {
        if (!dna.identity.name) { alert('Set a name first.'); return; }
        setSaveStatus('saving');
        try {
            const payload = {
                name: dna.identity.name,
                niche: dna.identity.niche || activeNiche || 'unspecified',
                comfy_prompt_base: dna.render?.comfy_prompt_base || dnaToComfyPrompt(dna),
                dna_json: JSON.stringify(dna)
            };
            
            // If we have an editId, we PATCH (update), otherwise POST (create)
            const endpoint = editId ? `/api/influencers/${editId}` : '/api/influencers';
            const method = editId ? 'PATCH' : 'POST';

            const res = await fetch(endpoint, {
                method, headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const d = await res.json();
            if (res.ok) { 
                setSaveStatus('done'); 
                setSavedId(editId || d.id || ''); 
                setTimeout(() => setSaveStatus('idle'), 5000); 
            }
            else { 
                alert('Save Error: ' + d.error); 
                setSaveStatus('error'); 
                setTimeout(() => setSaveStatus('idle'), 4000); 
            }
        } catch (e: any) { 
            alert('Save Error: ' + e.message); 
            setSaveStatus('error'); 
            setTimeout(() => setSaveStatus('idle'), 4000); 
        }
    };

    const tabs = [
        { id: 'identity', label: 'Identity', color: 'text-amber-400' },
        { id: 'personality', label: 'Personality', color: 'text-violet-400' },
        { id: 'viral', label: 'Strategy', color: 'text-emerald-400' },
        { id: 'face', label: 'Face', color: 'text-cyan-400' },
        { id: 'hair', label: 'Hair', color: 'text-rose-400' },
        { id: 'body', label: 'Body', color: 'text-emerald-400' },
        { id: 'style', label: 'Style', color: 'text-pink-400' },
        { id: 'gate', label: 'Monetize', color: 'text-red-500' },
        { id: 'render', label: 'Render', color: 'text-orange-400' },
    ] as const;

    const p = dna.personality;

    // Show loading existing spinner
    if (loadingExisting) return (
        <div className="h-full flex flex-col items-center justify-center bg-[#080808] gap-4">
            <Loader2 size={32} className="text-violet-500 animate-spin" />
            <p className="text-neutral-400 text-sm">Retrieving Character Record...</p>
        </div>
    );

    // Show setup screen first
    if (!setupDone) return <SetupScreen onStart={handleSetup} />;

    // Show generating overlay
    if (generating) return (
        <div className="h-full flex flex-col items-center justify-center bg-[#080808] gap-4">
            <Loader2 size={32} className="text-violet-500 animate-spin" />
            <p className="text-neutral-400 text-sm font-medium">{genStatus || 'Building character DNA...'}</p>
            <p className="text-neutral-600 text-[10px]">Niche: {activeNiche}</p>
        </div>
    );

    return (
        <div className="h-full flex flex-col bg-[#0a0a0a] text-neutral-300 overflow-hidden">
            {/* TOP BAR */}
            <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[#1e1e1e] bg-[#0c0c0c] shrink-0">
                <Fingerprint size={15} className="text-amber-500 shrink-0" />
                {dna.identity.name
                    ? <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono">{dna.identity.name}</span>
                    : <span className="text-[10px] text-neutral-600">No character loaded</span>
                }
                <span className="text-[9px] text-neutral-700 font-mono">{activeNiche}</span>
                {genStatus && <span className="text-[10px] text-emerald-400 font-mono">{genStatus}</span>}
                <div className="ml-auto flex gap-1.5">
                    <button onClick={() => generateDNA(activeNiche, activeAge, activeModel, activeGender, activeEthnicity)} disabled={generating}
                        className="flex items-center gap-1 text-[9px] px-2.5 py-1.5 rounded bg-violet-700 hover:bg-violet-600 text-white font-bold transition-colors disabled:opacity-50">
                        <Sparkles size={9} /> Regenerate
                    </button>
                    <button onClick={() => setSetupDone(false)}
                        className="flex items-center gap-1 text-[9px] px-2.5 py-1.5 rounded border border-[#2a2a2a] hover:bg-[#1e1e1e] text-neutral-500 transition-colors">
                        ← New Character
                    </button>
                    <button onClick={exportDNA} className="flex items-center gap-1 text-[9px] px-2 py-1.5 rounded border border-[#2a2a2a] hover:bg-[#1e1e1e] text-neutral-600 transition-colors">
                        <Download size={9} /> JSON
                    </button>
                    <button onClick={saveDNA} disabled={saveStatus === 'saving'}
                        className={`flex items-center gap-1 text-[9px] px-2.5 py-1.5 rounded font-semibold transition-colors ${saveStatus === 'done' ? 'bg-emerald-700 text-white' :
                            saveStatus === 'error' ? 'bg-red-800 text-white' :
                                'bg-amber-700 hover:bg-amber-600 text-white disabled:opacity-50'
                            }`}>
                        {saveStatus === 'saving' ? <Loader2 size={9} className="animate-spin" /> : <Save size={9} />}
                        {saveStatus === 'done' ? '✓ Saved!' : saveStatus === 'error' ? 'Error' : saveStatus === 'saving' ? '..' : editId ? 'Update Record' : 'Save to Roster'}
                    </button>
                </div>
            </div>
            {/* Save success toast */}
            {saveStatus === 'done' && (
                <div className="shrink-0 flex items-center justify-between px-4 py-3 bg-emerald-900/30 border-b border-emerald-500/20 text-[10px]">
                    <span className="text-emerald-400">✓ <strong>{dna.identity.name}</strong> {editId ? 'updated' : 'saved'} to Models Roster</span>
                    <div className="flex items-center gap-3">
                        <a href={`/influencers/${savedId}`} className="text-white font-bold flex items-center gap-1.5 px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 transition-colors shadow-lg">
                            Go Generate Identity Photo →
                        </a>
                        <a href="/influencers" className="text-emerald-400 underline hover:text-emerald-300 font-bold ml-2">View in Roster</a>
                    </div>
                </div>
            )}

            <div className="flex flex-1 overflow-hidden">
                {/* LEFT PANEL */}
                <div className="w-[360px] shrink-0 border-r border-[#1e1e1e] flex flex-col overflow-hidden">
                    {/* Tab bar */}
                    <div className="flex border-b border-[#1e1e1e] bg-[#0c0c0c] overflow-x-auto shrink-0">
                        {tabs.map(t => (
                            <button key={t.id} onClick={() => setTab(t.id)}
                                className={`px-3 py-2 text-[9px] font-bold uppercase tracking-widest whitespace-nowrap transition-colors border-b-2 ${tab === t.id ? `${t.color} border-current` : 'text-neutral-600 border-transparent hover:text-neutral-400'}`}>
                                {t.label}
                            </button>
                        ))}
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">

                        {/* ── IDENTITY ── */}
                        {tab === 'identity' && <>
                            <Txt label="Name" value={dna.identity.name} onChange={(v: string) => update('identity.name', v)} placeholder="Kira Chrome" />
                            <Txt label="Ethnicity" value={dna.identity.ethnicity} onChange={(v: string) => update('identity.ethnicity', v)} placeholder="e.g. East Asian, Afro-Caribbean" />
                            <Txt label="Niche / Aesthetic" value={dna.identity.niche} onChange={(v: string) => update('identity.niche', v)} placeholder="Cyberpunk DJ, Minimalist Fitness..." />
                            <Slider label="Age" value={dna.identity.age} min={18} max={100} step={1} unit=" yrs" onChange={(v: number) => update('identity.age', v)} />
                            <Txt label="Core Values (comma separated)" value={dna.identity.core_values.join(', ')} onChange={(v: string) => update('identity.core_values', v.split(',').map((s: string) => s.trim()).filter(Boolean))} placeholder="freedom, power, authenticity" />
                            <Txt label="Fears (comma separated)" value={dna.identity.fears.join(', ')} onChange={(v: string) => update('identity.fears', v.split(',').map((s: string) => s.trim()).filter(Boolean))} placeholder="being ignored, mediocrity" />
                            <Txt label="Goals (comma separated)" value={dna.identity.goals.join(', ')} onChange={(v: string) => update('identity.goals', v.split(',').map((s: string) => s.trim()).filter(Boolean))} placeholder="1M followers, Gucci deal" />
                            <div className="space-y-0.5">
                                <label className="text-[10px] text-neutral-500 uppercase tracking-wider">Backstory</label>
                                <textarea value={dna.identity.backstory} onChange={e => update('identity.backstory', e.target.value)} rows={4} placeholder="She grew up in..."
                                    className="w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded px-2 py-1.5 text-xs text-neutral-300 focus:outline-none focus:border-amber-500/50 placeholder:text-neutral-700 resize-none" />
                            </div>
                        </>}

                        {/* ── PERSONALITY ── */}
                        {tab === 'personality' && <>
                            <Sub label="Big Five — OCEAN Model" />
                            <PctBar label="Openness (creativity / curiosity)" value={p.ocean.openness} color="bg-violet-500" onChange={(v: number) => update('personality.ocean.openness', v)} />
                            <PctBar label="Conscientiousness (discipline / order)" value={p.ocean.conscientiousness} color="bg-blue-500" onChange={(v: number) => update('personality.ocean.conscientiousness', v)} />
                            <PctBar label="Extraversion (social energy)" value={p.ocean.extraversion} color="bg-amber-500" onChange={(v: number) => update('personality.ocean.extraversion', v)} />
                            <PctBar label="Agreeableness (warmth / empathy)" value={p.ocean.agreeableness} color="bg-emerald-500" onChange={(v: number) => update('personality.ocean.agreeableness', v)} />
                            <PctBar label="Neuroticism (emotional reactivity)" value={p.ocean.neuroticism} color="bg-rose-500" onChange={(v: number) => update('personality.ocean.neuroticism', v)} />

                            <Sub label="MBTI — Myers-Briggs" />
                            <Sel label="Type" value={p.mbti.type} options={MBTI_TYPES} onChange={(v: string) => update('personality.mbti.type', v)} />
                            <Slider label="Energy: Introvert ← → Extravert" value={p.mbti.energy} min={0} max={100} step={1} unit="%" onChange={(v: number) => update('personality.mbti.energy', v)} />
                            <Slider label="Information: Sensing ← → Intuition" value={p.mbti.information} min={0} max={100} step={1} unit="%" onChange={(v: number) => update('personality.mbti.information', v)} />
                            <Slider label="Decisions: Thinking ← → Feeling" value={p.mbti.decisions} min={0} max={100} step={1} unit="%" onChange={(v: number) => update('personality.mbti.decisions', v)} />
                            <Slider label="Lifestyle: Judging ← → Perceiving" value={p.mbti.lifestyle} min={0} max={100} step={1} unit="%" onChange={(v: number) => update('personality.mbti.lifestyle', v)} />

                            <Sub label="Enneagram" />
                            <Sel label="Core Type" value={String(p.enneagram.type)} options={['1', '2', '3', '4', '5', '6', '7', '8', '9']} onChange={(v: string) => update('personality.enneagram.type', parseInt(v))} />
                            <Sel label="Wing" value={String(p.enneagram.wing)} options={['1', '2', '3', '4', '5', '6', '7', '8', '9']} onChange={(v: string) => update('personality.enneagram.wing', parseInt(v))} />
                            <Sel label="Instinctual Drive" value={p.enneagram.instinct} options={['self-preservation', 'social', 'sexual']} onChange={(v: string) => update('personality.enneagram.instinct', v)} />

                            <Sub label="Dark Triad (0 = absent, 100 = extreme)" />
                            <PctBar label="Narcissism" value={p.dark_triad.narcissism} color="bg-red-600" onChange={(v: number) => update('personality.dark_triad.narcissism', v)} />
                            <PctBar label="Machiavellianism" value={p.dark_triad.machiavellianism} color="bg-orange-700" onChange={(v: number) => update('personality.dark_triad.machiavellianism', v)} />
                            <PctBar label="Psychopathy" value={p.dark_triad.psychopathy} color="bg-red-900" onChange={(v: number) => update('personality.dark_triad.psychopathy', v)} />

                            <Sub label="Communication Style" />
                            <Sel label="Vocabulary Level" value={p.communication.vocabulary_level} options={['simple', 'conversational', 'articulate', 'academic', 'poetic']} onChange={(v: string) => update('personality.communication.vocabulary_level', v)} />
                            <Sel label="Humor Type" value={p.communication.humor_type} options={['none', 'dry', 'sarcastic', 'wholesome', 'absurdist', 'dark']} onChange={(v: string) => update('personality.communication.humor_type', v)} />
                            <Sel label="Emotional Expression" value={p.communication.emotional_expression} options={['suppressed', 'controlled', 'moderate', 'expressive', 'dramatic']} onChange={(v: string) => update('personality.communication.emotional_expression', v)} />
                            <Sel label="Speaking Pace" value={p.communication.speaking_pace} options={['slow', 'measured', 'natural', 'fast', 'rapid-fire']} onChange={(v: string) => update('personality.communication.speaking_pace', v)} />
                            <Txt label="Topics They Love" value={p.communication.topics_they_love.join(', ')} onChange={(v: string) => update('personality.communication.topics_they_love', v.split(',').map((s: string) => s.trim()).filter(Boolean))} placeholder="tech, nightlife, fashion" />
                            <Txt label="Topics They Avoid" value={p.communication.topics_they_avoid.join(', ')} onChange={(v: string) => update('personality.communication.topics_they_avoid', v.split(',').map((s: string) => s.trim()).filter(Boolean))} placeholder="politics, family, finances" />
                            <Txt label="Recurring Phrases" value={p.communication.recurring_phrases.join(', ')} onChange={(v: string) => update('personality.communication.recurring_phrases', v.split(',').map((s: string) => s.trim()).filter(Boolean))} placeholder="honestly though, no way, literally" />

                            <Sub label="Social Media Algorithm" />
                            <Slider label="Posts Per Week" value={p.social_algorithm.posting_frequency_per_week} min={1} max={21} step={1} unit="x/wk" onChange={(v: number) => update('personality.social_algorithm.posting_frequency_per_week', v)} />
                            <Sel label="Caption Style" value={p.social_algorithm.caption_style} options={['ultra_short', 'one_liner', 'paragraph', 'storytelling', 'emoji_heavy']} onChange={(v: string) => update('personality.social_algorithm.caption_style', v)} />
                            <Sel label="Hook Type" value={p.social_algorithm.hook_type} options={['question', 'bold_claim', 'relatability', 'curiosity_gap', 'controversy']} onChange={(v: string) => update('personality.social_algorithm.hook_type', v)} />
                            <Sel label="Engagement Style" value={p.social_algorithm.engagement_style} options={['ignores_all', 'selective', 'replies_to_top_fans', 'replies_to_everyone']} onChange={(v: string) => update('personality.social_algorithm.engagement_style', v)} />
                            <Sel label="Growth Strategy" value={p.social_algorithm.growth_strategy} options={['viral_bait', 'niche_authority', 'collab_farming', 'consistency', 'shock_value']} onChange={(v: string) => update('personality.social_algorithm.growth_strategy', v)} />
                            <PctBar label="Controversy Tolerance" value={p.social_algorithm.controversy_tolerance} color="bg-red-500" onChange={(v: number) => update('personality.social_algorithm.controversy_tolerance', v)} />
                            <PctBar label="Brand Deal Openness" value={p.social_algorithm.brand_deal_openness} color="bg-green-600" onChange={(v: number) => update('personality.social_algorithm.brand_deal_openness', v)} />
                            <PctBar label="Authenticity Score" value={p.social_algorithm.authenticity_score} color="bg-cyan-500" onChange={(v: number) => update('personality.social_algorithm.authenticity_score', v)} />
                        </>}

                        {/* ── VIRAL STRATEGY ── */}
                        {tab === 'viral' && <>
                            <Sub label="Growth & Hook Mechanics" />
                            <Sel label="Primary Hook Archetype" value={dna.viral_strategy.primary_hook_archetype} options={['The Expert', 'The Contrarian', 'The Relatable Mess', 'The Mystery', 'The Shock Factor']} onChange={(v: string) => update('viral_strategy.primary_hook_archetype', v)} />
                            <Txt label="Aesthetic Trigger (Visual Hook)" value={dna.viral_strategy.aesthetic_trigger} onChange={(v: string) => update('viral_strategy.aesthetic_trigger', v)} placeholder="e.g. sharp high-contrast lighting" />
                            <Txt label="Viral Phrase Template" value={dna.viral_strategy.viral_phrase_template} onChange={(v: string) => update('viral_strategy.viral_phrase_template', v)} placeholder="Here is what nobody tells you..." />
                            
                            <Sub label="Algorithmic Precision" />
                            <Txt label="Visual Composition Rules" value={dna.viral_strategy.visual_composition_rules} onChange={(v: string) => update('viral_strategy.visual_composition_rules', v)} placeholder="Rule of thirds, center-weighted..." />
                            <Txt label="Color Contrast Ratio" value={dna.viral_strategy.color_contrast_ratio} onChange={(v: string) => update('viral_strategy.color_contrast_ratio', v)} placeholder="4.5:1 High Contrast" />
                            <Slider label="Pacing (BPM)" value={dna.viral_strategy.pacing_bpm} min={60} max={180} step={1} unit=" bpm" onChange={(v: number) => update('viral_strategy.pacing_bpm', v)} />
                            
                            <Sub label="Social Algorithm" />
                            <Slider label="Posts Per Week" value={p.social_algorithm.posting_frequency_per_week} min={1} max={21} step={1} unit="x/wk" onChange={(v: number) => update('personality.social_algorithm.posting_frequency_per_week', v)} />
                            <Sel label="Caption Style" value={p.social_algorithm.caption_style} options={['ultra_short', 'one_liner', 'paragraph', 'storytelling', 'emoji_heavy']} onChange={(v: string) => update('personality.social_algorithm.caption_style', v)} />
                            <Sel label="Hook Type" value={p.social_algorithm.hook_type} options={['question', 'bold_claim', 'relatability', 'curiosity_gap', 'controversy']} onChange={(v: string) => update('personality.social_algorithm.hook_type', v)} />
                            <Sel label="Engagement Style" value={p.social_algorithm.engagement_style} options={['ignores_all', 'selective', 'replies_to_top_fans', 'replies_to_everyone']} onChange={(v: string) => update('personality.social_algorithm.engagement_style', v)} />
                            <Sel label="Growth Strategy" value={p.social_algorithm.growth_strategy} options={['viral_bait', 'niche_authority', 'collab_farming', 'consistency', 'shock_value']} onChange={(v: string) => update('personality.social_algorithm.growth_strategy', v)} />
                            <PctBar label="Controversy Tolerance" value={p.social_algorithm.controversy_tolerance} color="bg-red-500" onChange={(v: number) => update('personality.social_algorithm.controversy_tolerance', v)} />
                            <PctBar label="Brand Deal Openness" value={p.social_algorithm.brand_deal_openness} color="bg-green-600" onChange={(v: number) => update('personality.social_algorithm.brand_deal_openness', v)} />
                            <PctBar label="Authenticity Score" value={p.social_algorithm.authenticity_score} color="bg-cyan-500" onChange={(v: number) => update('personality.social_algorithm.authenticity_score', v)} />
                            
                            <div className="pt-4 space-y-1.5 grayscale-[0.3]">
                                <Sub label="Target Content Mix" />
                                {(['lifestyle', 'educational', 'promotional', 'behind_scenes', 'controversial', 'interactive'] as const).map(k => (
                                    <Slider key={k} label={k.replace('_', ' ')} value={p.social_algorithm.content_mix[k]} min={0} max={100} unit="%"
                                        onChange={(v: number) => update(`personality.social_algorithm.content_mix.${k}`, v)} />
                                ))}
                            </div>
                        </>}

                        {/* ── FACE ── */}
                        {tab === 'face' && <>
                            <Sel label="Face Shape" value={dna.face.shape} options={['oval', 'round', 'square', 'heart', 'diamond', 'oblong', 'triangle']} onChange={(v: string) => update('face.shape', v)} />
                            <Slider label="Facial Symmetry Score" value={dna.face.symmetry_score} min={60} max={100} step={1} unit="%" onChange={(v: number) => update('face.symmetry_score', v)} />
                            <Sub label="Dimensions (cm)" />
                            <Slider label="Face Height (top→chin)" value={dna.face.total_height} min={14} max={24} unit=" cm" onChange={(v: number) => update('face.total_height', v)} />
                            <Slider label="Face Width (cheekbone)" value={dna.face.total_width} min={10} max={18} unit=" cm" onChange={(v: number) => update('face.total_width', v)} />
                            <Slider label="Forehead Height" value={dna.face.forehead_height} min={3} max={8} unit=" cm" onChange={(v: number) => update('face.forehead_height', v)} />
                            <Slider label="Forehead Width" value={dna.face.forehead_width} min={8} max={16} unit=" cm" onChange={(v: number) => update('face.forehead_width', v)} />
                            <Slider label="Cheekbone Width" value={dna.face.cheekbone_width} min={10} max={18} unit=" cm" onChange={(v: number) => update('face.cheekbone_width', v)} />
                            <Slider label="Jaw Width" value={dna.face.jaw_width} min={8} max={16} unit=" cm" onChange={(v: number) => update('face.jaw_width', v)} />
                            <Slider label="Chin Height" value={dna.face.chin_height} min={1.5} max={5} unit=" cm" onChange={(v: number) => update('face.chin_height', v)} />
                            <Sel label="Chin Shape" value={dna.face.chin_shape} options={['pointed', 'rounded', 'square', 'cleft']} onChange={(v: string) => update('face.chin_shape', v)} />
                            <Sub label="Eyes" />
                            <Txt label="Eye Color" value={dna.face.eye_color} onChange={(v: string) => update('face.eye_color', v)} placeholder="hazel green" />
                            <Sel label="Eye Shape" value={dna.face.eye_shape} options={['almond', 'round', 'hooded', 'monolid', 'upturned', 'downturned']} onChange={(v: string) => update('face.eye_shape', v)} />
                            <Slider label="Eye Size (pupil h)" value={dna.face.eye_size} min={7} max={16} step={0.5} unit=" mm" onChange={(v: number) => update('face.eye_size', v)} />
                            <Slider label="Eye Spacing" value={dna.face.eye_spacing} min={2} max={5} unit=" cm" onChange={(v: number) => update('face.eye_spacing', v)} />
                            <Sel label="Brow Thickness" value={dna.face.brow_thickness} options={['thin', 'medium', 'thick', 'bushy']} onChange={(v: string) => update('face.brow_thickness', v)} />
                            <Sel label="Brow Arch" value={dna.face.brow_arch} options={['flat', 'soft', 'medium', 'high']} onChange={(v: string) => update('face.brow_arch', v)} />
                            <Sub label="Nose" />
                            <Slider label="Nose Length" value={dna.face.nose_length} min={3} max={7} unit=" cm" onChange={(v: number) => update('face.nose_length', v)} />
                            <Slider label="Nose Width" value={dna.face.nose_width} min={2} max={5} unit=" cm" onChange={(v: number) => update('face.nose_width', v)} />
                            <Sel label="Bridge Height" value={dna.face.nose_bridge_height} options={['low', 'medium', 'high']} onChange={(v: string) => update('face.nose_bridge_height', v)} />
                            <Sel label="Nose Tip" value={dna.face.nose_tip} options={['upturned', 'downturned', 'bulbous', 'pointed', 'flat']} onChange={(v: string) => update('face.nose_tip', v)} />
                            <Sub label="Lips" />
                            <Slider label="Upper Lip Thickness" value={dna.face.lip_upper_thickness} min={3} max={18} step={0.5} unit=" mm" onChange={(v: number) => update('face.lip_upper_thickness', v)} />
                            <Slider label="Lower Lip Thickness" value={dna.face.lip_lower_thickness} min={5} max={22} step={0.5} unit=" mm" onChange={(v: number) => update('face.lip_lower_thickness', v)} />
                            <Slider label="Lip Width" value={dna.face.lip_width} min={3} max={7} unit=" cm" onChange={(v: number) => update('face.lip_width', v)} />
                            <Sel label="Lip Fullness" value={dna.face.lip_fullness} options={['thin', 'medium', 'full', 'very_full']} onChange={(v: string) => update('face.lip_fullness', v)} />
                            <Sub label="Skin" />
                            <Txt label="Skin Tone" value={dna.face.skin_tone} onChange={(v: string) => update('face.skin_tone', v)} placeholder="warm ivory, golden tan..." />
                            <Sel label="Undertone" value={dna.face.skin_undertone} options={['warm', 'cool', 'neutral']} onChange={(v: string) => update('face.skin_undertone', v)} />
                            <Sel label="Texture" value={dna.face.skin_texture} options={['smooth', 'natural', 'textured']} onChange={(v: string) => update('face.skin_texture', v)} />
                            <Tog label="Freckles" value={dna.face.freckles} onChange={(v: boolean) => update('face.freckles', v)} />
                        </>}

                        {/* ── HAIR ── */}
                        {tab === 'hair' && <>
                            <Txt label="Color" value={dna.hair.color} onChange={(v: string) => update('hair.color', v)} placeholder="platinum blonde, jet black..." />
                            <Txt label="Highlight Color" value={dna.hair.highlight_color} onChange={(v: string) => update('hair.highlight_color', v)} placeholder="rose gold, none..." />
                            <Sel label="Length" value={dna.hair.length} options={['buzz', 'short', 'chin', 'shoulder', 'mid_back', 'waist', 'hip']} onChange={(v: string) => update('hair.length', v)} />
                            <Sel label="Texture" value={dna.hair.texture} options={['straight', 'wavy', 'curly', 'coily']} onChange={(v: string) => update('hair.texture', v)} />
                            <Sel label="Density" value={dna.hair.density} options={['thin', 'medium', 'thick']} onChange={(v: string) => update('hair.density', v)} />
                            <Txt label="Style" value={dna.hair.style} onChange={(v: string) => update('hair.style', v)} placeholder="layered bob, space buns..." />
                        </>}

                        {/* ── BODY ── */}
                        {tab === 'body' && <>
                            <Slider label="Height" value={dna.body.height_cm} min={150} max={195} step={1} unit=" cm" onChange={(v: number) => update('body.height_cm', v)} />
                            <Slider label="Weight" value={dna.body.weight_kg} min={42} max={110} step={0.5} unit=" kg" onChange={(v: number) => update('body.weight_kg', v)} />
                            <Sel label="Body Type" value={dna.body.body_type} options={['ectomorph', 'mesomorph', 'endomorph', 'hourglass', 'pear', 'apple', 'rectangle']} onChange={(v: string) => update('body.body_type', v)} />
                            <Sel label="Muscle Tone" value={dna.body.muscle_tone} options={['very_lean', 'lean', 'athletic', 'curvy', 'soft', 'strong']} onChange={(v: string) => update('body.muscle_tone', v)} />
                            <Sub label="Measurements (cm)" />
                            <Slider label="Bust" value={dna.body.bust_cm} min={70} max={130} step={1} unit=" cm" onChange={(v: number) => update('body.bust_cm', v)} />
                            <Slider label="Waist" value={dna.body.waist_cm} min={55} max={110} step={1} unit=" cm" onChange={(v: number) => update('body.waist_cm', v)} />
                            <Slider label="Hips" value={dna.body.hips_cm} min={75} max={130} step={1} unit=" cm" onChange={(v: number) => update('body.hips_cm', v)} />
                            <Slider label="Shoulder Width" value={dna.body.shoulder_width_cm} min={30} max={55} step={0.5} unit=" cm" onChange={(v: number) => update('body.shoulder_width_cm', v)} />
                            <Slider label="Arm Length" value={dna.body.arm_length_cm} min={50} max={80} step={0.5} unit=" cm" onChange={(v: number) => update('body.arm_length_cm', v)} />
                            <Slider label="Leg Length" value={dna.body.leg_length_cm} min={70} max={110} step={0.5} unit=" cm" onChange={(v: number) => update('body.leg_length_cm', v)} />
                            <Slider label="Neck Circumference" value={dna.body.neck_circumference_cm} min={28} max={45} step={0.5} unit=" cm" onChange={(v: number) => update('body.neck_circumference_cm', v)} />
                            <Slider label="Wrist Circumference" value={dna.body.wrist_circumference_cm} min={12} max={22} step={0.5} unit=" cm" onChange={(v: number) => update('body.wrist_circumference_cm', v)} />
                            <Slider label="Foot Size (EU)" value={dna.body.foot_size_eu} min={34} max={45} step={0.5} unit=" EU" onChange={(v: number) => update('body.foot_size_eu', v)} />
                        </>}

                        {/* ── STYLE ── */}
                        {tab === 'style' && <>
                            <Txt label="Primary Aesthetic" value={dna.style.primary_aesthetic} onChange={(v: string) => update('style.primary_aesthetic', v)} placeholder="neon cyberpunk, dark academia..." />
                            <Txt label="Color Palette" value={dna.style.color_palette.join(', ')} onChange={(v: string) => update('style.color_palette', v.split(',').map((s: string) => s.trim()).filter(Boolean))} placeholder="neon pink, chrome, obsidian" />
                            <Txt label="Clothing Era" value={dna.style.clothing_era} onChange={(v: string) => update('style.clothing_era', v)} placeholder="futuristic, 90s retro, victorian..." />
                            <Sel label="Makeup Style" value={dna.style.makeup_style} options={['bare', 'natural', 'glam', 'editorial', 'avant_garde', 'theatrical']} onChange={(v: string) => update('style.makeup_style', v)} />
                            <Txt label="Accessories" value={dna.style.accessories.join(', ')} onChange={(v: string) => update('style.accessories', v.split(',').map((s: string) => s.trim()).filter(Boolean))} placeholder="holographic visor, chrome rings..." />
                            <Txt label="Tattoos" value={dna.style.tattoos} onChange={(v: string) => update('style.tattoos', v)} placeholder="sleeve on right arm, none..." />
                            <Txt label="Piercings" value={dna.style.piercings} onChange={(v: string) => update('style.piercings', v)} placeholder="septum, multiple ear, none..." />
                        </>}

                        {/* ── MONETIZATION & NSFW GATE ── */}
                        {tab === 'gate' && <>
                            <Sub label="Platform Paywall Logic" />
                            <Sel label="Primary Monetization Strategy" value={dna.viral_strategy.monetization_angle} options={['Digital products', 'Brand sponsorships', 'Subscription / OF', 'Merch / E-commerce']} onChange={(v: string) => update('viral_strategy.monetization_angle', v)} />
                            <Slider label="Target CPM (Ad Revenue Est.)" value={dna.viral_strategy.target_cpm} min={0} max={25} step={0.5} unit=" USD" onChange={(v: number) => update('viral_strategy.target_cpm', v)} />
                            <Txt label="Target Geos (comma separated)" value={dna.viral_strategy.platform_priority?.join(', ')} onChange={(v: string) => update('viral_strategy.platform_priority', v.split(',').map((s: string) => s.trim()).filter(Boolean))} placeholder="US, UK, CA" />

                            <Sub label="Content Boundary Engine" />
                            <Sel label="NSFW Content Level" value={String(dna.content_boundary.level)} options={['1', '2', '3', '4', '5']} onChange={(v: string) => update('content_boundary.level', parseInt(v))} />
                            <div className="bg-[#1a1111] border border-red-500/20 p-2 rounded text-[9px] text-neutral-400 leading-tight">
                                <span className="text-red-400 font-bold block mb-1">Level Meanings:</span>
                                1: SFW (Family Friendly) <br />
                                2: Mild (Bikini / Gymwear / Fashion) <br />
                                3: Suggestive (Lingerie / Implied / Boudoir) <br />
                                4: Mature (Artistic / Teaser / Patreon) <br />
                                5: Explicit (Hardcore / OnlyFans Fully Unlocked)
                            </div>
                            <Tog label="Strict Face Safety (Always Show Face)" value={dna.content_boundary.face_always_visible} onChange={(v: boolean) => update('content_boundary.face_always_visible', v)} />
                        </>}

                        {/* ── RENDER ── */}
                        {tab === 'render' && <>
                            <Sel label="Preferred Model" value={dna.render.preferred_model} options={['juggernautXL_ragnarokBy.safetensors', 'cyberrealisticXL_v90.safetensors']} onChange={(v: string) => update('render.preferred_model', v)} />
                            <Sel label="Aspect Ratio" value={dna.render.suggested_aspect_ratio} options={['1:1', '4:5', '9:16', '16:9']} onChange={(v: string) => update('render.suggested_aspect_ratio', v)} />
                            <Tog label="Auto-rebuild prompt on slider change" value={autoPrompt} onChange={setAutoPrompt} />
                            <Txt label="LoRA Tags (comma separated)" value={dna.render.lora_tags.join(', ')} onChange={(v: string) => update('render.lora_tags', v.split(',').map((s: string) => s.trim()).filter(Boolean))} placeholder="<lora:film_grain:0.7>" />
                        </>}
                    </div>
                </div>

                {/* RIGHT PANEL */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4">

                    {/* ComfyUI Prompt */}
                    <div className="bg-[#0f0f0f] border border-[#1e1e1e] rounded-lg overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-2 border-b border-[#1e1e1e]">
                            <span className="text-[9px] font-bold uppercase tracking-widest text-amber-500">ComfyUI Prompt (auto-generated)</span>
                            <div className="flex gap-1.5">
                                <button onClick={() => setDna(prev => ({ ...prev, render: { ...prev.render, comfy_prompt_base: dnaToComfyPrompt(prev) } }))}
                                    className="flex items-center gap-1 text-[9px] px-2 py-1 rounded bg-[#1e1e1e] hover:bg-[#2a2a2a] text-neutral-500 transition-colors">
                                    <Wand2 size={9} /> Rebuild
                                </button>
                                <button onClick={() => navigator.clipboard.writeText(dna.render.comfy_prompt_base || dnaToComfyPrompt(dna))}
                                    className="flex items-center gap-1 text-[9px] px-2 py-1 rounded bg-[#1e1e1e] hover:bg-[#2a2a2a] text-neutral-500 transition-colors">
                                    <Copy size={9} /> Copy
                                </button>
                            </div>
                        </div>
                        <p className="p-4 font-mono text-[10px] text-cyan-300/80 leading-relaxed break-words">{dna.render.comfy_prompt_base || dnaToComfyPrompt(dna)}</p>
                    </div>

                    {/* Personality Analysis Cards */}
                    <div className="grid grid-cols-2 gap-4">
                        {/* OCEAN Archetype */}
                        <div className="bg-[#0f0f0f] border border-[#1e1e1e] rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-2"><Brain size={12} className="text-violet-400" /><span className="text-[9px] font-bold uppercase tracking-widest text-violet-400">Derived Archetype</span></div>
                            <p className="text-xs text-neutral-400 leading-relaxed">{deriveArchetype(p.ocean)}</p>
                            <div className="mt-3 space-y-1">
                                {[
                                    { k: 'openness', label: 'O', val: p.ocean.openness, color: 'bg-violet-500' },
                                    { k: 'conscientiousness', label: 'C', val: p.ocean.conscientiousness, color: 'bg-blue-500' },
                                    { k: 'extraversion', label: 'E', val: p.ocean.extraversion, color: 'bg-amber-500' },
                                    { k: 'agreeableness', label: 'A', val: p.ocean.agreeableness, color: 'bg-emerald-500' },
                                    { k: 'neuroticism', label: 'N', val: p.ocean.neuroticism, color: 'bg-rose-500' },
                                ].map(r => (
                                    <div key={r.k} className="flex items-center gap-2">
                                        <span className="text-[9px] font-mono text-neutral-600 w-3">{r.label}</span>
                                        <div className="flex-1 h-1 bg-[#1e1e1e] rounded-full overflow-hidden">
                                            <div className={`h-full ${r.color}`} style={{ width: `${r.val}%` }} />
                                        </div>
                                        <span className="text-[9px] font-mono text-neutral-500 w-6 text-right">{r.val}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Social Algorithm Summary */}
                        <div className="bg-[#0f0f0f] border border-[#1e1e1e] rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-2"><BarChart3 size={12} className="text-cyan-400" /><span className="text-[9px] font-bold uppercase tracking-widest text-cyan-400">Social Algorithm</span></div>
                            <div className="space-y-1.5 text-[10px]">
                                <p className="text-neutral-500">Caption style: <span className="text-neutral-300">{p.social_algorithm.caption_style.replace('_', ' ')}</span></p>
                                <p className="text-neutral-500">Hook type: <span className="text-neutral-300">{p.social_algorithm.hook_type.replace('_', ' ')}</span></p>
                                <p className="text-neutral-500">Strategy: <span className="text-neutral-300">{p.social_algorithm.growth_strategy.replace('_', ' ')}</span></p>
                                <p className="text-neutral-500">Posts/week: <span className="text-amber-400 font-mono">{p.social_algorithm.posting_frequency_per_week}</span></p>
                                <p className="text-neutral-500 mt-1">Caption tone: <span className="text-neutral-300 italic">{oceanToCaption(p.ocean)}</span></p>
                            </div>
                        </div>

                        {/* Face Ratio */}
                        <div className="bg-[#0f0f0f] border border-[#1e1e1e] rounded-lg p-4">
                            <div className="text-[9px] font-bold uppercase tracking-widest text-emerald-400 mb-2">Face Ratio Analysis</div>
                            <div className="space-y-1.5">
                                {[
                                    { label: 'Golden Ratio Δ', value: Math.abs((dna.face.total_height / dna.face.total_width) - 1.618).toFixed(3), good: Math.abs((dna.face.total_height / dna.face.total_width) - 1.618) < 0.2 },
                                    { label: 'Symmetry Score', value: dna.face.symmetry_score + '%', good: dna.face.symmetry_score >= 85 },
                                    { label: 'Face H/W Ratio', value: (dna.face.total_height / dna.face.total_width).toFixed(2), good: true },
                                    { label: 'Jaw / Cheek Ratio', value: (dna.face.jaw_width / dna.face.cheekbone_width).toFixed(2), good: true },
                                    { label: 'Eye Spacing / Width', value: (dna.face.eye_spacing / dna.face.total_width).toFixed(3), good: true },
                                ].map(r => (
                                    <div key={r.label} className="flex justify-between">
                                        <span className="text-[10px] text-neutral-600">{r.label}</span>
                                        <span className={`text-[10px] font-mono font-bold ${r.good ? 'text-emerald-400' : 'text-amber-400'}`}>{r.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Body Ratio */}
                        <div className="bg-[#0f0f0f] border border-[#1e1e1e] rounded-lg p-4">
                            <div className="text-[9px] font-bold uppercase tracking-widest text-rose-400 mb-2">Body Ratio Analysis</div>
                            <div className="space-y-1.5">
                                {[
                                    { label: 'Waist-Hip Ratio', value: (dna.body.waist_cm / dna.body.hips_cm).toFixed(2) },
                                    { label: 'Bust-Waist Δ', value: (dna.body.bust_cm - dna.body.waist_cm).toFixed(0) + ' cm' },
                                    { label: 'Hip-Waist Δ', value: (dna.body.hips_cm - dna.body.waist_cm).toFixed(0) + ' cm' },
                                    { label: 'BMI Estimate', value: (dna.body.weight_kg / ((dna.body.height_cm / 100) ** 2)).toFixed(1) },
                                    { label: 'Leg / Height Ratio', value: (dna.body.leg_length_cm / dna.body.height_cm).toFixed(2) },
                                ].map(r => (
                                    <div key={r.label} className="flex justify-between">
                                        <span className="text-[10px] text-neutral-600">{r.label}</span>
                                        <span className="text-[10px] font-mono font-bold text-rose-400">{r.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* MBTI + Enneagram + Dark Triad summary */}
                    <div className="bg-[#0f0f0f] border border-[#1e1e1e] rounded-lg p-4">
                        <div className="text-[9px] font-bold uppercase tracking-widest text-violet-400 mb-3">Psychology Profile</div>
                        <div className="grid grid-cols-3 gap-4 text-[10px]">
                            <div>
                                <div className="text-neutral-600 mb-1 text-[9px]">MBTI</div>
                                <div className="text-2xl font-black text-violet-300 font-mono">{p.mbti.type}</div>
                                <div className="text-neutral-500 text-[9px] mt-1">
                                    {mbtiDescription(p.mbti.type)}
                                </div>
                            </div>
                            <div>
                                <div className="text-neutral-600 mb-1 text-[9px]">Enneagram</div>
                                <div className="text-2xl font-black text-cyan-300 font-mono">{p.enneagram.type}w{p.enneagram.wing}</div>
                                <div className="text-neutral-500 text-[9px] mt-1">{p.enneagram.instinct} drive</div>
                            </div>
                            <div>
                                <div className="text-neutral-600 mb-1 text-[9px]">Dark Triad</div>
                                <div className="space-y-1">
                                    <div className="flex justify-between"><span className="text-neutral-500">Narc</span><span className="text-red-400 font-mono">{p.dark_triad.narcissism}</span></div>
                                    <div className="flex justify-between"><span className="text-neutral-500">Mach</span><span className="text-orange-400 font-mono">{p.dark_triad.machiavellianism}</span></div>
                                    <div className="flex justify-between"><span className="text-neutral-500">Psyc</span><span className="text-red-700 font-mono">{p.dark_triad.psychopathy}</span></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Raw JSON */}
                    <div className="bg-[#0f0f0f] border border-[#1e1e1e] rounded-lg overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-2 border-b border-[#1e1e1e]">
                            <span className="text-[9px] font-bold uppercase tracking-widest text-violet-400">Full DNA JSON</span>
                            <button onClick={exportDNA} className="flex items-center gap-1 text-[9px] px-2 py-1 rounded bg-[#1e1e1e] hover:bg-[#2a2a2a] text-neutral-500 transition-colors">
                                <Download size={9} /> Export
                            </button>
                        </div>
                        <pre className="p-4 text-[9px] text-neutral-600 font-mono overflow-auto max-h-96 leading-relaxed">
                            {JSON.stringify(dna, null, 2)}
                        </pre>
                    </div>
                </div>
            </div>
        </div>
    );
}
