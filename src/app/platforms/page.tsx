'use client';
import { useState, useEffect, useCallback } from 'react';
import {
    Smartphone, CheckCircle2, XCircle, AlertTriangle, RefreshCw,
    ExternalLink, Loader2, LogOut, Users, Clock, Key, Globe,
    Image as ImageIcon, MessageSquare, Lock
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────
interface IGAccount {
    id: string; username: string; name: string;
    followers_count: number; profile_picture_url: string;
    token_expiry_days: number;
}

interface PlatformState {
    connected: boolean;
    loading: boolean;
    validating: boolean;
    error?: string;
    account?: IGAccount;
}

// ── Instagram Section ──────────────────────────────────────────────────────
function InstagramSection() {
    const [token, setToken] = useState('');
    const [appId, setAppId] = useState('');
    const [appSecret, setAppSecret] = useState('');
    const [pageId, setPageId] = useState('');
    const [igId, setIgId] = useState('');
    const [state, setState] = useState<PlatformState>({ connected: false, loading: true, validating: false });

    const loadSaved = useCallback(async () => {
        setState(s => ({ ...s, loading: true }));
        try {
            const r = await fetch('/api/credentials');
            if (!r.ok) { setState(s => ({ ...s, loading: false })); return; }
            const data = await r.json();
            if (data?.META_USER_ACCESS_TOKEN?.set) {
                await validate(null, true);
            }
            if (data?.META_APP_ID?.set) setAppId('••••••••');
            if (data?.META_APP_SECRET?.set) setAppSecret('••••••••');
            if (data?.FB_PAGE_ID?.set) setPageId('••••••••');
            if (data?.IG_BUSINESS_ACCOUNT_ID?.set) setIgId('••••••••');
        } catch {
            // silently fail
        } finally { setState(s => ({ ...s, loading: false })); }
    }, []);

    const validate = async (e?: any, silent = false) => {
        if (!silent) setState(s => ({ ...s, validating: true, error: undefined }));
        try {
            // Use token from input or the saved one
            const useToken = token || '__saved__';
            const r = await fetch('/api/platforms/instagram/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: useToken }),
            });
            const data = await r.json();
            if (data.ok) {
                setState(s => ({ ...s, connected: true, validating: false, loading: false, account: data.account, error: undefined }));
            } else {
                setState(s => ({ ...s, connected: false, validating: false, loading: false, error: data.error }));
            }
        } catch {
            setState(s => ({ ...s, connected: false, validating: false, loading: false, error: 'Network error' }));
        }
    };

    const saveAll = async () => {
        const saves: Promise<any>[] = [];
        const pushSave = (key: string, val: string) => {
            if (val && !val.startsWith('•')) {
                saves.push(fetch('/api/credentials', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key, value: val }),
                }));
            }
        };
        pushSave('META_USER_ACCESS_TOKEN', token);
        pushSave('META_APP_ID', appId);
        pushSave('META_APP_SECRET', appSecret);
        pushSave('FB_PAGE_ID', pageId);
        pushSave('IG_BUSINESS_ACCOUNT_ID', igId);
        await Promise.all(saves);
        await validate();
    };

    useEffect(() => { loadSaved(); }, [loadSaved]);

    const { account } = state;

    return (
        <div className="bg-[#0c0c0c] border border-[#1e1e1e] rounded-2xl overflow-hidden">
            {/* Header */}
            <div className={`flex items-center justify-between px-5 py-4 border-b border-[#1a1a1a] ${state.connected ? 'bg-pink-500/5' : ''}`}>
                <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${state.connected ? 'bg-pink-500/15' : 'bg-[#141414]'}`}>
                        <Smartphone className={`w-5 h-5 ${state.connected ? 'text-pink-400' : 'text-neutral-700'}`} />
                    </div>
                    <div>
                        <div className="font-bold text-sm text-neutral-200">Instagram / Meta</div>
                        <div className="text-[9px] text-neutral-600">Auto-posting + Analytics</div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {state.loading ? <Loader2 size={14} className="animate-spin text-neutral-600" />
                        : state.connected
                            ? <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /><span className="text-[9px] text-emerald-400 font-mono">CONNECTED</span></div>
                            : <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500" /><span className="text-[9px] text-red-400 font-mono">NOT CONNECTED</span></div>
                    }
                </div>
            </div>

            {/* Connected account card */}
            {state.connected && account && (
                <div className="px-5 py-4 border-b border-[#1a1a1a] bg-pink-500/3">
                    <div className="flex items-center gap-3">
                        {account.profile_picture_url
                            ? <img src={account.profile_picture_url} className="w-10 h-10 rounded-full border border-pink-500/20" alt={account.username} />
                            : <div className="w-10 h-10 rounded-full bg-pink-500/10 border border-pink-500/20 flex items-center justify-center"><Smartphone size={16} className="text-pink-400" /></div>
                        }
                        <div>
                            <div className="font-bold text-sm text-neutral-100">@{account.username}</div>
                            <div className="text-[9px] text-neutral-500">{account.name}</div>
                        </div>
                        <div className="ml-auto flex items-center gap-4">
                            <div className="text-center">
                                <div className="text-sm font-black font-mono text-pink-400">{account.followers_count?.toLocaleString()}</div>
                                <div className="text-[7px] text-neutral-700 uppercase">Followers</div>
                            </div>
                            <div className={`text-center ${account.token_expiry_days < 10 ? 'text-red-400' : account.token_expiry_days < 20 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                <div className="text-sm font-black font-mono">{account.token_expiry_days}d</div>
                                <div className="text-[7px] text-neutral-700 uppercase">Token Expiry</div>
                            </div>
                        </div>
                    </div>
                    {account.token_expiry_days < 15 && (
                        <div className="mt-3 flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/20">
                            <AlertTriangle size={12} className="text-amber-400 shrink-0" />
                            <span className="text-[9px] text-amber-400">Token expires in {account.token_expiry_days} days. Refresh it soon.</span>
                        </div>
                    )}
                </div>
            )}

            {/* Credentials form */}
            <div className="px-5 py-4 space-y-3">
                {state.error && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/5 border border-red-500/20">
                        <XCircle size={12} className="text-red-400 shrink-0" />
                        <span className="text-[10px] text-red-400">{state.error}</span>
                    </div>
                )}

                <div>
                    <label className="text-[8px] font-bold uppercase tracking-widest text-neutral-700 mb-1 block">User Access Token (Long-lived)</label>
                    <input type="password" value={token} onChange={e => setToken(e.target.value)}
                        placeholder="EAASTn... (paste your token)"
                        className="w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs text-neutral-300 outline-none font-mono focus:border-[#3a3a3a]" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-[8px] font-bold uppercase tracking-widest text-neutral-700 mb-1 block">Meta App ID</label>
                        <input value={appId} onChange={e => setAppId(e.target.value)} placeholder="12345..."
                            className="w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs text-neutral-300 outline-none font-mono" />
                    </div>
                    <div>
                        <label className="text-[8px] font-bold uppercase tracking-widest text-neutral-700 mb-1 block">Meta App Secret</label>
                        <input type="password" value={appSecret} onChange={e => setAppSecret(e.target.value)} placeholder="abc123..."
                            className="w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs text-neutral-300 outline-none font-mono" />
                    </div>
                    <div>
                        <label className="text-[8px] font-bold uppercase tracking-widest text-neutral-700 mb-1 block">Facebook Page ID</label>
                        <input value={pageId} onChange={e => setPageId(e.target.value)} placeholder="109876..."
                            className="w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs text-neutral-300 outline-none font-mono" />
                    </div>
                    <div>
                        <label className="text-[8px] font-bold uppercase tracking-widest text-neutral-700 mb-1 block">IG Business Account ID</label>
                        <input value={igId} onChange={e => setIgId(e.target.value)} placeholder="17841400..."
                            className="w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs text-neutral-300 outline-none font-mono" />
                    </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                    <button onClick={saveAll} disabled={state.validating}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-pink-700/80 hover:bg-pink-600 text-white text-[10px] font-bold transition-colors disabled:opacity-40">
                        {state.validating ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle2 size={10} />}
                        {state.validating ? 'Validating...' : 'Save & Validate'}
                    </button>
                    <a href="https://developers.facebook.com/tools/explorer" target="_blank" rel="noreferrer"
                        className="flex items-center gap-1 text-[9px] text-neutral-600 hover:text-neutral-400 transition-colors">
                        <ExternalLink size={9} /> Graph API Explorer
                    </a>
                    <a href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer"
                        className="flex items-center gap-1 text-[9px] text-neutral-600 hover:text-neutral-400 transition-colors">
                        <ExternalLink size={9} /> Meta App Dashboard
                    </a>
                </div>
            </div>
        </div>
    );
}

// ── TikTok Section ─────────────────────────────────────────────────────────
function TikTokSection() {
    const [clientKey, setClientKey] = useState('');
    const [clientSecret, setClientSecret] = useState('');
    const [connected, setConnected] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        fetch('/api/credentials').then(r => r.ok ? r.json() : ({} as Record<string, any>)).then(data => {
            if (data?.TIKTOK_ACCESS_TOKEN?.set) setConnected(true);
            if (data?.TIKTOK_CLIENT_KEY?.set) setClientKey('••••••••');
            if (data?.TIKTOK_CLIENT_SECRET?.set) setClientSecret('••••••••');
        }).catch(() => {});
    }, []);

    const saveKeys = async () => {
        const saves: Promise<any>[] = [];
        if (clientKey && !clientKey.startsWith('•')) saves.push(fetch('/api/credentials', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'TIKTOK_CLIENT_KEY', value: clientKey }) }));
        if (clientSecret && !clientSecret.startsWith('•')) saves.push(fetch('/api/credentials', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'TIKTOK_CLIENT_SECRET', value: clientSecret }) }));
        await Promise.all(saves);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    return (
        <div className="bg-[#0c0c0c] border border-[#1e1e1e] rounded-2xl overflow-hidden">
            <div className={`flex items-center justify-between px-5 py-4 border-b border-[#1a1a1a] ${connected ? 'bg-cyan-500/5' : ''}`}>
                <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${connected ? 'bg-cyan-500/15' : 'bg-[#141414]'}`}>
                        <Globe className={`w-5 h-5 ${connected ? 'text-cyan-400' : 'text-neutral-700'}`} />
                    </div>
                    <div>
                        <div className="font-bold text-sm text-neutral-200">TikTok</div>
                        <div className="text-[9px] text-neutral-600">Auto-posting Shorts + trend research</div>
                    </div>
                </div>
                <div className={`flex items-center gap-1.5 text-[9px] font-mono ${connected ? 'text-emerald-400' : 'text-neutral-600'}`}>
                    {connected ? <><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />CONNECTED</> : <><div className="w-2 h-2 rounded-full bg-neutral-700" />NOT CONNECTED</>}
                </div>
            </div>
            <div className="px-5 py-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-[8px] font-bold uppercase tracking-widest text-neutral-700 mb-1 block">Client Key</label>
                        <input value={clientKey} onChange={e => setClientKey(e.target.value)} placeholder="awxxxxxxxxxx"
                            className="w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs text-neutral-300 outline-none font-mono" />
                    </div>
                    <div>
                        <label className="text-[8px] font-bold uppercase tracking-widest text-neutral-700 mb-1 block">Client Secret</label>
                        <input type="password" value={clientSecret} onChange={e => setClientSecret(e.target.value)} placeholder="..."
                            className="w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs text-neutral-300 outline-none font-mono" />
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={saveKeys}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-700/80 hover:bg-cyan-600 text-white text-[10px] font-bold transition-colors">
                        {saved ? <CheckCircle2 size={10} /> : <Key size={10} />} {saved ? 'Saved!' : 'Save Keys'}
                    </button>
                    <a href="https://developers.tiktok.com/apps" target="_blank" rel="noreferrer"
                        className="flex items-center gap-1 text-[9px] text-neutral-600 hover:text-neutral-400 transition-colors">
                        <ExternalLink size={9} /> TikTok Developer Console
                    </a>
                </div>
                <div className="p-3 rounded-xl bg-[#0d0d0d] border border-[#1a1a1a]">
                    <p className="text-[8px] font-bold text-neutral-600 uppercase tracking-widest mb-2">OAuth Flow (Coming Soon)</p>
                    <p className="text-[9px] text-neutral-700">After saving your keys, the OAuth connect button will generate an access token automatically. For now, paste a token from TikTok API sandbox.</p>
                </div>
            </div>
        </div>
    );
}

// ── YouTube Section ────────────────────────────────────────────────────────
function YouTubeSection() {
    const [apiKey, setApiKey] = useState('');
    const [testResult, setTestResult] = useState<{ ok: boolean; detail: string } | null>(null);
    const [testing, setTesting] = useState(false);
    const [saved, setSaved] = useState(false);
    const [isSet, setIsSet] = useState(false);

    useEffect(() => {
        fetch('/api/credentials').then(r => r.ok ? r.json() : ({} as Record<string, any>)).then(data => {
            if (data?.YOUTUBE_API_KEY?.set) setIsSet(true);
        }).catch(() => {});
    }, []);

    const save = async () => {
        if (!apiKey.trim()) return;
        await fetch('/api/credentials', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'YOUTUBE_API_KEY', value: apiKey }) });
        setIsSet(true); setSaved(true); setTimeout(() => setSaved(false), 2000);
    };

    const test = async () => {
        setTesting(true); setTestResult(null);
        try {
            const r = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=ai+influencer&maxResults=1&key=${apiKey}`);
            if (r.ok) setTestResult({ ok: true, detail: '✓ YouTube API key is valid' });
            else setTestResult({ ok: false, detail: `✗ HTTP ${r.status} — check key or quota` });
        } catch { setTestResult({ ok: false, detail: '✗ Network error' }); }
        finally { setTesting(false); }
    };

    return (
        <div className="bg-[#0c0c0c] border border-[#1e1e1e] rounded-2xl overflow-hidden">
            <div className={`flex items-center justify-between px-5 py-4 border-b border-[#1a1a1a] ${isSet ? 'bg-red-500/5' : ''}`}>
                <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${isSet ? 'bg-red-500/15' : 'bg-[#141414]'}`}>
                        <Globe className={`w-5 h-5 ${isSet ? 'text-red-400' : 'text-neutral-700'}`} />
                    </div>
                    <div>
                        <div className="font-bold text-sm text-neutral-200">YouTube</div>
                        <div className="text-[9px] text-neutral-600">YouTube Shorts + trend research via Data API</div>
                    </div>
                </div>
                <div className={`flex items-center gap-1.5 text-[9px] font-mono ${isSet ? 'text-emerald-400' : 'text-neutral-600'}`}>
                    {isSet ? <><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />KEY SET</> : <><div className="w-2 h-2 rounded-full bg-neutral-700" />NOT SET</>}
                </div>
            </div>
            <div className="px-5 py-4 space-y-3">
                <div>
                    <label className="text-[8px] font-bold uppercase tracking-widest text-neutral-700 mb-1 block">YouTube Data API v3 Key</label>
                    <input value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="AIza..."
                        className="w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs text-neutral-300 outline-none font-mono" />
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={save} disabled={!apiKey.trim()}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-700/80 hover:bg-red-600 disabled:opacity-40 text-white text-[10px] font-bold transition-colors">
                        {saved ? <CheckCircle2 size={10} /> : <Key size={10} />} {saved ? 'Saved!' : 'Save Key'}
                    </button>
                    <button onClick={test} disabled={!apiKey.trim() || testing}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#2a2a2a] hover:bg-[#1a1a1a] disabled:opacity-40 text-[10px] text-neutral-500 transition-colors">
                        {testing ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />} Test
                    </button>
                    <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer"
                        className="flex items-center gap-1 text-[9px] text-neutral-600 hover:text-neutral-400 transition-colors">
                        <ExternalLink size={9} /> Google Cloud Console
                    </a>
                </div>
                {testResult && (
                    <div className={`text-[10px] font-mono px-3 py-2 rounded-lg border ${testResult.ok ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' : 'bg-red-500/5 border-red-500/20 text-red-400'}`}>
                        {testResult.detail}
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Pinterest Section ──────────────────────────────────────────────────────
function PinterestSection() {
    const [connected, setConnected] = useState(false);
    useEffect(() => {
        fetch('/api/credentials').then(r => r.ok ? r.json() : ({} as Record<string, any>)).then(data => {
            if (data?.PINTEREST_ACCESS_TOKEN?.set) setConnected(true);
        }).catch(() => {});
    }, []);

    return (
        <div className="bg-[#0c0c0c] border border-[#1e1e1e] rounded-2xl overflow-hidden">
            <div className={`flex items-center justify-between px-5 py-4 ${connected ? 'bg-red-500/5' : ''}`}>
                <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${connected ? 'bg-red-500/15' : 'bg-[#141414]'}`}>
                        <ImageIcon className={`w-5 h-5 ${connected ? 'text-red-400' : 'text-neutral-700'}`} />
                    </div>
                    <div>
                        <div className="font-bold text-sm text-neutral-200">Pinterest</div>
                        <div className="text-[9px] text-neutral-600">Auto-pinning and broad reach</div>
                    </div>
                </div>
                <div className={`flex items-center gap-1.5 text-[9px] font-mono ${connected ? 'text-emerald-400' : 'text-neutral-600'}`}>
                    {connected ? <><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />CONNECTED</> : <><div className="w-2 h-2 rounded-full bg-neutral-700" />NOT CONNECTED</>}
                </div>
            </div>
            {!connected && (
                <div className="px-5 pb-5">
                    <div className="p-3 rounded-xl bg-[#0d0d0d] border border-[#1a1a1a]">
                        <p className="text-[8px] font-bold text-neutral-600 uppercase tracking-widest mb-2">OAuth Setup</p>
                        <p className="text-[9px] text-neutral-700 mb-2">Configure this integration in the Settings &gt; API Vault first.</p>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Reddit Section ─────────────────────────────────────────────────────────
function RedditSection() {
    const [connected, setConnected] = useState(false);
    useEffect(() => {
        fetch('/api/credentials').then(r => r.ok ? r.json() : ({} as Record<string, any>)).then(data => {
            if (data.REDDIT_CLIENT_ID?.set && data.REDDIT_USERNAME?.set) setConnected(true);
        });
    }, []);

    return (
        <div className="bg-[#0c0c0c] border border-[#1e1e1e] rounded-2xl overflow-hidden">
            <div className={`flex items-center justify-between px-5 py-4 ${connected ? 'bg-amber-500/5' : ''}`}>
                <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${connected ? 'bg-amber-500/15' : 'bg-[#141414]'}`}>
                        <MessageSquare className={`w-5 h-5 ${connected ? 'text-amber-400' : 'text-neutral-700'}`} />
                    </div>
                    <div>
                        <div className="font-bold text-sm text-neutral-200">Reddit</div>
                        <div className="text-[9px] text-neutral-600">Subreddit promotion and trend research</div>
                    </div>
                </div>
                <div className={`flex items-center gap-1.5 text-[9px] font-mono ${connected ? 'text-emerald-400' : 'text-neutral-600'}`}>
                    {connected ? <><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />CONFIGURED</> : <><div className="w-2 h-2 rounded-full bg-neutral-700" />NOT CONFIGURED</>}
                </div>
            </div>
            {!connected && (
                <div className="px-5 pb-5">
                    <div className="p-3 rounded-xl bg-[#0d0d0d] border border-[#1a1a1a]">
                        <p className="text-[9px] text-neutral-700">Go to Settings &gt; API Vault to configure your Reddit integration credentials.</p>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── OnlyFans Section ───────────────────────────────────────────────────────
function OnlyFansSection() {
    const [connected, setConnected] = useState(false);
    useEffect(() => {
        fetch('/api/credentials').then(r => r.ok ? r.json() : ({} as Record<string, any>)).then(data => {
            if (data.ONLYFANS_AUTH_ID?.set && data.ONLYFANS_SESS?.set) setConnected(true);
        });
    }, []);

    return (
        <div className="bg-[#0c0c0c] border border-[#1e1e1e] rounded-2xl overflow-hidden">
            <div className={`flex items-center justify-between px-5 py-4 ${connected ? 'bg-cyan-500/5' : ''}`}>
                <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${connected ? 'bg-cyan-500/15' : 'bg-[#141414]'}`}>
                        <Lock className={`w-5 h-5 ${connected ? 'text-cyan-400' : 'text-neutral-700'}`} />
                    </div>
                    <div>
                        <div className="font-bold text-sm text-neutral-200">OnlyFans</div>
                        <div className="text-[9px] text-neutral-600">Monetization, messaging, auto-publishing</div>
                    </div>
                </div>
                <div className={`flex items-center gap-1.5 text-[9px] font-mono ${connected ? 'text-emerald-400' : 'text-neutral-600'}`}>
                    {connected ? <><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />CONFIGURED</> : <><div className="w-2 h-2 rounded-full bg-neutral-700" />NOT CONFIGURED</>}
                </div>
            </div>
            {!connected && (
                <div className="px-5 pb-5">
                    <div className="p-3 rounded-xl bg-[#0d0d0d] border border-[#1a1a1a]">
                        <p className="text-[9px] text-neutral-700">Go to Settings &gt; API Vault to set up your OF authentication tokens.</p>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function PlatformsPage() {
    return (
        <div className="h-full overflow-y-auto bg-[#080808] text-neutral-300">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-[#1e1e1e] bg-[#0a0a0a] sticky top-0 z-10">
                <Smartphone size={16} className="text-pink-400" />
                <span className="font-bold text-sm tracking-widest uppercase">Platform Connect</span>
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-400 font-mono">Social Accounts</span>
            </div>
            <div className="p-6 space-y-4 max-w-3xl mx-auto pb-16">
                <p className="text-[10px] text-neutral-600">
                    Connect your social accounts. Tokens are stored encrypted in SQLite and used by the Publisher Agent for automatic posting.
                </p>
                <InstagramSection />
                <TikTokSection />
                <YouTubeSection />
                <PinterestSection />
                <RedditSection />
                <OnlyFansSection />
            </div>
        </div>
    );
}
