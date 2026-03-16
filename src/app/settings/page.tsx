'use client';
import { useState, useEffect, useCallback } from 'react';
import {
    Key, Eye, EyeOff, CheckCircle2, XCircle, Loader2,
    ExternalLink, ChevronDown, ChevronUp, Save, RefreshCw,
    Bot, Instagram, Youtube, Globe, Cpu, Cloud, Zap, AlertTriangle,
    Image as ImageIcon, MessageSquare, Lock
} from 'lucide-react';

// ── Credential definition ──────────────────────────────────────────────────
interface CredDef {
    key: string;
    label: string;
    placeholder?: string;
    hint?: string;
    guide?: { step: string; url?: string }[];
    testFn?: (val: string) => Promise<{ ok: boolean; detail: string }>;
}

interface CredGroup {
    id: string;
    title: string;
    icon: any;
    color: string;
    description: string;
    creds: CredDef[];
}

// ── Validator helpers ──────────────────────────────────────────────────────
async function testGemini(key: string) {
    try {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        if (r.ok) { const d = await r.json(); return { ok: true, detail: `✓ ${d.models?.length ?? '?'} models available` }; }
        return { ok: false, detail: `✗ HTTP ${r.status} — check key` };
    } catch { return { ok: false, detail: '✗ Network error' }; }
}

async function testMetaToken(token: string) {
    try {
        const r = await fetch(`https://graph.facebook.com/me?access_token=${token}&fields=name,id`);
        if (r.ok) { const d = await r.json(); return { ok: true, detail: `✓ Authenticated as ${d.name}` }; }
        return { ok: false, detail: '✗ Invalid or expired token' };
    } catch { return { ok: false, detail: '✗ Network error' }; }
}

async function testLocalUrl(url: string, path = '') {
    try {
        const r = await fetch(`/api/integrations/ping?url=${encodeURIComponent(url + path)}`, { signal: AbortSignal.timeout(3000) });
        const d = await r.json();
        return d.ok ? { ok: true, detail: `✓ Online (${d.latency ?? '?'}ms)` } : { ok: false, detail: '✗ Not reachable' };
    } catch { return { ok: false, detail: '✗ Not reachable' }; }
}

async function testYouTubeKey(key: string) {
    try {
        const r = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=test&maxResults=1&key=${key}`);
        if (r.ok) return { ok: true, detail: '✓ YouTube API key valid' };
        return { ok: false, detail: '✗ Invalid key' };
    } catch { return { ok: false, detail: '✗ Network error' }; }
}

async function testExaKey(key: string) {
    try {
        const r = await fetch('https://api.exa.ai/search', {
            method: 'POST',
            headers: { 'x-api-key': key, 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: 'test', numResults: 1 }),
        });
        return r.ok ? { ok: true, detail: '✓ Exa AI key valid' } : { ok: false, detail: '✗ Invalid key' };
    } catch { return { ok: false, detail: '✗ Network error' }; }
}

// ── Credential groups ──────────────────────────────────────────────────────
const GROUPS: CredGroup[] = [
    {
        id: 'ai_core', title: 'AI Core', icon: Bot, color: 'violet',
        description: 'Primary LLM and agent engine connections.',
        creds: [
            {
                key: 'GEMINI_API_KEY', label: 'Google Gemini API Key',
                placeholder: 'AIza...',
                hint: 'Used for character DNA generation, content writing, and the AI assistant.',
                guide: [
                    { step: 'Go to Google AI Studio', url: 'https://aistudio.google.com/app/apikey' },
                    { step: 'Click "Create API Key"' },
                    { step: 'Copy the key and paste it here' },
                ],
                testFn: testGemini,
            },
            {
                key: 'AGENT_ENGINE_URL', label: 'Python Agent Engine URL',
                placeholder: process.env.NEXT_PUBLIC_AGENT_ENGINE_URL || 'http://localhost:8787',
                hint: 'The FastAPI server URL for the Python agent engine. Default: http://localhost:8787',
                testFn: (url) => testLocalUrl(url, '/health'),
            },
        ],
    },
    {
        id: 'services', title: 'Local Services', icon: Cpu, color: 'amber',
        description: 'ComfyUI, n8n, and Ollama connection URLs and launch paths.',
        creds: [
            {
                key: 'COMFYUI_URL', label: 'ComfyUI URL',
                placeholder: process.env.NEXT_PUBLIC_COMFYUI_URL || 'http://127.0.0.1:8188',
                testFn: (url) => testLocalUrl(url, '/system_stats'),
            },
            {
                key: 'COMFYUI_BAT_GPU', label: 'ComfyUI GPU Launch Script (.bat)',
                placeholder: 'C:\\ComfyUI_windows_portable\\run_nvidia_gpu.bat',
                hint: 'Full path to the GPU .bat file. Used by the one-click launcher.',
            },
            {
                key: 'COMFYUI_BAT_CPU', label: 'ComfyUI CPU Launch Script (.bat)',
                placeholder: 'C:\\ComfyUI_windows_portable\\run_cpu.bat',
                hint: 'Full path to the CPU fallback .bat file.',
            },
            {
                key: 'N8N_WEBHOOK_URL', label: 'n8n Base URL',
                placeholder: process.env.NEXT_PUBLIC_N8N_URL || 'http://localhost:5678',
                testFn: (url) => testLocalUrl(url, '/healthz'),
            },
            {
                key: 'N8N_DIR', label: 'n8n Project Directory',
                placeholder: 'z:\\n8n',
                hint: 'Folder where n8n is installed. Used by the one-click launcher.',
            },
            {
                key: 'OLLAMA_URL', label: 'Ollama URL',
                placeholder: process.env.NEXT_PUBLIC_OLLAMA_URL || 'http://127.0.0.1:11434',
                testFn: (url) => testLocalUrl(url, '/api/tags'),
            },
        ],
    },
    {
        id: 'instagram', title: 'Instagram / Meta', icon: Instagram, color: 'pink',
        description: 'Required for auto-posting to Instagram and pulling analytics.',
        creds: [
            {
                key: 'META_APP_ID', label: 'Meta App ID',
                placeholder: '1234567890',
                guide: [
                    { step: 'Go to Meta for Developers', url: 'https://developers.facebook.com/apps' },
                    { step: 'Create a new app → Select "Business" type' },
                    { step: 'Copy the App ID from dashboard' },
                ],
            },
            {
                key: 'META_APP_SECRET', label: 'Meta App Secret',
                placeholder: 'abc123...',
                hint: 'Found in App Settings → Basic. Keep this secret.',
            },
            {
                key: 'META_USER_ACCESS_TOKEN', label: 'Meta User Access Token (Long-lived)',
                placeholder: 'EAA...',
                hint: 'Long-lived token (~60 days). Generated via Graph API Explorer.',
                guide: [
                    { step: 'Go to Graph API Explorer', url: 'https://developers.facebook.com/tools/explorer' },
                    { step: 'Select your app, click "Generate Access Token"' },
                    { step: 'Grant instagram_basic, instagram_content_publish, pages_show_list permissions' },
                    { step: 'Exchange for long-lived token via: GET /oauth/access_token?grant_type=fb_exchange_token' },
                ],
                testFn: testMetaToken,
            },
            {
                key: 'FB_PAGE_ID', label: 'Facebook Page ID',
                placeholder: '109876543210',
                guide: [
                    { step: 'Go to your Facebook Page' },
                    { step: 'Click About → scroll down to find Page ID' },
                ],
            },
            {
                key: 'IG_BUSINESS_ACCOUNT_ID', label: 'Instagram Business Account ID',
                placeholder: '17841400000000000',
                guide: [
                    { step: 'Call: GET /{fb-page-id}?fields=instagram_business_account&access_token={token}', url: 'https://developers.facebook.com/tools/explorer' },
                    { step: 'Copy the id from instagram_business_account object' },
                ],
            },
        ],
    },
    {
        id: 'tiktok', title: 'TikTok', icon: Zap, color: 'cyan',
        description: 'For auto-publishing Reels/TikToks and trend research.',
        creds: [
            {
                key: 'TIKTOK_CLIENT_KEY', label: 'TikTok Client Key (App ID)',
                placeholder: 'awxxxxxxxxxx',
                guide: [
                    { step: 'Go to TikTok for Developers', url: 'https://developers.tiktok.com/apps' },
                    { step: 'Create app → Enable "Login Kit" and "Content Posting API"' },
                    { step: 'Copy Client Key from app dashboard' },
                ],
            },
            {
                key: 'TIKTOK_CLIENT_SECRET', label: 'TikTok Client Secret',
                placeholder: '...',
                hint: 'Keep this secret. Found alongside Client Key in your TikTok app settings.',
            },
            {
                key: 'TIKTOK_ACCESS_TOKEN', label: 'TikTok Access Token',
                placeholder: 'act.xxx...',
                hint: 'Generated via TikTok OAuth flow. Connect from the Platforms page.',
            },
        ],
    },
    {
        id: 'youtube', title: 'YouTube', icon: Youtube, color: 'red',
        description: 'For YouTube Shorts publishing and trend research via YouTube Data API.',
        creds: [
            {
                key: 'YOUTUBE_API_KEY', label: 'YouTube Data API v3 Key',
                placeholder: 'AIza...',
                guide: [
                    { step: 'Go to Google Cloud Console', url: 'https://console.cloud.google.com' },
                    { step: 'Enable "YouTube Data API v3"' },
                    { step: 'Create Credentials → API Key → Restrict to YouTube Data API' },
                ],
                testFn: testYouTubeKey,
            },
            {
                key: 'YOUTUBE_CLIENT_ID', label: 'YouTube OAuth Client ID',
                placeholder: '*.apps.googleusercontent.com',
                hint: 'Required for uploads. Create OAuth 2.0 credentials in Google Cloud Console.',
            },
        ],
    },
    {
        id: 'pinterest', title: 'Pinterest', icon: ImageIcon, color: 'red',
        description: 'For auto-publishing Pins and Boards.',
        creds: [
            {
                key: 'PINTEREST_APP_ID', label: 'Pinterest App ID',
                placeholder: '14325...',
                guide: [
                    { step: 'Go to Pinterest for Developers', url: 'https://developers.pinterest.com/apps/' },
                    { step: 'Create a new app and copy the App ID.' },
                ],
            },
            {
                key: 'PINTEREST_APP_SECRET', label: 'Pinterest App Secret',
                placeholder: '...',
                hint: 'Found in your Pinterest app settings.',
            },
            {
                key: 'PINTEREST_ACCESS_TOKEN', label: 'Pinterest Access Token',
                placeholder: 'pina_...',
                hint: 'Generated via OAuth flow or developer sandbox.',
            },
        ],
    },
    {
        id: 'cloud_bridge', title: 'Cloud Bridge (Ghost Publisher)', icon: Cloud, color: 'orange',
        description: 'For offline posting via Cloudflare Workers.',
        creds: [
            {
                key: 'CLOUDFLARE_WORKER_URL', label: 'Cloudflare Worker URL',
                placeholder: 'https://factory-ghost-publisher.youruser.workers.dev',
                guide: [
                    { step: 'Deploy the worker via `npx wrangler deploy` in the cloud_worker dir.' },
                    { step: 'Copy the assigned workers.dev URL.' },
                ],
                testFn: (url) => testLocalUrl(url), // Re-using standard ping
            },
        ],
    },
    {
        id: 'reddit', title: 'Reddit', icon: MessageSquare, color: 'amber',
        description: 'For auto-publishing to subreddits and trend research.',
        creds: [
            {
                key: 'REDDIT_CLIENT_ID', label: 'Reddit Client ID',
                placeholder: '...',
                guide: [
                    { step: 'Go to Reddit App Preferences', url: 'https://www.reddit.com/prefs/apps' },
                    { step: 'Create a new script app.' },
                ],
            },
            {
                key: 'REDDIT_CLIENT_SECRET', label: 'Reddit Client Secret',
                placeholder: '...',
            },
            {
                key: 'REDDIT_USERNAME', label: 'Reddit Username',
                placeholder: 'u/...',
            },
            {
                key: 'REDDIT_PASSWORD', label: 'Reddit Password',
                placeholder: '...',
            },
        ],
    },
    {
        id: 'onlyfans', title: 'OnlyFans', icon: Lock, color: 'cyan',
        description: 'For auto-publishing, messaging, and account management.',
        creds: [
            {
                key: 'ONLYFANS_AUTH_ID', label: 'Auth ID',
                placeholder: '...',
                hint: 'Found in your browser cookies/local storage.',
            },
            {
                key: 'ONLYFANS_SESS', label: 'Sess Token',
                placeholder: '...',
                hint: 'Found in your browser cookies.',
            },
            {
                key: 'ONLYFANS_USER_AGENT', label: 'User Agent',
                placeholder: 'Mozilla/5.0...',
            },
            {
                key: 'ONLYFANS_X_BC', label: 'X-BC Header',
                placeholder: '...',
                hint: 'Required signature header found in network requests.',
            },
        ],
    },
    {
        id: 'research', title: 'Research & Cloud', icon: Globe, color: 'emerald',
        description: 'APIs used by the Scout Agent for trend research and offline posting.',
        creds: [
            {
                key: 'EXA_API_KEY', label: 'Exa AI API Key',
                placeholder: 'exa-...',
                guide: [
                    { step: 'Go to Exa.ai', url: 'https://exa.ai' },
                    { step: 'Sign up → API Keys → Create new key' },
                    { step: 'Used by n8n trend mining workflow for real-time web search' },
                ],
                testFn: testExaKey,
            },
            {
                key: 'CLOUDFLARE_API_TOKEN', label: 'Cloudflare API Token',
                placeholder: '...',
                hint: 'Used for the offline cloud bridge (posts fire when your PC is off).',
                guide: [
                    { step: 'Go to Cloudflare Dashboard', url: 'https://dash.cloudflare.com/profile/api-tokens' },
                    { step: 'Create Token → Use "Edit Cloudflare Workers" template' },
                    { step: 'This powers the offline post scheduler' },
                ],
            },
            {
                key: 'CLOUDFLARE_ACCOUNT_ID', label: 'Cloudflare Account ID',
                placeholder: 'abc123...',
                hint: 'Found in the right sidebar of any Cloudflare dashboard page.',
            },
        ],
    },
];

const COLOR_MAP: Record<string, { text: string; bg: string; border: string; icon: string }> = {
    violet: { text: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20', icon: 'text-violet-400' },
    amber: { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: 'text-amber-400' },
    pink: { text: 'text-pink-400', bg: 'bg-pink-500/10', border: 'border-pink-500/20', icon: 'text-pink-400' },
    cyan: { text: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', icon: 'text-cyan-400' },
    red: { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', icon: 'text-red-400' },
    emerald: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: 'text-emerald-400' },
};

// ── Single credential row ──────────────────────────────────────────────────
function CredRow({ def, initialSet }: { def: CredDef; initialSet: boolean }) {
    const [value, setValue] = useState('');
    const [visible, setVisible] = useState(false);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ ok: boolean; detail: string } | null>(null);
    const [guideOpen, setGuideOpen] = useState(false);
    const [isSet, setIsSet] = useState(initialSet);

    const save = async () => {
        if (!value.trim()) return;
        setSaving(true);
        try {
            await fetch('/api/credentials', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: def.key, value: value.trim() }),
            });
            setIsSet(true);
            setValue('');
        } finally { setSaving(false); }
    };

    const test = async () => {
        if (!def.testFn) return;
        setTesting(true);
        setTestResult(null);
        try {
            const result = await def.testFn(value.trim() || '{{saved}}');
            setTestResult(result);
        } finally { setTesting(false); }
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <label className="text-[10px] font-bold text-neutral-400">{def.label}</label>
                    {isSet
                        ? <span className="flex items-center gap-1 text-[8px] text-emerald-400 font-mono"><CheckCircle2 size={9} /> SET</span>
                        : <span className="flex items-center gap-1 text-[8px] text-red-500 font-mono"><XCircle size={9} /> MISSING</span>
                    }
                </div>
                {def.guide && (
                    <button onClick={() => setGuideOpen(o => !o)}
                        className="flex items-center gap-1 text-[8px] text-neutral-600 hover:text-neutral-400 transition-colors">
                        How to get this {guideOpen ? <ChevronUp size={8} /> : <ChevronDown size={8} />}
                    </button>
                )}
            </div>

            {guideOpen && def.guide && (
                <div className="p-3 rounded-xl bg-[#0d0d0d] border border-[#1e1e1e] space-y-1.5">
                    {def.guide.map((g, i) => (
                        <div key={i} className="flex items-start gap-2">
                            <span className="text-[8px] text-neutral-700 font-mono font-bold mt-0.5 shrink-0">{i + 1}.</span>
                            <span className="text-[9px] text-neutral-500">{g.step}</span>
                            {g.url && (
                                <a href={g.url} target="_blank" rel="noreferrer"
                                    className="ml-auto shrink-0 flex items-center gap-0.5 text-[8px] text-violet-400 hover:text-violet-300">
                                    <ExternalLink size={8} /> Open
                                </a>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {def.hint && !guideOpen && (
                <p className="text-[8px] text-neutral-700">{def.hint}</p>
            )}

            <div className="flex gap-2">
                <div className="relative flex-1">
                    <input
                        type={visible ? 'text' : 'password'}
                        value={value}
                        onChange={e => setValue(e.target.value)}
                        placeholder={def.placeholder ?? 'Enter value...'}
                        onKeyDown={e => e.key === 'Enter' && save()}
                        className="w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg px-3 py-2 pr-8 text-[11px] text-neutral-300 outline-none font-mono focus:border-[#3a3a3a] placeholder:text-neutral-800"
                    />
                    <button onClick={() => setVisible(v => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-700 hover:text-neutral-400 transition-colors">
                        {visible ? <EyeOff size={12} /> : <Eye size={12} />}
                    </button>
                </div>
                <button onClick={save} disabled={!value.trim() || saving}
                    className="flex items-center gap-1 px-3 py-2 rounded-lg bg-violet-700 hover:bg-violet-600 disabled:opacity-40 text-white text-[10px] font-bold transition-colors shrink-0">
                    {saving ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />}
                    {saving ? '' : 'Save'}
                </button>
                {def.testFn && (
                    <button onClick={test} disabled={testing}
                        className="flex items-center gap-1 px-3 py-2 rounded-lg border border-[#2a2a2a] hover:bg-[#1a1a1a] disabled:opacity-40 text-neutral-500 hover:text-neutral-300 text-[10px] transition-colors shrink-0">
                        {testing ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
                        {testing ? '' : 'Test'}
                    </button>
                )}
            </div>

            {testResult && (
                <div className={`text-[10px] font-mono px-3 py-2 rounded-lg border ${testResult.ok
                    ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400'
                    : 'bg-red-500/5 border-red-500/20 text-red-400'}`}>
                    {testResult.detail}
                </div>
            )}
        </div>
    );
}

// ── Group Card ─────────────────────────────────────────────────────────────
function GroupCard({ group, statuses }: { group: CredGroup; statuses: Record<string, boolean> }) {
    const [open, setOpen] = useState(false);
    const c = COLOR_MAP[group.color];
    const Icon = group.icon;
    const setCount = group.creds.filter(cr => statuses[cr.key]).length;
    const total = group.creds.length;
    const allSet = setCount === total;
    const noneSet = setCount === 0;

    return (
        <div className={`border rounded-2xl overflow-hidden ${allSet ? `${c.border} ${c.bg}` : 'border-[#1e1e1e] bg-[#0c0c0c]'}`}>
            <button onClick={() => setOpen(o => !o)}
                className="w-full flex items-center justify-between px-5 py-4 text-left">
                <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${allSet ? c.bg : 'bg-[#141414]'}`}>
                        <Icon className={`w-5 h-5 ${allSet ? c.icon : 'text-neutral-700'}`} />
                    </div>
                    <div>
                        <div className="font-bold text-sm text-neutral-200">{group.title}</div>
                        <div className="text-[9px] text-neutral-600 mt-0.5">{group.description}</div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className={`flex items-center gap-1.5 text-[9px] font-mono font-bold px-2 py-1 rounded-full border
                        ${allSet ? `${c.text} ${c.bg} ${c.border}`
                            : noneSet ? 'text-red-400 bg-red-500/5 border-red-500/20'
                                : 'text-amber-400 bg-amber-500/5 border-amber-500/20'}`}>
                        {allSet ? <CheckCircle2 size={9} /> : noneSet ? <XCircle size={9} /> : <AlertTriangle size={9} />}
                        {setCount}/{total}
                    </div>
                    {open ? <ChevronUp size={14} className="text-neutral-600" /> : <ChevronDown size={14} className="text-neutral-600" />}
                </div>
            </button>

            {open && (
                <div className="px-5 pb-5 space-y-5 border-t border-[#1a1a1a] pt-4">
                    {group.creds.map(cr => (
                        <CredRow key={cr.key} def={cr} initialSet={!!statuses[cr.key]} />
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function SettingsPage() {
    const [statuses, setStatuses] = useState<Record<string, boolean>>({});
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const r = await fetch('/api/credentials');
            if (!r.ok) { setStatuses({}); return; }
            const data = await r.json();
            const s: Record<string, boolean> = {};
            if (data && typeof data === 'object') {
                for (const [k, v] of Object.entries(data as any)) {
                    s[k] = (v as any)?.set ?? false;
                }
            }
            setStatuses(s);
        } catch {
            setStatuses({});
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const totalSet = Object.values(statuses).filter(Boolean).length;
    const totalKeys = GROUPS.reduce((a, g) => a + g.creds.length, 0);
    const readiness = Math.round((totalSet / totalKeys) * 100);

    return (
        <div className="h-full overflow-y-auto bg-[#080808] text-neutral-300">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e1e1e] bg-[#0a0a0a] sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <Key size={16} className="text-violet-400" />
                    <span className="font-bold text-sm tracking-widest uppercase">API Vault</span>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 font-mono">
                        {totalSet}/{totalKeys} configured
                    </span>
                </div>
                <button onClick={load} disabled={loading}
                    className="flex items-center gap-1.5 text-[10px] px-3 py-1.5 rounded-lg border border-[#2a2a2a] hover:bg-[#1a1a1a] text-neutral-500 transition-colors">
                    <RefreshCw size={10} className={loading ? 'animate-spin' : ''} /> Refresh
                </button>
            </div>

            {/* Readiness bar */}
            <div className="px-6 py-4 border-b border-[#1a1a1a] bg-[#090909]">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-[9px] text-neutral-600 uppercase font-bold tracking-widest">Factory Readiness</span>
                    <span className={`text-[10px] font-mono font-black ${readiness >= 80 ? 'text-emerald-400' : readiness >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                        {readiness}%
                    </span>
                </div>
                <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-500 ${readiness >= 80 ? 'bg-emerald-500' : readiness >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${readiness}%` }}
                    />
                </div>
                <p className="text-[8px] text-neutral-700 mt-2">
                    All credentials are saved to SQLite and automatically synced to .env.local for the Python agent engine.
                </p>
            </div>

            {/* Groups */}
            <div className="p-6 space-y-4 max-w-3xl mx-auto pb-16">
                {loading ? (
                    <div className="flex items-center justify-center h-48">
                        <Loader2 className="animate-spin text-violet-500" size={24} />
                    </div>
                ) : (
                    GROUPS.map(g => <GroupCard key={g.id} group={g} statuses={statuses} />)
                )}
            </div>
        </div>
    );
}
