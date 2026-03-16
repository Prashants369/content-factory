'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
    Users, Sparkles, Loader2, RefreshCw, ImagePlus, Zap,
    ChevronRight, Brain, DollarSign, Flame, Globe, Target,
    TrendingUp, BarChart3, Clock, Check, Shield
} from 'lucide-react';

interface Influencer {
    id: string; name: string; niche: string;
    avatar_image_path: string | null;
    generated_image_path: string | null;
    image_status: string; dna_json: string | null;
    created_at: string;
}

// ── Viral Score Calculator ────────────────────────────────────────────────
function calcViralScore(dna: any): number {
    if (!dna) return 0;
    const p = dna.personality;
    const v = dna.viral_strategy;
    let score = 50;
    if (p?.ocean?.extraversion > 70) score += 10;
    if (p?.dark_triad?.narcissism > 60) score += 8;
    if (v?.psychological_hooks?.includes('FOMO') || v?.psychological_hooks?.includes('Status Signaling')) score += 10;
    if (v?.primary_hook_archetype === 'The Contrarian' || v?.primary_hook_archetype === 'The Shock Factor') score += 12;
    if (v?.pacing_bpm >= 120 && v?.pacing_bpm <= 145) score += 5;
    if (dna.content_boundary?.level >= 3) score += 5;
    return Math.min(100, score);
}

// ── Card Component ─────────────────────────────────────────────────────────
function InfluencerCard({ influencer }: { influencer: Influencer }) {
    const dna = influencer.dna_json ? JSON.parse(influencer.dna_json) : null;
    const p = dna?.personality;
    const v = dna?.viral_strategy;
    const displayImage = influencer.avatar_image_path || influencer.generated_image_path;
    const viralScore = calcViralScore(dna);
    const scoreColor = viralScore >= 85 ? 'text-violet-400' : viralScore >= 70 ? 'text-amber-400' : 'text-neutral-500';
    const scoreBg = viralScore >= 85 ? 'bg-violet-500/10 border-violet-500/20' : viralScore >= 70 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-neutral-500/10 border-neutral-700';

    return (
        <div className="group relative bg-[#0c0c0c] border border-[#1e1e1e] rounded-2xl overflow-hidden hover:border-[#2a2a2a] transition-all duration-300 hover:shadow-lg hover:shadow-black/50 flex flex-col">
            {/* Image Area */}
            <div className="relative h-52 bg-[#111] overflow-hidden">
                {displayImage ? (
                    <>
                        <img
                            src={displayImage}
                            alt={influencer.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            style={{ objectPosition: 'center 15%' }}
                        />
                        {/* Bottom fade for blending into card content */}
                        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#0c0c0c] to-transparent pointer-events-none" />
                    </>
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <Users size={32} className="text-neutral-800" />
                    </div>
                )}
                {/* Overlay badges */}
                <div className="absolute top-2 left-2 right-2 flex justify-between items-start">
                    {v?.market_focus && (
                        <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-black/70 border border-white/10 text-neutral-400 font-mono backdrop-blur-sm flex items-center gap-1">
                            <Globe size={6} /> {v.market_focus}
                        </span>
                    )}
                    <span className={`text-[8px] px-2 py-0.5 rounded-full border font-black font-mono backdrop-blur-sm ${scoreBg} ${scoreColor}`}>
                        ⚡ {viralScore}
                    </span>
                </div>
                {/* Image status */}
                {influencer.image_status !== 'done' && (
                    <div className="absolute bottom-2 right-2">
                        <span className="text-[7px] px-1.5 py-0.5 rounded bg-[#111]/80 border border-[#2a2a2a] text-neutral-600 backdrop-blur-sm">No Portrait</span>
                    </div>
                )}
            </div>

            {/* Content Area */}
            <div className="p-4 flex flex-col gap-3 flex-1">
                <div>
                    <h3 className="font-black text-neutral-100 text-sm leading-snug">{influencer.name}</h3>
                    <p className="text-[9px] text-neutral-600 mt-0.5 line-clamp-2">{influencer.niche}</p>
                </div>

                {/* Psychological hooks */}
                {v?.psychological_hooks?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                        {v.psychological_hooks.map((hook: string) => (
                            <span key={hook} className="text-[7px] px-1.5 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 uppercase font-bold tracking-wide">
                                {hook}
                            </span>
                        ))}
                    </div>
                )}

                {/* Stats row */}
                {dna && (
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#1a1a1a]">
                        <div className="text-center">
                            <div className="text-xs font-black font-mono text-emerald-400">${v?.target_cpm || '—'}</div>
                            <div className="text-[7px] text-neutral-700 uppercase">CPM</div>
                        </div>
                        <div className="text-center">
                            <div className="text-xs font-black font-mono text-violet-400">{p?.mbti?.type || '—'}</div>
                            <div className="text-[7px] text-neutral-700 uppercase">MBTI</div>
                        </div>
                        <div className="text-center">
                            <div className="text-xs font-black font-mono text-amber-400">{v?.pacing_bpm || '—'}</div>
                            <div className="text-[7px] text-neutral-700 uppercase">BPM</div>
                        </div>
                    </div>
                )}

                {/* Platforms */}
                {v?.platform_priority?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                        {v.platform_priority.map((plat: string) => (
                            <span key={plat} className="text-[7px] px-1.5 py-0.5 rounded bg-[#1a1a1a] border border-[#252525] text-neutral-500 font-mono uppercase">{plat}</span>
                        ))}
                    </div>
                )}

                {/* Hook Archetype */}
                {v?.primary_hook_archetype && (
                    <div className="flex items-center gap-1">
                        <Flame size={8} className="text-orange-500 shrink-0" />
                        <span className="text-[8px] text-neutral-500 italic">{v.primary_hook_archetype}</span>
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-1.5 mt-auto pt-2 border-t border-[#1a1a1a]">
                    <Link href={`/influencers/${influencer.id}`}
                        className="flex-1 flex items-center justify-center gap-1 text-[9px] py-1.5 rounded-lg bg-violet-700/80 hover:bg-violet-600 text-white font-bold transition-colors">
                        <Brain size={9} /> Profile
                    </Link>
                    <Link href="/queue"
                        className="flex-1 flex items-center justify-center gap-1 text-[9px] py-1.5 rounded-lg border border-[#2a2a2a] hover:bg-[#1a1a1a] text-neutral-500 hover:text-neutral-300 transition-colors">
                        <Sparkles size={9} /> Content
                    </Link>
                    <Link href="/models"
                        className="flex items-center justify-center gap-1 text-[9px] px-2 py-1.5 rounded-lg border border-[#2a2a2a] hover:bg-[#1a1a1a] text-neutral-600 hover:text-neutral-400 transition-colors">
                        <ImagePlus size={9} />
                    </Link>
                </div>
            </div>
        </div>
    );
}

// ── Sort Controls ─────────────────────────────────────────────────────────
const SORT_OPTIONS = [
    { value: 'newest', label: 'Newest' },
    { value: 'viral', label: 'Viral Score ↓' },
    { value: 'cpm', label: 'CPM ↓' },
    { value: 'name', label: 'Name A-Z' },
];

export default function InfluencersPage() {
    const [influencers, setInfluencers] = useState<Influencer[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [sort, setSort] = useState('newest');
    const [filterMarket, setFilterMarket] = useState<string>('all');

    const fetchInfluencers = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/influencers');
            if (!res.ok) { setInfluencers([]); return; }
            const data = await res.json();
            setInfluencers(Array.isArray(data) ? data : []);
        } catch {
            setInfluencers([]);
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchInfluencers(); }, [fetchInfluencers]);

    // Gather unique markets
    const markets = ['all', ...Array.from(new Set(influencers.map(i => {
        const dna = i.dna_json ? JSON.parse(i.dna_json) : null;
        return dna?.viral_strategy?.market_focus || 'Global';
    })))];

    let filtered = influencers.filter(i => {
        const dna = i.dna_json ? JSON.parse(i.dna_json) : null;
        const market = dna?.viral_strategy?.market_focus || 'Global';
        const matchMarket = filterMarket === 'all' || market === filterMarket;
        const matchSearch = i.name.toLowerCase().includes(search.toLowerCase()) || i.niche.toLowerCase().includes(search.toLowerCase());
        return matchMarket && matchSearch;
    });

    filtered = [...filtered].sort((a, b) => {
        const da = a.dna_json ? JSON.parse(a.dna_json) : null;
        const db = b.dna_json ? JSON.parse(b.dna_json) : null;
        if (sort === 'viral') return calcViralScore(db) - calcViralScore(da);
        if (sort === 'cpm') return (db?.viral_strategy?.target_cpm || 0) - (da?.viral_strategy?.target_cpm || 0);
        if (sort === 'name') return a.name.localeCompare(b.name);
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime(); // newest
    });

    const stats = {
        total: influencers.length,
        withImage: influencers.filter(i => i.image_status === 'done').length,
        withDNA: influencers.filter(i => !!i.dna_json).length,
        avgViralScore: influencers.length ? Math.round(influencers.reduce((acc, i) => acc + calcViralScore(i.dna_json ? JSON.parse(i.dna_json) : null), 0) / influencers.length) : 0,
    };

    return (
        <div className="h-full flex flex-col bg-[#080808] text-neutral-300 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e1e1e] bg-[#0a0a0a] shrink-0">
                <div className="flex items-center gap-3">
                    <Users size={16} className="text-cyan-400" />
                    <span className="font-bold text-sm tracking-widest uppercase text-neutral-300">Influencer Roster</span>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 font-mono">{stats.total} models</span>
                </div>
                <div className="flex items-center gap-2">
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or niche..."
                        className="bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-1.5 text-[10px] text-neutral-400 outline-none w-44 focus:border-[#3a3a3a] focus:bg-[#111] placeholder:text-neutral-700" />
                    <button onClick={fetchInfluencers} disabled={loading} className="p-1.5 rounded-lg border border-[#2a2a2a] hover:bg-[#1e1e1e] text-neutral-500 transition-colors">
                        <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <Link href="/character" className="flex items-center gap-1.5 text-[10px] px-3 py-1.5 rounded-lg bg-violet-700 hover:bg-violet-600 text-white font-bold transition-colors">
                        <Sparkles size={10} /> New Model
                    </Link>
                </div>
            </div>

            {/* Stats bar */}
            <div className="grid grid-cols-4 border-b border-[#1e1e1e] shrink-0">
                {[
                    { label: 'Total Models', value: stats.total, color: 'text-neutral-300' },
                    { label: 'Full DNA', value: stats.withDNA, color: 'text-amber-400' },
                    { label: 'With Portrait', value: stats.withImage, color: 'text-emerald-400' },
                    { label: 'Avg Viral Score', value: stats.avgViralScore, color: 'text-violet-400' },
                ].map(s => (
                    <div key={s.label} className="px-6 py-3 border-r border-[#1e1e1e] last:border-r-0">
                        <div className={`text-xl font-black font-mono ${s.color}`}>{s.value}</div>
                        <div className="text-[9px] text-neutral-600 uppercase tracking-wider">{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Filters + Sort */}
            <div className="flex items-center gap-4 px-6 py-3 border-b border-[#1a1a1a] bg-[#090909] shrink-0 overflow-x-auto">
                <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[8px] text-neutral-700 uppercase font-bold tracking-widest">Sort:</span>
                    {SORT_OPTIONS.map(opt => (
                        <button key={opt.value} onClick={() => setSort(opt.value)}
                            className={`text-[9px] px-2.5 py-1 rounded-lg transition-colors ${sort === opt.value ? 'bg-violet-700 text-white' : 'border border-[#2a2a2a] text-neutral-600 hover:text-neutral-400'}`}>
                            {opt.label}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[8px] text-neutral-700 uppercase font-bold tracking-widest">Market:</span>
                    {markets.map(m => (
                        <button key={m} onClick={() => setFilterMarket(m)}
                            className={`text-[9px] px-2.5 py-1 rounded-lg transition-colors capitalize ${filterMarket === m ? 'bg-cyan-700/50 border border-cyan-500/30 text-cyan-300' : 'border border-[#2a2a2a] text-neutral-600 hover:text-neutral-400'}`}>
                            {m}
                        </button>
                    ))}
                </div>
            </div>

            {/* Card Grid */}
            <div className="flex-1 overflow-y-auto p-6">
                {loading ? (
                    <div className="flex items-center justify-center h-48">
                        <Loader2 className="text-violet-500 animate-spin" size={24} />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
                        <Users size={36} className="text-neutral-800" />
                        <div>
                            <p className="text-neutral-500 font-semibold text-sm">{search ? 'No matches found' : 'No influencers yet'}</p>
                            {!search && <p className="text-[11px] text-neutral-700 mt-1">Create characters in the DNA Editor and save them to your Roster</p>}
                        </div>
                        {!search && (
                            <Link href="/character" className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-700 hover:bg-violet-600 text-white text-sm font-bold transition-colors">
                                <Sparkles size={14} /> Create First Model
                            </Link>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filtered.map(inf => <InfluencerCard key={inf.id} influencer={inf} />)}
                    </div>
                )}
            </div>
        </div>
    );
}
