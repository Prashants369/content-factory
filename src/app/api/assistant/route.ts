import { NextResponse } from 'next/server';

const GEMINI_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

export async function POST(req: Request) {
    if (!GEMINI_KEY) {
        return NextResponse.json({ error: 'GEMINI_API_KEY not set in .env.local' }, { status: 503 });
    }

    const { message, context } = await req.json();

    const systemPrompt = `You are an expert AI Influencer strategist and creative director embedded inside an AI Influencer Factory platform.

Your role:
- Help design compelling AI influencer characters (DNA, aesthetics, niches)
- Rewrite and improve ComfyUI image generation prompts for photorealistic results
- Plan 30-day content calendars for any influencer
- Analyze viral potential and suggest improvements  
- Debug workflow issues (n8n, ComfyUI, Ollama errors)
- Suggest trending niches and character concepts for Instagram

Platform context:
- Uses ComfyUI + Flux Klein 9B for image generation (cfg=1.0, no negative prompts for Flux)
- Ollama local LLMs for DNA generation (qwen3 series)
- n8n for workflow automation
- Target market: India (no TikTok), Instagram + Pinterest + YouTube
- Characters are saved as JSON "DNA" with full biometric, personality, and style profiles

${context ? `Current context:\n${context}` : ''}

Be concise, specific, and actionable. Use bullet points liberally. 
When writing ComfyUI prompts, use this Flux-optimized format:
"photo of [ethnicity] [gender], [age], [description], [lighting], [camera], [quality tags]"`;

    try {
        const res = await fetch(`${GEMINI_URL}?key=${GEMINI_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: `${systemPrompt}\n\nUser: ${message}` }] }],
                generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
            })
        });

        if (!res.ok) {
            const err = await res.json();
            return NextResponse.json({ error: err.error?.message || 'Gemini API error' }, { status: res.status });
        }

        const json = await res.json();
        const reply = json.candidates?.[0]?.content?.parts?.[0]?.text || 'No response from Gemini.';
        return NextResponse.json({ reply });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
