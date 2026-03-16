'use client';
import { useCallback, useState } from 'react';
import {
    ReactFlow,
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    addEdge,
    Connection,
    Edge,
    Node,
    BackgroundVariant,
    Panel,
    MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { PromptNode, LLMNode, ComfyUINode, N8NNode, InfluencerNode } from './CustomNodes';
import { Play, Save, Database, Bot, Network, Workflow, Users } from 'lucide-react';

const nodeTypes = {
    promptNode: PromptNode,
    llmNode: LLMNode,
    comfyNode: ComfyUINode,
    n8nNode: N8NNode,
    influencerNode: InfluencerNode,
};

const initialNodes: Node[] = [
    { id: '1', type: 'influencerNode', position: { x: 50, y: 150 }, data: {} },
    { id: '3', type: 'comfyNode', position: { x: 450, y: 150 }, data: { workflow: 'flux-9b-txt2img' } },
    { id: '4', type: 'n8nNode', position: { x: 850, y: 150 }, data: { url: process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/your-id' } },
];

const initialEdges: Edge[] = [
    {
        id: 'e1-3',
        source: '1',
        target: '3',
        sourceHandle: 'text',
        targetHandle: 'prompt',
        type: 'smoothstep',
        markerEnd: { type: MarkerType.ArrowClosed, color: '#525252' },
        style: { stroke: '#525252', strokeWidth: 2 }
    },
    {
        id: 'e3-4',
        source: '3',
        target: '4',
        sourceHandle: 'media',
        targetHandle: 'payload',
        type: 'smoothstep',
        markerEnd: { type: MarkerType.ArrowClosed, color: '#525252' },
        style: { stroke: '#525252', strokeWidth: 2 }
    },
];

export default function WorkflowCanvas() {
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    const [isExecuting, setIsExecuting] = useState(false);

    const handleExecute = async () => {
        setIsExecuting(true);
        try {
            const payload = {
                nodes,
                edges,
                comfyUrl: process.env.NEXT_PUBLIC_COMFYUI_URL || 'http://127.0.0.1:8188'
            };

            const res = await fetch('/api/workflow/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await res.json();
            console.log('Workflow Execution Result:', result);

            if (result.success) {
                // Update nodes with their execution results
                setNodes(nds => nds.map(n => {
                    if (result.outputs && result.outputs[n.id]) {
                        return { ...n, data: { ...n.data, executionResult: result.outputs[n.id] } };
                    }
                    return n;
                }));
                // alert("Workflow Executed Successfully!\nCheck nodes for outputs.");
            } else {
                alert("Workflow Failed: " + result.error);
            }
        } catch (err: any) {
            alert('Failed to connect to orchestrator: ' + err.message);
        } finally {
            setIsExecuting(false);
        }
    };

    const onConnect = useCallback(
        (params: Connection | Edge) => setEdges((eds) => addEdge({
            ...params,
            type: 'smoothstep',
            markerEnd: { type: MarkerType.ArrowClosed, color: '#f59e0b' },
            style: { stroke: '#f59e0b', strokeWidth: 2 }
        } as Edge, eds)),
        [setEdges],
    );

    const addNode = (type: string) => {
        const newNode = {
            id: Math.random().toString(),
            type,
            position: { x: Math.random() * 200 + 100, y: Math.random() * 200 + 100 },
            data: {},
        };
        setNodes((nds) => nds.concat(newNode));
    };

    return (
        <div className="w-full h-full bg-[#0a0a0a] relative outline-none z-0">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                fitView
            >
                <Controls
                    className="!bg-[#1e1e1e] !border-[#333333] shadow-lg [&>button]:!border-[#333333] [&>button]:!bg-transparent [&>button]:!fill-neutral-400 hover:[&>button]:!bg-[#333333]"
                    position="bottom-right"
                />

                {/* Professional dark grey/blue dot matrix */}
                <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#262626" />

                <Panel position="top-right" className="flex gap-2 p-4">
                    <button className="flex items-center gap-2 bg-[#1e1e1e] hover:bg-[#262626] border border-[#333333] px-4 py-2 rounded shadow-sm text-neutral-300 text-xs font-semibold uppercase tracking-wider transition-colors">
                        <Save size={14} /> Save
                    </button>
                    <button
                        onClick={handleExecute}
                        disabled={isExecuting}
                        className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 px-6 py-2 rounded shadow-lg shadow-amber-500/10 text-white text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Play size={14} /> {isExecuting ? 'Running...' : 'Execute Workflow'}
                    </button>
                </Panel>

                <Panel position="top-left" className="m-4 ml-0 h-full max-h-[85%] my-auto flex items-center shrink-0">
                    <div className="bg-[#171717]/95 backdrop-blur-md border border-[#333333] rounded-r-lg shadow-2xl w-56 flex flex-col pointer-events-auto h-full overflow-hidden">
                        <div className="bg-[#1e1e1e] px-4 py-3 text-[10px] font-bold tracking-widest uppercase text-neutral-400 border-b border-[#333333]">Available Nodes</div>
                        <div className="p-2 flex flex-col gap-1 overflow-y-auto">

                            <div className="text-[10px] font-bold text-neutral-600 uppercase tracking-wider mt-2 mb-1 pl-2">Core Logic</div>
                            <button onClick={() => addNode('influencerNode')} className="flex items-center gap-3 px-3 py-2.5 rounded text-neutral-300 text-xs font-medium hover:bg-[#262626] text-left border border-transparent transition-colors group">
                                <Users size={15} className="text-pink-500" />
                                Influencer DNA
                            </button>
                            <button onClick={() => addNode('promptNode')} className="flex items-center gap-3 px-3 py-2.5 rounded text-neutral-300 text-xs font-medium hover:bg-[#262626] text-left border border-transparent transition-colors group">
                                <Database size={15} className="text-emerald-500" />
                                Static Prompt
                            </button>
                            <button onClick={() => addNode('llmNode')} className="flex items-center gap-3 px-3 py-2.5 rounded text-neutral-300 text-xs font-medium hover:bg-[#262626] text-left border border-transparent transition-colors group">
                                <Bot size={15} className="text-violet-500" />
                                AI Text Agent
                            </button>

                            <div className="text-[10px] font-bold text-neutral-600 uppercase tracking-wider mt-4 mb-1 pl-2">Integrations</div>
                            <button onClick={() => addNode('comfyNode')} className="flex items-center gap-3 px-3 py-2.5 rounded text-neutral-300 text-xs font-medium hover:bg-[#262626] text-left border border-transparent transition-colors group">
                                <Network size={15} className="text-cyan-500" />
                                ComfyUI Job
                            </button>
                            <button onClick={() => addNode('n8nNode')} className="flex items-center gap-3 px-3 py-2.5 rounded text-neutral-300 text-xs font-medium hover:bg-[#262626] text-left border border-transparent transition-colors group">
                                <Workflow size={15} className="text-rose-500" />
                                n8n Trigger
                            </button>

                        </div>
                    </div>
                </Panel>
            </ReactFlow>
        </div>
    );
}
