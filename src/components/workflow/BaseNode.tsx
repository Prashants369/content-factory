import { memo, ReactNode } from 'react';
import { Handle, Position } from '@xyflow/react';

interface BaseNodeProps {
    id: string;
    title: string;
    icon?: ReactNode;
    color?: string;
    children?: ReactNode;
    selected?: boolean;
}

const BaseNode = memo(({ id, title, icon, color = 'bg-slate-500', children, selected }: BaseNodeProps) => {
    return (
        <div className={`relative min-w-[280px] rounded-2xl border bg-black/80 backdrop-blur-xl shadow-2xl transition-all duration-300
      ${selected ? 'border-primary shadow-[0_0_30px_-5px] shadow-primary/50' : 'border-white/10 shadow-black/50'}
    `}>
            {/* Top Header */}
            <div className={`flex items-center gap-3 px-4 py-3 rounded-t-2xl border-b border-white/10 ${color} bg-opacity-20`}>
                <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${color} text-white shadow-lg`}>
                    {icon}
                </div>
                <div className="font-semibold text-white/90 tracking-wide text-sm">{title}</div>
            </div>

            {/* Body */}
            <div className="p-4 space-y-4">
                {children}
            </div>

            {/* Handles generic input/output */}
            <Handle
                type="target"
                position={Position.Left}
                className="w-4 h-4 rounded-full border-2 border-slate-900 bg-emerald-400 !-left-2"
            />
            <Handle
                type="source"
                position={Position.Right}
                className="w-4 h-4 rounded-full border-2 border-slate-900 bg-purple-400 !-right-2"
            />
        </div>
    );
});

BaseNode.displayName = 'BaseNode';

export default BaseNode;
