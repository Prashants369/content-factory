'use client';
import { useCallback } from 'react';
import { useReactFlow, Handle, Position } from '@xyflow/react';
import { Database, Bot, Network, Workflow, Trash2, Users } from 'lucide-react';
import { useEffect, useState } from 'react';

const HandleRow = ({ label, id, isInput = false }: any) => (
    <div className="flex items-center relative h-6 my-1.5 w-full">
        {isInput ? (
            <>
                <Handle type="target" position={Position.Left} id={id} className="w-3 h-3 bg-[#a3a3a3] border-[3px] border-[#171717] rounded-full !-left-[18px]" />
                <span className="text-[10px] text-neutral-400 font-medium ml-1.5 uppercase tracking-wide">{label}</span>
            </>
        ) : (
            <>
                <span className="text-[10px] text-neutral-400 font-medium mr-1.5 ml-auto uppercase tracking-wide">{label}</span>
                <Handle type="source" position={Position.Right} id={id} className="w-3 h-3 bg-[#a3a3a3] border-[3px] border-[#171717] rounded-full !-right-[18px]" />
            </>
        )}
    </div>
);

const NodeShell = ({ id, selected, icon: Icon, title, iconColor, children }: any) => {
    const { setNodes, setEdges } = useReactFlow();

    const deleteNode = () => {
        setNodes((nds) => nds.filter((n) => n.id !== id));
        setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
    };

    return (
        <div className={`min-w-[280px] rounded border bg-[#171717] shadow-2xl transition-all duration-200
        ${selected ? 'border-amber-500 ring-1 ring-amber-500/50 shadow-amber-500/10' : 'border-[#333333]'}`}>
            <div className="flex items-center justify-between px-3 py-2 border-b border-[#333333] bg-[#1e1e1e] rounded-t">
                <div className="flex items-center gap-2.5">
                    <div className={iconColor}><Icon size={14} /></div>
                    <div className="font-semibold text-neutral-200 text-xs tracking-wide">{title}</div>
                </div>
                <button
                    onClick={deleteNode}
                    className="text-neutral-500 hover:text-red-400 transition-colors focus:outline-none bg-transparent hover:bg-red-400/10 p-1 rounded"
                    title="Delete Node"
                >
                    <Trash2 size={13} />
                </button>
            </div>
            <div className="p-3">
                {children}
            </div>
        </div>
    );
};

// --- Prompt Node ---
export function PromptNode({ id, data, selected }: any) {
    const { updateNodeData } = useReactFlow();
    const onChange = useCallback((evt: React.ChangeEvent<HTMLTextAreaElement>) => {
        updateNodeData(id, { prompt: evt.target.value });
    }, [id, updateNodeData]);

    return (
        <NodeShell id={id} selected={selected} icon={Database} iconColor="text-emerald-500" title="Static Prompt">
            <div className="space-y-3">
                <textarea
                    onChange={onChange}
                    value={data.prompt || ''}
                    placeholder="Data string..."
                    className="w-full h-16 bg-[#0a0a0a] border border-[#333333] rounded px-2 py-1.5 text-xs text-neutral-300 focus:outline-none focus:border-amber-500 resize-none nodrag font-mono"
                />
                <HandleRow label="output_string" id="text" isInput={false} />
            </div>
        </NodeShell>
    );
}

// --- Influencer / Model Select Node ---
export function InfluencerNode({ id, data, selected }: any) {
    const { updateNodeData } = useReactFlow();
    const [models, setModels] = useState<any[]>([]);

    useEffect(() => {
        fetch('/api/influencers')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    setModels(data);
                    // initialize first one if empty
                    if (data.length > 0 && !(data as any).selected_id) {
                        const first = data[0];
                        updateNodeData(id, { selected_id: first.id, prompt: first.lookbook_prompt });
                    }
                }
            })
            .catch(console.error);
    }, [id, updateNodeData]);

    const onSelectChange = (e: any) => {
        const selectedId = e.target.value;
        const model = models.find(m => m.id === selectedId);
        if (model) {
            updateNodeData(id, { selected_id: model.id, prompt: model.lookbook_prompt });
        }
    };

    return (
        <NodeShell id={id} selected={selected} icon={Users} iconColor="text-pink-500" title="Influencer DNA">
            <div className="space-y-2">
                <div className="flex flex-col gap-1.5 border-b border-[#333333] pb-3 mb-2">
                    <label className="text-[9px] text-neutral-500 uppercase font-semibold tracking-wider">Select Model Entity</label>
                    <select
                        className="w-full bg-[#0a0a0a] border border-[#333333] rounded px-2 py-1.5 text-xs text-neutral-300 focus:outline-none focus:border-amber-500 nodrag appearance-none cursor-pointer"
                        value={data.selected_id || ''}
                        onChange={onSelectChange}
                    >
                        {models.length === 0 && <option value="">Loading...</option>}
                        {models.map(m => (
                            <option key={m.id} value={m.id}>{m.name} - {m.niche}</option>
                        ))}
                    </select>
                </div>
                <div className="text-[10px] text-neutral-400 font-mono bg-black p-2 rounded border border-[#333333] max-h-24 overflow-y-auto w-full break-words">
                    {data.prompt || 'No DNA selected...'}
                </div>
                <HandleRow label="dna_prompt" id="text" isInput={false} />
            </div>
        </NodeShell>
    );
}

// --- LLM Agent Node ---
export function LLMNode({ id, data, selected }: any) {
    const { updateNodeData } = useReactFlow();
    return (
        <NodeShell id={id} selected={selected} icon={Bot} iconColor="text-violet-500" title="AI Agent Task">
            <div className="space-y-1">
                <div className="flex flex-col gap-1.5 mb-2 border-b border-[#333333] pb-3">
                    <label className="text-[9px] text-neutral-500 uppercase font-semibold tracking-wider">Local Model</label>
                    <select
                        className="w-full bg-[#0a0a0a] border border-[#333333] rounded px-2 py-1.5 text-xs text-neutral-300 focus:outline-none focus:border-amber-500 nodrag appearance-none cursor-pointer"
                        value={data.model || 'qwen3:1.7b'}
                        onChange={(e) => updateNodeData(id, { model: e.target.value })}
                    >
                        <option value="qwen3:1.7b">Qwen 3 (1.7B Local)</option>
                    </select>
                </div>

                <HandleRow label="system_rules" id="sys" isInput={true} />
                <HandleRow label="prompt" id="prompt" isInput={true} />
                <div className="h-2"></div>
                <HandleRow label="response" id="response" isInput={false} />
            </div>
        </NodeShell>
    );
}

// --- ComfyUI Worker Node ---
export function ComfyUINode({ id, data, selected }: any) {
    const { updateNodeData } = useReactFlow();

    const needsImage = ['flux-9b-i2i', 'flux-9b-detailer', 'seedvr2-upscaler'].includes(data.workflow);
    const hasLora = ['flux-9b-txt2img', 'flux-9b-i2i'].includes(data.workflow);

    const WORKFLOW_INFO: Record<string, { vram: string; speed: string }> = {
        'flux-9b-txt2img': { vram: '~4.5 GB', speed: '3–5 min' },
        'flux-9b-i2i': { vram: '~4.5 GB', speed: '3–5 min' },
        'flux-9b-detailer': { vram: '~4 GB', speed: '2 min' },
        'seedvr2-upscaler': { vram: '~3 GB', speed: '2–3 min' },
    };

    const info = WORKFLOW_INFO[data.workflow || 'flux-9b-txt2img'];

    return (
        <NodeShell id={id} selected={selected} icon={Network} iconColor="text-cyan-500" title="ComfyUI Job">
            <div className="space-y-1">
                <div className="flex flex-col gap-1.5 mb-2 border-b border-[#333333] pb-3">
                    <label className="text-[9px] text-neutral-500 uppercase font-semibold tracking-wider">Workflow</label>
                    <select
                        className="w-full bg-[#0a0a0a] border border-[#333333] rounded px-2 py-1.5 text-xs text-neutral-300 focus:outline-none focus:border-amber-500 nodrag appearance-none cursor-pointer"
                        value={data.workflow || 'flux-9b-txt2img'}
                        onChange={(e) => updateNodeData(id, { workflow: e.target.value })}
                    >
                        <option value="flux-9b-txt2img">⚡ Generate (Step 1) — txt2img + IPAdapter</option>
                        <option value="flux-9b-i2i">🔄 Refine (Step 2) — img2img + face consistency</option>
                        <option value="flux-9b-detailer">✨ Detail (Step 3) — Z-Image ColorMatch + Sharpen</option>
                        <option value="seedvr2-upscaler">🚀 Upscale (Step 4) — SeedVR2 2048px</option>
                    </select>
                    {info && (
                        <div className="flex items-center gap-3 mt-1">
                            <span className="text-[9px] text-neutral-600">VRAM: <span className="text-neutral-400">{info.vram}</span></span>
                            <span className="text-[9px] text-neutral-600">Speed: <span className="text-neutral-400">{info.speed}</span></span>
                        </div>
                    )}
                </div>

                <div className="bg-[#1e1e1e] -mx-3 px-3 py-2 border-b border-[#333333]">
                    <div className="text-[9px] text-neutral-500 mb-2 uppercase font-semibold">Injected Inputs</div>
                    <HandleRow label="positive_prompt" id="prompt" isInput={true} />
                    <HandleRow label="negative_prompt" id="neg" isInput={true} />
                    {needsImage && (
                        <HandleRow label="reference_image" id="image" isInput={true} />
                    )}
                    {hasLora && (
                        <HandleRow label="lora_strength" id="lora_strength" isInput={true} />
                    )}
                </div>

                <div className="pt-2">
                    <HandleRow label="media_url" id="media" isInput={false} />
                </div>

                {data.executionResult?.media && (
                    <div className="mt-2 rounded overflow-hidden border border-[#333333] bg-black">
                        {data.executionResult.media.startsWith('http') ? (
                            <img src={data.executionResult.media} alt="Gen" className="w-full h-auto object-cover" />
                        ) : (
                            <div className="text-[10px] text-neutral-500 p-2 text-center">{data.executionResult.media}</div>
                        )}
                    </div>
                )}
            </div>
        </NodeShell>
    );
}


// --- n8n Webhook Node ---
export function N8NNode({ id, data, selected }: any) {
    const { updateNodeData } = useReactFlow();
    return (
        <NodeShell id={id} selected={selected} icon={Workflow} iconColor="text-rose-500" title="n8n Trigger">
            <div className="space-y-1">
                <div className="flex flex-col gap-1.5 mb-2 border-b border-[#333333] pb-3">
                    <label className="text-[9px] text-neutral-500 uppercase font-semibold tracking-wider">Webhook URL</label>
                    <input
                        type="text"
                        placeholder="https://n8n.local/webhook/..."
                        className="w-full bg-[#0a0a0a] border border-[#333333] rounded px-2 py-1.5 text-xs text-neutral-300 focus:outline-none focus:border-amber-500 nodrag font-mono"
                        value={data.url || ''}
                        onChange={(e) => updateNodeData(id, { url: e.target.value })}
                    />
                </div>

                <HandleRow label="payload_json" id="payload" isInput={true} />
                <div className="h-2"></div>
                <HandleRow label="success" id="success" isInput={false} />
                <HandleRow label="data" id="data" isInput={false} />
            </div>
        </NodeShell>
    );
}
