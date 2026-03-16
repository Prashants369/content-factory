import { NextResponse } from 'next/server';
import db from '@/lib/db';

// POST /api/platforms/instagram/validate  body: { token }
export async function POST(req: Request) {
  try {
    if (!db) {
      return NextResponse.json({ ok: false, error: 'Database unavailable' }, { status: 503 });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ ok: false, error: 'Invalid request body' }, { status: 400 });
    }

    const { token } = body as { token: string };

    // If caller sends '__saved__', read from DB
    let useToken = token;
    if (!token || token === '__saved__') {
      const row = db.prepare("SELECT value FROM api_credentials WHERE key = 'META_USER_ACCESS_TOKEN'").get() as any;
      useToken = row?.value || process.env.META_USER_ACCESS_TOKEN || '';
    }

    if (!useToken) {
      return NextResponse.json({ ok: false, error: 'No token configured. Go to Settings to add it.' });
    }

    // Step 1: validate token & get user info
    let me: any;
    try {
      const meRes = await fetch(
        `https://graph.facebook.com/me?fields=name,id&access_token=${useToken}`,
        { signal: AbortSignal.timeout(10000) }
      );
      if (!meRes.ok) {
        const e = await meRes.json().catch(() => ({}));
        return NextResponse.json({ ok: false, error: e?.error?.message ?? `HTTP ${meRes.status}` });
      }
      me = await meRes.json();
    } catch (fetchErr: any) {
      return NextResponse.json({ ok: false, error: `Facebook API unreachable: ${fetchErr.message}` });
    }

    // Step 2: get IG business account ID from DB/env
    const igRow = db.prepare("SELECT value FROM api_credentials WHERE key = 'IG_BUSINESS_ACCOUNT_ID'").get() as any;
    const igId = igRow?.value || process.env.IG_BUSINESS_ACCOUNT_ID || '';

    let account: any = {
      id: me.id,
      username: me.name,
      name: me.name,
      followers_count: 0,
      profile_picture_url: '',
      token_expiry_days: 0,
    };

    if (igId) {
      // Step 3: pull IG profile
      try {
        const igRes = await fetch(
          `https://graph.facebook.com/v21.0/${igId}?fields=username,name,followers_count,profile_picture_url&access_token=${useToken}`,
          { signal: AbortSignal.timeout(10000) }
        );
        if (igRes.ok) {
          const igData = await igRes.json();
          account = { ...account, ...igData };
        }
      } catch { /* non-fatal */ }

      // Step 4: check token expiry
      try {
        const debugRes = await fetch(
          `https://graph.facebook.com/debug_token?input_token=${useToken}&access_token=${useToken}`,
          { signal: AbortSignal.timeout(6000) }
        );
        if (debugRes.ok) {
          const debug = await debugRes.json();
          const expiresAt: number = debug?.data?.expires_at ?? 0;
          if (expiresAt > 0) {
            account.token_expiry_days = Math.max(0, Math.floor((expiresAt * 1000 - Date.now()) / 86400000));
          } else {
            account.token_expiry_days = 99;
          }
        }
      } catch { /* non-fatal */ }
    }

    // Save the token to DB (auto-upsert)
    if (token && token !== '__saved__') {
      db.prepare(`
        INSERT INTO api_credentials (key, value, updated_at)
        VALUES ('META_USER_ACCESS_TOKEN', ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `).run(useToken);
    }

    return NextResponse.json({ ok: true, account });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || 'Internal server error' }, { status: 500 });
  }
}
