import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const OLLAMA_URL = (process.env.OLLAMA_URL || 'http://127.0.0.1:11434') + '/api/generate';

// Topological sort to determine execution order
function orderNodes(nodes: any[], edges: any[]) {
  const inDegree: Record<string, number> = {};
  const adjList: Record<string, string[]> = {};

  nodes.forEach(n => {
    inDegree[n.id] = 0;
    adjList[n.id] = [];
  });

  edges.forEach(e => {
    adjList[e.source].push(e.target);
    inDegree[e.target] = (inDegree[e.target] || 0) + 1;
  });

  const queue: string[] = [];
  nodes.forEach(n => {
    if (inDegree[n.id] === 0) queue.push(n.id);
  });

  const sorted: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    sorted.push(id);
    adjList[id].forEach(neighbor => {
      inDegree[neighbor]--;
      if (inDegree[neighbor] === 0) queue.push(neighbor);
    });
  }

  return sorted.map(id => nodes.find(n => n.id === id));
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || !Array.isArray(body.nodes) || !Array.isArray(body.edges)) {
      return NextResponse.json({ error: 'nodes and edges arrays are required' }, { status: 400 });
    }

    const { nodes, edges, comfyUrl = process.env.COMFYUI_URL || 'http://127.0.0.1:8188' } = body;

    // 1. Sort nodes topologically
    const executionOrder = orderNodes(nodes, edges);
    if (executionOrder.length !== nodes.length) {
      return NextResponse.json({ error: 'Cycle detected in workflow graph' }, { status: 400 });
    }

    const nodeOutputs: Record<string, any> = {};

    // Helper to get input data for a node
    const getInputs = (nodeId: string) => {
      const inputs: Record<string, any> = {};
      const incomingEdges = edges.filter((e: any) => e.target === nodeId);
      incomingEdges.forEach((edge: any) => {
        const sourceOutput = nodeOutputs[edge.source];
        if (sourceOutput) {
          inputs[edge.targetHandle] = sourceOutput[edge.sourceHandle] || sourceOutput.default;
        }
      });
      return inputs;
    };

    // 2. Execute nodes in order
    for (const node of executionOrder) {
      const inputs = getInputs(node.id);
      let result: any = {};

      switch (node.type) {
        case 'influencerNode':
        case 'promptNode':
          result = { text: node.data?.prompt || '' };
          break;

        case 'llmNode': {
          const systemRules = inputs['sys'] || '';
          const prompt = inputs['prompt'] || node.data?.prompt || '';
          const modelName = node.data?.model || 'qwen3:1.7b';

          try {
            const ollamaRes = await fetch(OLLAMA_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: modelName === 'gemini-1.5-pro' ? 'qwen3:1.7b' : modelName,
                prompt: systemRules ? `System: ${systemRules}\n\nUser: ${prompt}` : prompt,
                stream: false,
                options: { temperature: 0.8 }
              }),
              signal: AbortSignal.timeout(30000),
            });

            if (!ollamaRes.ok) {
              result = { response: `[Ollama Error: ${await ollamaRes.text()}]` };
            } else {
              const data = await ollamaRes.json();
              result = { response: data.response };
            }
          } catch (err: any) {
            result = { response: `[Ollama Connection Error: ${err.message}]` };
          }
          break;
        }

        case 'comfyNode': {
          const positivePrompt = inputs['prompt'] || 'A beautiful scene text';
          const negativePrompt = inputs['neg'] || 'ugly, poorly drawn, out of frame';
          const imgWidth = inputs['width'] || node.data?.width || 1024;
          const imgHeight = inputs['height'] || node.data?.height || 1024;
          const loraStrength = inputs['lora_strength'] || node.data?.loraStrength || 0.75;
          const inputImagePath = inputs['image'] || node.data?.inputImage || '';

          const TEMPLATE_MAP: Record<string, string> = {
            'flux-9b-txt2img': 'flux-9b-base-v2.json',
            'flux-9b-i2i': 'flux-9b-refine-i2i.json',
            'flux-9b-detailer': 'flux-9b-detailer-zimage.json',
            'seedvr2-upscaler': 'upscale-seedvr2.json',
          };

          try {
            const workflowId = node.data?.workflow || 'flux-9b-txt2img';
            const templateName = TEMPLATE_MAP[workflowId] || 'flux-9b-base-v2.json';
            const templatePath = path.join(process.cwd(), 'src', 'lib', 'comfy-templates', templateName);

            let rawJson = await fs.readFile(templatePath, 'utf8');

            const randomSeed = Math.floor(Math.random() * 100000000000000);
            const escPrompt = positivePrompt.replace(/"/g, '\\"');
            const escNeg = negativePrompt.replace(/"/g, '\\"');

            rawJson = rawJson.replace(/\{\{POSITIVE_PROMPT\}\}/g, escPrompt);
            rawJson = rawJson.replace(/\{\{NEGATIVE_PROMPT\}\}/g, escNeg);
            rawJson = rawJson.replace(/"\{\{WIDTH(?::(\d+))?\}\}"/g, String(imgWidth));
            rawJson = rawJson.replace(/"\{\{HEIGHT(?::(\d+))?\}\}"/g, String(imgHeight));
            rawJson = rawJson.replace(/"\{\{SEED(?::(\d+))?\}\}"/g, String(randomSeed));
            rawJson = rawJson.replace(/"\{\{LORA_STRENGTH(?::([\d.]+))?\}\}"/g, String(loraStrength));
            rawJson = rawJson.replace(/"\{\{LORA_CLIP_STRENGTH(?::([\d.]+))?\}\}"/g, String(loraStrength));
            rawJson = rawJson.replace(/\{\{INPUT_IMAGE_PATH\}\}/g, (inputImagePath || '').replace(/"/g, '\\"'));
            rawJson = rawJson.replace(/"\{\{TARGET_RESOLUTION(?::(\d+))?\}\}"/g, '2048');

            const parsed = JSON.parse(rawJson);
            delete parsed._meta_workflow;
            delete parsed._comfy_note;

            // Randomize seeds
            for (const key of Object.keys(parsed)) {
              const ct = parsed[key].class_type;
              if (ct === 'KSampler' && typeof parsed[key].inputs.seed === 'number') {
                parsed[key].inputs.seed = randomSeed;
              }
              if (ct === 'RandomNoise' && typeof parsed[key].inputs.noise_seed === 'number') {
                parsed[key].inputs.noise_seed = randomSeed;
              }
            }

            try {
              const res = await fetch(`${comfyUrl}/prompt`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: parsed }),
                signal: AbortSignal.timeout(10000),
              });

              if (res.ok) {
                const data = await res.json();
                const promptId = data.prompt_id;

                // Poll for completion
                let imageFound = false;
                let imageUrl = '';
                for (let i = 0; i < 60; i++) {
                  await new Promise(r => setTimeout(r, 2000));
                  try {
                    const histRes = await fetch(`${comfyUrl}/history/${promptId}`, { signal: AbortSignal.timeout(5000) });
                    if (histRes.ok) {
                      const histData = await histRes.json();
                      if (histData[promptId]) {
                        const outputs = histData[promptId].outputs;
                        for (const outputNodeId of Object.keys(outputs)) {
                          if (outputs[outputNodeId].images && outputs[outputNodeId].images.length > 0) {
                            const img = outputs[outputNodeId].images[0];
                            imageUrl = `${comfyUrl}/view?filename=${img.filename}&subfolder=${img.subfolder}&type=${img.type}`;
                            imageFound = true;
                            break;
                          }
                        }
                        break;
                      }
                    }
                  } catch { /* continue polling */ }
                }

                result = imageFound
                  ? { media: imageUrl }
                  : { media: `Job ID: ${promptId} queued, but timed out waiting for image render.` };
              } else {
                const errText = await res.text().catch(() => 'Unknown');
                result = { media: `ComfyUI error: ${errText}` };
              }
            } catch (e: any) {
              result = { media: `ComfyUI not reachable at ${comfyUrl}. ${e.message}` };
            }
          } catch (e: any) {
            result = { media: `Error loading ComfyUI Template: ${e.message}` };
          }
          break;
        }

        case 'n8nNode': {
          const hookUrl = node.data?.url;
          if (!hookUrl) {
            result = { success: false, data: 'No webhook URL configured' };
            break;
          }
          const payloadString = inputs['payload'] || '{}';
          try {
            const payloadData = typeof payloadString === 'string' ? JSON.parse(payloadString) : payloadString;
            const res = await fetch(hookUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payloadData),
              signal: AbortSignal.timeout(15000),
            });
            result = { success: res.ok, data: await res.text().catch(() => '') };
          } catch (error: any) {
            result = { success: false, data: error.message };
          }
          break;
        }

        default:
          result = { error: `Unknown node type: ${node.type}` };
      }

      nodeOutputs[node.id] = result;
    }

    return NextResponse.json({ success: true, outputs: nodeOutputs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
