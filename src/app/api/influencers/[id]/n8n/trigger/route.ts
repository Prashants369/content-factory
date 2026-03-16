import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!db) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
    }

    const { id } = await params;

    const influencer = db.prepare(`SELECT id, name, niche, dna_json FROM influencers WHERE id = ?`).get(id) as any;
    if (!influencer) return NextResponse.json({ error: 'Influencer not found' }, { status: 404 });

    const dna = influencer.dna_json ? JSON.parse(influencer.dna_json) : null;
    if (!dna) return NextResponse.json({ error: 'Missing DNA data for this influencer' }, { status: 400 });

    const n8nUrl = process.env.N8N_WEBHOOK_IDEAS_URL || 'http://localhost:5678/webhook/generate-ideas';

    try {
      const res = await fetch(n8nUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          influencer_id: influencer.id,
          name: influencer.name,
          niche: influencer.niche,
          dna: dna
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        return NextResponse.json({
          error: `n8n returned ${res.status}`,
          message: 'n8n workflow responded with an error.',
        }, { status: res.status });
      }

      return NextResponse.json({ success: true, message: 'n8n workflow triggered successfully.' });
    } catch (fetchErr: any) {
      return NextResponse.json({
        error: 'n8n offline',
        message: `Cannot reach n8n at ${n8nUrl}. Make sure n8n is running.`,
      }, { status: 503 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 });
  }
}
