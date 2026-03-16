import { NextResponse } from 'next/server';
import db from '@/lib/db';

// GET — get all platform accounts for an influencer
export async function GET(req: Request) {
  try {
    if (!db) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
    }

    const { searchParams } = new URL(req.url);
    const influencerId = searchParams.get('influencer_id');
    if (!influencerId) return NextResponse.json({ error: 'influencer_id required' }, { status: 400 });

    const accounts = db.prepare('SELECT * FROM platform_accounts WHERE influencer_id = ?').all(influencerId);
    return NextResponse.json({ accounts });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 });
  }
}

// POST — add or update a platform account
export async function POST(req: Request) {
  try {
    if (!db) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { influencer_id, platform, account_name, account_id, access_token, ig_business_account_id, fb_page_id } = body;
    if (!influencer_id || !platform) {
      return NextResponse.json({ error: 'influencer_id and platform required' }, { status: 400 });
    }

    const id = 'acc_' + Date.now();
    const existing = db.prepare('SELECT id FROM platform_accounts WHERE influencer_id = ? AND platform = ?').get(influencer_id, platform) as any;

    if (existing) {
      db.prepare(`
        UPDATE platform_accounts SET
          account_name = ?, account_id = ?, access_token = ?,
          ig_business_account_id = ?, fb_page_id = ?, enabled = 1
        WHERE id = ?
      `).run(account_name || null, account_id || null, access_token || null, ig_business_account_id || null, fb_page_id || null, existing.id);
      return NextResponse.json({ success: true, id: existing.id, updated: true });
    } else {
      db.prepare(`
        INSERT INTO platform_accounts (id, influencer_id, platform, account_name, account_id, access_token, ig_business_account_id, fb_page_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, influencer_id, platform, account_name || null, account_id || null, access_token || null, ig_business_account_id || null, fb_page_id || null);
      return NextResponse.json({ success: true, id });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 });
  }
}

// DELETE — remove a platform account
export async function DELETE(req: Request) {
  try {
    if (!db) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
    }

    const body = await req.json().catch(() => null);
    if (!body || !body.id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    db.prepare('DELETE FROM platform_accounts WHERE id = ?').run(body.id);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 });
  }
}
