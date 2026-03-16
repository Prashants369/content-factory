'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
    ArrowLeft, Sparkles, Camera, ImagePlus, Loader2, Star,
    Fingerprint, BarChart3, Send, Clock, Zap, Eye, Mail,
    Calendar, User, Brain, Palette, ChevronRight, Check,
    RefreshCw, Shield, Maximize, Music, Layers, ZoomIn, ZoomOut, X, Download, AlertCircle,
    Smartphone, ExternalLink, Lock
} from 'lucide-react';
import { CharacterDNA, deriveArchetype, getContentBoundaryLabel, getContentBoundaryColor, type ContentLevel } from '@/lib/characterDNA';

// ── OCEAN Bar ─────────────────────────────────────────────────────────
function OceanBar({ label, full, val, color }: { label: string; full: string; val: number; color: string }) {
    return (
        <div className="space-y-1">
            <div className="flex justify-between items-center">
                <span className="text-[10px] text-neutral-400">{full}</span>
                <span className="text-[10px] font-mono text-neutral-500">{val}%</span>
            </div>
            <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${val}%` }} />
            </div>
        </div>
    );
}

// ── Stat Card ─────────────────────────────────────────────────────────
function StatCard({ label, value, color, icon: Icon }: any) {
    return (
        <div className="bg-[#0f0f0f] border border-[#1e1e1e] rounded-lg p-4 flex flex-col items-center gap-1">
            <Icon size={14} className={color} />
            <span className={`text-2xl font-black font-mono ${color}`}>{value}</span>
            <span className="text-[9px] text-neutral-600 uppercase tracking-wider">{label}</span>
        </div>
    );
}

export default function InfluencerProfilePage() {
    const params = useParams();
    const id = params.id as string;

    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'bio' | 'dna' | 'gallery' | 'content' | 'social'>('bio');
    const [generating, setGenerating] = useState(false);
    const [showGenModal, setShowGenModal] = useState(false);
    const [genMode, setGenMode] = useState<'single' | 'library'>('single');
    const [libraryCategory, setLibraryCategory] = useState('All');
    const [selectedWorkflow, setSelectedWorkflow] = useState('flux-9b-txt2img');
    const [triggeringN8n, setTriggeringN8n] = useState(false);
    const [n8nStatus, setN8nStatus] = useState('');

    // Social linking state
    const [platformAccounts, setPlatformAccounts] = useState<any[]>([]);
    const [showSocialModal, setShowSocialModal] = useState(false);
    const [linkToken, setLinkToken] = useState('');
    const [linkBusinessId, setLinkBusinessId] = useState('');
    const [linkPageId, setLinkPageId] = useState('');
    const [linking, setLinking] = useState(false);

    // Lightbox state
    const [lightbox, setLightbox] = useState<{ src: string; imageId?: string; label?: string; isContent?: boolean } | null>(null);
    const [lightboxZoom, setLightboxZoom] = useState(1);

    // Load default workflow from Integration Hub settings
    useEffect(() => {
        try {
            const saved = localStorage.getItem('factory_settings');
            if (saved) {
                const s = JSON.parse(saved);
                if (s.defaultWorkflow) setSelectedWorkflow(s.defaultWorkflow);
            }
        } catch { }
    }, []);

    const handleTriggerN8n = async () => {
        setTriggeringN8n(true);
        setN8nStatus('Triggering n8n...');
        try {
            const res = await fetch(`/api/influencers/${id}/n8n/trigger`, { method: 'POST' });
            const json = await res.json();
            setN8nStatus(res.ok ? '✓ n8n triggered! Ideas will appear in the pipeline.' : '✗ ' + (json.error || 'Failed'));
            if (res.ok) setTimeout(() => fetchProfile(true), 15000);
        } catch (e: any) {
            setN8nStatus('✗ Connection failed: ' + e.message);
        } finally {
            setTriggeringN8n(false);
            setTimeout(() => setN8nStatus(''), 6000);
        }
    };

    const [evolvingDNA, setEvolvingDNA] = useState(false);
    const [selectedLora, setSelectedLora] = useState('');
    const [sourceImagePath, setSourceImagePath] = useState('');
    const [genSteps, setGenSteps] = useState(8);
    const [genCfg, setGenCfg] = useState(1.0);

    // Advanced Mode
    const [customWorkflows, setCustomWorkflows] = useState<any[]>([]);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [advancedConfig, setAdvancedConfig] = useState({ unet_name: '', clip_name: '', vae_name: '', sampler_name: '' });
    const [advancedPresetName, setAdvancedPresetName] = useState('');

    const fetchCustomWorkflows = useCallback(async () => {
        try {
            const res = await fetch('/api/custom-workflows');
            const data = await res.json();
            if (Array.isArray(data)) setCustomWorkflows(data);
        } catch(e) {}
    }, []);

    useEffect(() => { fetchCustomWorkflows(); }, [fetchCustomWorkflows]);

    useEffect(() => {
        if (showGenModal && data?.dna_json) {
            try {
                const parsed = JSON.parse(data.dna_json);
                if (parsed?.render?.lora_tags?.length) {
                    setSelectedLora(parsed.render.lora_tags[0]);
                }
            } catch(e) {}
        }
    }, [showGenModal, data?.dna_json]);

    const fetchPlatformAccounts = useCallback(async () => {
        try {
            const res = await fetch(`/api/platform-accounts?influencer_id=${id}`);
            const json = await res.json();
            setPlatformAccounts(json);
        } catch (e) { }
    }, [id]);

    const fetchProfile = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await fetch(`/api/influencers/${id}`);
            if (!res.ok) { setData(null); return; }
            const json = await res.json();
            setData(json);
        } catch {
            setData(null);
        } finally { if (!silent) setLoading(false); }
    }, [id]);

    useEffect(() => {
        if (activeTab === 'social') fetchPlatformAccounts();
    }, [activeTab, fetchPlatformAccounts]);

    useEffect(() => { fetchProfile(); }, [fetchProfile]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightbox(null); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (data?.image_status === 'rendering') {
            interval = setInterval(async () => {
                await fetch(`/api/influencers/${id}/generate-image`);
                await fetchProfile(true);
            }, 8000);
        }
        return () => clearInterval(interval);
    }, [data?.image_status, fetchProfile, id]);

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center bg-[#080808]">
                <Loader2 className="text-violet-500 animate-spin" size={32} />
            </div>
        );
    }

    if (!data || data.error) {
        return (
            <div className="h-full flex flex-col items-center justify-center bg-[#080808] gap-4">
                <User size={48} className="text-neutral-700" />
                <p className="text-neutral-500">Influencer not found</p>
                <Link href="/influencers" className="text-violet-400 text-sm hover:underline">← Back to roster</Link>
            </div>
        );
    }

    const dna: CharacterDNA | null = data.dna_json ? JSON.parse(data.dna_json) : null;
    const p = dna?.personality;
    const archetype = p ? deriveArchetype(p.ocean) : null;
    const avatar = data.avatar_image_path || data.generated_image_path;
    const images = data.images || [];
    const stats = data.postStats || {};
    const posts = data.recentPosts || [];
    const contentLevel: ContentLevel = (dna?.content_boundary?.level || 2) as ContentLevel;
    const boundaryLabel = getContentBoundaryLabel(contentLevel);
    const boundaryColor = getContentBoundaryColor(contentLevel);

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
        if (!selectedLora || !dna) return;
        setGenerating(true);
        try {
            const newDna = structuredClone(dna);
            if (!newDna.render) newDna.render = {} as any;
            if (!newDna.render.lora_tags) newDna.render.lora_tags = [];
            newDna.render.lora_tags = [selectedLora, ...newDna.render.lora_tags.filter((t: string) => t !== selectedLora)];
            
            await fetch(`/api/influencers/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dna_json: JSON.stringify(newDna) })
            });
            await fetchProfile(true);
        } finally {
            setGenerating(false);
        }
    };

    const handleSaveCustomWorkflow = async () => {
        if (!advancedPresetName) return alert('Name required');
        try {
            const newId = 'custom_' + Date.now();
            await fetch('/api/custom-workflows', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: newId,
                    name: advancedPresetName,
                    description: `Custom UNET/CLIP overrides for ${selectedWorkflow}`,
                    base_template: ALL_WORKFLOWS.find(w => w.id === selectedWorkflow)?.isCustom 
                        ? (customWorkflows.find(c => c.id === selectedWorkflow)?.base_template || 'flux-9b-txt2img') 
                        : selectedWorkflow,
                    config_json: advancedConfig
                })
            });
            await fetchCustomWorkflows();
            setSelectedWorkflow(newId);
            setAdvancedPresetName('');
        } catch(e: any) { alert(e.message); }
    };

    const handleGenerate = async () => {
        setShowGenModal(false);
        setGenerating(true);
        try {
            await fetch(`/api/influencers/${id}/generate-image`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content_type: genMode === 'library' ? 'character library turnaround sheet, multiple angles, front side back profile' : 'editorial portrait',
                    set_as_avatar: genMode === 'single',
                    workflow: selectedWorkflow,
                    library_category: genMode === 'library' ? libraryCategory : undefined,
                    base_image: data.avatar_image_path || data.base_image_path || undefined,
                    source_image: sourceImagePath || undefined,
                    lora: selectedLora || undefined,
                    steps: genSteps,
                    cfg: genCfg,
                    workflow_config: showAdvanced ? advancedConfig : undefined,
                })
            });
            setTimeout(() => fetchProfile(true), 3000);
        } finally {
            setTimeout(() => setGenerating(false), 3000);
        }
    };

    const handleRefreshGallery = async () => {
        setGenerating(true);
        try {
            // First ping the generator API so it downloads any finished ComfyUI jobs
            await fetch(`/api/influencers/${id}/generate-image`);
            // Then refresh the UI data
            await fetchProfile(true);
        } finally {
            setGenerating(false);
        }
    };

    const setAsAvatar = async (imagePath: string) => {
        await fetch(`/api/influencers/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ avatar_image_path: imagePath })
        });
        fetchProfile();
    };

    const triggerUpscale = async (imageId: string, imagePath: string) => {
        setGenerating(true);
        try {
            await fetch(`/api/influencers/${id}/upscale`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image_id: imageId, image_path: imagePath })
            });
            // Re-fetch after 2 seconds so the gallery can show 'Rendering' overlay if we implement it, 
            // or just refresh to get updated queue status.
            setTimeout(() => fetchProfile(true), 2000);
        } finally {
            setTimeout(() => setGenerating(false), 2000);
        }
    };

    const handleLinkSocial = async () => {
        setLinking(true);
        try {
            const res = await fetch('/api/platform-accounts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    influencer_id: id,
                    platform: 'instagram',
                    access_token: linkToken,
                    ig_business_account_id: linkBusinessId,
                    fb_page_id: linkPageId,
                    account_name: `${data.name} (Instagram)`
                })
            });
            if (res.ok) {
                setShowSocialModal(false);
                setLinkToken('');
                setLinkBusinessId('');
                setLinkPageId('');
                fetchPlatformAccounts();
            }
        } finally {
            setLinking(false);
        }
    };

    const handleEvolveDNA = async () => {
        setEvolvingDNA(true);
        setN8nStatus('Analyzing IG & Mutating DNA...');
        try {
            const res = await fetch(`/api/influencers/${id}/evolve`, { method: 'POST' });
            const json = await res.json();
            if (res.ok) {
                setN8nStatus('✓ DNA Evolved Based on Analytics!');
                fetchProfile(true);
            } else {
                setN8nStatus('✗ Evolution failed: ' + (json.error || 'Check data'));
            }
        } catch (e: any) {
            setN8nStatus('✗ Connection failed: ' + e.message);
        } finally {
            setEvolvingDNA(false);
            setTimeout(() => setN8nStatus(''), 8000);
        }
    };


    const openLightbox = (src: string, imageId?: string, label?: string, isContent = false) => {
        setLightbox({ src, imageId, label, isContent });
        setLightboxZoom(1);
    };

    return (
        <div className="h-full flex flex-col bg-[#080808] text-neutral-300 overflow-hidden">

            {/* ════ LIGHTBOX MODAL ════ */}
            {lightbox && (
                <div
                    className="fixed inset-0 z-[9000] bg-black/95 backdrop-blur-sm flex flex-col"
                    onClick={() => setLightbox(null)}
                >
                    {/* ════ PREREQUISITE WARNING PANEL ════ */}
                    <div className="px-4 py-3 bg-amber-500/5 border-b border-amber-500/10 flex flex-wrap gap-x-8 gap-y-2 items-center">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.3)]" />
                            <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest">DNA Evolution:</span>
                            <span className="text-[9px] text-neutral-600">Requires Gemini API (Vault)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.3)]" />
                            <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest">Portrait Gen:</span>
                            <span className="text-[9px] text-neutral-600">Requires ComfyUI (Local)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]" />
                            <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest">n8n Pipeline:</span>
                            <span className="text-[9px] text-neutral-600">Requires n8n Desktop/Local</span>
                        </div>
                        <div className="ml-auto text-[9px] text-amber-500/70 font-mono flex items-center gap-1.5">
                            <AlertCircle size={9} /> One or more services may be offline. Check console if actions hang.
                        </div>
                    </div>

                    {/* Top bar */}
                    <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 shrink-0" onClick={e => e.stopPropagation()}>
                        <span className="text-xs text-neutral-400 font-mono">{lightbox.label || 'Image Preview'}</span>
                        <div className="flex items-center gap-2">
                            {/* Zoom controls */}
                            <button onClick={() => setLightboxZoom(z => Math.max(0.3, z - 0.25))}
                                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-colors" title="Zoom Out">
                                <ZoomOut size={14} />
                            </button>
                            <span className="text-[10px] font-mono text-neutral-500 w-10 text-center">{Math.round(lightboxZoom * 100)}%</span>
                            <button onClick={() => setLightboxZoom(z => Math.min(4, z + 0.25))}
                                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-colors" title="Zoom In">
                                <ZoomIn size={14} />
                            </button>
                            <button onClick={() => setLightboxZoom(1)}
                                className="px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[9px] text-neutral-500 hover:text-white transition-colors">
                                Reset
                            </button>
                            <div className="w-px h-4 bg-white/10 mx-1" />
                            {/* Download */}
                            <a href={lightbox.src} download target="_blank" rel="noreferrer"
                                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-colors" title="Download Original">
                                <Download size={14} />
                            </a>
                            {/* Set as Avatar */}
                            <button onClick={() => { setAsAvatar(lightbox.src); setLightbox(null); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600/40 border border-amber-500/30 text-amber-400 text-[10px] font-bold transition-colors">
                                <Star size={11} /> Set Avatar
                            </button>
                            {/* Upscale */}
                            {lightbox.imageId && !lightbox.src.includes('upscaled') && (
                                <button onClick={() => { triggerUpscale(lightbox.imageId!, lightbox.src); setLightbox(null); }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600/20 hover:bg-violet-600/40 border border-violet-500/30 text-violet-400 text-[10px] font-bold transition-colors">
                                    <Maximize size={11} /> Upscale HD
                                </button>
                            )}
                            {/* Close */}
                            <button onClick={() => setLightbox(null)}
                                className="p-2 rounded-lg bg-white/5 hover:bg-red-500/20 text-neutral-400 hover:text-red-400 transition-colors ml-1">
                                <X size={14} />
                            </button>
                        </div>
                    </div>

                    {/* Image area — scrollable for zoomed images */}
                    <div className="flex-1 overflow-auto flex items-center justify-center p-6" onClick={() => setLightbox(null)}>
                        <img
                            src={lightbox.src}
                            alt={lightbox.label || 'Preview'}
                            className="rounded-xl shadow-2xl transition-transform duration-200 max-h-none cursor-zoom-out"
                            style={{ transform: `scale(${lightboxZoom})`, transformOrigin: 'center center', maxWidth: lightboxZoom > 1 ? 'none' : '90vw', maxHeight: lightboxZoom > 1 ? 'none' : '80vh' }}
                            onClick={e => {
                                e.stopPropagation();
                                setLightboxZoom(z => z < 2 ? z + 0.5 : 1);
                            }}
                        />
                    </div>

                    {/* Bottom hint */}
                    <div className="text-center py-2 text-[9px] text-neutral-700 shrink-0">
                        Click image to cycle zoom · Scroll to pan · ESC to close
                    </div>
                </div>
            )}
            <div className="flex items-center justify-between px-6 py-3 border-b border-[#1e1e1e] bg-[#0a0a0a] shrink-0">
                <div className="flex items-center gap-3">
                    <Link href="/influencers" className="flex items-center gap-1.5 text-neutral-500 hover:text-neutral-300 transition-colors text-sm">
                        <ArrowLeft size={14} /> <span className="text-[10px] uppercase tracking-wider">Roster</span>
                    </Link>
                    <ChevronRight size={10} className="text-neutral-700" />
                    <span className="font-bold text-sm text-neutral-200">{data.name}</span>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => fetchProfile()} className="flex items-center gap-1.5 text-[10px] px-3 py-1.5 rounded border border-[#2a2a2a] hover:bg-[#1e1e1e] text-neutral-500 transition-colors">
                        <RefreshCw size={10} /> Refresh
                    </button>
                    {n8nStatus && (
                        <span className={`text-[9px] font-mono px-2 py-1 rounded-lg border ${n8nStatus.startsWith('✓') ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : n8nStatus.startsWith('✗') ? 'text-red-400 bg-red-500/10 border-red-500/20' : 'text-neutral-300 bg-neutral-500/10 border-neutral-700'}`}>
                            {n8nStatus}
                        </span>
                    )}
                    <button onClick={handleEvolveDNA} disabled={evolvingDNA} className="flex items-center gap-1.5 text-[10px] px-3 py-1.5 rounded border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 transition-colors disabled:opacity-50">
                        {evolvingDNA ? <Loader2 size={10} className="animate-spin" /> : <Brain size={10} />} Auto-Evolve
                    </button>
                    <Link href={`/character?id=${id}`} className="flex items-center gap-1.5 text-[10px] px-3 py-1.5 rounded border border-violet-500/30 text-violet-400 hover:bg-violet-500/10 transition-colors">
                        <Fingerprint size={10} /> Edit DNA
                    </Link>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto">
                {/* ── Hero Section ─────────────────────────── */}
                <div className="relative border-b border-[#1e1e1e]">
                    {/* Gradient backdrop */}
                    <div className="absolute inset-0 bg-gradient-to-b from-violet-950/30 via-[#080808] to-[#080808]" />

                    <div className="relative px-6 py-8 flex gap-8 items-start max-w-6xl mx-auto">
                        {/* Avatar */}
                        <div className="shrink-0">
                            <div className="w-40 h-52 rounded-xl overflow-hidden bg-[#111] border-2 border-[#2a2a2a] shadow-2xl shadow-violet-950/20 group relative">
                                {avatar ? (
                                    <img src={avatar} alt={data.name} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-[#0d0d0d]">
                                        <Camera size={24} className="text-neutral-700" />
                                        <span className="text-[9px] text-neutral-600">No avatar</span>
                                    </div>
                                )}
                                {/* Generate overlay */}
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                                    <button onClick={() => setShowGenModal(true)} disabled={generating}
                                        className="flex items-center gap-1 text-[10px] px-3 py-1.5 rounded-lg bg-violet-600/90 text-white font-bold">
                                        {generating ? <Loader2 size={10} className="animate-spin" /> : <Camera size={10} />}
                                        {avatar ? 'Options' : 'Generate'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Info */}
                        <div className="flex-1 space-y-3">
                            <div>
                                <h1 className="text-2xl font-black text-neutral-100">{data.name}</h1>
                                <p className="text-sm text-neutral-500 mt-0.5">{data.niche}</p>
                            </div>

                            {dna && (
                                <div className="flex flex-wrap gap-2">
                                    {images.filter((img: any) => img.category === 'library').length > 0 ? (
                                        <span className="text-[9px] px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold flex items-center gap-1">
                                            <Check size={9} /> Library Locked
                                        </span>
                                    ) : (
                                        <span className="text-[9px] px-2 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold flex items-center gap-1">
                                            <Clock size={9} /> Pending Reference Sheet
                                        </span>
                                    )}
                                    {dna.identity?.ethnicity && (
                                        <span className="text-[9px] px-2 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500">{dna.identity.ethnicity}</span>
                                    )}
                                    {p?.mbti?.type && (
                                        <span className="text-[9px] px-2 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 font-mono">{p.mbti.type}</span>
                                    )}
                                    {p?.enneagram?.type && (
                                        <span className="text-[9px] px-2 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 font-mono">E{p.enneagram.type}w{p.enneagram.wing}</span>
                                    )}
                                    {archetype && (
                                        <span className="text-[9px] px-2 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400">{archetype.split(' – ')[0]}</span>
                                    )}
                                    <span className={`text-[9px] px-2 py-1 rounded-full border font-bold flex items-center gap-1 ${boundaryColor}`}>
                                        <Shield size={8} /> L{contentLevel}
                                    </span>
                                    {dna.style?.primary_aesthetic && (
                                        <span className="text-[9px] px-2 py-1 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] text-neutral-500 capitalize">{dna.style.primary_aesthetic}</span>
                                    )}
                                </div>
                            )}

                            <p className="text-xs text-neutral-600 leading-relaxed max-w-lg line-clamp-3 italic">
                                {dna?.identity?.backstory || 'No backstory defined yet.'}
                            </p>

                            <div className="text-[10px] text-neutral-700">
                                <Calendar size={10} className="inline mr-1" />
                                Created {new Date(data.created_at).toLocaleDateString()}
                            </div>
                        </div>

                        {/* Stats */}
                        <div className="shrink-0 grid grid-cols-2 gap-2">
                            <StatCard label="Total Posts" value={stats.total || 0} color="text-neutral-300" icon={BarChart3} />
                            <StatCard label="Posted" value={stats.posted || 0} color="text-emerald-400" icon={Check} />
                            <StatCard label="Ready" value={stats.ready || 0} color="text-amber-400" icon={Clock} />
                            <StatCard label="Ideas" value={stats.ideas || 0} color="text-violet-400" icon={Sparkles} />
                        </div>
                    </div>
                </div>

                {/* ── Tab Navigation ──────────────────────── */}
                <div className="flex gap-0 border-b border-[#1e1e1e] px-6 shrink-0 bg-[#0a0a0a] sticky top-0 z-10">
                    {([
                        { id: 'bio', label: 'Biography', icon: User },
                        { id: 'dna', label: 'DNA Profile', icon: Brain },
                        { id: 'gallery', label: 'Gallery', icon: ImagePlus },
                        { id: 'content', label: 'Content Pipeline', icon: Send },
                        { id: 'social', label: 'Social Accounts', icon: Smartphone },
                    ] as const).map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-1.5 px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-colors ${activeTab === tab.id ? 'border-violet-500 text-violet-400' : 'border-transparent text-neutral-600 hover:text-neutral-400'
                                }`}>
                            <tab.icon size={10} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* ── Tab Content ─────────────────────────── */}
                <div className="px-6 py-6 max-w-6xl mx-auto w-full">

                    {/* ─── BIOGRAPHY TAB ──────────────────── */}
                    {activeTab === 'bio' && dna && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="space-y-6">
                                <div className="bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl p-5 space-y-4">
                                    <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400 flex items-center gap-2">
                                        <User size={12} /> Identity
                                    </h3>
                                    <div className="grid grid-cols-2 gap-3 text-xs">
                                        <div><span className="text-neutral-600">Name</span><p className="text-neutral-200 font-medium">{dna.identity.name}</p></div>
                                        <div><span className="text-neutral-600">Age</span><p className="text-neutral-200 font-medium">{dna.identity.age}</p></div>
                                        <div><span className="text-neutral-600">Ethnicity</span><p className="text-neutral-200 font-medium">{dna.identity.ethnicity}</p></div>
                                        <div><span className="text-neutral-600">Niche</span><p className="text-neutral-200 font-medium">{dna.identity.niche}</p></div>
                                    </div>
                                    <div>
                                        <span className="text-[10px] text-neutral-600 uppercase">Backstory</span>
                                        <p className="text-xs text-neutral-400 leading-relaxed mt-1">{dna.identity.backstory}</p>
                                    </div>
                                    <div>
                                        <span className="text-[10px] text-neutral-600 uppercase">Core Values</span>
                                        <div className="flex flex-wrap gap-1.5 mt-1">
                                            {dna.identity.core_values?.map((v: string, i: number) => (
                                                <span key={i} className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400">{v}</span>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl p-5 space-y-4">
                                    <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400 flex items-center gap-2">
                                        <Mail size={12} /> Communication Style
                                    </h3>
                                    <div className="grid grid-cols-2 gap-3 text-xs">
                                        <div><span className="text-neutral-600">Vocabulary</span><p className="text-neutral-200">{p?.communication?.vocabulary_level}</p></div>
                                        <div><span className="text-neutral-600">Humor</span><p className="text-neutral-200">{p?.communication?.humor_type}</p></div>
                                        <div><span className="text-neutral-600">Emotion</span><p className="text-neutral-200">{p?.communication?.emotional_expression}</p></div>
                                        <div><span className="text-neutral-600">Pace</span><p className="text-neutral-200">{p?.communication?.speaking_pace}</p></div>
                                    </div>
                                    {p?.communication?.recurring_phrases && (
                                        <div>
                                            <span className="text-[10px] text-neutral-600 uppercase">Signature Phrases</span>
                                            <div className="flex flex-wrap gap-1.5 mt-1">
                                                {p.communication.recurring_phrases.map((phrase: string, i: number) => (
                                                    <span key={i} className="text-[9px] px-2 py-0.5 rounded bg-[#1a1a1a] text-neutral-400 italic">&ldquo;{phrase}&rdquo;</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl p-5 space-y-4">
                                    <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400 flex items-center gap-2">
                                        <Palette size={12} /> Appearance
                                    </h3>
                                    <div className="grid grid-cols-2 gap-3 text-xs">
                                        <div><span className="text-neutral-600">Height</span><p className="text-neutral-200">{dna.body.height_cm} cm</p></div>
                                        <div><span className="text-neutral-600">Weight</span><p className="text-neutral-200">{dna.body.weight_kg} kg</p></div>
                                        <div><span className="text-neutral-600">Body Type</span><p className="text-neutral-200 capitalize">{dna.body.body_type}</p></div>
                                        <div><span className="text-neutral-600">Skin Tone</span><p className="text-neutral-200">{dna.face.skin_tone}</p></div>
                                        <div><span className="text-neutral-600">Eyes</span><p className="text-neutral-200">{dna.face.eye_color} {dna.face.eye_shape}</p></div>
                                        <div><span className="text-neutral-600">Hair</span><p className="text-neutral-200">{dna.hair.color} {dna.hair.texture}</p></div>
                                        <div><span className="text-neutral-600">Face Shape</span><p className="text-neutral-200 capitalize">{dna.face.shape}</p></div>
                                        <div><span className="text-neutral-600">Measurements</span><p className="text-neutral-200">{dna.body.bust_cm}/{dna.body.waist_cm}/{dna.body.hips_cm}</p></div>
                                    </div>
                                </div>

                                <div className="bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl p-5 space-y-4">
                                    <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400 flex items-center gap-2">
                                        <Palette size={12} /> Style & Aesthetic
                                    </h3>
                                    <div className="grid grid-cols-2 gap-3 text-xs">
                                        <div><span className="text-neutral-600">Aesthetic</span><p className="text-neutral-200 capitalize">{dna.style.primary_aesthetic}</p></div>
                                        <div><span className="text-neutral-600">Makeup</span><p className="text-neutral-200">{dna.style.makeup_style}</p></div>
                                    </div>
                                    {dna.style.color_palette && (
                                        <div>
                                            <span className="text-[10px] text-neutral-600 uppercase">Color Palette</span>
                                            <div className="flex gap-2 mt-2">
                                                {dna.style.color_palette.map((c: string, i: number) => (
                                                    <div key={i} className="flex flex-col items-center gap-1">
                                                        <div className="w-8 h-8 rounded-lg border border-[#2a2a2a]" style={{ background: c.toLowerCase().replace(/\s/g, '') }} />
                                                        <span className="text-[7px] text-neutral-600 text-center leading-tight max-w-[40px]">{c}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {dna.style.accessories && (
                                        <div>
                                            <span className="text-[10px] text-neutral-600 uppercase">Accessories</span>
                                            <div className="flex flex-wrap gap-1.5 mt-1">
                                                {dna.style.accessories.map((a: string, i: number) => (
                                                    <span key={i} className="text-[9px] px-2 py-0.5 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] text-neutral-400">{a}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ─── DNA TAB ────────────────────────── */}
                    {activeTab === 'dna' && dna && p && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl p-5 space-y-4">
                                <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400">OCEAN Model</h3>
                                <div className="space-y-3">
                                    <OceanBar label="O" full="Openness" val={p.ocean.openness} color="bg-violet-500" />
                                    <OceanBar label="C" full="Conscientiousness" val={p.ocean.conscientiousness} color="bg-blue-500" />
                                    <OceanBar label="E" full="Extraversion" val={p.ocean.extraversion} color="bg-amber-500" />
                                    <OceanBar label="A" full="Agreeableness" val={p.ocean.agreeableness} color="bg-emerald-500" />
                                    <OceanBar label="N" full="Neuroticism" val={p.ocean.neuroticism} color="bg-rose-500" />
                                </div>
                                {archetype && (
                                    <div className="bg-[#1a1a1a] rounded-lg p-3 border border-[#2a2a2a]">
                                        <span className="text-[9px] text-neutral-600 uppercase">Archetype</span>
                                        <p className="text-xs text-neutral-300 mt-1">{archetype}</p>
                                    </div>
                                )}
                            </div>

                            <div className="bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl p-5 space-y-4">
                                <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400">Personality Traits</h3>
                                <div className="space-y-3 text-xs">
                                    <div className="flex justify-between"><span className="text-neutral-600">MBTI</span><span className="text-violet-400 font-mono font-bold">{p.mbti.type}</span></div>
                                    <div className="flex justify-between"><span className="text-neutral-600">Energy/Info</span><span className="text-neutral-300">{p.mbti.energy}/{p.mbti.information}</span></div>
                                    <div className="flex justify-between"><span className="text-neutral-600">Enneagram</span><span className="text-cyan-400 font-mono">{p.enneagram.type}w{p.enneagram.wing}</span></div>
                                    <div className="flex justify-between"><span className="text-neutral-600">Instinct</span><span className="text-neutral-300">{p.enneagram.instinct}</span></div>
                                </div>
                                <div className="border-t border-[#1e1e1e] pt-3">
                                    <h4 className="text-[10px] text-neutral-600 uppercase mb-2">Dark Triad</h4>
                                    <div className="space-y-2">
                                        <OceanBar label="" full="Narcissism" val={p.dark_triad.narcissism} color="bg-red-500" />
                                        <OceanBar label="" full="Machiavellianism" val={p.dark_triad.machiavellianism} color="bg-orange-500" />
                                        <OceanBar label="" full="Psychopathy" val={p.dark_triad.psychopathy} color="bg-rose-800" />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl p-5 space-y-4">
                                <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400">Social Algorithm</h3>
                                <div className="space-y-3 text-xs">
                                    <div className="flex justify-between"><span className="text-neutral-600">Posts/Week</span><span className="text-neutral-300 font-mono">{p.social_algorithm.posting_frequency_per_week}×</span></div>
                                    <div className="flex justify-between"><span className="text-neutral-600">Caption Style</span><span className="text-neutral-300">{p.social_algorithm.caption_style}</span></div>
                                    <div className="flex justify-between"><span className="text-neutral-600">Hook Type</span><span className="text-neutral-300">{p.social_algorithm.hook_type}</span></div>
                                    <div className="flex justify-between"><span className="text-neutral-600">Engagement</span><span className="text-neutral-300">{p.social_algorithm.engagement_style}</span></div>
                                    <div className="flex justify-between"><span className="text-neutral-600">Controversy</span><span className="text-neutral-300">{p.social_algorithm.controversy_tolerance}%</span></div>
                                </div>
                                {p.social_algorithm.best_posting_times && (
                                    <div>
                                        <span className="text-[10px] text-neutral-600 uppercase">Best Posting Times</span>
                                        <div className="flex flex-wrap gap-1.5 mt-1">
                                            {p.social_algorithm.best_posting_times.map((t: string, i: number) => (
                                                <span key={i} className="text-[9px] px-2 py-0.5 rounded bg-violet-500/10 text-violet-400">{t}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Content Boundary */}
                            <div className="bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl p-5 space-y-4">
                                <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400 flex items-center gap-2">
                                    <Shield size={12} /> Content Boundary
                                </h3>
                                <div className={`text-sm font-bold px-3 py-2 rounded-lg border ${boundaryColor}`}>
                                    Level {contentLevel}: {boundaryLabel}
                                </div>
                                <div className="space-y-2 text-xs">
                                    <div className="flex justify-between"><span className="text-neutral-600">Face Required</span><span className="text-neutral-300">{dna?.content_boundary?.face_always_visible ? 'Always' : 'Optional'}</span></div>
                                    <div className="flex justify-between"><span className="text-neutral-600">Platforms</span><span className="text-neutral-300">{dna?.content_boundary?.allowed_platforms?.join(', ') || 'All'}</span></div>
                                </div>
                                {dna?.content_boundary?.custom_restrictions && dna.content_boundary.custom_restrictions.length > 0 && (
                                    <div>
                                        <span className="text-[10px] text-neutral-600 uppercase">Custom Restrictions</span>
                                        <div className="flex flex-wrap gap-1.5 mt-1">
                                            {dna.content_boundary.custom_restrictions.map((r: string, i: number) => (
                                                <span key={i} className="text-[9px] px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400">{r}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Viral Strategy */}
                            {dna?.viral_strategy && (
                                <div className="bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl p-5 space-y-4">
                                    <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400 flex items-center gap-2">
                                        <Zap size={12} className="text-amber-500" /> Viral Strategy
                                    </h3>
                                    <div className="space-y-3 text-xs">
                                        <div className="flex justify-between"><span className="text-neutral-600">Hook Archetype</span><span className="text-amber-400 font-bold">{dna.viral_strategy.primary_hook_archetype}</span></div>
                                        <div className="flex justify-between"><span className="text-neutral-600">Content Format</span><span className="text-neutral-300">{dna.viral_strategy.content_format_focus}</span></div>
                                        <div className="flex justify-between"><span className="text-neutral-600">Monetization</span><span className="text-neutral-300">{dna.viral_strategy.monetization_angle}</span></div>
                                        <div className="flex justify-between"><span className="text-neutral-600">Pacing (BPM)</span><span className="text-emerald-400 font-mono">{dna.viral_strategy.pacing_bpm} BPM</span></div>
                                        <div className="flex justify-between"><span className="text-neutral-600">Readability</span><span className="text-emerald-400 font-mono">Grade {dna.viral_strategy.reading_grade_level}</span></div>
                                    </div>

                                    <div className="border-t border-[#1e1e1e] pt-3">
                                        <h4 className="text-[10px] text-neutral-600 uppercase mb-2">Monetization & Market</h4>
                                        <div className="space-y-3 text-xs">
                                            <div className="flex justify-between"><span className="text-neutral-600">Market Focus</span><span className="text-amber-400 font-bold">{dna.viral_strategy.market_focus || 'Global'}</span></div>
                                            <div className="flex justify-between"><span className="text-neutral-600">Est. CPM</span><span className="text-emerald-400 font-mono">${dna.viral_strategy.target_cpm || '??'}/1k views</span></div>
                                            <div className="flex justify-between">
                                                <span className="text-neutral-600">Platforms</span>
                                                <div className="flex gap-1">
                                                    {dna.viral_strategy.platform_priority?.map((plat: string) => (
                                                        <span key={plat} className="text-[9px] px-1.5 py-0.5 rounded-md bg-[#222] border border-white/5 text-neutral-300 font-mono uppercase">{plat}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="border-t border-[#1e1e1e] pt-3">
                                        <span className="text-[10px] text-neutral-600 uppercase mb-2 inline-block">Psychological Triggers</span>
                                        <div className="flex flex-wrap gap-1.5">
                                            {dna.viral_strategy.psychological_hooks?.map((hook: string) => (
                                                <span key={hook} className="text-[9px] px-2 py-0.5 rounded-full bg-violet-600/10 border border-violet-500/20 text-violet-400 font-bold uppercase tracking-widest">{hook}</span>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="border-t border-[#1e1e1e] pt-3 space-y-3">
                                        <div>
                                            <span className="text-[10px] text-neutral-600 uppercase">Retention Formula</span>
                                            <p className="text-[11px] text-neutral-300 mt-1 font-mono tracking-tight">{dna.viral_strategy.target_retention_curve}</p>
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-neutral-600 uppercase">Visual Composition & Contrast</span>
                                            <p className="text-[11px] text-neutral-300 mt-1">{dna.viral_strategy.visual_composition_rules} <span className="opacity-50">|</span> {dna.viral_strategy.color_contrast_ratio}</p>
                                        </div>
                                    </div>
                                    <div className="border-t border-[#1e1e1e] pt-3">
                                        <span className="text-[10px] text-neutral-600 uppercase">Aesthetic Trigger (1s Hook)</span>
                                        <p className="text-xs text-neutral-300 mt-1">{dna.viral_strategy.aesthetic_trigger}</p>
                                    </div>
                                    <div className="border-t border-[#1e1e1e] pt-3">
                                        <span className="text-[10px] text-neutral-600 uppercase">Viral Phrase Template</span>
                                        <p className="text-xs text-neutral-400 mt-1 italic">"{dna.viral_strategy.viral_phrase_template}"</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ─── GALLERY TAB ────────────────────── */}
                    {activeTab === 'gallery' && (() => {
                        const libraryImages = images.filter((img: any) => img.image_type === 'library');
                        const contentImages = images.filter((img: any) => img.image_type !== 'library');

                        // Group library images by category (stored as "Category::Label")
                        const CATEGORIES = [
                            { key: 'Face', label: '😶 Face Close-Ups', color: 'text-violet-400', border: 'border-violet-500/30', bg: 'bg-violet-500/5', count: 5 },
                            { key: 'Upper Body', label: '👕 Upper Body', color: 'text-cyan-400', border: 'border-cyan-500/30', bg: 'bg-cyan-500/5', count: 5 },
                            { key: 'Full Body', label: '🧍 Full Body', color: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/5', count: 5 },
                            { key: 'Expression', label: '😄 Expressions', color: 'text-amber-400', border: 'border-amber-500/30', bg: 'bg-amber-500/5', count: 5 },
                        ];
                        const getCategory = (img: any) => (img.angle || '::').split('::')[0];
                        const getLabel = (img: any) => (img.angle || '::').split('::')[1] || '';

                        return (
                            <div className="space-y-8">
                                {/* Header controls */}
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400">Character Library</h3>
                                        <p className="text-[10px] text-neutral-600 mt-0.5">{libraryImages.length}/20 reference shots · {contentImages.length} content images</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={handleRefreshGallery} className="flex items-center gap-1.5 text-[10px] px-3 py-1.5 rounded border border-[#2a2a2a] hover:bg-[#1e1e1e] text-neutral-500 transition-colors">
                                            <RefreshCw size={10} className={generating ? "animate-spin" : ""} /> Sync ComfyUI
                                        </button>
                                        <button onClick={() => setShowGenModal(true)} disabled={generating}
                                            className="flex items-center gap-1.5 text-[10px] px-3 py-1.5 rounded bg-violet-700 hover:bg-violet-600 text-white font-semibold transition-colors disabled:opacity-40">
                                            {generating ? <Loader2 size={10} className="animate-spin" /> : <ImagePlus size={10} />}
                                            Generate
                                        </button>
                                    </div>
                                </div>

                                {/* Progress bar when library is incomplete */}
                                {libraryImages.length > 0 && libraryImages.length < 20 && (
                                    <div className="bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl p-4 space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] text-neutral-500">Library Progress</span>
                                            <span className="text-[10px] font-mono text-violet-400">{libraryImages.length}/20 shots</span>
                                        </div>
                                        <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                                            <div className="h-full bg-gradient-to-r from-violet-600 to-cyan-500 rounded-full transition-all duration-700"
                                                style={{ width: `${(libraryImages.length / 20) * 100}%` }} />
                                        </div>
                                    </div>
                                )}

                                {/* 4 Category Sections */}
                                {CATEGORIES.map(cat => {
                                    const catImages = libraryImages.filter((img: any) => getCategory(img) === cat.key);
                                    return (
                                        <div key={cat.key} className={`rounded-xl border ${cat.border} ${cat.bg} overflow-hidden`}>
                                            {/* Section Header */}
                                            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-xs font-bold uppercase tracking-widest ${cat.color}`}>{cat.label}</span>
                                                    <span className="text-[9px] text-neutral-600 font-mono">{catImages.length}/{cat.count} shots</span>
                                                </div>
                                                {catImages.length === 0 && (
                                                    <span className="text-[9px] text-neutral-700 italic">Not generated yet — run Library Mode</span>
                                                )}
                                            </div>

                                            {/* Images grid */}
                                            <div className="p-3">
                                                {catImages.length > 0 ? (
                                                    <div className="grid grid-cols-5 gap-2">
                                                        {catImages.map((img: any) => (
                                                            <div key={img.id} className="relative group">
                                                                <div className="aspect-[3/4] rounded-lg overflow-hidden bg-[#111] border border-white/5 cursor-zoom-in"
                                                                    onClick={() => openLightbox(img.image_path, img.id, getLabel(img))}>
                                                                    <img src={img.image_path} alt={getLabel(img)} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                                                                    {/* Hover overlay */}
                                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex flex-col items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                                                                        <ZoomIn size={20} className="text-white drop-shadow" />
                                                                        <button onClick={e => { e.stopPropagation(); setAsAvatar(img.image_path); }}
                                                                            className="text-[8px] px-2 py-1 rounded bg-amber-600/90 text-white font-bold flex items-center gap-1">
                                                                            <Star size={7} /> Set Avatar
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                                {/* Label below image */}
                                                                <p className="text-[8px] text-center text-neutral-600 mt-1 truncate">{getLabel(img)}</p>
                                                            </div>
                                                        ))}
                                                        {/* Empty placeholder slots */}
                                                        {Array.from({ length: Math.max(0, cat.count - catImages.length) }).map((_, i) => (
                                                            <div key={`empty-${i}`} className="aspect-[3/4] rounded-lg border border-dashed border-white/5 bg-[#0a0a0a] flex items-center justify-center">
                                                                <Camera size={12} className="text-neutral-800" />
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    /* Empty state — show 5 placeholder slots */
                                                    <div className="grid grid-cols-5 gap-2">
                                                        {Array.from({ length: cat.count }).map((_, i) => (
                                                            <div key={i} className="aspect-[3/4] rounded-lg border border-dashed border-white/5 bg-[#0a0a0a] flex items-center justify-center">
                                                                <Camera size={12} className="text-neutral-800" />
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* Content Posts Section */}
                                <div className="space-y-3">
                                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-violet-400 flex items-center gap-1.5">
                                        <ImagePlus size={12} /> Generated Content Posts
                                        <span className="text-neutral-700 font-normal normal-case tracking-normal">{contentImages.length} images</span>
                                    </h4>
                                    {contentImages.length > 0 || data.avatar_image_path ? (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                            {[data.avatar_image_path, data.generated_image_path]
                                                .filter((v, i, a) => v && a.indexOf(v) === i)
                                                .map((img: string, i: number) => (
                                                    <div key={`main-${i}`}
                                                        className="relative aspect-[3/4] rounded-lg overflow-hidden bg-[#111] border border-[#1e1e1e] group cursor-zoom-in"
                                                        onClick={() => openLightbox(img, undefined, img === data.avatar_image_path ? '⭐ Avatar Photo' : '📷 Latest Generated')}>
                                                        <img src={img} alt="" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                                                        <div className="absolute top-2 left-2 text-[8px] px-1.5 py-0.5 rounded-full bg-black/60 backdrop-blur-sm text-emerald-400 font-bold">
                                                            {img === data.avatar_image_path ? '⭐ Avatar' : '📷 Latest'}
                                                        </div>
                                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                            <ZoomIn size={24} className="text-white drop-shadow-lg" />
                                                        </div>
                                                    </div>
                                                ))}
                                            {contentImages.map((img: any) => (
                                                <div key={img.id}
                                                    className="relative aspect-[3/4] rounded-lg overflow-hidden bg-[#111] border border-[#1e1e1e] group cursor-zoom-in"
                                                    onClick={() => openLightbox(img.image_path, img.id, img.angle || 'Content Image', true)}>
                                                    <img src={img.image_path} alt="" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/70 transition-all flex flex-col items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                                                        <ZoomIn size={20} className="text-white drop-shadow" />
                                                        <button onClick={e => { e.stopPropagation(); setAsAvatar(img.image_path); }}
                                                            className="w-3/4 text-[9px] py-1.5 rounded bg-amber-600/90 hover:bg-amber-500 text-white font-bold flex items-center justify-center gap-1 transition-colors">
                                                            <Star size={10} /> Set Avatar
                                                        </button>
                                                        {!img.image_path.includes('upscaled') && (
                                                            <button onClick={e => { e.stopPropagation(); triggerUpscale(img.id, img.image_path); }}
                                                                className="w-3/4 text-[9px] py-1.5 rounded bg-violet-600/90 hover:bg-violet-500 text-white font-bold flex items-center justify-center gap-1 transition-colors">
                                                                <Maximize size={10} /> Upscale HD
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-32 gap-3 text-center border border-dashed border-[#1e1e1e] rounded-xl">
                                            <ImagePlus size={24} className="text-neutral-800" />
                                            <p className="text-neutral-700 text-xs">No content images yet. Generate a single portrait.</p>
                                        </div>
                                    )}
                                </div>

                                {/* All empty state */}
                                {libraryImages.length === 0 && contentImages.length === 0 && !data.avatar_image_path && (
                                    <div className="flex flex-col items-center justify-center h-32 gap-3 text-center">
                                        <Camera size={28} className="text-neutral-800" />
                                        <p className="text-neutral-600 text-xs">No images yet.<br />Click Generate → Library Mode to build all 20 angle shots.</p>
                                    </div>
                                )}
                            </div>
                        );
                    })()}


                    {/* ─── CONTENT PIPELINE TAB ───────────── */}
                    {activeTab === 'content' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400">{posts.length} Posts</h3>
                                <div className="flex items-center gap-2">
                                    <button onClick={handleTriggerN8n} disabled={triggeringN8n} className="flex items-center gap-1.5 text-[10px] px-3 py-1.5 rounded border border-[#2a2a2a] hover:bg-neutral-800 text-neutral-400 font-semibold transition-colors disabled:opacity-50">
                                        <Zap size={10} className={triggeringN8n ? "animate-pulse text-amber-500" : "text-amber-500"} />
                                        {triggeringN8n ? 'Triggering n8n...' : 'Generate AI Ideas (n8n)'}
                                    </button>
                                    <Link href="/queue" className="flex items-center gap-1.5 text-[10px] px-3 py-1.5 rounded bg-violet-700 hover:bg-violet-600 text-white font-semibold transition-colors">
                                        <Sparkles size={10} /> To Content Queue
                                    </Link>
                                </div>
                            </div>

                            {posts.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-48 gap-4 text-center">
                                    <Send size={32} className="text-neutral-700" />
                                    <p className="text-neutral-500 text-sm">No content yet. Go to the Content Pipeline to generate posts.</p>
                                </div>
                            ) : (
                                <div className="bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl overflow-hidden">
                                    {posts.map((post: any, i: number) => {
                                        const statusColors: Record<string, string> = {
                                            'Idea': 'text-neutral-500 bg-neutral-500/10 border-neutral-500/20',
                                            'Image_Gen': 'text-amber-500 bg-amber-500/10 border-amber-500/20',
                                            'Ready': 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
                                            'Posted': 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
                                        };
                                        return (
                                            <div key={post.id} className={`flex items-start gap-4 px-4 py-4 ${i < posts.length - 1 ? 'border-b border-[#1a1a1a]' : ''} hover:bg-[#111] transition-colors`}>
                                                <div className="w-14 h-14 shrink-0 rounded-lg overflow-hidden bg-[#111] border border-[#1e1e1e] relative group">
                                                    {post.media_path ? (
                                                        <img src={post.media_path} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center bg-violet-500/5"><ImagePlus size={16} className="text-violet-500/20" /></div>
                                                    )}
                                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Maximize size={16} className="text-white" />
                                                    </div>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-xs font-bold text-neutral-100 truncate">{post.viral_hook || 'Algorithmic Content Idea'}</p>
                                                        {post.music_suggestion && (
                                                            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[8px] font-mono border border-emerald-500/20">
                                                                <Music size={8} /> {post.music_suggestion.slice(0, 15)}...
                                                            </div>
                                                        )}
                                                    </div>
                                                    <p className="text-[10px] text-neutral-500 line-clamp-2 mt-1 italic">"{post.caption || 'No caption generated yet.'}"</p>

                                                    <div className="flex items-center gap-3 mt-2">
                                                        <div className="flex items-center gap-1.5 grayscale opacity-60">
                                                            <div className="flex gap-0.5">
                                                                {[1, 2, 3].map(dot => (
                                                                    <div key={dot} className={`w-1 h-1 rounded-full ${post.status === 'Ready' ? 'bg-cyan-400' : 'bg-neutral-600'}`} />
                                                                ))}
                                                            </div>
                                                            <span className="text-[9px] text-neutral-600 font-mono tracking-tighter uppercase">Algorithm Match</span>
                                                        </div>
                                                        <p className="text-[9px] text-neutral-700 font-medium">
                                                            {post.post_date ? new Date(post.post_date).toLocaleDateString() : 'Scheduled: ASAP'}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end gap-2">
                                                    <span className={`text-[8px] px-2 py-1 rounded-full border font-bold uppercase tracking-wider ${statusColors[post.status] || statusColors['Idea']}`}>
                                                        {post.status}
                                                    </span>
                                                    {post.video_hook_variations && (
                                                        <span className="text-[9px] text-neutral-600 flex items-center gap-1 font-mono">
                                                            <Layers size={9} /> 3 Hooks
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ─── SOCIAL ACCOUNTS TAB ────────────── */}
                    {activeTab === 'social' && (
                        <div className="space-y-6 max-w-4xl">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400">Social Account Connections</h3>
                                    <p className="text-[10px] text-neutral-600 mt-0.5">Link accounts for automated posting & analytics</p>
                                </div>
                                <button onClick={() => setShowSocialModal(true)}
                                    className="flex items-center gap-1.5 text-[10px] px-3 py-1.5 rounded bg-violet-700 hover:bg-violet-600 text-white font-semibold transition-colors">
                                    <Smartphone size={10} /> Link Instagram
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {platformAccounts.length === 0 ? (
                                    <div className="col-span-full py-12 flex flex-col items-center justify-center border border-dashed border-[#1e1e1e] rounded-xl gap-3">
                                        <Lock size={24} className="text-neutral-800" />
                                        <p className="text-neutral-600 text-xs">No social accounts linked yet.</p>
                                    </div>
                                ) : (
                                    platformAccounts.map(acc => (
                                        <div key={acc.id} className="bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl p-4 flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center shrink-0">
                                                <Smartphone className="text-white" size={20} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="text-xs font-bold text-neutral-200 truncate">{acc.account_name}</h4>
                                                <p className="text-[10px] text-neutral-500 font-mono mt-0.5">ID: {acc.external_id}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[8px] px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold uppercase tracking-wider">Active</span>
                                                <button className="text-neutral-500 hover:text-white transition-colors"><ExternalLink size={12} /></button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-4 flex gap-3">
                                <AlertCircle size={16} className="text-amber-500 shrink-0" />
                                <div className="space-y-1">
                                    <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Automation Token Check</p>
                                    <p className="text-[10px] text-neutral-500 leading-relaxed">
                                        The <b>Posting Agent</b> will route content through these linked accounts automatically. If no account is linked here, it will fall back to the global environment variables defined in <code>.env.local</code>.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {!dna && (activeTab === 'bio' || activeTab === 'dna') && (
                        <div className="flex flex-col items-center justify-center h-48 gap-4 text-center">
                            <Brain size={32} className="text-neutral-700" />
                            <p className="text-neutral-500 text-sm">No DNA data. Create a character profile in the DNA Editor.</p>
                            <Link href="/character" className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-700 hover:bg-violet-600 text-white text-sm font-semibold transition-colors">
                                <Fingerprint size={14} /> Open DNA Editor
                            </Link>
                        </div>
                    )}
                </div>
            </div>

            {showGenModal && (
                <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-2xl w-full max-w-lg overflow-hidden flex flex-col shadow-2xl">
                        <div className="p-5 border-b border-[#1e1e1e] flex justify-between items-center">
                            <div className="flex items-center gap-4">
                                <div>
                                    <h3 className="text-sm font-black text-neutral-100">Image Generation</h3>
                                    <p className="text-[9px] text-neutral-600 mt-0.5">For {data.name} · Default from Integration Hub</p>
                                </div>
                                <div className="h-4 w-px bg-neutral-800 mx-2" />
                                <button onClick={() => setShowAdvanced(!showAdvanced)}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest transition-all ${
                                        showAdvanced ? 'bg-violet-500 text-white shadow-lg shadow-violet-500/20' : 'bg-[#1a1a1a] text-neutral-500 hover:bg-[#222]'
                                    }`}>
                                    <Brain size={10} className={showAdvanced ? 'animate-pulse' : ''} />
                                    {showAdvanced ? 'Advanced Mode ON' : 'Experimental Mode'}
                                </button>
                            </div>
                            <button onClick={() => setShowGenModal(false)} className="text-neutral-500 hover:text-white text-lg leading-none">&times;</button>
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
                                                try { setAdvancedConfig(JSON.parse(w.config)); } catch(e) {}
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
                                        <button onClick={handleSaveLoraToDNA} disabled={!selectedLora || generating}
                                            className="px-3 text-[9px] bg-amber-500/10 border border-amber-500/30 text-amber-500 rounded-lg hover:bg-amber-500/20 disabled:opacity-50 font-bold uppercase tracking-wider whitespace-nowrap">
                                            Save to DNA
                                        </button>
                                    </div>
                                    <p className="text-[8px] text-neutral-700">strength 0.75 · must be in ComfyUI/models/loras/</p>
                                </div>
                            )}

                            {/* Advanced Engine Overrides */}
                            <div className="pt-2 border-t border-[#1e1e1e]/50">
                                <button onClick={() => setShowAdvanced(!showAdvanced)} className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-violet-400 hover:text-violet-300 transition-colors w-full">
                                    <Brain size={12} /> {showAdvanced ? 'Hide Advanced Mode' : 'Show Advanced Mode'}
                                </button>
                                
                                {showAdvanced && (
                                    <div className="mt-4 space-y-3 p-4 rounded-xl border border-violet-500/20 bg-violet-500/5">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest">UNET Model Override</label>
                                                <input type="text" value={advancedConfig.unet_name} onChange={e => setAdvancedConfig({...advancedConfig, unet_name: e.target.value})}
                                                    placeholder="e.g. flux-2-Q4.gguf" className="w-full bg-[#111] border border-[#2a2a2a] rounded px-2 py-1.5 text-[10px] text-neutral-300 font-mono" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest">CLIP V Override</label>
                                                <input type="text" value={advancedConfig.clip_name} onChange={e => setAdvancedConfig({...advancedConfig, clip_name: e.target.value})}
                                                    placeholder="e.g. viT-L-14.safetensors" className="w-full bg-[#111] border border-[#2a2a2a] rounded px-2 py-1.5 text-[10px] text-neutral-300 font-mono" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest">VAE Override</label>
                                                <input type="text" value={advancedConfig.vae_name} onChange={e => setAdvancedConfig({...advancedConfig, vae_name: e.target.value})}
                                                    placeholder="e.g. ae.safetensors" className="w-full bg-[#111] border border-[#2a2a2a] rounded px-2 py-1.5 text-[10px] text-neutral-300 font-mono" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest">Sampler Override</label>
                                                <input type="text" value={advancedConfig.sampler_name} onChange={e => setAdvancedConfig({...advancedConfig, sampler_name: e.target.value})}
                                                    placeholder="e.g. euler, euler_ancestral" className="w-full bg-[#111] border border-[#2a2a2a] rounded px-2 py-1.5 text-[10px] text-neutral-300 font-mono" />
                                            </div>
                                        </div>
                                        
                                        <div className="flex gap-2 pt-2 border-t border-violet-500/10">
                                            <input type="text" value={advancedPresetName} onChange={e => setAdvancedPresetName(e.target.value)}
                                                placeholder="Custom Preset Name" className="flex-1 bg-[#111] border border-[#2a2a2a] rounded px-2 py-1 text-[10px] text-neutral-300 font-mono" />
                                            <button onClick={handleSaveCustomWorkflow} disabled={!advancedPresetName}
                                                className="px-3 py-1 bg-violet-500/20 hover:bg-violet-500/30 text-violet-400 font-bold text-[9px] uppercase tracking-wider rounded border border-violet-500/30 disabled:opacity-50">
                                                Save Custom
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Advanced Settings */}
                            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-[#1e1e1e]/50">
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-neutral-600">Inference Steps</label>
                                        <span className="text-[9px] font-mono text-violet-400">{genSteps}</span>
                                    </div>
                                    <input type="range" min="4" max="40" step="1" value={genSteps} onChange={e => setGenSteps(Number(e.target.value))}
                                        className="w-full accent-violet-500" />
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-neutral-600">Guidance (CFG)</label>
                                        <span className="text-[9px] font-mono text-violet-400">{genCfg}</span>
                                    </div>
                                    <input type="range" min="1.0" max="10.0" step="0.5" value={genCfg} onChange={e => setGenCfg(Number(e.target.value))}
                                        className="w-full accent-violet-500" />
                                </div>
                            </div>
                        </div>
                        <div className="p-4 border-t border-[#1e1e1e] flex gap-2">
                            <button onClick={() => setShowGenModal(false)} className="px-4 py-2 text-xs text-neutral-500 hover:text-white transition-colors">Cancel</button>
                            <button onClick={handleGenerate}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-black bg-violet-600 hover:bg-violet-500 text-white rounded-xl transition-colors">
                                <Camera size={11} /> Run: {ALL_WORKFLOWS.find(w => w.id === selectedWorkflow)?.name || 'ComfyUI'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showSocialModal && (
                <div className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-2xl w-full max-w-md overflow-hidden flex flex-col shadow-2xl">
                        <div className="p-5 border-b border-[#1e1e1e] flex justify-between items-center">
                            <div>
                                <h3 className="text-sm font-black text-neutral-100 uppercase tracking-tight">Link Instagram Account</h3>
                                <p className="text-[9px] text-neutral-600 mt-0.5">Connect {data.name} to the IG Graph API</p>
                            </div>
                            <button onClick={() => setShowSocialModal(false)} className="text-neutral-500 hover:text-white leading-none text-2xl">&times;</button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-black uppercase tracking-widest text-neutral-600">User Access Token (Long-Lived)</label>
                                <input type="password" value={linkToken} onChange={e => setLinkToken(e.target.value)}
                                    placeholder="EAAB..."
                                    className="w-full bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-[10px] text-neutral-300 placeholder-neutral-700 focus:border-violet-500/40 focus:outline-none font-mono" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-neutral-600">IG Business ID</label>
                                    <input type="text" value={linkBusinessId} onChange={e => setLinkBusinessId(e.target.value)}
                                        placeholder="1784..."
                                        className="w-full bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-[10px] text-neutral-300 placeholder-neutral-700 focus:border-violet-500/40 focus:outline-none font-mono" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-neutral-600">FB Page ID</label>
                                    <input type="text" value={linkPageId} onChange={e => setLinkPageId(e.target.value)}
                                        placeholder="1092..."
                                        className="w-full bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-[10px] text-neutral-300 placeholder-neutral-700 focus:border-violet-500/40 focus:outline-none font-mono" />
                                </div>
                            </div>
                            <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/10 flex gap-2.5">
                                <ExternalLink size={14} className="text-blue-500 shrink-0 mt-0.5" />
                                <p className="text-[9px] text-neutral-500 leading-normal">
                                    You can find these IDs in the <b>Meta Business Suite</b> or the <b>Graph API Explorer</b>. Use a long-lived user token (60 days) for best results.
                                </p>
                            </div>
                        </div>
                        <div className="p-4 border-t border-[#1e1e1e] flex gap-2">
                            <button onClick={() => setShowSocialModal(false)} className="px-4 py-2 text-xs text-neutral-500 hover:text-white transition-colors">Cancel</button>
                            <button onClick={handleLinkSocial} disabled={linking || !linkToken}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-black bg-violet-600 hover:bg-violet-500 text-white rounded-xl transition-colors disabled:opacity-40">
                                {linking ? <Loader2 size={11} className="animate-spin" /> : <Smartphone size={11} />}
                                {linking ? 'Connecting...' : 'Link Account'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}
