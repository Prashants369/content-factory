'use client';

import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sphere, Html, Line } from '@react-three/drei';
import * as THREE from 'three';

interface MemoryNode {
    id: string;
    type: string;
    content: string;
    importance: number;
    connections: string[];
}

interface BrainProps {
    nodes: MemoryNode[];
    onNodeClick: (node: MemoryNode) => void;
    activeAgents: Record<string, boolean>;
}

function Node({ node, position, onClick, isActive }: { node: MemoryNode; position: [number, number, number]; onClick: () => void; isActive: boolean }) {
    const [hovered, setHovered] = useState(false);
    const materialRef = useRef<THREE.MeshStandardMaterial>(null);

    const color = useMemo(() => {
        if (node.type === 'core_dna') return '#f59e0b'; // Amber
        if (node.type === 'viral_hook') return '#ec4899'; // Pink
        return '#8b5cf6'; // Violet
    }, [node.type]);

    const size = (node.importance * 0.2) + 0.1;

    useFrame(({ clock }) => {
        if (materialRef.current) {
            if (isActive) {
                // Pulse intensity if agent is active
                const pulse = Math.sin(clock.getElapsedTime() * 10) * 2 + 3;
                materialRef.current.emissiveIntensity = pulse;
            } else {
                materialRef.current.emissiveIntensity = hovered ? 2 : 0.5;
            }
        }
    });

    return (
        <group position={position} onClick={(e) => { e.stopPropagation(); onClick(); }}>
            <Sphere
                args={[size, 16, 16]}
                onPointerOver={() => setHovered(true)}
                onPointerOut={() => setHovered(false)}
            >
                <meshStandardMaterial
                    ref={materialRef}
                    color={color}
                    emissive={color}
                    emissiveIntensity={0.5}
                    toneMapped={false}
                />
            </Sphere>
            {hovered && (
                <Html distanceFactor={10}>
                    <div className="bg-black/90 backdrop-blur-xl border border-white/20 p-3 rounded-xl text-[10px] whitespace-nowrap text-white pointer-events-none shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-2 mb-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                            <div className="font-black uppercase tracking-widest text-[#8b5cf6]">{node.type}</div>
                        </div>
                        <div className="opacity-50 font-mono text-[8px] uppercase">{node.id}</div>
                    </div>
                </Html>
            )}
        </group>
    );
}

function NeuralNetwork({ nodes, onNodeClick, activeAgents }: BrainProps) {
    const groupRef = useRef<THREE.Group>(null);

    const nodeData = useMemo(() => {
        return nodes.map((node, i) => {
            const phi = Math.acos(-1 + (2 * i) / nodes.length);
            const theta = Math.sqrt(nodes.length * Math.PI) * phi;
            const r = 5 + Math.random() * 2;

            const x = r * Math.cos(theta) * Math.sin(phi);
            const y = r * Math.sin(theta) * Math.sin(phi);
            const z = r * Math.cos(phi);

            // Determine if this node should pulse based on active agents
            let isActive = false;
            if (activeAgents.Analyst && node.type === 'core_dna') isActive = true;
            if ((activeAgents.Creator || activeAgents.Scout) && node.type === 'viral_hook') isActive = true;
            if (activeAgents.Visual && node.type !== 'core_dna' && node.type !== 'viral_hook') isActive = true;

            return { ...node, pos: [x, y, z] as [number, number, number], isActive };
        });
    }, [nodes, activeAgents]);

    useFrame(() => {
        if (groupRef.current) {
            groupRef.current.rotation.y += 0.001;
        }
    });

    return (
        <group ref={groupRef}>
            {/* Connections (Lines) */}
            {nodeData.map((node) => (
                <React.Fragment key={`lines-${node.id}`}>
                    {node.connections.map(targetId => {
                        const target = nodeData.find(n => n.id === targetId);
                        if (target) {
                            return (
                                <Line
                                    key={`line-${node.id}-${target.id}`}
                                    points={[node.pos, target.pos]}
                                    color={node.isActive ? "#ffffff" : "#8b5cf6"}
                                    opacity={node.isActive ? 0.4 : 0.1}
                                    transparent
                                    lineWidth={node.isActive ? 1 : 0.5}
                                />
                            );
                        }
                        return null;
                    })}
                </React.Fragment>
            ))}

            {/* Nodes */}
            {nodeData.map((node) => (
                <Node
                    key={node.id}
                    node={node}
                    position={node.pos}
                    onClick={() => onNodeClick(node)}
                    isActive={node.isActive}
                />
            ))}
        </group>
    );
}

export default function BrainVisualization3D({ nodes, onNodeClick, activeAgents }: BrainProps) {
    return (
        <div className="w-full h-full">
            <Canvas camera={{ position: [0, 0, 15], fov: 50 }} gl={{ antialias: true, alpha: true }}>
                <color attach="background" args={['#050505']} />
                <ambientLight intensity={0.4} />
                <pointLight position={[10, 10, 10]} intensity={1.5} color="#8b5cf6" />
                <pointLight position={[-10, -10, -10]} intensity={0.5} color="#ec4899" />
                <spotLight position={[0, 20, 0]} angle={0.3} penumbra={1} intensity={1} color="#ffffff" />

                <NeuralNetwork nodes={nodes} onNodeClick={onNodeClick} activeAgents={activeAgents} />

                <OrbitControls
                    enablePan={false}
                    enableZoom={true}
                    minDistance={8}
                    maxDistance={25}
                    autoRotate={true}
                    autoRotateSpeed={0.5}
                />
            </Canvas>
        </div>
    );
}
