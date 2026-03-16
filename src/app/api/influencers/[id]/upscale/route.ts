import { NextResponse } from 'next/server';
import db from '@/lib/db';
import fs from 'fs';
import path from 'path';

const COMFY_URL = process.env.COMFY_URL || 'http://127.0.0.1:8188';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!db) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
    }

    const { id } = await params;

    // Verify influencer exists
    const influencer = db.prepare('SELECT * FROM influencers WHERE id = ?').get(id) as any;
    if (!influencer) {
      return NextResponse.json({ error: 'Influencer not found' }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    if (!body || !body.image_path) {
      return NextResponse.json({ error: 'image_path is required' }, { status: 400 });
    }

    const { image_path } = body;

    // Ensure ComfyUI is reachable
    try {
      const ping = await fetch(`${COMFY_URL}/system_stats`, { signal: AbortSignal.timeout(3000) });
      if (!ping.ok) throw new Error('ComfyUI not responding');
    } catch {
      return NextResponse.json({
        error: 'ComfyUI not running at port 8188. Start ComfyUI first.',
      }, { status: 503 });
    }

    const localFilePath = path.join(process.cwd(), 'public', image_path);
    if (!fs.existsSync(localFilePath)) {
      return NextResponse.json({ error: 'Source image not found on disk' }, { status: 404 });
    }

    // Upload the image to ComfyUI's /input directory
    const imageBuffer = fs.readFileSync(localFilePath);
    const fileNameToUpload = `target_upscale_${Date.now()}.png`;

    const formData = new FormData();
    formData.append('image', new Blob([imageBuffer], { type: 'image/png' }), fileNameToUpload);

    const uploadRes = await fetch(`${COMFY_URL}/upload/image`, {
      method: 'POST',
      body: formData
    });

    if (!uploadRes.ok) {
      return NextResponse.json({ error: 'Failed to upload image to ComfyUI' }, { status: 502 });
    }
    const uploadedData = await uploadRes.json();
    const comfyFileName = uploadedData.name;

    // Build the SeedVR2 Upscale Workflow JSON
    const templatePath = path.join(process.cwd(), 'src/lib/comfy-templates/upscale-seedvr2.json');
    if (!fs.existsSync(templatePath)) {
      return NextResponse.json({ error: 'Upscale template not found' }, { status: 500 });
    }

    let workflowTemplate = fs.readFileSync(templatePath, 'utf8');

    // Replace placeholders
    workflowTemplate = workflowTemplate.replaceAll('{{IMAGE_FILENAME}}', comfyFileName);
    workflowTemplate = workflowTemplate.replaceAll('{{SEED:42}}', Math.floor(Math.random() * 1000000).toString());
    workflowTemplate = workflowTemplate.replaceAll('{{TARGET_RESOLUTION:2048}}', '2048');

    const workflow = JSON.parse(workflowTemplate);

    const queueRes = await fetch(`${COMFY_URL}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: workflow })
    });

    if (!queueRes.ok) {
      const errText = await queueRes.text().catch(() => 'Unknown error');
      return NextResponse.json({ error: `Failed to queue upscale workflow: ${errText}` }, { status: 502 });
    }

    const { prompt_id } = await queueRes.json();

    // Track job in DB with special "upscale" type so we can identify it later
    db.prepare(`INSERT INTO comfyui_jobs (prompt_id, influencer_id, image_type) VALUES (?, ?, ?)`).run(
      prompt_id, id, 'upscale_seedvr2'
    );

    return NextResponse.json({
      success: true,
      prompt_id,
      status: 'rendering'
    });

  } catch (e: any) {
    console.error("UPSCALE ERROR:", e);
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 });
  }
}
