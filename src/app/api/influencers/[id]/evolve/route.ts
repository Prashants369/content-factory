import { NextResponse } from 'next/server';
import db from '@/lib/db';

const AGENT_ENGINE_URL = process.env.AGENT_ENGINE_URL || 'http://127.0.0.1:8787';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!db) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
    }

    const { id } = await params;

    // Verify influencer exists
    const influencer = db.prepare('SELECT id, name FROM influencers WHERE id = ?').get(id) as any;
    if (!influencer) {
      return NextResponse.json({ error: 'Influencer not found' }, { status: 404 });
    }

    // Try Agent Engine
    try {
      const res = await fetch(`${AGENT_ENGINE_URL}/agents/analyst/evolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.INTERNAL_API_KEY || ''
        },
        body: JSON.stringify({ influencer_id: id }),
        signal: AbortSignal.timeout(15000),
      });

      if (res.ok) {
        const data = await res.json();
        return NextResponse.json(data);
      }

      const errData = await res.json().catch(() => ({}));
      return NextResponse.json({
        error: errData.detail || errData.error || `Agent Engine returned ${res.status}`,
      }, { status: res.status });
    } catch (fetchErr: any) {
      return NextResponse.json({
        error: 'Agent Engine offline',
        message: `Cannot reach Agent Engine at ${AGENT_ENGINE_URL}. Start the engine to use evolution.`,
      }, { status: 503 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 });
  }
}
