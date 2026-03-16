'use client';

import { useState, useEffect, useCallback } from 'react';

export interface TelemetryEvent {
    agent: string;
    status: string;
    message: string;
    task_id?: string;
    timestamp: number;
}

export function useAgentTelemetry() {
    const [events, setEvents] = useState<TelemetryEvent[]>([]);
    const [activeAgents, setActiveAgents] = useState<Record<string, TelemetryEvent>>({});
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        let socket: WebSocket | null = null;
        let reconnectTimeout: NodeJS.Timeout;
        let mounted = true;

        const connect = () => {
            if (!mounted) return;
            
            try {
                const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                const hostname = window.location.hostname || 'localhost';
                const port = '8787';
                const wsUrl = `${protocol}//${hostname}:${port}/ws/telemetry`;

                try {
                    socket = new WebSocket(wsUrl);
                } catch (e) {
                    // WebSocket constructor failed - invalid URL or browser doesn't support it
                    console.warn('WebSocket not available:', e);
                    if (mounted) reconnectTimeout = setTimeout(connect, 10000);
                    return;
                }

                socket.onopen = () => {
                    if (mounted) setConnected(true);
                };

                socket.onmessage = (event) => {
                    if (!mounted) return;
                    try {
                        const raw = JSON.parse(event.data);
                        const data: TelemetryEvent = raw.event === 'job_update' ? {
                            agent: `Worker:${raw.influencer_id || 'system'}`,
                            status: raw.status || 'unknown',
                            message: raw.status === 'finished' ? 'Generation Complete' : `Job ${raw.status}: ${raw.job_id || 'unknown'}`,
                            task_id: raw.job_id,
                            timestamp: Date.now()
                        } : {
                            agent: raw.agent || 'Unknown',
                            status: raw.status || 'unknown',
                            message: raw.message || '',
                            task_id: raw.task_id,
                            timestamp: raw.timestamp || Date.now()
                        };

                        setEvents((prev) => [data, ...prev].slice(0, 50));
                        setActiveAgents((prev) => ({
                            ...prev,
                            [data.agent]: data
                        }));
                    } catch (e) {
                        // Invalid JSON, skip
                    }
                };

                socket.onclose = () => {
                    if (mounted) {
                        setConnected(false);
                        reconnectTimeout = setTimeout(connect, 5000);
                    }
                };

                socket.onerror = () => {
                    // Silently handle error - connection will retry via onclose
                    try { socket?.close(); } catch {}
                    if (mounted) setConnected(false);
                };
            } catch (err) {
                // Any unexpected error in connect
                console.warn('Telemetry connection error:', err);
                if (mounted) reconnectTimeout = setTimeout(connect, 10000);
            }
        };

        // Delay initial connection to avoid hydration issues
        const initTimeout = setTimeout(connect, 1000);

        return () => {
            mounted = false;
            clearTimeout(initTimeout);
            clearTimeout(reconnectTimeout);
            try { socket?.close(); } catch {}
        };
    }, []);

    const clearEvents = useCallback(() => setEvents([]), []);

    return { events, activeAgents, connected, clearEvents };
}
