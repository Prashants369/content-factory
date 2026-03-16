'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
    ReactFlow, 
    Controls, 
    Background, 
    applyNodeChanges, 
    applyEdgeChanges,
    Node,
    Edge,
    NodeChange,
    EdgeChange,
    Connection,
    addEdge,
    Panel
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { 
    Fingerprint, 
    Zap, 
    Brain, 
    Cpu, 
    Layers, 
    Maximize2, 
    Minimize2, 
    Settings,
    Layout,
    Box,
    Sparkles,
    Eye,
    ChevronLeft,
    ChevronRight,
    RefreshCw,
    Activity
} from 'lucide-react';
import Link from 'next/link';

// ── Types ─────────────────────────────────────────────────────────────────
interface Influencer {
    id: string;
    name: string;
    niche: string;
    avatar_image_path?: string;
    dna_json?: string;
}

// ── Initial State ────────────────────────────────────────────────────────
const initialNodes: Node[] = [
    { 
        id: 'dna', 
        type: 'input', 
        data: { label: 'Character DNA Core' }, 
        position: { x: 50, y: 150 },
        className: 'bg-violet-900/40 border-violet-500/50 text-violet-100 font-bold p-4 rounded-xl shadow-[0_0_20px_rgba(139,92,246,0.3)] border-2 w-[200px]'
    },
    { 
        id: 'prompt', 
        data: { label: 'Prompt Engine' }, 
        position: { x: 300, y: 150 },
        className: 'bg-cyan-900/40 border-cyan-500/50 text-cyan-100 font-bold p-4 rounded-xl border-2 w-[180px]'
    },
    { 
        id: 'comfy', 
        data: { label: 'ComfyUI (GPU Node)' }, 
        position: { x: 550, y: 150 },
        className: 'bg-emerald-900/40 border-emerald-500/50 text-emerald-100 font-bold p-4 rounded-xl border-2 w-[200px]'
    },
    { 
        id: 'render', 
        type: 'output', 
        data: { label: 'Final AI Image' }, 
        position: { x: 800, y: 150 },
        className: 'bg-amber-900/40 border-amber-500/50 text-amber-100 font-bold p-4 rounded-xl border-2 w-[180px]'
    }
];

const initialEdges: Edge[] = [
    { id: 'e1-2', source: 'dna', target: 'prompt', animated: true, style: { stroke: '#8b5cf6', strokeWidth: 2 } },
    { id: 'e2-3', source: 'prompt', target: 'comfy', animated: true, style: { stroke: '#06b6d4', strokeWidth: 2 } },
    { id: 'e3-4', source: 'comfy', target: 'render', animated: true, style: { stroke: '#10b981', strokeWidth: 2 } }
];

export default function CanvasPage() {
    const [influencers, setInfluencers] = useState<Influencer[]>([]);
    const [activeInf, setActiveInf] = useState<Influencer | null>(null);
    const [nodes, setNodes] = useState<Node[]>(initialNodes);
    const [edges, setEdges] = useState<Edge[]>(initialEdges);
    const [loading, setLoading] = useState(true);

    const onNodesChange = useCallback(
        (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
        []
    );
    const onEdgesChange = useCallback(
        (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
        []
    );
    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge(params, eds)),
        []
    );

    useEffect(() => {
        const fetchInfs = async () => {
            try {
                const res = await fetch('/api/influencers');
                if (!res.ok) { setInfluencers([]); return; }
                const data = await res.json();
                const infs = Array.isArray(data) ? data : [];
                setInfluencers(infs);
                if (infs.length > 0) setActiveInf(infs[0]);
            } catch {
                setInfluencers([]);
            } finally {
                setLoading(false);
            }
        };
        fetchInfs();
    }, []);

    const updateCanvasForInfluencer = useCallback((inf: Influencer) => {
        if (!inf) return;
        const dna = inf.dna_json ? JSON.parse(inf.dna_json) : null;
        
        const newNodes: Node[] = [
            { 
                id: 'dna', 
                type: 'input', 
                data: { 
                    label: (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2"><Fingerprint size={14} /> DNA CORE</div>
                            <div className="text-[10px] font-mono opacity-70">ID: {inf.id.slice(0,8)}</div>
                            <div className="text-[9px] bg-white/10 p-1.5 rounded border border-white/5 font-normal">
                                {dna?.personality?.mbti?.type || 'ENTJ'} · {inf.niche}
                            </div>
                        </div>
                    ) 
                }, 
                position: { x: 50, y: 100 },
                className: 'bg-violet-900/50 border-violet-500/50 text-white p-4 rounded-xl border-2 w-[220px]'
            },
            {
                id: 'unet',
                data: { label: 'UNET (flux1-dev-fp8)' },
                position: { x: 320, y: 20 },
                className: 'bg-[#111] border-[#222] text-[#666] p-2 rounded-lg border w-[160px] text-[10px]'
            },
            {
                id: 'vae',
                data: { label: 'VAE (vae-ft-mse)' },
                position: { x: 320, y: 100 },
                className: 'bg-[#111] border-[#222] text-[#666] p-2 rounded-lg border w-[160px] text-[10px]'
            },
            {
                id: 'lora',
                data: { 
                    label: (
                        <div className="flex items-center gap-2 italic">
                            <Layers size={10} className="text-amber-400" />
                            {dna?.render?.lora_tags?.[0]?.split(':')[1] || 'RealStyle_v2'}
                        </div>
                    )
                },
                position: { x: 320, y: 180 },
                className: 'bg-amber-900/30 border-amber-500/40 text-amber-200 p-2 rounded-lg border w-[160px] text-[10px]'
            },
            { 
                id: 'sampler', 
                data: { 
                    label: (
                        <div className="space-y-1">
                            <div className="flex items-center gap-2 font-bold mb-1"><Cpu size={12} /> kSampler</div>
                            <div className="text-[8px] flex justify-between"><span>Steps</span> <span className="text-emerald-400">25</span></div>
                            <div className="text-[8px] flex justify-between"><span>CFG</span> <span className="text-emerald-400">3.5</span></div>
                            <div className="text-[8px] flex justify-between"><span>Sampler</span> <span className="text-emerald-400">euler</span></div>
                        </div>
                    ) 
                }, 
                position: { x: 550, y: 100 },
                className: 'bg-emerald-900/40 border-emerald-500/50 text-white p-4 rounded-xl border-2 w-[180px]'
            },
            { 
                id: 'render', 
                type: 'output', 
                data: { 
                    label: (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-[10px] font-bold text-amber-400 uppercase tracking-widest"><Eye size={12} /> Decoded Output</div>
                            <div className="aspect-[3/4] rounded-lg overflow-hidden bg-black/40 border border-white/5 group relative">
                                {inf.avatar_image_path ? (
                                    <img src={inf.avatar_image_path} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-neutral-800"><Brain size={32} /></div>
                                )}
                                <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <RefreshCw className="text-white animate-spin-slow" size={24} />
                                </div>
                            </div>
                            <div className="text-[8px] font-mono text-neutral-500 text-center uppercase">1024x1024 · JPG</div>
                        </div>
                    ) 
                }, 
                position: { x: 800, y: 50 },
                className: 'bg-[#111] border-[#2a2a2a] text-white p-3 rounded-2xl border-2 w-[200px] shadow-2xl shadow-amber-500/5'
            }
        ];

        const newEdges: Edge[] = [
            { id: 'e-dna-unet', source: 'dna', target: 'unet', animated: true, style: { stroke: '#8b5cf6' } },
            { id: 'e-dna-vae', source: 'dna', target: 'vae', animated: true, style: { stroke: '#8b5cf6' } },
            { id: 'e-dna-lora', source: 'dna', target: 'lora', animated: true, style: { stroke: '#8b5cf6' } },
            { id: 'e-unet-sampler', source: 'unet', target: 'sampler', style: { stroke: '#444' } },
            { id: 'e-vae-sampler', source: 'vae', target: 'sampler', style: { stroke: '#444' } },
            { id: 'e-lora-sampler', source: 'lora', target: 'sampler', style: { stroke: '#f59e0b', strokeDasharray: '5,5' } },
            { id: 'e-sampler-render', source: 'sampler', target: 'render', animated: true, style: { stroke: '#10b981', strokeWidth: 3 } }
        ];

        setNodes(newNodes);
        setEdges(newEdges);
    }, []);

    useEffect(() => {
        if (activeInf) updateCanvasForInfluencer(activeInf);
    }, [activeInf, updateCanvasForInfluencer]);

    const handleRandomizeLayout = () => {
        setNodes(nds => nds.map(n => ({
            ...n,
            position: { x: n.position.x + (Math.random() - 0.5) * 50, y: n.position.y + (Math.random() - 0.5) * 50 }
        })));
    };

    return (
        <div className="h-full flex flex-col bg-[#080808] text-neutral-300">
            {/* Header */}
            <header className="px-6 py-4 border-b border-[#1a1a1a] flex items-center justify-between bg-[#0a0a0a]">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 rounded-2xl bg-violet-600/10 border border-violet-500/20">
                        <Layout className="w-5 h-5 text-violet-400" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-white tracking-tight uppercase italic underline decoration-violet-600 underline-offset-4 decoration-2">AI Character Canvas</h1>
                        <p className="text-[9px] text-neutral-600 font-mono tracking-widest uppercase mt-0.5">Live Generation Architecture · v{process.env.NEXT_PUBLIC_APP_VERSION || '2.0.4'}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex -space-x-2 mr-4">
                        {influencers.slice(0, 5).map(inf => (
                            <button key={inf.id} onClick={() => setActiveInf(inf)}
                                className={`w-8 h-8 rounded-full border-2 transition-all ${activeInf?.id === inf.id ? 'border-violet-500 scale-110 z-10' : 'border-[#1a1a1a] hover:z-10 hover:scale-105'}`}>
                                <img src={inf.avatar_image_path || '/placeholder.png'} className="w-full h-full rounded-full object-cover" />
                            </button>
                        ))}
                        {influencers.length > 5 && (
                            <div className="w-8 h-8 rounded-full bg-[#111] border-2 border-[#1a1a1a] flex items-center justify-center text-[8px] font-bold text-neutral-600">
                                +{influencers.length - 5}
                            </div>
                        )}
                    </div>
                    <button onClick={handleRandomizeLayout} className="p-2 rounded-xl border border-[#222] bg-[#0c0c0c] text-neutral-600 hover:text-white transition-all">
                        <RefreshCw size={14} />
                    </button>
                    <Link href="/character" className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-700 hover:bg-violet-600 text-white text-[10px] font-black tracking-widest uppercase shadow-lg shadow-violet-500/10 transition-all">
                        <Sparkles size={14} /> New DNA
                    </Link>
                </div>
            </header>

            {/* Main Area */}
            <div className="flex-1 relative overflow-hidden flex">
                
                {/* Side Inspector */}
                <aside className="w-[280px] border-r border-[#1a1a1a] bg-[#090909] flex flex-col shrink-0">
                    <div className="p-5 space-y-6">
                        <div className="space-y-2">
                        <label className="text-[8px] font-black uppercase tracking-[0.2em] text-violet-500">Active Model</label>
                            <h2 className="text-lg font-black text-white">{activeInf?.name || 'Awaiting Selection'}</h2>
                            <p className="text-[10px] text-neutral-500 italic leading-relaxed">{activeInf?.niche || 'Digital Architect'}</p>
                        </div>

                        <div className="p-4 rounded-2xl bg-gradient-to-br from-[#111] to-[#0a0a0a] border border-[#1e1e1e] space-y-3">
                            <div className="flex items-center justify-between text-[9px] font-bold text-neutral-400">
                                <span className="flex items-center gap-1.5"><Brain size={11} className="text-violet-500" /> Synaptic Load</span>
                                <span className="text-emerald-400">Normal</span>
                            </div>
                            <div className="h-1 bg-black rounded-full overflow-hidden">
                                <div className="h-full bg-violet-500 w-[62%]" />
                            </div>
                            <div className="grid grid-cols-2 gap-2 mt-2">
                                <div className="bg-black/40 p-2 rounded-lg border border-white/5">
                                    <div className="text-[7px] text-neutral-600 uppercase">Latency</div>
                                    <div className="text-[10px] font-mono font-black text-white">4.2s</div>
                                </div>
                                <div className="bg-black/40 p-2 rounded-lg border border-white/5">
                                    <div className="text-[7px] text-neutral-600 uppercase">Precision</div>
                                    <div className="text-[10px] font-mono font-black text-white">FP16</div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4 pt-4 border-t border-[#1a1a1a]">
                            <h3 className="text-[8px] font-black uppercase tracking-[0.2em] text-neutral-600 flex items-center justify-between">
                                Pipeline Metrics
                                <Activity size={10} className="text-neutral-700" />
                            </h3>
                            <div className="space-y-2">
                                {[
                                    { label: 'Prompt Weighting', val: 0.85, color: '#8b5cf6' },
                                    { label: 'LoRA Influence', val: 0.62, color: '#f59e0b' },
                                    { label: 'Model Compliance', val: 0.94, color: '#10b981' },
                                    { label: 'Content Boundary', val: 0.45, color: '#ef4444' }
                                ].map(stat => (
                                    <div key={stat.label} className="space-y-1">
                                        <div className="flex justify-between text-[7px] font-black uppercase text-neutral-700">
                                            <span>{stat.label}</span>
                                            <span>{Math.round(stat.val * 100)}%</span>
                                        </div>
                                        <div className="h-0.5 bg-black rounded-full overflow-hidden">
                                            <div className="h-full transition-all duration-1000" style={{ width: `${stat.val * 100}%`, backgroundColor: stat.color }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="mt-auto p-5 border-t border-[#1a1a1a] bg-[#0a0a0a]/50 backdrop-blur-sm">
                        <button className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-[#2a2a2a] text-neutral-500 text-[10px] font-bold hover:bg-[#1a1a1a] transition-all">
                            <Settings size={14} /> Node Settings
                        </button>
                    </div>
                </aside>

                {/* React Flow Canvas */}
                <div className="flex-1 bg-dot-pattern">
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        fitView
                        className="bg-[#080808]"
                        colorMode="dark"
                    >
                        <Background color="#1a1a1a" gap={20} size={1} />
                        <Controls className="bg-[#111] border-[#2a2a2a] fill-white" />
                        <Panel position="top-right" className="bg-[#0c0c0c]/80 backdrop-blur-md p-2 rounded-xl border border-[#1a1a1a] flex gap-2">
                            <button className="p-2 rounded-lg bg-[#141414] text-neutral-600 hover:text-white transition-all"><Box size={14} /></button>
                            <button className="p-2 rounded-lg bg-[#141414] text-neutral-600 hover:text-white transition-all"><Cpu size={14} /></button>
                            <div className="w-[1px] h-6 bg-[#222] self-center" />
                            <div className="flex items-center gap-2 px-3 text-[10px] font-black tracking-widest text-[#444] uppercase bg-black/40 rounded-lg">
                                <Activity size={12} className="text-emerald-500" /> Live Canvas
                            </div>
                        </Panel>
                    </ReactFlow>
                </div>
            </div>

            <style jsx global>{`
                .bg-dot-pattern {
                    background-image: radial-gradient(#1e1e1e 1px, transparent 1px);
                    background-size: 20px 20px;
                }
                .animate-spin-slow {
                    animation: spin 8s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
