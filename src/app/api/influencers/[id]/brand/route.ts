import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        if (!db) {
            return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
        }

        const { id } = await params;
        const brandKit = db.prepare('SELECT * FROM brand_kits WHERE influencer_id = ?').get(id);
        
        if (!brandKit) {
            // Return default/empty kit if not exists
            return NextResponse.json({
                influencer_id: id,
                primary_color: '#8b5cf6',
                secondary_color: '#06b6d4',
                font_family: 'Inter',
                voice_tone: 'Professional',
                brand_values: '[]'
            });
        }
        
        return NextResponse.json(brandKit);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        if (!db) {
            return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
        }

        const { id: influencer_id } = await params;
        const body = await req.json().catch(() => null);
        if (!body) {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }
        
        const existing = db.prepare('SELECT id FROM brand_kits WHERE influencer_id = ?').get(influencer_id) as { id: string } | undefined;
        
        if (existing) {
            db.prepare(`
                UPDATE brand_kits 
                SET primary_color = ?, secondary_color = ?, font_family = ?, 
                    voice_tone = ?, signature_catchphrase = ?, target_audience_desc = ?, 
                    brand_values = ?, logo_path = ?, updated_at = CURRENT_TIMESTAMP
                WHERE influencer_id = ?
            `).run(
                body.primary_color,
                body.secondary_color,
                body.font_family,
                body.voice_tone,
                body.signature_catchphrase,
                body.target_audience_desc,
                body.brand_values,
                body.logo_path,
                influencer_id
            );
        } else {
            const id = 'brand_' + Date.now();
            db.prepare(`
                INSERT INTO brand_kits (
                    id, influencer_id, primary_color, secondary_color, font_family, 
                    voice_tone, signature_catchphrase, target_audience_desc, brand_values, logo_path
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                id,
                influencer_id,
                body.primary_color,
                body.secondary_color,
                body.font_family,
                body.voice_tone,
                body.signature_catchphrase,
                body.target_audience_desc,
                body.brand_values,
                body.logo_path
            );
        }
        
        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
