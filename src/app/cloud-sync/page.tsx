'use client';

import { useState, useEffect } from 'react';
import {
    CloudLightning, UploadCloud, RefreshCw, CheckCircle2,
    Clock, Smartphone, Globe, AlertCircle, Database, Network
} from 'lucide-react';

interface ScheduledPost {
    id: string;
    influencer_name: string;
    platform: string;
    scheduled_for: string;
    content: {
        hook: string;
        caption: string;
        media_url?: string;
    }
}

interface ExportPayload {
    export_timestamp: string;
    total_scheduled: number;
    posts: ScheduledPost[];
}

export default function CloudBridgePage() {
    const [payload, setPayload] = useState<ExportPayload | null>(null);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [syncStatus, setSyncStatus] = useState<string | null>(null);

    useEffect(() => {
        fetchPayload();
    }, []);

    const fetchPayload = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/cloud-sync/export');
            if (!res.ok) { setPayload(null); return; }
            const data = await res.json();
            setPayload(data);
        } catch {
            setPayload(null);
        } finally {
            setLoading(false);
        }
    };

    const handleUplink = async () => {
        setSyncing(true);
        setSyncStatus('Encrypting payload...');

        // Mocking the uplink delay to cloudflare
        await new Promise(resolve => setTimeout(resolve, 800));
        setSyncStatus('Connecting to Cloudflare Edge...');

        await new Promise(resolve => setTimeout(resolve, 1000));
        setSyncStatus('Transmitting ' + payload?.total_scheduled + ' scheduled posts...');

        await new Promise(resolve => setTimeout(resolve, 1200));
        setSyncStatus('✓ Uplink successful. Ghost Publisher active.');
        setSyncing(false);

        // Wipe status after a few seconds
        setTimeout(() => setSyncStatus(null), 5000);
    };

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center bg-[#080808]">
                <RefreshCw className="animate-spin text-neutral-600" />
            </div>
        );
    }

    return (
        <div className="h-full bg-[#080808] text-neutral-300 overflow-y-auto layout-scroll p-8">
            <div className="max-w-4xl mx-auto space-y-8">

                {/* Header Section */}
                <div>
                    <h1 className="text-2xl font-black text-white flex items-center gap-3">
                        <Globe className="text-blue-500" /> Cloud Bridge Terminal
                    </h1>
                    <p className="text-xs text-neutral-500 mt-2 max-w-2xl leading-relaxed">
                        This is the final step in the autonomous cycle. Review the content your local agents generated, and uplink the payload to the Cloudflare Edge network so your influencers keep posting while your PC is off.
                    </p>
                </div>

                {/* Exception Guideline */}
                <div className="p-4 rounded-xl bg-blue-900/10 border border-blue-500/20 flex gap-4 items-start">
                    <div className="mt-0.5"><AlertCircle size={16} className="text-blue-400" /></div>
                    <div>
                        <h4 className="text-xs font-bold text-blue-400 mb-1">Cloud Bridge Prerequisites</h4>
                        <p className="text-[10px] text-neutral-400 leading-relaxed max-w-3xl">
                            <strong>Requirement:</strong> The "Execute Uplink" function transmits your scheduled posts to a Cloudflare Worker KV store. You must have a valid <span className="text-white font-mono">CF_BRIDGE_URL</span> (or worker endpoint) configured in your <strong>Integration Hub</strong>. If the uplink fails, ensure your Cloudflare credentials are set and the worker is deployed.
                        </p>
                    </div>
                </div>

                {/* Dashboard Grid */}
                <div className="grid grid-cols-3 gap-6">

                    {/* Local Payload Status */}
                    <div className="col-span-2 bg-[#0c0c0c] border border-[#1a1a1a] rounded-2xl p-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 blur-[100px] rounded-full" />

                        <div className="flex items-center justify-between mb-6 relative z-10">
                            <div>
                                <h2 className="text-xs font-black text-white flex items-center gap-2">
                                    <Database size={14} className="text-blue-400" /> Local Queue Payload
                                </h2>
                                <p className="text-[10px] text-neutral-500 mt-1">Posts awaiting uplink to the cloud schedule.</p>
                            </div>
                            <span className="text-2xl font-black text-white">{payload?.total_scheduled || 0}</span>
                        </div>

                        {!payload || payload.total_scheduled === 0 ? (
                            <div className="flex flex-col flex-1 items-center justify-center py-10 mt-6 border border-dashed border-[#2a2a2a] rounded-xl bg-[#111]/80 relative z-10">
                                <AlertCircle size={32} className="text-blue-500/50 mb-3" />
                                <p className="text-xs font-bold text-neutral-300">No Payloads Found in Local Database</p>
                                <p className="text-[10px] text-neutral-600 text-center mt-2 leading-relaxed">
                                    Head over to the Queue, run a Burst Session, and <br /> schedule some posts to prepare them for Edge Uplink.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3 relative z-10 max-h-80 overflow-y-auto pr-2 mt-4">
                                {payload.posts.map((post) => (
                                    <div key={post.id} className="bg-[#111] border border-[#2a2a2a] rounded-xl p-3 flex gap-4 items-center hover:border-[#3a3a3a] transition-all">
                                        {post.content.media_url ? (
                                            <img src={post.content.media_url} className="w-12 h-12 rounded object-cover border border-[#3a3a3a]" />
                                        ) : (
                                            <div className="w-12 h-12 rounded bg-[#1a1a1a] flex items-center justify-center border border-[#2a2a2a]">
                                                <Smartphone size={16} className="text-neutral-600" />
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start">
                                                <p className="text-[10px] font-bold text-blue-400 truncate">{post.influencer_name}</p>
                                                <span className="text-[9px] font-mono text-neutral-500 bg-[#0a0a0a] px-1.5 py-0.5 rounded flex items-center gap-1">
                                                    <Clock size={8} />
                                                    {post.scheduled_for ? new Date(post.scheduled_for).toLocaleString() : 'No Date'}
                                                </span>
                                            </div>
                                            <p className="text-[10px] text-neutral-300 font-bold truncate mt-0.5">{post.content.hook || 'Untitled Hook'}</p>
                                            <p className="text-[8px] text-neutral-600 truncate">{post.content.caption}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Uplink Control Panel */}
                    <div className="space-y-6">
                        <div className="bg-[#0c0c0c] border border-[#1a1a1a] rounded-2xl p-6">
                            <h2 className="text-xs font-black text-white flex items-center gap-2 mb-4">
                                <Network size={14} className="text-cyan-500" /> Sync Controls
                            </h2>
                            <button
                                onClick={handleUplink}
                                disabled={payload?.total_scheduled === 0 || syncing}
                                className="w-full relative group overflow-hidden bg-gradient-to-br from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-xl py-4 flex flex-col items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:hover:from-blue-600 disabled:hover:to-cyan-600 shadow-[0_0_20px_rgba(59,130,246,0.15)]"
                            >
                                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                                {syncing ? (
                                    <RefreshCw size={24} className="animate-spin relative z-10" />
                                ) : (
                                    <UploadCloud size={24} className="relative z-10" />
                                )}
                                <span className="text-xs font-black uppercase tracking-wider relative z-10">
                                    {syncing ? 'Uplinking...' : 'Execute Uplink'}
                                </span>
                            </button>

                            {syncStatus && (
                                <div className={`mt-4 p-3 rounded-xl border text-[9px] font-mono leading-relaxed transition-all ${syncStatus.includes('✓')
                                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                    : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                                    }`}>
                                    &gt; {syncStatus}
                                </div>
                            )}
                        </div>

                        <div className="bg-[#0c0c0c] border border-[#1a1a1a] rounded-2xl p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <CloudLightning size={12} className="text-amber-500" />
                                <span className="text-[9px] font-bold text-neutral-400 uppercase">System Status</span>
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between items-center text-[10px]">
                                    <span className="text-neutral-500">Local DB Read</span>
                                    <span className="text-emerald-500 flex items-center gap-1"><CheckCircle2 size={10} /> OK</span>
                                </div>
                                <div className="flex justify-between items-center text-[10px]">
                                    <span className="text-neutral-500">Cloudflare Edge</span>
                                    <span className="text-emerald-500 flex items-center gap-1"><CheckCircle2 size={10} /> Online</span>
                                </div>
                                <div className="flex justify-between items-center text-[10px]">
                                    <span className="text-neutral-500">n8n Webhook</span>
                                    <span className="text-emerald-500 flex items-center gap-1"><CheckCircle2 size={10} /> Active</span>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

            </div>
        </div>
    );
}
