'use client';

import React from 'react';
import { useAgentTelemetry } from '@/lib/telemetry';
import { Activity, Cpu, Sparkles, Wand2, Zap } from 'lucide-react';

export default function AgentLiveStatus() {
    const { events, activeAgents, connected } = useAgentTelemetry();

    const agentIcons: Record<string, any> = {
        'Orchestrator': Cpu,
        'Creator': Wand2,
        'Visual': Sparkles,
        'Analyst': Zap,
        'Scout': Activity
    };

    const agents = ['Orchestrator', 'Scout', 'Creator', 'Visual', 'Analyst'];

    return (
        <div className="bg-[#0c0c0c] border border-white/[0.06] rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-white/[0.03] flex items-center justify-between">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-400 flex items-center gap-2">
                    <Activity size={12} className={connected ? "animate-pulse" : "opacity-30"} />
                    Live Agent Telemetry
                </h3>
                <div className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-500'}`} />
                    <span className="text-[8px] font-bold text-neutral-600 uppercase tracking-widest">
                        {connected ? 'Syncing' : 'Offline'}
                    </span>
                </div>
            </div>

            <div className="p-4 space-y-3">
                {agents.map((agentName) => {
                    const status = activeAgents[agentName];
                    const Icon = agentIcons[agentName] || Cpu;
                    const isActive = status && (Date.now() - status.timestamp < 300000); // Active if update in last 5 mins

                    return (
                        <div key={agentName} className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg border transition-all duration-500 ${isActive ? 'bg-violet-500/10 border-violet-500/30' : 'bg-neutral-900/50 border-white/[0.03]'}`}>
                                <Icon size={14} className={isActive ? 'text-violet-400' : 'text-neutral-700'} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-0.5">
                                    <span className={`text-[9px] font-black uppercase tracking-widest ${isActive ? 'text-white' : 'text-neutral-600'}`}>
                                        {agentName} Agent
                                    </span>
                                    <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded ${isActive ? 'bg-violet-500/20 text-violet-300 border border-violet-500/20' : 'bg-neutral-900 text-neutral-800'}`}>
                                        {isActive ? 'PROCESSING' : 'IDLE'}
                                    </span>
                                </div>
                                <div className={`text-[10px] truncate ${isActive ? 'text-neutral-400' : 'text-neutral-700 font-mono italic'}`}>
                                    {isActive ? status.message : 'Waiting for pipeline trigger...'}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Mini Event Log */}
            <div className="mt-2 p-2 bg-black/40 border-t border-white/[0.03] max-h-32 overflow-y-auto layout-scroll">
                {events.length === 0 ? (
                    <div className="text-[8px] text-neutral-800 uppercase font-black tracking-widest text-center py-4">
                        No recent transmissions
                    </div>
                ) : (
                    events.slice(0, 10).map((event, i) => (
                        <div key={i} className="text-[8px] font-mono py-1 px-2 border-b border-white/[0.02] last:border-0 flex gap-2">
                            <span className="text-violet-500 shrink-0">[{event.agent}]</span>
                            <span className="text-neutral-500 truncate">{event.message}</span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
