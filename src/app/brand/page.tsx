'use client';

import { useState, useEffect } from 'react';
import { 
    Palette, 
    Type, 
    MessageSquare, 
    Target, 
    CheckCircle2, 
    Save, 
    RefreshCw, 
    Users, 
    Sparkles, 
    Shield, 
    Zap,
    Pipette,
    Layout,
    CloudRain
} from 'lucide-react';

interface Influencer {
    id: string;
    name: string;
    niche: string;
    avatar_image_path?: string;
}

interface BrandKit {
    influencer_id: string;
    primary_color: string;
    secondary_color: string;
    font_family: string;
    voice_tone: string;
    signature_catchphrase: string;
    target_audience_desc: string;
    brand_values: string; // JSON string
    logo_path?: string;
}

export default function BrandStudioPage() {
    const [influencers, setInfluencers] = useState<Influencer[]>([]);
    const [activeInfId, setActiveInfId] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [brandKit, setBrandKit] = useState<BrandKit | null>(null);
    const [values, setValues] = useState<string[]>([]);
    const [newValue, setNewValue] = useState('');

    useEffect(() => {
        fetch('/api/influencers')
            .then(r => { if (!r.ok) return []; return r.json(); })
            .then(d => {
                const infs = Array.isArray(d) ? d : [];
                setInfluencers(infs);
                if (infs.length > 0) setActiveInfId(infs[0].id);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        if (!activeInfId) return;
        fetch(`/api/influencers/${activeInfId}/brand`)
            .then(r => { if (!r.ok) return null; return r.json(); })
            .then(data => {
                setBrandKit(data);
                try {
                    setValues(JSON.parse(data?.brand_values || '[]'));
                } catch {
                    setValues([]);
                }
            })
            .catch(() => {});
    }, [activeInfId]);

    const handleSave = async () => {
        if (!activeInfId || !brandKit) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/influencers/${activeInfId}/brand`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...brandKit,
                    brand_values: JSON.stringify(values)
                })
            });
            if (res.ok) {
                // Show success toast or something
            }
        } catch (e) {
            console.error(e);
        } finally {
            setSaving(false);
        }
    };

    const addValue = () => {
        if (!newValue.trim()) return;
        setValues([...values, newValue.trim()]);
        setNewValue('');
    };

    const removeValue = (index: number) => {
        setValues(values.filter((_, i) => i !== index));
    };

    if (loading) return <div className="h-full flex items-center justify-center bg-[#080808]"><RefreshCw className="animate-spin text-neutral-600" /></div>;

    const activeInf = influencers.find(i => i.id === activeInfId);

    return (
        <div className="h-full flex bg-[#080808] text-neutral-300 overflow-hidden font-sans">
            
            {/* Left Sidebar */}
            <div className="w-64 border-r border-[#1a1a1a] bg-[#0a0a0a] flex flex-col shrink-0">
                <div className="p-6 border-b border-[#1a1a1a]">
                    <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-500 flex items-center gap-2">
                        <Palette size={12} /> Brand Hub
                    </h2>
                    <p className="text-[9px] text-neutral-500 mt-2 leading-relaxed">
                        Establish the visual and linguistic identity of your AI assets.
                    </p>
                </div>
                <div className="p-3 space-y-1 overflow-y-auto">
                    {influencers.map(inf => (
                        <button key={inf.id} onClick={() => setActiveInfId(inf.id)}
                            className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all ${activeInfId === inf.id ? 'bg-violet-500/10 border border-violet-500/30' : 'hover:bg-white/[0.03] border border-transparent'}`}>
                            {inf.avatar_image_path ? (
                                <img src={inf.avatar_image_path} className="w-8 h-8 rounded-full object-cover border border-[#2a2a2a]" />
                            ) : (
                                <div className="w-8 h-8 rounded-full bg-[#1a1a1a] flex items-center justify-center"><Users size={12} className="text-neutral-600" /></div>
                            )}
                            <div className="text-left flex-1 min-w-0">
                                <div className={`text-[10px] font-bold truncate ${activeInfId === inf.id ? 'text-violet-400' : 'text-neutral-300'}`}>{inf.name}</div>
                                <div className="text-[8px] text-neutral-600 truncate">{inf.niche}</div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto layout-scroll p-10">
                {!activeInfId ? (
                    <div className="h-full flex items-center justify-center text-neutral-600 text-sm">Select an influencer to begin</div>
                ) : (
                    <div className="max-w-4xl mx-auto space-y-10">
                        
                        {/* Header */}
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-3xl font-black text-white tracking-tight">Brand Identity Studio</h1>
                                <p className="text-xs text-neutral-500 mt-1 flex items-center gap-2 italic">
                                    <Shield size={12} className="text-violet-500" /> Crafting the soul of {activeInf?.name}
                                </p>
                            </div>
                            <button onClick={handleSave} disabled={saving}
                                className="flex items-center gap-2 px-6 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-black tracking-widest uppercase transition-all shadow-lg shadow-violet-500/20 disabled:opacity-50">
                                {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                                {saving ? 'Syncing Brand...' : 'Save Identity'}
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            
                            {/* Visual Identity */}
                            <div className="space-y-6">
                                <div className="p-6 rounded-3xl bg-[#0c0c0c] border border-[#1a1a1a] space-y-6">
                                    <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                                        <div className="p-2 rounded-lg bg-emerald-500/10"><Palette size={16} className="text-emerald-400" /></div>
                                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Visual Foundation</h3>
                                    </div>
                                    
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">Primary Color</label>
                                                <div className="flex gap-2">
                                                    <input type="color" value={brandKit?.primary_color || '#8b5cf6'} 
                                                        onChange={e => setBrandKit(b => b ? {...b, primary_color: e.target.value} : null)}
                                                        className="w-10 h-10 rounded-lg bg-transparent cursor-pointer border-0 p-0" />
                                                    <input type="text" value={brandKit?.primary_color || '#8b5cf6'} 
                                                        onChange={e => setBrandKit(b => b ? {...b, primary_color: e.target.value} : null)}
                                                        className="flex-1 bg-black/40 border border-[#222] rounded-lg px-3 text-[10px] font-mono text-neutral-400" />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">Secondary Color</label>
                                                <div className="flex gap-2">
                                                    <input type="color" value={brandKit?.secondary_color || '#06b6d4'} 
                                                        onChange={e => setBrandKit(b => b ? {...b, secondary_color: e.target.value} : null)}
                                                        className="w-10 h-10 rounded-lg bg-transparent cursor-pointer border-0 p-0" />
                                                    <input type="text" value={brandKit?.secondary_color || '#06b6d4'} 
                                                        onChange={e => setBrandKit(b => b ? {...b, secondary_color: e.target.value} : null)}
                                                        className="flex-1 bg-black/40 border border-[#222] rounded-lg px-3 text-[10px] font-mono text-neutral-400" />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">Typography Path</label>
                                            <select value={brandKit?.font_family} onChange={e => setBrandKit(b => b ? {...b, font_family: e.target.value} : null)}
                                                className="w-full bg-black/40 border border-[#222] rounded-xl px-4 py-3 text-xs text-white appearance-none cursor-pointer">
                                                <option value="Inter">Inter (Clean, Tech)</option>
                                                <option value="Outfit">Outfit (Modern, Brand)</option>
                                                <option value="Playfair Display">Playfair (Luxury, Classic)</option>
                                                <option value="JetBrains Mono">JetBrains (Technical, Precise)</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Preview Card */}
                                <div className="p-8 rounded-[40px] relative overflow-hidden group border-2 transition-all duration-700"
                                    style={{ 
                                        borderColor: `${brandKit?.primary_color}20`,
                                        background: `linear-gradient(135deg, ${brandKit?.primary_color}10 0%, #000 100%)`
                                    }}>
                                    <div className="absolute top-0 right-0 p-4 opacity-20"><Zap size={40} style={{ color: brandKit?.primary_color }} /></div>
                                    <div className="space-y-4">
                                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-xl" style={{ backgroundColor: brandKit?.primary_color }}>
                                            <Sparkles size={20} className="text-white" />
                                        </div>
                                        <div className="space-y-1">
                                            <h4 className="text-xl font-black text-white" style={{ fontFamily: brandKit?.font_family }}>Identity Preview</h4>
                                            <p className="text-[10px] leading-relaxed text-neutral-400 max-w-[200px]">
                                                {brandKit?.signature_catchphrase || 'Your unique digital signature goes here...'}
                                            </p>
                                        </div>
                                        <button className="px-5 py-2 rounded-full text-[9px] font-bold text-white transition-all shadow-lg"
                                            style={{ backgroundColor: brandKit?.secondary_color }}>
                                            Action Button
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Linguistic & Behavioral Identity */}
                            <div className="space-y-6">
                                <div className="p-6 rounded-3xl bg-[#0c0c0c] border border-[#1a1a1a] space-y-6">
                                    <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                                        <div className="p-2 rounded-lg bg-violet-500/10"><MessageSquare size={16} className="text-violet-400" /></div>
                                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Linguistic DNA</h3>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">Voice & Tone</label>
                                            <div className="grid grid-cols-2 gap-2">
                                                {['Professional', 'Playful', 'Sarcastic', 'Empathetic', 'Luxury', 'Stoic'].map(t => (
                                                    <button key={t} onClick={() => setBrandKit(b => b ? {...b, voice_tone: t} : null)}
                                                        className={`px-4 py-2 rounded-xl text-[10px] font-bold border transition-all ${brandKit?.voice_tone === t ? 'bg-violet-600 border-violet-500 text-white shadow-lg shadow-violet-500/20' : 'bg-black/40 border-[#222] text-neutral-500 hover:border-neutral-700'}`}>
                                                        {t}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">Signature Catchphrase</label>
                                            <textarea value={brandKit?.signature_catchphrase || ''} onChange={e => setBrandKit(b => b ? {...b, signature_catchphrase: e.target.value} : null)}
                                                placeholder="e.g. Scaling the impossible, one block at a time."
                                                className="w-full bg-black/40 border border-[#222] rounded-xl px-4 py-3 text-xs text-neutral-300 min-h-[80px]" />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">Target Audience</label>
                                            <input type="text" value={brandKit?.target_audience_desc || ''} onChange={e => setBrandKit(b => b ? {...b, target_audience_desc: e.target.value} : null)}
                                                placeholder="e.g. Gen-Z Tech Founders in Tier 1 Cities"
                                                className="w-full bg-black/40 border border-[#222] rounded-xl px-4 py-3 text-xs text-neutral-300" />
                                        </div>
                                    </div>
                                </div>

                                <div className="p-6 rounded-3xl bg-[#0c0c0c] border border-[#1a1a1a] space-y-4">
                                    <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                                        <div className="p-2 rounded-lg bg-amber-500/10"><CheckCircle2 size={16} className="text-amber-400" /></div>
                                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Brand Values</h3>
                                    </div>
                                    
                                    <div className="flex flex-wrap gap-2">
                                        {values.map((v, i) => (
                                            <span key={i} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[10px] text-white flex items-center gap-2 group">
                                                {v}
                                                <button onClick={() => removeValue(i)} className="text-neutral-600 hover:text-red-400 transition-colors">×</button>
                                            </span>
                                        ))}
                                    </div>
                                    
                                    <div className="flex gap-2">
                                        <input type="text" value={newValue} onChange={e => setNewValue(e.target.value)} 
                                            onKeyPress={e => e.key === 'Enter' && addValue()}
                                            placeholder="Authentic, Fast, Bold..."
                                            className="flex-1 bg-black/40 border border-[#222] rounded-xl px-4 py-2 text-xs text-neutral-400" />
                                        <button onClick={addValue} className="p-2 rounded-xl bg-neutral-800 text-white hover:bg-neutral-700 transition-colors">
                                            <Zap size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Commercial Bridge Section */}
                        <div className="bg-gradient-to-br from-indigo-900/20 to-purple-900/20 border border-indigo-500/10 rounded-[32px] p-8 flex items-center gap-8 relative overflow-hidden">
                            <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-500/10 blur-[60px] rounded-full" />
                            <div className="w-16 h-16 rounded-[22px] bg-indigo-600 flex items-center justify-center shrink-0 shadow-2xl shadow-indigo-500/30">
                                <Layout size={32} className="text-white" />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-lg font-black text-white flex items-center gap-2">
                                    Commercial Logic Sync <span className="text-[8px] bg-indigo-500 text-white px-2 py-0.5 rounded-full uppercase tracking-tighter">Enterprise</span>
                                </h3>
                                <p className="text-xs text-neutral-400 mt-2 leading-relaxed max-w-2xl">
                                    This Brand Identity automatically propagates to every caption, video script, and prompt generated by the AI Hub. Save the identity to update all scheduled content across the high-CPM network.
                                </p>
                            </div>
                            <div className="flex flex-col gap-2 shrink-0">
                                <div className="text-[10px] font-mono text-emerald-400 flex items-center gap-2">
                                    <Zap size={10} /> Latency: 42ms
                                </div>
                                <div className="text-[10px] font-mono text-cyan-400 flex items-center gap-2">
                                    <CloudRain size={10} /> Sync: Enabled
                                </div>
                            </div>
                        </div>

                    </div>
                )}
            </div>
        </div>
    );
}
