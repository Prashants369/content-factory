'use client';
import { useState, useRef, useEffect } from 'react';
import { Sparkles, X, Send, Loader2, Bot, ChevronDown, Minimize2, Maximize2, Copy, Check } from 'lucide-react';

interface Message { role: 'user' | 'assistant'; text: string; }

const QUICK_ACTIONS = [
    { label: '✍️ Improve prompt', msg: 'Improve this ComfyUI prompt for Flux Klein 9B to get a more photorealistic result.' },
    { label: '📅 Content calendar', msg: 'Create a 30-day Instagram content calendar for this influencer.' },
    { label: '🔥 Viral analysis', msg: 'Analyze this character\'s viral potential and give me 5 specific improvements.' },
    { label: '🎭 Suggest niches', msg: 'Suggest 5 trending AI influencer niches for the India market that have high CPM potential.' },
    { label: '🔧 Fix glitch', msg: 'My generated image looks glitchy/deformed. What ComfyUI settings and prompt changes will fix this?' },
];

export default function AIAssistant({ context }: { context?: string }) {
    const [open, setOpen] = useState(false);
    const [minimized, setMinimized] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        { role: 'assistant', text: '👋 I\'m your AI Influencer strategist. Ask me anything — character concepts, ComfyUI prompts, content strategy, or workflow fixes.' }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState<number | null>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const hasKey = true; // optimistic — API will tell us if key is missing

    useEffect(() => {
        if (open && !minimized) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, open, minimized]);

    const send = async (text: string) => {
        if (!text.trim() || loading) return;
        const userMsg = text.trim();
        setInput('');
        setMessages(m => [...m, { role: 'user', text: userMsg }]);
        setLoading(true);

        try {
            const res = await fetch('/api/assistant', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userMsg, context })
            });
            const j = await res.json();
            setMessages(m => [...m, {
                role: 'assistant',
                text: j.reply || j.error || 'Something went wrong.'
            }]);
        } catch (e: any) {
            setMessages(m => [...m, { role: 'assistant', text: '⚠️ Network error: ' + e.message }]);
        } finally {
            setLoading(false);
        }
    };

    const copyMsg = (idx: number, text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(idx);
        setTimeout(() => setCopied(null), 2000);
    };

    if (!open) {
        return (
            <button
                onClick={() => setOpen(true)}
                className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-gradient-to-br from-violet-600 to-purple-700 hover:from-violet-500 hover:to-purple-600 shadow-lg shadow-violet-900/50 flex items-center justify-center transition-all hover:scale-110 active:scale-95 group"
                title="AI Assistant (Gemini)"
            >
                <Sparkles size={20} className="text-white group-hover:animate-pulse" />
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#0a0a0a]" />
            </button>
        );
    }

    return (
        <div className={`fixed bottom-6 right-6 z-50 flex flex-col shadow-2xl shadow-black/60 rounded-2xl border border-[#2a2a2a] bg-[#0d0d0d] transition-all duration-200 ${minimized ? 'h-12 w-72' : 'w-80 h-[520px] md:w-96 md:h-[580px]'}`}>

            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1e1e1e] rounded-t-2xl bg-gradient-to-r from-violet-600/10 to-purple-600/5 flex-shrink-0">
                <Bot size={14} className="text-violet-400" />
                <span className="text-xs font-bold text-neutral-200 flex-1">AI Strategist</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-400 font-mono">Gemini</span>
                <button onClick={() => setMinimized(m => !m)} className="text-neutral-600 hover:text-neutral-400 transition-colors ml-1">
                    {minimized ? <Maximize2 size={12} /> : <Minimize2 size={12} />}
                </button>
                <button onClick={() => setOpen(false)} className="text-neutral-600 hover:text-red-400 transition-colors">
                    <X size={12} />
                </button>
            </div>

            {!minimized && (
                <>
                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-hide">
                        {messages.map((m, i) => (
                            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`group relative max-w-[85%] rounded-xl px-3 py-2 text-[11px] leading-relaxed whitespace-pre-wrap ${m.role === 'user'
                                        ? 'bg-violet-600/30 text-neutral-200 rounded-br-sm border border-violet-500/20'
                                        : 'bg-[#141414] text-neutral-300 rounded-bl-sm border border-[#1e1e1e]'
                                    }`}>
                                    {m.text}
                                    {m.role === 'assistant' && (
                                        <button
                                            onClick={() => copyMsg(i, m.text)}
                                            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity text-neutral-700 hover:text-neutral-400"
                                        >
                                            {copied === i ? <Check size={9} className="text-emerald-400" /> : <Copy size={9} />}
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className="flex justify-start">
                                <div className="bg-[#141414] border border-[#1e1e1e] rounded-xl rounded-bl-sm px-3 py-2">
                                    <Loader2 size={12} className="animate-spin text-violet-400" />
                                </div>
                            </div>
                        )}
                        <div ref={bottomRef} />
                    </div>

                    {/* Quick actions */}
                    <div className="px-3 flex gap-1.5 overflow-x-auto scrollbar-hide pb-2 flex-shrink-0">
                        {QUICK_ACTIONS.map(a => (
                            <button
                                key={a.label}
                                onClick={() => send(a.msg)}
                                disabled={loading}
                                className="flex-shrink-0 text-[9px] px-2 py-1 rounded-full border border-[#2a2a2a] text-neutral-500 hover:text-violet-400 hover:border-violet-500/30 transition-colors whitespace-nowrap disabled:opacity-40"
                            >
                                {a.label}
                            </button>
                        ))}
                    </div>

                    {/* Input */}
                    <div className="flex gap-2 p-3 border-t border-[#1e1e1e] flex-shrink-0">
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
                            placeholder="Ask anything... (Enter to send)"
                            rows={2}
                            className="flex-1 bg-[#111] border border-[#2a2a2a] focus:border-violet-500/50 rounded-lg px-3 py-2 text-[11px] text-neutral-200 outline-none placeholder:text-neutral-700 resize-none transition-colors"
                        />
                        <button
                            onClick={() => send(input)}
                            disabled={!input.trim() || loading}
                            className="self-end w-8 h-8 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-30 flex items-center justify-center transition-colors flex-shrink-0"
                        >
                            <Send size={12} className="text-white" />
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
