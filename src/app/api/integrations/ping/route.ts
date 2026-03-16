import { NextResponse } from 'next/server';

// GET /api/integrations/ping?url=http://...
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get('url');
    if (!url) {
      return NextResponse.json({ ok: false, error: 'Missing url parameter' }, { status: 400 });
    }

    const start = Date.now();
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(4000) });
      return NextResponse.json({ ok: r.ok, status: r.status, latency: Date.now() - start });
    } catch (fetchErr: any) {
      return NextResponse.json({ ok: false, error: fetchErr.message, latency: Date.now() - start });
    }
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message || 'Internal server error' }, { status: 500 });
  }
}
