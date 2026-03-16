'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Camera, Check, Users2, ImagePlus, Loader2, Sparkles, RefreshCw, Brain, BarChart3, Fingerprint, AlertCircle, ExternalLink, Zap, ChevronDown, ChevronUp, Eye, Shield, Box, Activity, Cpu, Layers, Layout } from 'lucide-react';
import { CharacterDNA, deriveArchetype, filterContentTypesForBoundary, getContentBoundaryLabel, getContentBoundaryColor, type ContentLevel } from '@/lib/characterDNA';

// ── Types ─────────────────────────────────────────────────────────────────
interface Model {
    id: string;
    name: string;
    niche: string;
    lookbook_prompt: string | null;
    dna_json: string | null;
    avatar_image_path: string | null;
    generated_image_path: string | null;
    image_status: 'none' | 'rendering' | 'done' | 'error';
    created_at: string;
}

// ── Mini DNA Visual Summary ────────────────────────────────────────────────
function OceanBar({ label, val, color }: { label: string; val: number; color: string }) {
    return (
        <div className="flex items-center gap-1.5">
            <span className="text-[8px] font-mono text-neutral-600 w-2">{label}</span>
            <div className="flex-1 h-1 bg-[#1e1e1e] rounded-full overflow-hidden">
                <div className={`h-full ${color} transition-all`} style={{ width: `${val}%` }} />
            </div>
            <span className="text-[8px] font-mono text-neutral-700 w-5 text-right">{val}</span>
        </div>
    );
}

function FaceVisual({ dna }: { dna: CharacterDNA }) {
    const f = dna.face;
    const ratio = f.total_height / f.total_width;
    // Map ratio (1.1–1.7) to oval squish: border-radius varies
    const rx = Math.round(40 + (ratio - 1.1) * 10);
    const shapeColor = {
        oval: '#a855f7', round: '#ec4899', square: '#3b82f6',
        heart: '#ef4444', diamond: '#f59e0b', oblong: '#10b981', triangle: '#6366f1'
    }[f.shape] || '#a855f7';

    return (
        <div className="flex flex-col items-center gap-1">
            {/* Face outline */}
            <div className="relative w-14 h-[72px] flex items-center justify-center">
                <div style={{
                    width: '100%', height: '100%',
                    borderRadius: `${rx}% ${rx}% ${Math.round(rx * 0.8)}% ${Math.round(rx * 0.8)}%`,
                    background: `${shapeColor}12`,
                    border: `1.5px solid ${shapeColor}40`,
                    position: 'relative',
                    display: 'flex', flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: '8px 6px',
                }}>
                    {/* Eyes */}
                    <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '10px' }}>
                        <div style={{ width: f.eye_size * 1.5, height: f.eye_size * 0.7, borderRadius: '50%', background: f.eye_color.includes('brown') ? '#8B4513' : f.eye_color.includes('green') ? '#228B22' : f.eye_color.includes('blue') ? '#4169E1' : '#555' }} />
                        <div style={{ width: f.eye_size * 1.5, height: f.eye_size * 0.7, borderRadius: '50%', background: f.eye_color.includes('brown') ? '#8B4513' : f.eye_color.includes('green') ? '#228B22' : f.eye_color.includes('blue') ? '#4169E1' : '#555' }} />
                    </div>
                    {/* Nose dot */}
                    <div style={{ width: 3, height: 3, borderRadius: '50%', background: '#555', margin: '0 auto' }} />
                    {/* Lips */}
                    <div style={{
                        width: `${(f.lip_width / f.total_width) * 100}%`,
                        height: Math.max(3, f.lip_upper_thickness * 0.4 + f.lip_lower_thickness * 0.4),
                        background: '#c0667a',
                        borderRadius: '50%',
                        margin: '0 auto 4px',
                    }} />
                </div>
            </div>
            <span className="text-[9px] text-neutral-600 capitalize">{f.shape} · {f.symmetry_score}% sym</span>
        </div>
    );
}

function ColorPalette({ colors }: { colors: string[] }) {
    if (!colors?.length) return null;
    const CSS_COLORS: Record<string, string> = {
        'neon cyan': '#00f5ff', 'obsidian black': '#0d0d0d', 'electric violet': '#8b00ff',
        'void black': '#050505', 'blood crimson': '#8b0000', 'ash grey': '#9e9e9e',
        'bone white': '#f5f5dc', 'electric orange': '#ff6b00', 'steel grey': '#708090',
        'champagne gold': '#f7e7ce', 'ivory': '#fffff0', 'neon pink': '#ff44cc',
        'terminal green': '#00ff41', 'gunmetal': '#2a3439', 'electric blue': '#0047ab',
        'midnight blue': '#191970', 'chrome silver': '#c0c0c0', 'rose quartz': '#aa9ab8',
        'jet black': '#1a1a1a', 'deep brown': '#3b1a0b', 'warm ivory': '#fff8ee',
        'golden tan': '#c8964e', 'warm beige': '#d4b896', 'deep mahogany': '#4a1a0a',
        'rich ebony': '#1a0800', 'caramel': '#c68642', 'olive': '#808000',
        'porcelain': '#f5eee8', 'warm sand': '#deb887',
    };
    return (
        <div className="flex gap-1">
            {colors.slice(0, 4).map((c, i) => (
                <div key={i} title={c}
                    style={{ background: CSS_COLORS[c.toLowerCase()] || '#444' }}
                    className="w-4 h-4 rounded-full border border-black/30" />
            ))}
        </div>
    );
}

// ── Model Card ─────────────────────────────────────────────────────────────
function ModelCard({ model, onRefresh, onOpenModal }: { model: Model; onRefresh: () => void; onOpenModal: (m: Model) => void }) {
    const [generating, setGenerating] = useState(false);
    const [promptId, setPromptId] = useState<string | null>(null);
    const [status, setStatus] = useState(model.image_status);
    const [imagePath, setImagePath] = useState(model.generated_image_path);
    const [expanded, setExpanded] = useState(false);
    const [pollCount, setPollCount] = useState(0);
    const [contentType, setContentType] = useState<string>('auto');
    const [showPrompt, setShowPrompt] = useState(false);

    const dna: CharacterDNA | null = model.dna_json ? JSON.parse(model.dna_json) : null;
    const p = dna?.personality;
    const archetype = p ? deriveArchetype(p.ocean) : null;
    const contentLevel: ContentLevel = (dna?.content_boundary?.level || 2) as ContentLevel;
    const allowedTypes = filterContentTypesForBoundary(contentLevel);
    const boundaryLabel = getContentBoundaryLabel(contentLevel);
    const boundaryColor = getContentBoundaryColor(contentLevel);

    // Auto-poll when rendering
    useEffect(() => {
        if (status !== 'rendering') return;

        let active = true;
        const interval = setInterval(async () => {
            if (!active) return;
            setPollCount(c => c + 1);

            try {
                // Ping the unified background jobs API
                const res = await fetch(`/api/influencers/${model.id}/generate-image`);
                if (!res.ok) return;

                const data = await res.json();
                if (data.status && data.status !== 'rendering') {
                    // It finished syncing!
                    setStatus(data.status);
                    if (data.status === 'done' || data.status === 'none') {
                        setGenerating(false);
                        clearInterval(interval);
                        onRefresh(); // Refresh parent to pull newly saved image links natively
                    } else if (data.status === 'error') {
                        setGenerating(false);
                        clearInterval(interval);
                    }
                }
            } catch (e) {
                // ignore network issues during poll
            }
        }, 5000); // Check every 5s instead of 3s to save network traffic

        return () => {
            active = false;
            clearInterval(interval);
        };
    }, [status, model.id, onRefresh]);

    const handleGenerate = async () => {
        setGenerating(true);
        setStatus('rendering');
        setImagePath(null);
        try {
            const res = await fetch(`/api/influencers/${model.id}/generate-image`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content_type: contentType === 'auto' ? undefined : contentType,
                })
            });
            const data = await res.json();
            if (!res.ok) { alert('Error: ' + data.error); setStatus('error'); setGenerating(false); return; }
            setPromptId(data.prompt_id);
        } catch (e: any) {
            alert('Error: ' + e.message);
            setStatus('error');
            setGenerating(false);
        }
    };

    const statusColor = { none: 'text-neutral-600', rendering: 'text-amber-400', done: 'text-emerald-400', error: 'text-red-400' }[status];
    const statusLabel = {
        none: 'No image',
        rendering: `ComfyUI (${pollCount * 3}s)`,
        done: '⚡ ComfyUI image',
        error: 'Error'
    }[status];

    return (
        <div className="bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl overflow-hidden flex flex-col hover:border-[#2a2a2a] transition-colors group">
            {/* Image area */}
            <div className="relative aspect-[3/4] bg-[#0a0a0a] overflow-hidden">
                {(model.avatar_image_path || imagePath) ? (
                    <img src={model.avatar_image_path || imagePath!} alt={model.name} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                        {status === 'rendering' ? (
                            <>
                                <Loader2 className="text-amber-500 animate-spin" size={28} />
                                <p className="text-[10px] text-amber-400 font-mono">{statusLabel}</p>
                            </>
                        ) : dna ? (
                            <div className="px-6 w-full space-y-4">
                                <FaceVisual dna={dna} />
                                {/* Color palette */}
                                <div className="flex justify-center">
                                    <ColorPalette colors={dna.style?.color_palette || []} />
                                </div>
                                {/* Body type pill */}
                                <div className="text-center space-y-1">
                                    <div className="text-[9px] text-neutral-600 uppercase tracking-wider">{dna.body.height_cm}cm · {dna.body.weight_kg}kg</div>
                                    <div className="text-[9px] px-2 py-0.5 rounded-full bg-[#1e1e1e] text-neutral-500 inline-block capitalize">{dna.body.body_type}</div>
                                </div>
                                {/* Hair preview */}
                                <div className="text-center text-[9px] text-neutral-600">{dna.hair.color} {dna.hair.texture} {dna.hair.length}-length</div>
                            </div>
                        ) : (
                            <div className="text-neutral-700 flex flex-col items-center gap-2">
                                <ImagePlus size={24} />
                                <span className="text-[10px]">No preview</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Status badge */}
                <div className={`absolute top-2 right-2 text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-black/60 backdrop-blur-sm ${statusColor}`}>
                    {statusLabel}
                </div>

                {/* Overlay on hover */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-end p-2 gap-1.5 opacity-0 group-hover:opacity-100">
                    {status !== 'rendering' && (
                        <button onClick={() => onOpenModal(model)}
                            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-violet-600/90 hover:bg-violet-500 text-white text-[10px] font-bold backdrop-blur-sm transition-all">
                            <Zap size={10} />
                            {status === 'done' ? 'Regenerate' : 'Generate Image'}
                        </button>
                    )}
                </div>
            </div>

            {/* Card body */}
            <div className="p-3 flex flex-col gap-2 flex-1">
                <div>
                    <Link href={`/influencers/${model.id}`} className="font-bold text-neutral-100 text-sm truncate hover:text-violet-400 transition-colors block">{model.name}</Link>
                    <div className="text-[10px] text-neutral-500 truncate">{model.niche}</div>
                </div>

                {dna && (
                    <>
                        {/* Ethnicity + MBTI pills */}
                        <div className="flex flex-wrap gap-1">
                            {dna.identity.ethnicity && (
                                <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500">{dna.identity.ethnicity}</span>
                            )}
                            {p?.mbti.type && (
                                <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 font-mono">{p.mbti.type}</span>
                            )}
                            {p?.enneagram.type && (
                                <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 font-mono">{p.enneagram.type}w{p.enneagram.wing}</span>
                            )}
                        </div>

                        {/* OCEAN mini bars */}
                        <div className="space-y-0.5">
                            <OceanBar label="O" val={p?.ocean.openness ?? 0} color="bg-violet-500" />
                            <OceanBar label="C" val={p?.ocean.conscientiousness ?? 0} color="bg-blue-500" />
                            <OceanBar label="E" val={p?.ocean.extraversion ?? 0} color="bg-amber-500" />
                            <OceanBar label="A" val={p?.ocean.agreeableness ?? 0} color="bg-emerald-500" />
                            <OceanBar label="N" val={p?.ocean.neuroticism ?? 0} color="bg-rose-500" />
                        </div>

                        {/* Archetype */}
                        {archetype && (
                            <p className="text-[8px] text-neutral-600 leading-relaxed line-clamp-2">{archetype}</p>
                        )}

                        {/* Expandable details */}
                        <button onClick={() => setExpanded(!expanded)}
                            className="flex items-center gap-1 text-[9px] text-neutral-700 hover:text-neutral-500 transition-colors">
                            {expanded ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
                            {expanded ? 'Less' : 'More details'}
                        </button>

                        {expanded && (
                            <div className="border-t border-[#1a1a1a] pt-2 space-y-1.5 text-[9px] text-neutral-600">
                                <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                                    <span>Height</span><span className="text-neutral-400">{dna.body.height_cm} cm</span>
                                    <span>Weight</span><span className="text-neutral-400">{dna.body.weight_kg} kg</span>
                                    <span>Bust/W/H</span><span className="text-neutral-400">{dna.body.bust_cm}/{dna.body.waist_cm}/{dna.body.hips_cm}</span>
                                    <span>Skin</span><span className="text-neutral-400 truncate">{dna.face.skin_tone}</span>
                                    <span>Eyes</span><span className="text-neutral-400 truncate">{dna.face.eye_color} {dna.face.eye_shape}</span>
                                    <span>Hair</span><span className="text-neutral-400 truncate">{dna.hair.color} {dna.hair.texture}</span>
                                    <span>Makeup</span><span className="text-neutral-400">{dna.style.makeup_style}</span>
                                    <span>Posts/wk</span><span className="text-neutral-400">{p?.social_algorithm.posting_frequency_per_week}×</span>
                                </div>
                                <div className="text-[8px] text-neutral-700 leading-relaxed line-clamp-3 italic">{dna.identity.backstory}</div>
                            </div>
                        )}
                    </>
                )}

                {/* Bottom action area */}
                <div className="space-y-1.5 mt-auto pt-1">
                    {/* NSFW Boundary Level */}
                    <div className={`flex items-center gap-1 text-[8px] px-1.5 py-1 rounded border ${boundaryColor} font-bold`}>
                        <Shield size={8} />
                        {boundaryLabel}
                    </div>
                    {/* Content type selector — filtered by boundary */}
                    <select value={contentType} onChange={e => setContentType(e.target.value)}
                        disabled={generating || status === 'rendering'}
                        className="w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded px-1.5 py-1 text-[8px] text-neutral-500 outline-none cursor-pointer">
                        <option value="auto">🎲 Random ({allowedTypes.length} types)</option>
                        {allowedTypes.map(t => (
                            <option key={t} value={t}>{t}</option>
                        ))}
                    </select>
                    {/* Generate */}
                    <div className="flex gap-1.5">
                        <button onClick={() => onOpenModal(model)} disabled={generating || status === 'rendering'}
                            className="flex-1 flex items-center justify-center gap-1 text-[9px] py-1.5 rounded bg-violet-700 hover:bg-violet-600 text-white font-bold transition-colors disabled:opacity-40">
                            {generating ? <Loader2 size={8} className="animate-spin" /> : <Zap size={8} />}
                            {status === 'rendering' ? 'Generating...' : status === 'done' ? 'Regenerate' : 'Generate'}
                        </button>
                        <Link href={`/influencers/${model.id}`} className="flex items-center gap-1 text-[9px] px-1.5 py-1 rounded border border-[#2a2a2a] text-neutral-600 hover:text-neutral-400 transition-colors">
                            <Fingerprint size={8} />
                        </Link>
                        {imagePath && (
                            <a href={imagePath} target="_blank" rel="noopener noreferrer"
                                className="flex items-center text-[9px] px-1.5 py-1 rounded border border-[#2a2a2a] text-neutral-600 hover:text-neutral-400 transition-colors">
                                <ExternalLink size={8} />
                            </a>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// -- Page component
const COMFY_WORKFLOWS = [
    {
        id: 'flux-9b-txt2img',
        name: '⚡ Generate (Step 1)',
        desc: 'Flux 9B · txt2img + IPAdapter face lock. The base generation step.',
        badge: 'txt2img',
        color: 'border-violet-500/40 text-violet-400 bg-violet-500/5',
        requiresSource: false,
        supportsLora: true,
    },
    {
        id: 'flux-9b-i2i',
        name: '🔄 Refine (Step 2)',
        desc: 'Flux 9B · img2img + IPAdapter. Face-consistent edits on existing images.',
        badge: 'img2img',
        color: 'border-cyan-500/40 text-cyan-400 bg-cyan-500/5',
        requiresSource: true,
        supportsLora: true,
    },
    {
        id: 'flux-9b-detailer',
        name: '✨ Detail (Step 3)',
        desc: 'Z-Image detailer · ColorMatch + FastUnsharp. Makes skin/texture photorealistic.',
        badge: 'detailer',
        color: 'border-emerald-500/40 text-emerald-400 bg-emerald-500/5',
        requiresSource: true,
        supportsLora: false,
    },
    {
        id: 'seedvr2-upscaler',
        name: '🚀 Upscale (Step 4)',
        desc: 'SeedVR2 · Diffusion upscale to 2048px. Final export quality.',
        badge: 'upscale',
        color: 'border-amber-500/40 text-amber-400 bg-amber-500/5',
        requiresSource: true,
        supportsLora: false,
    },
];


export default function ModelsPage() {
    const [models, setModels] = useState<Model[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');


    const [customWorkflows, setCustomWorkflows] = useState<any[]>([]);
    const [activeGenModel, setActiveGenModel] = useState<Model | null>(null);
    const [genMode, setGenMode] = useState<'single' | 'library'>('single');
    const [libraryCategory, setLibraryCategory] = useState<string>('lookbook');
    const [selectedWorkflow, setSelectedWorkflow] = useState<string>('flux-9b-txt2img');
    const [sourceImagePath, setSourceImagePath] = useState('');
    const [selectedLora, setSelectedLora] = useState('');
    const [genSteps, setGenSteps] = useState(25);
    const [genCfg, setGenCfg] = useState(3.5);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [advancedConfig, setAdvancedConfig] = useState({ unet_name: '', clip_name: '', vae_name: '', sampler_name: 'euler' });
    const [advancedPresetName, setAdvancedPresetName] = useState('');
    const [modalGenerating, setModalGenerating] = useState(false);

    useEffect(() => {
        fetch('/api/custom-workflows').then(r => r.json()).then(data => {
            if (Array.isArray(data)) setCustomWorkflows(data);
        }).catch(() => { });
    }, []);


    const ALL_WORKFLOWS: any[] = [
        ...COMFY_WORKFLOWS,
        ...customWorkflows.map(cw => ({
            id: cw.id,
            name: `⚙️ ${cw.name}`,
            desc: cw.description || `Custom preset based on ${cw.base_template}`,
            badge: 'custom',
            color: 'border-blue-500/40 text-blue-400 bg-blue-500/5',
            requiresSource: COMFY_WORKFLOWS.find(w => w.id === cw.base_template)?.requiresSource || false,
            supportsLora: COMFY_WORKFLOWS.find(w => w.id === cw.base_template)?.supportsLora || false,
            isCustom: true,
            config: cw.config_json
        }))
    ];

    const handleSaveLoraToDNA = async () => {
        if (!selectedLora || !activeGenModel) return;
        const dna = activeGenModel.dna_json ? JSON.parse(activeGenModel.dna_json) : null;
        if (!dna) return;
        setModalGenerating(true);
        try {
            const rawTags = selectedLora.split(',').map(s => s.trim()).filter(Boolean);
            const loras = rawTags.map(t => { if (!t.startsWith('<lora:')) return `<lora:${t}:0.75>`; return t; });
            const newDna = { ...dna };
            newDna.render = newDna.render || {};
            newDna.render.lora_tags = Array.from(new Set([...(newDna.render.lora_tags || []), ...loras]));

            const res = await fetch(`/api/influencers/${activeGenModel.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dna_json: JSON.stringify(newDna) })
            });
            if (res.ok) {
                alert('LoRA saved to DNA for future generations!');
                fetchModels(); // Refresh Models
            } else {
                alert('Failed to save LoRA to DNA');
            }
        } catch (e) { console.error('Error saving LoRA:', e); }
        setModalGenerating(false);
    };

    const handleSaveCustomWorkflow = async () => {
        if (!advancedPresetName) return;
        try {
            const res = await fetch('/api/custom-workflows', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: advancedPresetName,
                    description: `Custom config overriding ${selectedWorkflow}`,
                    base_template: selectedWorkflow,
                    config_json: JSON.stringify(advancedConfig)
                })
            });
            if (res.ok) {
                alert('Custom advanced workflow saved globally!');
                const fresh = await fetch('/api/custom-workflows').then(r => r.json());
                setCustomWorkflows(Array.isArray(fresh) ? fresh : []);
                setAdvancedPresetName('');
                setShowAdvanced(false);
            }
            else alert('Failed to save config');
        } catch (e) { console.error(e); }
    };

    const handleGenerateInModal = async () => {
        if (!activeGenModel) return;
        setModalGenerating(true);
        try {
            const res = await fetch(`/api/influencers/${activeGenModel.id}/generate-image`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content_type: undefined,
                    mode: genMode,
                    workflowId: selectedWorkflow,
                    category: genMode === 'library' ? libraryCategory : undefined,
                    sourceImage: COMFY_WORKFLOWS.find(w => w.id === selectedWorkflow)?.requiresSource ? sourceImagePath : undefined,
                    loraName: selectedLora || undefined,
                    steps: genSteps,
                    cfg: genCfg,
                    workflow_config: advancedConfig
                })
            });
            const data = await res.json();
            if (!res.ok) { alert('Error: ' + data.error); }
            else {
                alert('Job started - it will render in the background');
                setActiveGenModel(null);
                fetchModels();
            }
        } catch (e: any) {
            alert('Error: ' + e.message);
        }
        setModalGenerating(false);
    };
    const fetchModels = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/influencers');
            if (!res.ok) { setModels([]); return; }
            const data = await res.json();
            setModels(Array.isArray(data) ? data : []);
        } catch {
            setModels([]);
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchModels(); }, [fetchModels]);

    const stats = {
        total: models.length,
        withImage: models.filter(m => m.image_status === 'done').length,
        rendering: models.filter(m => m.image_status === 'rendering').length,
        withDNA: models.filter(m => !!m.dna_json).length,
    };

    const filtered = filter === 'all' ? models
        : filter === 'with_image' ? models.filter(m => m.image_status === 'done')
            : filter === 'no_image' ? models.filter(m => m.image_status !== 'done')
                : models;

    return (
        <div className="h-full flex flex-col bg-[#080808] text-neutral-300 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e1e1e] bg-[#0a0a0a] shrink-0">
                <div className="flex items-center gap-3">
                    <Users2 size={16} className="text-violet-400" />
                    <span className="font-bold text-sm tracking-widest uppercase text-neutral-300">Models Roster</span>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 font-mono">{stats.total} total</span>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={fetchModels} disabled={loading} className="flex items-center gap-1.5 text-[10px] px-3 py-1.5 rounded border border-[#2a2a2a] hover:bg-[#1e1e1e] text-neutral-500 transition-colors">
                        <RefreshCw size={10} className={loading ? 'animate-spin' : ''} /> Refresh
                    </button>
                    <Link href="/character" className="flex items-center gap-1.5 text-[10px] px-3 py-1.5 rounded bg-violet-700 hover:bg-violet-600 text-white font-semibold transition-colors">
                        <Sparkles size={10} /> New Character
                    </Link>
                </div>
            </div>

            <div className="grid grid-cols-4 border-b border-[#1e1e1e] shrink-0">
                {[
                    { label: 'Total Models', value: stats.total, color: 'text-neutral-300' },
                    { label: 'With Full DNA', value: stats.withDNA, color: 'text-amber-400' },
                    { label: 'Images Done', value: stats.withImage, color: 'text-emerald-400' },
                    { label: 'Rendering', value: stats.rendering, color: 'text-amber-500' },
                ].map(s => (
                    <div key={s.label} className="px-6 py-3 border-r border-[#1e1e1e] last:border-r-0">
                        <div className={`text-xl font-black font-mono ${s.color}`}>{s.value}</div>
                        <div className="text-[9px] text-neutral-600 uppercase tracking-wider">{s.label}</div>
                    </div>
                ))}
            </div>

            <div className="flex gap-0 border-b border-[#1e1e1e] px-6 shrink-0">
                {[
                    { id: 'all', label: 'All Models' },
                    { id: 'with_image', label: 'Has Image' },
                    { id: 'no_image', label: 'Needs Image' },
                ].map(f => (
                    <button key={f.id} onClick={() => setFilter(f.id)}
                        className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-colors ${filter === f.id ? 'border-violet-500 text-violet-400' : 'border-transparent text-neutral-600 hover:text-neutral-400'}`}>
                        {f.label}
                    </button>
                ))}
            </div>

            <div className="flex-1 overflow-y-auto p-6">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <Loader2 className="text-violet-500 animate-spin" size={32} />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
                        <Users2 size={40} className="text-neutral-700" />
                        <div>
                            <p className="text-neutral-500 font-medium">No models yet</p>
                            <p className="text-[11px] text-neutral-700 mt-1">Generate characters in the DNA Editor and save them</p>
                        </div>
                        <Link href="/character" className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-700 hover:bg-violet-600 text-white text-sm font-semibold transition-colors">
                            <Sparkles size={14} /> Create First Model
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                        {filtered.map(model => (
                            <ModelCard key={model.id} model={model} onRefresh={fetchModels} onOpenModal={setActiveGenModel} />
                        ))}
                    </div>
                )}
            </div>
            {!!activeGenModel && (
                <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-2xl w-full max-w-lg overflow-hidden flex flex-col shadow-2xl">
                        <div className="p-5 border-b border-[#1e1e1e] flex justify-between items-center">
                            <div className="flex items-center gap-4">
                                <div>
                                    <h3 className="text-sm font-black text-neutral-100 uppercase tracking-tight">Image Generation</h3>
                                    <p className="text-[9px] text-neutral-600 mt-0.5">For {activeGenModel?.name} · Default from Integration Hub</p>
                                </div>
                                <div className="h-4 w-px bg-neutral-800 mx-2" />
                                <button onClick={() => setShowAdvanced(!showAdvanced)}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest transition-all ${
                                        showAdvanced ? 'bg-violet-500 text-white shadow-lg shadow-violet-500/20' : 'bg-[#1a1a1a] text-neutral-500 hover:bg-[#222]'
                                    }`}>
                                    <Brain size={10} className={showAdvanced ? 'animate-pulse' : ''} />
                                    {showAdvanced ? 'Advanced Active' : 'Enable Advanced'}
                                </button>
                            </div>
                            <button onClick={() => setActiveGenModel(null)} className="text-neutral-500 hover:text-white text-lg leading-none transition-colors">&times;</button>
                        </div>
                        <div className="p-5 space-y-5 overflow-y-auto max-h-[70vh]">
                            {/* Mode */}
                            <div className="space-y-2">
                                <label className="text-[9px] font-black uppercase tracking-widest text-neutral-600">Generation Mode</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button onClick={() => setGenMode('single')} className={`p-3 text-[10px] font-bold rounded-xl border text-left transition-all ${genMode === 'single' ? 'bg-violet-500/15 border-violet-500/40 text-violet-400' : 'bg-transparent border-[#2a2a2a] text-neutral-600 hover:text-neutral-400 hover:border-[#3a3a3a]'}`}>
                                        <div className="text-base mb-0.5">📸</div>
                                        <div>Single Portrait</div>
                                        <div className="text-[8px] font-normal text-neutral-600 mt-0.5">1 image · set as avatar</div>
                                    </button>
                                    <button onClick={() => setGenMode('library')} className={`p-3 text-[10px] font-bold rounded-xl border text-left transition-all ${genMode === 'library' ? 'bg-amber-500/15 border-amber-500/40 text-amber-400' : 'bg-transparent border-[#2a2a2a] text-neutral-600 hover:text-neutral-400 hover:border-[#3a3a3a]'}`}>
                                        <div className="text-base mb-0.5">🎭</div>
                                        <div>Character Library</div>
                                        <div className="text-[8px] font-normal text-neutral-600 mt-0.5">20 angles · LoRA dataset</div>
                                    </button>
                                </div>
                                {genMode === 'library' && (
                                    <div className="pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                        <label className="text-[8px] font-black uppercase tracking-widest text-neutral-600 mb-2 block">Generation Stage</label>
                                        <div className="flex flex-wrap gap-2">
                                            {['Face', 'Upper Body', 'Full Body', 'Expression', 'All'].map(cat => (
                                                <button key={cat} onClick={() => setLibraryCategory(cat)}
                                                    className={`px-3 py-1.5 text-[10px] font-bold rounded border transition-colors ${libraryCategory === cat ? 'bg-amber-500/20 border-amber-500/50 text-amber-300' : 'bg-transparent border-[#333] text-neutral-500 hover:text-neutral-300 hover:border-[#444]'}`}>
                                                    {cat === 'All' ? 'Queue All 20 Shots' : `${cat} Only (5)`}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Workflow */}
                            <div className="space-y-2">
                                <label className="text-[9px] font-black uppercase tracking-widest text-neutral-600">Pipeline Step <span className="font-normal normal-case tracking-normal text-neutral-700 ml-2">(Standard & Custom)</span></label>
                                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                                    {ALL_WORKFLOWS.map(w => (
                                        <button key={w.id} onClick={() => {
                                            setSelectedWorkflow(w.id);
                                            if (w.isCustom && typeof w.config === 'string') {
                                                try { setAdvancedConfig(JSON.parse(w.config)); } catch (e) { }
                                            }
                                        }}
                                            className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${selectedWorkflow === w.id
                                                ? `${w.color}`
                                                : 'bg-[#111] border-[#1e1e1e] hover:border-[#2a2a2a] text-neutral-400'
                                                }`}>
                                            <div className={`w-2 h-2 rounded-full shrink-0 ${selectedWorkflow === w.id ? 'bg-current' : 'bg-neutral-700'}`} />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold">{w.name}</span>
                                                    <span className="text-[7px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-neutral-500 font-mono">{w.badge}</span>
                                                    {w.supportsLora && <span className="text-[7px] px-1 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-500 font-bold">LoRA</span>}
                                                </div>
                                                <div className="text-[8px] text-neutral-600 mt-0.5">{w.desc}</div>
                                            </div>
                                            {selectedWorkflow === w.id && <Check size={10} className="shrink-0" />}
                                        </button>
                                    ))}
                                </div>
                                {COMFY_WORKFLOWS.find(w => w.id === selectedWorkflow)?.requiresSource && (
                                    <p className="text-[8px] text-amber-500/70">⚠ This step processes a source image from a previous step.</p>
                                )}
                            </div>

                            {/* Source Image Path */}
                            {COMFY_WORKFLOWS.find(w => w.id === selectedWorkflow)?.requiresSource && (
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-neutral-600">Source Image Path <span className="font-normal normal-case tracking-normal text-neutral-700">(optional)</span></label>
                                    <input type="text" value={sourceImagePath} onChange={e => setSourceImagePath(e.target.value)}
                                        placeholder="/outputs/images/opt_abc123_image.jpg"
                                        className="w-full bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-[10px] text-neutral-300 placeholder-neutral-700 focus:border-cyan-500/40 focus:outline-none font-mono" />
                                    <p className="text-[8px] text-neutral-700">Leave blank to use the influencer avatar as source.</p>
                                </div>
                            )}

                            {/* LoRA */}
                            {ALL_WORKFLOWS.find(w => w.id === selectedWorkflow)?.supportsLora && (
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-neutral-600">LoRA Model <span className="font-normal normal-case tracking-normal text-neutral-700">(optional)</span></label>
                                    <div className="flex gap-2">
                                        <input type="text" value={selectedLora} onChange={e => setSelectedLora(e.target.value)}
                                            placeholder="style_lora_v1.safetensors"
                                            className="flex-1 bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-[10px] text-neutral-300 placeholder-neutral-700 focus:border-amber-500/40 focus:outline-none font-mono" />
                                        <button onClick={handleSaveLoraToDNA} disabled={!selectedLora || modalGenerating}
                                            className="px-3 text-[9px] bg-amber-500/10 border border-amber-500/30 text-amber-500 rounded-lg hover:bg-amber-500/20 disabled:opacity-50 font-bold uppercase tracking-wider whitespace-nowrap">
                                            Save to DNA
                                        </button>
                                    </div>
                                    <p className="text-[8px] text-neutral-700">strength 0.75 · must be in ComfyUI/models/loras/</p>
                                </div>
                            )}

                            {/* Pro Advanced Control Panel - Architectural Alignment */}
                            {showAdvanced && (
                                <div className="space-y-6 pt-4 border-t border-violet-500/10 animate-in fade-in slide-in-from-top-4 duration-500">
                                    
                                    {/* Component Overrides - Matching Canvas Nodes */}
                                    <div className="space-y-4 p-5 rounded-2xl bg-black/40 border border-[#1e1e1e] relative overflow-hidden group">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="p-1.5 rounded-lg bg-violet-600/10 border border-violet-500/20">
                                                <Cpu size={12} className="text-violet-500" />
                                            </div>
                                            <div>
                                                <span className="text-[9px] font-black text-white uppercase tracking-widest italic block">Neural Console</span>
                                                <span className="text-[7px] text-neutral-600 uppercase font-mono tracking-tighter">Direct Node Override v4.0.1</span>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Box size={10} className="text-neutral-600" />
                                                    <label className="text-[8px] font-black text-neutral-600 uppercase tracking-widest">UNET Node</label>
                                                </div>
                                                <input type="text" value={advancedConfig.unet_name} onChange={e => setAdvancedConfig({ ...advancedConfig, unet_name: e.target.value })}
                                                    placeholder="flux1-dev-fp8" className="w-full bg-[#0a0a0a] border border-[#1e1e1e] rounded-lg px-3 py-2 text-[10px] text-neutral-400 font-mono focus:border-violet-500/40 outline-none" />
                                            </div>
                                            <div className="space-y-1.5">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Fingerprint size={10} className="text-neutral-600" />
                                                    <label className="text-[8px] font-black text-neutral-600 uppercase tracking-widest">CLIP V Node</label>
                                                </div>
                                                <input type="text" value={advancedConfig.clip_name} onChange={e => setAdvancedConfig({ ...advancedConfig, clip_name: e.target.value })}
                                                    placeholder="clip_l.safetensors" className="w-full bg-[#0a0a0a] border border-[#1e1e1e] rounded-lg px-3 py-2 text-[10px] text-neutral-400 font-mono focus:border-violet-500/40 outline-none" />
                                            </div>
                                            <div className="space-y-1.5">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Activity size={10} className="text-neutral-600" />
                                                    <label className="text-[8px] font-black text-neutral-600 uppercase tracking-widest">VAE Node</label>
                                                </div>
                                                <input type="text" value={advancedConfig.vae_name} onChange={e => setAdvancedConfig({ ...advancedConfig, vae_name: e.target.value })}
                                                    placeholder="vae-ft-mse" className="w-full bg-[#0a0a0a] border border-[#1e1e1e] rounded-lg px-3 py-2 text-[10px] text-neutral-400 font-mono focus:border-violet-500/40 outline-none" />
                                            </div>
                                            <div className="space-y-1.5">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Zap size={10} className="text-neutral-600" />
                                                    <label className="text-[8px] font-black text-neutral-600 uppercase tracking-widest">Sampler Node</label>
                                                </div>
                                                <input type="text" value={advancedConfig.sampler_name} onChange={e => setAdvancedConfig({ ...advancedConfig, sampler_name: e.target.value })}
                                                    placeholder="euler / dpmpp_2m" className="w-full bg-[#0a0a0a] border border-[#1e1e1e] rounded-lg px-3 py-2 text-[10px] text-neutral-400 font-mono focus:border-violet-500/40 outline-none" />
                                            </div>
                                        </div>

                                        <div className="flex gap-2 pt-4 border-t border-violet-500/5 mt-2">
                                            <input type="text" value={advancedPresetName} onChange={e => setAdvancedPresetName(e.target.value)}
                                                placeholder="Save this blueprint..." className="flex-1 bg-black/40 border border-[#222] rounded-lg px-3 py-2 text-[10px] font-mono text-neutral-700" />
                                            <button onClick={handleSaveCustomWorkflow} disabled={!advancedPresetName}
                                                className="px-4 py-2 bg-violet-600/10 hover:bg-violet-600 text-violet-500 hover:text-white border border-violet-500/20 rounded-lg text-[8px] font-black uppercase tracking-[0.2em] transition-all">
                                                Archive
                                            </button>
                                        </div>
                                    </div>

                                    {/* kSampler Optimization Slider Matrix */}
                                    <div className="grid grid-cols-2 gap-8 px-4 py-6 rounded-2xl bg-gradient-to-br from-[#0c0c0c] to-black border border-[#1e1e1e]">
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-widest text-neutral-600">
                                                <span className="flex items-center gap-1.5"><RefreshCw size={10} /> Inference Steps</span>
                                                <span className="text-violet-500 font-mono text-xs font-black">{genSteps}</span>
                                            </div>
                                            <div className="relative flex items-center h-1 bg-[#1a1a1a] rounded-full group">
                                                <input type="range" min="4" max="50" step="1" value={genSteps} onChange={e => setGenSteps(Number(e.target.value))}
                                                    className="w-full h-4 absolute opacity-0 cursor-pointer z-10" />
                                                <div className="h-full bg-gradient-to-r from-violet-600 to-fuchsia-500 rounded-full shadow-[0_0_8px_rgba(139,92,246,0.5)]" style={{ width: `${(genSteps - 4) / (50 - 4) * 100}%` }} />
                                            </div>
                                        </div>
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-widest text-neutral-600">
                                                <span className="flex items-center gap-1.5"><Sparkles size={10} /> Guidance (CFG)</span>
                                                <span className="text-violet-500 font-mono text-xs font-black">{genCfg}</span>
                                            </div>
                                            <div className="relative flex items-center h-1 bg-[#1a1a1a] rounded-full group">
                                                <input type="range" min="1.0" max="15.0" step="0.5" value={genCfg} onChange={e => setGenCfg(Number(e.target.value))}
                                                    className="w-full h-4 absolute opacity-0 cursor-pointer z-10" />
                                                <div className="h-full bg-gradient-to-r from-violet-600 to-fuchsia-500 rounded-full shadow-[0_0_8px_rgba(139,92,246,0.5)]" style={{ width: `${(genCfg - 1) / (15 - 1) * 100}%` }} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* LoRA / DNA Core Integration */}
                                    {ALL_WORKFLOWS.find(w => w.id === selectedWorkflow)?.supportsLora && (
                                        <div className="space-y-3 p-5 rounded-2xl bg-amber-500/5 border border-amber-500/10">
                                            <div className="flex items-center gap-2">
                                                <Layers size={12} className="text-amber-500" />
                                                <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest">DNA :: LoRA Node</span>
                                            </div>
                                            <div className="flex gap-2">
                                                <input type="text" value={selectedLora} onChange={e => setSelectedLora(e.target.value)}
                                                    placeholder="RealStyle_v2.safetensors"
                                                    className="flex-1 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-[10px] text-neutral-400 font-mono focus:border-amber-500/40 outline-none" />
                                                <button onClick={handleSaveLoraToDNA} disabled={!selectedLora || modalGenerating}
                                                    className="px-4 py-2 bg-amber-500/10 border border-amber-500/30 text-amber-500 rounded-lg hover:bg-amber-500/20 text-[8px] font-black uppercase tracking-widest transition-all">
                                                    Sync DNA
                                                </button>
                                            </div>
                                            <p className="text-[7px] text-neutral-700 font-mono uppercase tracking-tighter">Affects synaptic weights during inference pipeline</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t border-[#1e1e1e] flex gap-2">
                            <button onClick={() => setActiveGenModel(null)} className="px-4 py-2 text-xs text-neutral-500 hover:text-white transition-colors">Cancel</button>
                            <button onClick={handleGenerateInModal}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-black bg-violet-600 hover:bg-violet-500 text-white rounded-xl transition-colors">
                                <Camera size={11} /> Run: {ALL_WORKFLOWS.find(w => w.id === selectedWorkflow)?.name || 'ComfyUI'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
