import { NextResponse } from 'next/server';
import db from '@/lib/db';

// GET — List all influencers
export async function GET() {
  try {
    if (!db) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
    }

    const influencers = db.prepare(`
      SELECT id, name, niche, lookbook_prompt, dna_json, 
             avatar_image_path, generated_image_path, image_status, created_at
      FROM influencers 
      ORDER BY created_at DESC
    `).all();

    return NextResponse.json(influencers);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 });
  }
}

// POST — Create a new influencer
export async function POST(req: Request) {
  try {
    if (!db) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const id = 'dna_' + Date.now() + Math.floor(Math.random() * 1000);
    db.prepare('INSERT INTO influencers (id, name, niche, lookbook_prompt, dna_json) VALUES (?, ?, ?, ?, ?)')
      .run(
        id,
        body.name,
        body.niche || 'Uncategorized',
        body.comfy_prompt_base || body.lookbook_prompt || null,
        body.dna_json ? (typeof body.dna_json === 'string' ? body.dna_json : JSON.stringify(body.dna_json)) : null
      );
    return NextResponse.json({ success: true, id }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
