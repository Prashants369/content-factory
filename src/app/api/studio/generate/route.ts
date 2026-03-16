import { NextResponse } from 'next/server';

const OLLAMA_URL = (process.env.OLLAMA_URL || 'http://127.0.0.1:11434') + '/api/generate';

function buildNameFromNiche(niche: string): string {
  const words = niche.trim().split(' ');
  const adjectives = ['Nova', 'Neon', 'Chrome', 'Axe', 'Rex', 'Lyra', 'Kira', 'Zara', 'Vex', 'Lore', 'Flux'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const base = words[words.length - 1] || 'Entity';
  return adj + ' ' + base.charAt(0).toUpperCase() + base.slice(1);
}

function buildComfyPrompt(niche: string, description: string): string {
  const desc = description.substring(0, 120);
  return `RAW photo, photorealistic portrait of a synthetic AI influencer, ${niche} aesthetic, ${desc}, studio lighting, 35mm lens, 8k resolution, cinematic lighting, hyperrealistic, masterpiece, sharp focus`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || !body.niche) {
      return NextResponse.json({ error: 'niche is required' }, { status: 400 });
    }

    const { niche, provider, modelName } = body;

    let parsedData: any = null;

    if (provider === 'ollama' || !provider) {
      try {
        const ollamaRes = await fetch(OLLAMA_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: modelName || 'qwen3:1.7b',
            prompt: `Describe a fictional ${niche} AI influencer character. Include their name, appearance, and personality in 3-5 sentences. Be creative.`,
            stream: false,
            options: { num_predict: 300, temperature: 0.8 }
          }),
          signal: AbortSignal.timeout(30000),
        });

        if (!ollamaRes.ok) {
          return NextResponse.json({
            error: 'Ollama unavailable',
            message: `Cannot reach Ollama at ${OLLAMA_URL}. Make sure Ollama is running.`,
          }, { status: 503 });
        }

        const ollamaData = await ollamaRes.json();
        const prose = (ollamaData.response || '').trim();

        let generatedName = buildNameFromNiche(niche);
        const nameMatch = prose.match(/(?:named?|called?|known as)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
        if (nameMatch) generatedName = nameMatch[1];

        parsedData = {
          name: generatedName,
          niche: niche,
          physical_description: prose,
          comfy_prompt_base: buildComfyPrompt(niche, prose),
        };
      } catch (fetchErr: any) {
        return NextResponse.json({
          error: 'Ollama connection failed',
          message: `Cannot reach Ollama at ${OLLAMA_URL}. ${fetchErr.message}`,
        }, { status: 503 });
      }
    } else {
      return NextResponse.json({ error: `Unsupported provider: ${provider}` }, { status: 400 });
    }

    return NextResponse.json(parsedData);
  } catch (error: any) {
    console.error('Studio Generate Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
