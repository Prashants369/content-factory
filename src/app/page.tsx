'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Users, Camera, ListVideo, Network, Activity, Zap, Play, RefreshCw,
  Loader2, Sparkles, Users2, Fingerprint, TrendingUp, DollarSign,
  Brain, Bolt, Globe, ArrowUpRight, ChevronRight, Clock, BarChart3,
  Target, Flame, AlertCircle, Clapperboard
} from 'lucide-react';

import AgentLiveStatus from '@/components/AgentLiveStatus';

import useSWR from 'swr';

const fetcher = async (url: string) => {
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return data ?? [];
  } catch {
    return [];
  }
};

// ── Types ─────────────────────────────────────────────────────────────────
interface StatCardData { title: string; value: number | string; sub: string; icon: any; color: string; glow: string; border: string; bg: string; href: string; trend?: string; }
interface ActivityItem { time: string; text: string; color: string; }

// ── Stat Card ─────────────────────────────────────────────────────────────
function StatCard({ card }: { card: StatCardData }) {
  return (
    <Link href={card.href} className={`relative p-[1px] rounded-2xl overflow-hidden group ${card.glow} block transition-all duration-300 hover:scale-[1.02]`}>
      <div className="relative h-full bg-[#0c0c0c] border border-white/[0.06] rounded-[15px] p-5 flex flex-col justify-between hover:bg-[#111] transition-colors duration-300">
        <div className="flex justify-between items-start mb-4">
          <div className={`p-2.5 rounded-xl ${card.bg} ${card.border} border`}>
            <card.icon className={`w-4 h-4 ${card.color}`} strokeWidth={2} />
          </div>
          {card.trend && (
            <span className="text-[9px] flex items-center gap-0.5 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full font-mono">
              <ArrowUpRight size={8} /> {card.trend}
            </span>
          )}
        </div>
        <div>
          <div className="text-3xl font-black tracking-tight text-white/90 mb-0.5 font-mono">{card.value}</div>
          <div className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">{card.title}</div>
          <div className="text-[9px] text-slate-600 mt-0.5">{card.sub}</div>
        </div>
      </div>
    </Link>
  );
}

// ── Niche Card ─────────────────────────────────────────────────────────────
function NicheCard({ niche }: { niche: { label: string; cpm: string; hook: string; market: string; color: string; border: string; } }) {
  return (
    <div className={`p-3 rounded-xl border ${niche.border} bg-[#0c0c0c]`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-[10px] font-bold text-neutral-200 leading-snug">{niche.label}</span>
        <span className={`text-[9px] font-mono font-black px-1.5 py-0.5 rounded ${niche.color} shrink-0`}>${niche.cpm}</span>
      </div>
      <div className="text-[8px] text-neutral-600 italic mb-1">"{niche.hook}"</div>
      <div className="flex gap-1 mt-1.5">
        <span className="text-[7px] px-1 py-0.5 rounded bg-[#1a1a1a] text-neutral-600 border border-[#222]">{niche.market}</span>
      </div>
    </div>
  );
}

// ── Activity Item ─────────────────────────────────────────────────────────
function ActivityRow({ item }: { item: ActivityItem }) {
  return (
    <div className="flex items-center gap-2.5 py-2 border-b border-[#111] last:border-0">
      <div className={`w-1 h-1 rounded-full shrink-0 ${item.color}`} />
      <span className="text-[9px] text-neutral-400 flex-1">{item.text}</span>
      <span className="text-[8px] text-neutral-700 font-mono shrink-0">{item.time}</span>
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────
const HOT_NICHES = [
  { label: 'AI Side Hustles & SaaS', cpm: '15.00', hook: 'The tool I use to make $200/day', market: 'Global', color: 'bg-violet-500/20 text-violet-300', border: 'border-violet-500/20' },
  { label: 'Luxury Quiet Wealth', cpm: '22.00', hook: 'What having real money looks like', market: 'India / Global', color: 'bg-amber-500/20 text-amber-300', border: 'border-amber-500/20' },
  { label: 'Indian FinTech / Investing', cpm: '11.00', hook: 'This is why your money isn\'t growing', market: 'India', color: 'bg-emerald-500/20 text-emerald-300', border: 'border-emerald-500/20' },
  { label: 'Biohacking & Tech-Wellness', cpm: '9.50', hook: 'My morning stack changed everything', market: 'Global', color: 'bg-cyan-500/20 text-cyan-300', border: 'border-cyan-500/20' },
  { label: 'Aesthetic Home Decor', cpm: '7.00', hook: 'Designing my $0 apartment', market: 'Global / Pinterest', color: 'bg-rose-500/20 text-rose-300', border: 'border-rose-500/20' },
  { label: 'Desi-Modern Fusion Fashion', cpm: '5.50', hook: 'Outfits that break the internet', market: 'India', color: 'bg-fuchsia-500/20 text-fuchsia-300', border: 'border-fuchsia-500/20' },
];

export default function Home() {
  const { data: influencers } = useSWR('/api/influencers', fetcher, { refreshInterval: 15000, errorRetryCount: 2 });
  const { data: postsData } = useSWR('/api/content/generate', fetcher, { refreshInterval: 15000, errorRetryCount: 2 });
  const [running, setRunning] = useState<string | null>(null);
  const [output, setOutput] = useState<Record<string, string>>({});

  const posts = useMemo(() => {
    if (!postsData) return [];
    if (Array.isArray(postsData)) return postsData;
    if (postsData.posts && Array.isArray(postsData.posts)) return postsData.posts;
    return [];
  }, [postsData]);

  const stats = useMemo(() => ({
    totalInfluencers: Array.isArray(influencers) ? influencers.length : 0,
    postsGeneratedToday: posts.filter((p: any) => p?.status !== 'Posted').length,
    ideasPending: posts.filter((p: any) => p?.status === 'Idea').length,
    readyToPost: posts.filter((p: any) => p?.status === 'Ready').length,
  }), [influencers, posts]);

  const revenue = useMemo(() => {
    const estDaily = (stats.readyToPost * 1000 * 8 / 1000).toFixed(2);
    const estMonthly = (parseFloat(estDaily) * 30).toFixed(2);
    return { daily: estDaily, monthly: estMonthly };
  }, [stats.readyToPost]);

  const triggerAction = async (action: string) => {
    setRunning(action);
    setOutput(prev => ({ ...prev, [action]: 'Running...' }));
    try {
      if (action === 'generate_content') {
        const infRes = await fetch('/api/influencers');
        const infs = await infRes.json();
        if (!Array.isArray(infs) || !infs.length) { setOutput(prev => ({ ...prev, [action]: '⚠ No models saved yet. Create one in DNA Editor.' })); return; }
        const target = infs[0];
        const res = await fetch('/api/content/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ influencer_id: target.id, count: 5 }) });
        const data = await res.json();
        setOutput(prev => ({ ...prev, [action]: res.ok ? `✓ ${data.count ?? 0} posts generated for ${target.name}` : '✗ ' + (data.error || 'Failed') }));
      } else if (action === 'generate_image') {
        const infRes = await fetch('/api/influencers');
        const infs = await infRes.json();
        if (!Array.isArray(infs) || !infs.length) { setOutput(prev => ({ ...prev, [action]: '⚠ No models yet.' })); return; }
        const noImg = infs.filter((i: any) => i.image_status !== 'done');
        if (!noImg.length) { setOutput(prev => ({ ...prev, [action]: '✓ All models have images!' })); return; }
        const target = noImg[0];
        setOutput(prev => ({ ...prev, [action]: `Queuing ${target.name}...` }));
        const res = await fetch(`/api/influencers/${target.id}/generate-image`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
        const data = await res.json();
        setOutput(prev => ({ ...prev, [action]: res.ok ? `✓ Image queued for ${target.name}!` : '✗ ' + (data.error || 'Failed') }));
      } else if (action === 'new_character') {
        window.location.href = '/character'; return;
      } else if (action === 'video_burst') {
        const infRes = await fetch('/api/influencers');
        const infs = await infRes.json();
        if (!Array.isArray(infs) || !infs.length) { setOutput(prev => ({ ...prev, [action]: '⚠ Create a model first.' })); return; }
        const target = infs[0];
        try {
          const res = await fetch(`${window.location.protocol}//${window.location.hostname}:8787/agents/video-burst`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': 'ai_factory_secret_2026'
            },
            body: JSON.stringify({ influencer_ids: [target.id], num_videos: 1 })
          });
          const data = await res.json();
          setOutput(prev => ({ ...prev, [action]: res.ok ? `✓ Video Burst queued for ${target.name}!` : '✗ ' + (data.error || 'Agent engine offline') }));
        } catch (e: any) {
          setOutput(prev => ({ ...prev, [action]: '✗ Agent engine (port 8787) is offline' }));
        }
      }
    } catch (e: any) {
      setOutput(prev => ({ ...prev, [action]: '✗ ' + e.message }));
    } finally { setRunning(null); }
  };

  const cards: StatCardData[] = [
    { title: 'Active Models', value: stats.totalInfluencers, sub: 'DNA-encoded influencers', icon: Users2, color: 'text-purple-400', glow: 'shadow-[0_0_20px_rgba(168,85,247,0.1)]', border: 'border-purple-500/15', bg: 'bg-purple-500/5', href: '/models', trend: '+1 today' },
    { title: 'Content Queue', value: stats.postsGeneratedToday, sub: 'Posts in pipeline', icon: ListVideo, color: 'text-cyan-400', glow: 'shadow-[0_0_20px_rgba(34,211,238,0.1)]', border: 'border-cyan-500/15', bg: 'bg-cyan-500/5', href: '/queue' },
    { title: 'Pending Ideas', value: stats.ideasPending, sub: 'Awaiting production', icon: Brain, color: 'text-amber-400', glow: 'shadow-[0_0_20px_rgba(251,191,36,0.1)]', border: 'border-amber-500/15', bg: 'bg-amber-500/5', href: '/queue' },
    { title: 'Est. Daily CPM', value: `$${revenue.daily}`, sub: 'Revenue estimate ($8 CPM avg)', icon: DollarSign, color: 'text-emerald-400', glow: 'shadow-[0_0_20px_rgba(52,211,153,0.1)]', border: 'border-emerald-500/15', bg: 'bg-emerald-500/5', href: '/queue', trend: `$${revenue.monthly}/mo` },
  ];

  return (
    <div className="max-w-7xl mx-auto p-6 sm:p-10 pb-20 space-y-8 pt-4">

      {/* ── Header ──────────────────────────────────── */}
      <div className="flex justify-between items-end pb-6 border-b border-white/[0.06]">
        <div>
          <div className="text-[9px] font-bold tracking-[0.3em] text-neutral-600 uppercase mb-2">AI Influencer OS</div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white">
            Command Center
          </h1>
          <p className="text-neutral-500 text-sm mt-1 font-light">
            Real-time telemetry. Viral engineering. Mathematical precision.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="p-2 rounded-xl border border-white/[0.06] text-neutral-600 hover:text-neutral-400 hover:bg-white/[0.03] transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/8 border border-emerald-500/15 rounded-full text-emerald-400 text-[10px] font-bold tracking-wider">
            <Activity className="w-3 h-3 animate-pulse" /> OPERATIONAL
          </div>
        </div>
      </div>

      {/* ── System Health Legend ────────────────────────── */}
      <div className="bg-[#0c0c0c] border border-white/[0.04] rounded-2xl p-4 flex flex-wrap gap-6 items-center">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.5)]" />
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">DNA Engine:</span>
            <span className="text-[10px] text-neutral-600">Ollama</span>
          </div>
          <button onClick={() => { fetch('/api/launcher', { method: 'POST', body: JSON.stringify({ service: 'ollama', action: 'start' }), headers: { 'Content-Type': 'application/json' } }) }} className="text-[8px] px-2 py-0.5 rounded border border-violet-500/20 text-violet-500 hover:bg-violet-500/10 transition-colors font-bold uppercase tracking-widest">Start</button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)]" />
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Visual Factory:</span>
            <span className="text-[10px] text-neutral-600">ComfyUI</span>
          </div>
          <button onClick={() => { fetch('/api/launcher', { method: 'POST', body: JSON.stringify({ service: 'comfyui', action: 'start' }), headers: { 'Content-Type': 'application/json' } }) }} className="text-[8px] px-2 py-0.5 rounded border border-cyan-500/20 text-cyan-500 hover:bg-cyan-500/10 transition-colors font-bold uppercase tracking-widest">Start</button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Ghost Publisher:</span>
            <span className="text-[10px] text-neutral-600">n8n</span>
          </div>
          <button onClick={() => { fetch('/api/launcher', { method: 'POST', body: JSON.stringify({ service: 'n8n', action: 'start' }), headers: { 'Content-Type': 'application/json' } }) }} className="text-[8px] px-2 py-0.5 rounded border border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/10 transition-colors font-bold uppercase tracking-widest">Start</button>
        </div>

        <div className="ml-auto flex items-center gap-1.5 text-[9px] text-amber-500/80 font-mono bg-amber-500/5 px-2 py-1 rounded border border-amber-500/10 cursor-help" title="Backends must be installed on your local machine. Configure paths in Settings.">
          <AlertCircle size={10} /> Dependency Check
        </div>
      </div>

      {/* ── Stats grid ────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(card => <StatCard key={card.title} card={card} />)}
      </div>

      {/* ── Main grid ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Quick Actions — 2 cols */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-bold tracking-widest uppercase text-neutral-400">Quick Launch</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { id: 'new_character', name: 'New AI Influencer', desc: 'DNA Editor → AI generation', icon: Fingerprint, accent: 'violet' },
              { id: 'generate_image', name: 'Generate Portrait', desc: 'ComfyUI → Viral visual', icon: Camera, accent: 'cyan' },
              { id: 'video_burst', name: 'Video Burst', desc: 'SVD + Polishing + Captions', icon: Clapperboard, accent: 'blue' },
              { id: 'generate_content', name: 'Batch Content', desc: 'AI hooks + captions', icon: Sparkles, accent: 'emerald' },
            ].map(btn => (
              <button key={btn.id} onClick={() => triggerAction(btn.id)} disabled={running === btn.id}
                className={`relative group p-5 rounded-2xl border text-left transition-all duration-300 disabled:opacity-50
                                    ${btn.accent === 'violet' ? 'border-violet-500/20 bg-violet-500/5 hover:bg-violet-500/10 hover:border-violet-500/40' : ''}
                                    ${btn.accent === 'cyan' ? 'border-cyan-500/20 bg-cyan-500/5 hover:bg-cyan-500/10 hover:border-cyan-500/40' : ''}
                                    ${btn.accent === 'blue' ? 'border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 hover:border-blue-500/40' : ''}
                                    ${btn.accent === 'emerald' ? 'border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 hover:border-emerald-500/40' : ''}
                                `}>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-3 
                                    ${btn.accent === 'violet' ? 'bg-violet-500/20 text-violet-400' : ''}
                                    ${btn.accent === 'cyan' ? 'bg-cyan-500/20 text-cyan-400' : ''}
                                    ${btn.accent === 'blue' ? 'bg-blue-500/20 text-blue-400' : ''}
                                    ${btn.accent === 'emerald' ? 'bg-emerald-500/20 text-emerald-400' : ''}
                                `}>
                  {running === btn.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <btn.icon className="w-4 h-4" />}
                </div>
                <div className="text-sm font-bold text-white mb-0.5">{btn.name}</div>
                <div className="text-[9px] text-neutral-600 uppercase tracking-wider">{btn.desc}</div>
                {output[btn.id] && (
                  <div className={`mt-2 text-[9px] leading-relaxed font-mono ${output[btn.id].startsWith('✗') ? 'text-red-400' : output[btn.id].startsWith('⚠') ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {output[btn.id]}
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Hot Niche Grid */}
          <div className="mt-2">
            <div className="flex items-center gap-2 mb-3">
              <Flame className="w-4 h-4 text-orange-500" />
              <h2 className="text-sm font-bold tracking-widest uppercase text-neutral-400">High CPM Niches 2025</h2>
              <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 font-mono">LIVE DATA</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
              {HOT_NICHES.map(n => <NicheCard key={n.label} niche={n} />)}
            </div>
          </div>
        </div>

        {/* Right Panel: Activity Feed + Nav */}
        <div className="space-y-4">
          {/* Activity Feed */}
          <AgentLiveStatus />

          {/* Revenue Projection */}
          <div className="bg-[#0c0c0c] border border-emerald-500/15 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Revenue Projection</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[9px] text-neutral-600">Daily Est.</span>
                <span className="text-lg font-black font-mono text-emerald-400">${revenue.daily}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[9px] text-neutral-600">Monthly Est.</span>
                <span className="text-sm font-bold font-mono text-emerald-500">${revenue.monthly}</span>
              </div>
              <div className="text-[8px] text-neutral-700 mt-2 pt-2 border-t border-[#1a1a1a]">Based on $8 avg CPM × {stats.readyToPost} ready posts × 1k est. views</div>
            </div>
          </div>

          {/* Nav */}
          <div className="bg-[#0c0c0c] border border-[#1a1a1a] rounded-2xl p-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-600 mb-3">Factory Sections</div>
            <div className="space-y-1">
              {[
                { href: '/character', label: 'DNA Editor', icon: Fingerprint, color: 'text-amber-400' },
                { href: '/influencers', label: 'Influencer Roster', icon: Users, color: 'text-cyan-400' },
                { href: '/studio', label: 'AI Cinema Studio', icon: Clapperboard, color: 'text-blue-400' },
                { href: '/models', label: 'Image Library', icon: Camera, color: 'text-violet-400' },
                { href: '/queue', label: 'Content Pipeline', icon: ListVideo, color: 'text-emerald-400' },
                { href: '/workflows', label: 'n8n Workflows', icon: Network, color: 'text-slate-400' },
              ].map(nav => (
                <Link key={nav.href} href={nav.href}
                  className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-white/[0.03] transition-colors group">
                  <nav.icon className={`w-3.5 h-3.5 ${nav.color}`} />
                  <span className="text-[11px] text-neutral-500 group-hover:text-neutral-300 transition-colors font-medium">{nav.label}</span>
                  <ChevronRight size={10} className="text-neutral-700 ml-auto group-hover:text-neutral-500 transition-colors" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
