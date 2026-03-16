import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
  try {
    if (!db) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
    }

    const workflows = db.prepare('SELECT * FROM custom_workflows ORDER BY created_at DESC').all();
    return NextResponse.json(workflows);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    if (!db) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { name, description, base_template, config_json } = body;
    let { id } = body;

    if (!name || !base_template || !config_json) {
      return NextResponse.json({ error: 'name, base_template, and config_json are required' }, { status: 400 });
    }

    if (!id) {
      id = name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now();
    }

    db.prepare(`
      INSERT INTO custom_workflows (id, name, description, base_template, config_json)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET 
        name = excluded.name,
        description = excluded.description,
        base_template = excluded.base_template,
        config_json = excluded.config_json
    `).run(id, name, description || null, base_template, typeof config_json === 'string' ? config_json : JSON.stringify(config_json));

    return NextResponse.json({ success: true, id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 });
  }
}
