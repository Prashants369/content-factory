import { NextResponse } from 'next/server';

const AGENT_ENGINE_URL = process.env.AGENT_ENGINE_URL || 'http://localhost:8787';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || !body.post_id) {
      return NextResponse.json({ error: 'post_id required' }, { status: 400 });
    }

    const { post_id } = body;
    const apiKey = process.env.INTERNAL_API_KEY || '';

    try {
      const response = await fetch(`${AGENT_ENGINE_URL}/agents/post`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        },
        body: JSON.stringify({ post_id }),
        signal: AbortSignal.timeout(15000),
      });

      const result = await response.json().catch(() => ({ error: 'Invalid response from engine' }));
      return NextResponse.json(result, { status: response.status });
    } catch (fetchErr: any) {
      return NextResponse.json({
        error: 'Agent Engine offline',
        message: `Cannot reach Agent Engine at ${AGENT_ENGINE_URL}. Start the engine to publish posts.`,
        post_id,
      }, { status: 503 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 });
  }
}
