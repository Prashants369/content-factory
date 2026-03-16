'use client';
import { useState, useEffect } from 'react';
import { 
  Play, Clapperboard, Sparkles, Zap, Clock, 
  Settings, Film, Download, Share2, Eye, 
  TrendingUp, Activity, BarChart3, Radio,
  Loader2, CheckCircle2, AlertTriangle, ChevronRight,
  Flame, Scissors, MonitorPlay, Layers
} from 'lucide-react';
import useSWR, { mutate } from 'swr';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const fetcher = async (url: string) => {
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    return await res.json();
  } catch { return []; }
};

export default function StudioPage() {
  const { data: influencers } = useSWR('/api/influencers', fetcher);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedInfluencer, setSelectedInfluencer] = useState<string | null>(null);
  const [burstCount, setBurstCount] = useState(1);
  const [recentOutput, setRecentOutput] = useState<any[]>([]);

  // Trigger Video Burst
  const triggerBurst = async () => {
    if (!selectedInfluencer) return;
    setIsGenerating(true);
    try {
      const res = await fetch('http://127.0.0.1:8787/agents/video-burst', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-API-Key': 'ai_factory_secret_2026'
        },
        body: JSON.stringify({
          influencer_ids: [selectedInfluencer],
          num_videos: burstCount
        })
      });
      if (res.ok) {
        // Since it's a background task, we just confirm it's queued
        // In a real app, we'd poll or use SSE
      }
    } catch (err) {
      console.error("Burst error:", err);
    } finally {
      // Keep generating state for a bit for feedback
      setTimeout(() => setIsGenerating(false), 3000);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 sm:p-10 pb-20 space-y-8 animate-in fade-in duration-700">
      {/* Cinematic Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#111] via-[#080808] to-[#040404] border border-white/[0.04] p-8">
        <div className="absolute top-0 right-0 w-1/3 h-full bg-blue-500/5 blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-1/4 h-1/2 bg-purple-500/5 blur-[80px] pointer-events-none" />
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
          <div>
            <div className="text-[10px] font-bold tracking-[0.4em] text-blue-400 uppercase mb-3 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]">
               AI Cinema Production Suite
            </div>
            <h1 className="text-5xl font-black tracking-tighter text-white mb-3">
              Studio <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400">V.1</span>
            </h1>
            <p className="text-neutral-500 text-sm max-w-md font-light leading-relaxed">
              Transforming raw AI motion into high-retention masterpiece. 
              Integrated with <span className="text-blue-400/80 font-mono">Dopamine-Pacing</span> and <span className="text-purple-400/80 font-mono">Auto-Captions</span>.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button variant="outline" className="bg-[#0c0c0c] border-white/5 text-neutral-400 hover:text-white hover:bg-white/5 rounded-xl px-5 py-6">
              <Settings className="w-4 h-4 mr-2 opacity-50" />
              Workflow Config
            </Button>
            <Button 
               className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white border-0 shadow-lg shadow-blue-500/20 rounded-xl px-8 py-6 font-bold tracking-tight"
               onClick={triggerBurst}
               disabled={isGenerating || !selectedInfluencer}
            >
              {isGenerating ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sequencing...</>
              ) : (
                <><Sparkles className="w-4 h-4 mr-2" /> Launch Video Burst</>
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Controls */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="bg-[#0c0c0c] border-white/[0.04] p-5 rounded-2xl space-y-5">
            <div>
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-3">Production Model</label>
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 scrollbar-hide">
                {influencers?.map((inf: any) => (
                  <button
                    key={inf.id}
                    onClick={() => setSelectedInfluencer(inf.id)}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all duration-300 border ${
                      selectedInfluencer === inf.id 
                        ? 'bg-blue-500/10 border-blue-500/30 text-blue-100 shadow-[0_0_15px_rgba(59,130,246,0.1)]' 
                        : 'bg-white/[0.02] border-white/[0.04] text-neutral-500 hover:bg-white/[0.05] hover:border-white/10'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br from-[#222] to-[#111] flex items-center justify-center shrink-0 border border-white/5`}>
                      <Clapperboard size={14} className={selectedInfluencer === inf.id ? 'text-blue-400' : 'text-neutral-600'} />
                    </div>
                    <div className="text-left">
                       <div className="text-[11px] font-bold truncate tracking-tight">{inf.name}</div>
                       <div className="text-[9px] opacity-40 uppercase tracking-tighter">{inf.niche || 'General'}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-3">Burst Density</label>
              <div className="grid grid-cols-3 gap-2">
                {[1, 3, 5].map(n => (
                  <button
                    key={n}
                    onClick={() => setBurstCount(n)}
                    className={`p-2.5 rounded-xl border text-[11px] font-mono transition-all ${
                      burstCount === n 
                        ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300' 
                        : 'bg-white/[0.02] border-white/[0.04] text-neutral-600 hover:bg-white/[0.05]'
                    }`}
                  >
                    {n} Short{n > 1 ? 's' : ''}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2">
              <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
                <div className="flex items-center gap-2 text-amber-500 mb-1">
                  <Flame size={12} />
                  <span className="text-[10px] font-bold uppercase tracking-wider">High Retention Mode</span>
                </div>
                <p className="text-[9px] text-neutral-500 leading-relaxed font-light">
                  Enables dynamic zooms, chromatic aberration hits, and strategic B-roll insertion to maximize viewer loop.
                </p>
              </div>
            </div>
          </Card>

          <Card className="bg-[#0c0c0c] border-white/[0.04] p-5 rounded-2xl">
              <div className="flex items-center gap-2 mb-4">
                  <Activity size={14} className="text-blue-400" />
                  <span className="text-[11px] font-bold uppercase tracking-widest text-neutral-400">Pipeline Status</span>
              </div>
              <div className="space-y-4">
                  {[
                    { label: 'Trend Scout', status: 'Ready', color: 'bg-emerald-500' },
                    { label: 'Scripting Engine', status: 'Active', color: 'bg-blue-500' },
                    { label: 'Comfy Video (SVD)', status: 'Standby', color: 'bg-neutral-700' },
                    { label: 'Retention Editor', status: 'Standby', color: 'bg-neutral-700' },
                  ].map(step => (
                    <div key={step.label} className="flex items-center justify-between">
                        <span className="text-[10px] text-neutral-500 font-medium">{step.label}</span>
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] text-neutral-600 font-mono uppercase">{step.status}</span>
                            <div className={`w-1.5 h-1.5 rounded-full ${step.color} shadow-[0_0_8px_rgba(0,0,0,0.5)]`} />
                        </div>
                    </div>
                  ))}
              </div>
          </Card>
        </div>

        {/* Output Gallery / Large Workspace */}
        <div className="lg:col-span-3 space-y-6">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
            <div className="flex items-center gap-3">
              <MonitorPlay className="text-indigo-400" size={20} />
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">Recent Masterpiece Clips</h2>
                <p className="text-[10px] text-neutral-600 uppercase tracking-[0.2em] font-bold">Auto-polished & Caption-Burned</p>
              </div>
            </div>
            
            <Badge variant="outline" className="bg-[#0c0c0c] border-emerald-500/20 text-emerald-500 font-mono text-[10px]">
              {recentOutput.length || 0} OUTPUTS READY
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Sample/Empty State */}
            {recentOutput.length === 0 ? (
              <div className="md:col-span-2 flex flex-col items-center justify-center py-32 rounded-3xl border border-dashed border-white/[0.04] bg-white/[0.01]">
                <div className="w-16 h-16 rounded-2xl bg-white/[0.02] flex items-center justify-center mb-4 border border-white/[0.04]">
                  <Film size={24} className="text-neutral-700" />
                </div>
                <h3 className="text-sm font-bold text-neutral-400">No videos generated yet</h3>
                <p className="text-[11px] text-neutral-600 mt-1 uppercase tracking-widest font-medium">Capture a trend to begin production</p>
              </div>
            ) : null}
          </div>

          {/* Retention Analytics Visualization */}
          <Card className="bg-gradient-to-br from-[#0c0c0c] to-[#080808] border-white/[0.04] p-6 rounded-3xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity duration-700">
               <TrendingUp size={200} strokeWidth={4} />
            </div>
            
            <div className="flex items-center gap-4 mb-8">
              <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                <Radio size={18} className="animate-pulse" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white tracking-tight">Loop Probability Telemetry</h3>
                <p className="text-[10px] text-neutral-600 uppercase tracking-widest font-bold">Mathematical Engagement Prediction</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
               {[
                 { label: 'Retention Hook', value: '0.89', sub: 'High Probability', icon: Scissors, color: 'text-emerald-400' },
                 { label: 'Dopamine Pulse', value: '4.2s', sub: 'Sync Rate', icon: Zap, color: 'text-amber-400' },
                 { label: 'Visual Contrast', value: '+14%', sub: 'Over Baseline', icon: Eye, color: 'text-blue-400' },
                 { label: 'Watch Completion', value: '62%', sub: 'Est. Organic', icon: BarChart3, color: 'text-purple-400' },
               ].map(stat => (
                 <div key={stat.label} className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] transition-all">
                    <stat.icon size={14} className={`${stat.color} mb-3`} />
                    <div className="text-2xl font-black font-mono text-white mb-0.5">{stat.value}</div>
                    <div className="text-[9px] font-bold text-neutral-500 uppercase tracking-tight">{stat.label}</div>
                    <div className="text-[8px] text-neutral-700 font-mono italic">{stat.sub}</div>
                 </div>
               ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
