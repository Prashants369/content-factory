import { NextResponse } from 'next/server';
import db from '@/lib/db';

// GET — Get single influencer with images, stats, recent posts
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    if (!db) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
    }

    const influencer = db.prepare(`
      SELECT id, name, niche, lookbook_prompt, dna_json,
             avatar_image_path, generated_image_path, image_status, created_at
      FROM influencers WHERE id = ?
    `).get(id) as any;

    if (!influencer) {
      return NextResponse.json({ error: 'Influencer not found' }, { status: 404 });
    }

    // Get all images for this influencer
    const images = db.prepare(`
      SELECT id, image_path, image_type, angle, expression, prompt_used, 
             workflow_used, is_avatar, created_at
      FROM influencer_images
      WHERE influencer_id = ?
      ORDER BY created_at DESC
    `).all(id);

    // Get post stats
    const postStats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'Posted' THEN 1 ELSE 0 END) as posted,
        SUM(CASE WHEN status = 'Ready' THEN 1 ELSE 0 END) as ready,
        SUM(CASE WHEN status = 'Image_Gen' THEN 1 ELSE 0 END) as generating,
        SUM(CASE WHEN status = 'Idea' THEN 1 ELSE 0 END) as ideas
      FROM posts WHERE influencer_id = ?
    `).get(id) as any;

    // Get recent posts
    const recentPosts = db.prepare(`
      SELECT id, post_date, viral_hook, caption, media_path, status, image_prompt
      FROM posts
      WHERE influencer_id = ?
      ORDER BY post_date DESC
      LIMIT 20
    `).all(id);

    return NextResponse.json({
      ...influencer,
      images,
      postStats: postStats || { total: 0, posted: 0, ready: 0, generating: 0, ideas: 0 },
      recentPosts,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 });
  }
}

// PUT — Full update of influencer fields
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    if (!db) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const existing = db.prepare('SELECT id FROM influencers WHERE id = ?').get(id);
    if (!existing) {
      return NextResponse.json({ error: 'Influencer not found' }, { status: 404 });
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (body.name !== undefined) { updates.push('name = ?'); values.push(body.name); }
    if (body.niche !== undefined) { updates.push('niche = ?'); values.push(body.niche); }
    if (body.lookbook_prompt !== undefined) { updates.push('lookbook_prompt = ?'); values.push(body.lookbook_prompt); }
    if (body.dna_json !== undefined) { updates.push('dna_json = ?'); values.push(typeof body.dna_json === 'string' ? body.dna_json : JSON.stringify(body.dna_json)); }
    if (body.avatar_image_path !== undefined) { updates.push('avatar_image_path = ?'); values.push(body.avatar_image_path); }
    if (body.generated_image_path !== undefined) { updates.push('generated_image_path = ?'); values.push(body.generated_image_path); }
    if (body.image_status !== undefined) { updates.push('image_status = ?'); values.push(body.image_status); }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    values.push(id);
    db.prepare(`UPDATE influencers SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    return NextResponse.json({ success: true, id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 });
  }
}

// PATCH — Partial update (kept for backwards compat)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    if (!db) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const existing = db.prepare('SELECT id FROM influencers WHERE id = ?').get(id);
    if (!existing) {
      return NextResponse.json({ error: 'Influencer not found' }, { status: 404 });
    }

    if (body.avatar_image_path !== undefined) {
      db.prepare('UPDATE influencers SET avatar_image_path = ? WHERE id = ?').run(body.avatar_image_path, id);
    }
    if (body.name !== undefined) {
      db.prepare('UPDATE influencers SET name = ? WHERE id = ?').run(body.name, id);
    }
    if (body.dna_json !== undefined) {
      const val = typeof body.dna_json === 'string' ? body.dna_json : JSON.stringify(body.dna_json);
      db.prepare('UPDATE influencers SET dna_json = ? WHERE id = ?').run(val, id);
    }
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 });
  }
}

// DELETE — Remove an influencer and all related data
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    if (!db) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
    }

    const existing = db.prepare('SELECT id FROM influencers WHERE id = ?').get(id);
    if (!existing) {
      return NextResponse.json({ error: 'Influencer not found' }, { status: 404 });
    }

    // Delete related records first (foreign keys)
    const tables = ['comfyui_jobs', 'influencer_images', 'posts', 'brand_kits', 'platform_accounts', 'influencer_memory'];
    for (const table of tables) {
      try { db.prepare(`DELETE FROM ${table} WHERE influencer_id = ?`).run(id); } catch { /* table may not exist */ }
    }

    // Delete the influencer
    db.prepare('DELETE FROM influencers WHERE id = ?').run(id);

    return NextResponse.json({ success: true, deleted: id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 });
  }
}
