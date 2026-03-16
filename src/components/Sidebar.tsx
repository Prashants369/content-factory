'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    Activity, Users, Camera, ListVideo, Network, Zap, Play, RefreshCw,
    Loader2, Sparkles, Users2, Fingerprint, TrendingUp, DollarSign,
    Brain, Bolt, Globe, ArrowUpRight, ChevronRight, Clock, BarChart3,
    Target, Flame, AlertCircle, Clapperboard, Smartphone, Radar, Settings, ChevronLeft, Layout, Palette
} from 'lucide-react';

interface SidebarStats {
    models: number;
    readyPosts: number;
}

export default function Sidebar() {
    const pathname = usePathname();
    const [isCollapsed, setIsCollapsed] = useState(true);
    const [stats, setStats] = useState<SidebarStats>({ models: 0, readyPosts: 0 });

    useEffect(() => {
        const load = async () => {
            try {
                const [infRes, postRes] = await Promise.allSettled([
                    fetch('/api/influencers').then(r => r.ok ? r.json() : []),
                    fetch('/api/content/generate').then(r => r.ok ? r.json() : []),
                ]);
                const infs = infRes.status === 'fulfilled' ? infRes.value : [];
                const posts = postRes.status === 'fulfilled' ? postRes.value : [];
                const postList = Array.isArray(posts) ? posts : (posts?.posts ?? []);
                setStats({
                    models: Array.isArray(infs) ? infs.length : 0,
                    readyPosts: Array.isArray(postList) ? postList.filter((p: any) => p?.status === 'Ready').length : 0,
                });
            } catch { /* swallow */ }
        };
        load();
    }, []);

    const links = [
        {
            href: '/', label: 'Dashboard', icon: Activity,
            color: 'text-slate-400',
            activeColor: 'text-white',
            activeBg: 'bg-white/[0.06]',
        },
        {
            href: '/character', label: 'DNA Editor', icon: Fingerprint,
            color: 'text-amber-500/70',
            activeColor: 'text-amber-400',
            activeBg: 'bg-amber-500/10',
        },
        {
            href: '/models', label: 'Image Library', icon: Camera,
            color: 'text-violet-500/70',
            activeColor: 'text-violet-400',
            activeBg: 'bg-violet-500/10',
        },
        {
            href: '/brand', label: 'Brand Hub', icon: Palette,
            color: 'text-amber-500/70',
            activeColor: 'text-amber-400',
            activeBg: 'bg-amber-500/10',
        },

        {
            href: '/studio', label: 'Cinema Studio', icon: Clapperboard,
            color: 'text-blue-500/70',
            activeColor: 'text-blue-400',
            activeBg: 'bg-blue-500/10',
        },
        {
            href: '/influencers', label: 'Roster', icon: Users,
            badge: stats.models > 0 ? stats.models : undefined,
            color: 'text-cyan-500/70',
            activeColor: 'text-cyan-400',
            activeBg: 'bg-cyan-500/10',
        },
        {
            href: '/queue', label: 'Image Pipeline', icon: ListVideo,
            badge: stats.readyPosts > 0 ? stats.readyPosts : undefined,
            badgeColor: 'bg-emerald-500',
            color: 'text-emerald-500/70',
            activeColor: 'text-emerald-400',
            activeBg: 'bg-emerald-500/10',
        },
        {
            href: '/workflows', label: 'n8n Flows', icon: Network,
            color: 'text-neutral-500/70',
            activeColor: 'text-neutral-300',
            activeBg: 'bg-white/[0.05]',
        },
        {
            href: '/platforms', label: 'Platforms', icon: Smartphone,
            color: 'text-pink-500/70',
            activeColor: 'text-pink-400',
            activeBg: 'bg-pink-500/10',
        },
        {
            href: '/radar', label: 'Trend Radar', icon: Radar,
            color: 'text-emerald-500/70',
            activeColor: 'text-emerald-400',
            activeBg: 'bg-emerald-500/10',
        },
        {
            href: '/cloud-sync', label: 'Cloud Bridge', icon: Globe,
            color: 'text-blue-500/70',
            activeColor: 'text-blue-400',
            activeBg: 'bg-blue-500/10',
        },
        {
            href: '/analytics', label: 'Analytics', icon: TrendingUp,
            color: 'text-amber-500/70',
            activeColor: 'text-amber-400',
            activeBg: 'bg-amber-500/10',
        },
        {
            href: '/settings', label: 'API Vault', icon: Settings,
            color: 'text-violet-500/50',
            activeColor: 'text-violet-300',
            activeBg: 'bg-violet-500/10',
        },
    ];

    return (
        <div className={`${isCollapsed ? 'w-16' : 'w-56'} h-screen border-r border-[#1a1a1a] bg-[#080808] z-50 flex flex-col transition-all duration-300 relative shrink-0`}>
            {/* Toggle */}
            <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="absolute -right-3 top-6 bg-[#141414] border border-[#2a2a2a] rounded-full p-1 hover:bg-[#1e1e1e] text-neutral-600 hover:text-neutral-300 z-50 transition-colors"
            >
                {isCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
            </button>

            {/* Logo */}
            <div className={`p-4 border-b border-[#1a1a1a] flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} h-[57px]`}>
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center shrink-0 shadow-lg shadow-violet-500/20">
                    <Zap className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
                </div>
                {!isCollapsed && (
                    <div className="overflow-hidden">
                        <div className="font-black text-xs tracking-[0.15em] text-neutral-200 uppercase whitespace-nowrap">Factory.OS</div>
                        <div className="text-[8px] text-neutral-700 whitespace-nowrap tracking-widest font-mono uppercase">AI Influencer Engine</div>
                    </div>
                )}
            </div>

            {/* Nav */}
            <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto overflow-x-hidden">
                {links.map(link => {
                    const isActive = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
                    const Icon = link.icon;

                    return (
                        <Link
                            key={link.href}
                            href={link.href}
                            title={isCollapsed ? link.label : ''}
                            className={`relative flex items-center px-3 py-2.5 rounded-xl transition-all duration-200 text-xs font-medium
                                ${isActive ? `${link.activeBg} ${link.activeColor}` : `text-neutral-600 hover:bg-white/[0.03] hover:${link.color}`}
                                ${isCollapsed ? 'justify-center' : 'gap-3'}
                            `}
                        >
                            <Icon className={`w-[16px] h-[16px] shrink-0 transition-colors ${isActive ? link.activeColor : link.color}`} />
                            {!isCollapsed && (
                                <>
                                    <span className="whitespace-nowrap overflow-hidden flex-1">{link.label}</span>
                                    {link.badge !== undefined && (
                                        <span className={`text-[8px] font-mono font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center
                                            ${link.badgeColor ? `${link.badgeColor} text-white` : 'bg-[#1e1e1e] border border-[#2a2a2a] text-neutral-500'}`}>
                                            {link.badge}
                                        </span>
                                    )}
                                </>
                            )}
                            {isCollapsed && link.badge !== undefined && (
                                <span className={`absolute -top-0.5 -right-0.5 text-[7px] font-black min-w-[14px] h-[14px] flex items-center justify-center rounded-full
                                    ${link.badgeColor ? `${link.badgeColor} text-white` : 'bg-neutral-700 text-neutral-400'}`}>
                                    {link.badge}
                                </span>
                            )}
                        </Link>
                    );
                })}
            </nav>

            {/* Live Status */}
            <div className={`border-t border-[#1a1a1a] p-3 ${isCollapsed ? 'flex justify-center' : ''}`}>
                {isCollapsed ? (
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="System Operational" />
                ) : (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[8px] text-neutral-700 uppercase font-bold tracking-widest">Status</span>
                            <span className="text-[8px] text-emerald-500 flex items-center gap-1 font-mono">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                                Operational
                            </span>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                            <div className="bg-[#111] border border-[#1e1e1e] rounded-lg p-2 text-center">
                                <div className="text-sm font-black font-mono text-violet-400">{stats.models}</div>
                                <div className="text-[7px] text-neutral-700 uppercase">Models</div>
                            </div>
                            <div className="bg-[#111] border border-[#1e1e1e] rounded-lg p-2 text-center">
                                <div className="text-sm font-black font-mono text-emerald-400">{stats.readyPosts}</div>
                                <div className="text-[7px] text-neutral-700 uppercase">Ready</div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
