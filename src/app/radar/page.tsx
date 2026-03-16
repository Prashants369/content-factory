'use client';
import { useState, useEffect } from 'react';
import {
    Radar, Activity, RefreshCw, Zap, TrendingUp,
    Globe, Smartphone, Skull, AlertCircle, CheckCircle2,
    Eye, Hash, Target
} from 'lucide-react';

interface TrendIdea {
    title: string;
    niche: string;
    why_trending: string;
    aesthetic: string;
    platform: string;
    emoji: string;
}

interface RadarResponse {
    ideas: TrendIdea[];
    source: string;
    message?: string;
    count: number;
    refreshed_at?: string;
}

export default function TrendRadarPage() {
    const [data, setData] = useState<RadarResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        // Initial soft load (will return cached/idle state)
        fetchRadar(false);
    }, []);

    const fetchRadar = async (forceRefresh = false) => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`/api/trending-ideas${forceRefresh ? '?refresh=1' : ''}`);
            const json = await res.json();
            if (!res.ok && json.message) {
                setError(json.message);
            } else {
                setData(json);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to connect to radar endpoint');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-full bg-[#080808] text-neutral-300 overflow-y-auto layout-scroll">
            {/* Header */}
            <div className="border-b border-[#1a1a1a] bg-[#0c0c0c] sticky top-0 z-20">
                <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-600 to-emerald-900 p-[1px] shadow-[0_0_20px_rgba(16,185,129,0.15)]">
                            <div className="w-full h-full rounded-2xl bg-[#0a0a0a] flex items-center justify-center relative overflow-hidden">
                                <div className="absolute inset-0 bg-emerald-500/10" />
                                <Radar size={22} className="text-emerald-400 relative z-10 animate-[spin_4s_linear_infinite]" />
                            </div>
                        </div>
                        <div>
                            <h1 className="text-lg font-black text-white flex items-center gap-2 tracking-wide">
                                GLOBAL TREND RADAR <span className="text-[10px] font-mono text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">LIVE</span>
                            </h1>
                            <p className="text-xs text-neutral-500 mt-0.5 max-w-xl">
                                Real-time algorithmic web-scraping for viral character aesthetics and high-traction hooks across TikTok, IG, and Pinterest.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="text-right mr-2 hidden sm:block">
                            <div className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest">Source</div>
                            <div className="text-[10px] font-mono text-neutral-400 capitalize flex items-center justify-end gap-1 mt-0.5">
                                {data?.source === 'idle' ? <span className="text-neutral-600">Idle</span> :
                                    data?.source?.includes('n8n') ? <span className="text-emerald-400 flex items-center gap-1"><Globe size={10} /> Web Scrape</span> :
                                        <span className="text-violet-400 flex items-center gap-1"><Activity size={10} /> Neural Gen</span>}
                            </div>
                        </div>
                        <button
                            onClick={() => fetchRadar(true)}
                            disabled={loading}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-br from-emerald-600 to-green-800 hover:from-emerald-500 hover:to-green-700 text-white text-xs font-black shadow-[0_0_15px_rgba(16,185,129,0.2)] transition-all disabled:opacity-50"
                        >
                            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                            {loading ? 'Scanning Deep Web...' : 'Run Live Scan'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Pre-requisite Warning */}
            <div className="bg-[#0a0a0a] border-b border-[#1a1a1a]">
                <div className="max-w-6xl mx-auto px-6 py-4 flex gap-4 items-start">
                    <div className="mt-0.5"><AlertCircle size={16} className="text-emerald-500" /></div>
                    <div>
                        <h4 className="text-xs font-bold text-emerald-400 mb-1">Radar Dependencies</h4>
                        <p className="text-[10px] text-neutral-400 leading-relaxed max-w-2xl">
                            <strong>Note:</strong> To perform a Live Scan, you must either have <strong>Ollama</strong> running locally, an active <strong>n8n</strong> workflow, OR have <strong>Exa AI and Gemini</strong> API keys configured in Advanced Mode. If the scan hangs, check your backend logs.
                        </p>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-6xl mx-auto px-6 py-8">
                {error ? (
                    <div className="p-6 rounded-2xl bg-red-500/5 border border-red-500/20 flex flex-col items-center justify-center text-center">
                        <AlertCircle size={32} className="text-red-500/50 mb-3" />
                        <p className="text-sm font-bold text-red-400 mb-1">Radar Scan Failed</p>
                        <p className="text-xs text-neutral-600 max-w-md leading-relaxed">{error}</p>
                    </div>
                ) : data?.source === 'idle' || data?.ideas?.length === 0 ? (
                    <div className="h-64 flex flex-col items-center justify-center border border-dashed border-[#2a2a2a] rounded-2xl bg-[#0c0c0c] relative overflow-hidden group">
                        <div className="absolute inset-0 bg-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <Radar size={48} className="text-emerald-500/20 mb-4 group-hover:text-emerald-500/40 transition-colors" />
                        <p className="text-sm font-bold text-neutral-400 mb-2">Radar Array is Idle</p>
                        <p className="text-[10px] text-neutral-600 text-center max-w-sm leading-relaxed">
                            Click "Run Live Scan" to deploy the Scout Agent. It will parse Reddit, Google Trends, and use Exa/Gemini to synthesize the exact viral aesthetics peaking right now.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {data?.ideas.map((idea, idx) => (
                            <div key={idx} className="bg-[#0c0c0c] border border-[#1a1a1a] p-5 rounded-2xl hover:border-emerald-500/30 transition-all group flex flex-col relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-[50px] rounded-full group-hover:bg-emerald-500/10 transition-colors" />

                                <div className="flex items-start justify-between mb-3 relative z-10">
                                    <div className="text-3xl filter drop-shadow-md">{idea.emoji}</div>
                                    <div className="flex gap-1 flex-col items-end">
                                        <div className="text-[8px] font-black tracking-widest uppercase px-1.5 py-0.5 rounded bg-[#111] border border-[#2a2a2a] text-neutral-400">
                                            {idea.platform}
                                        </div>
                                    </div>
                                </div>

                                <h3 className="text-xs font-black text-white leading-snug mb-2 relative z-10 group-hover:text-emerald-400 transition-colors">
                                    {idea.title}
                                </h3>

                                <div className="space-y-3 flex-1 relative z-10">
                                    <div>
                                        <div className="text-[7px] text-neutral-600 font-black uppercase tracking-widest mb-1 flex items-center gap-1">
                                            <Hash size={8} /> Aesthetic
                                        </div>
                                        <div className="text-[10px] font-mono text-emerald-300 bg-emerald-500/10 px-2 py-1 rounded inline-block">
                                            {idea.aesthetic}
                                        </div>
                                    </div>

                                    <div>
                                        <div className="text-[7px] text-neutral-600 font-black uppercase tracking-widest mb-1 flex items-center gap-1">
                                            <Target size={8} /> Niche Directive
                                        </div>
                                        <p className="text-[10px] text-neutral-400 leading-relaxed line-clamp-3">
                                            {idea.niche}
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-4 pt-3 border-t border-[#1a1a1a] relative z-10">
                                    <div className="text-[7px] text-emerald-600 font-black uppercase tracking-widest mb-1 flex items-center gap-1">
                                        <TrendingUp size={8} /> Why it's Viral Now
                                    </div>
                                    <p className="text-[9px] text-neutral-500 italic leading-relaxed line-clamp-2">
                                        {idea.why_trending}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}


