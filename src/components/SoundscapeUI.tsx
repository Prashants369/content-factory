'use client';

import { useEffect, useRef } from 'react';
import { useAgentTelemetry } from '@/lib/telemetry';

export default function SoundscapeUI() {
    const { events } = useAgentTelemetry();
    const lastEventId = useRef<string | null>(null);

    // Audio refs
    const clickSound = useRef<HTMLAudioElement | null>(null);
    const successSound = useRef<HTMLAudioElement | null>(null);
    const pulseSound = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        // Initialize audio objects
        clickSound.current = new Audio('/sounds/ui-click.mp3');
        successSound.current = new Audio('/sounds/ui-success.mp3');
        pulseSound.current = new Audio('/sounds/ui-pulse.mp3');

        // Low volume for background atmosphere
        if (clickSound.current) clickSound.current.volume = 0.1;
        if (successSound.current) successSound.current.volume = 0.1;
        if (pulseSound.current) pulseSound.current.volume = 0.05;
    }, []);

    useEffect(() => {
        if (!events || events.length === 0) return;
        const latest = events[0];

        // Play sound based on event status
        if (latest.status === 'COMPLETED' || latest.status === 'SUCCESS') {
            successSound.current?.play().catch(() => { });
        } else if (latest.status === 'RUNNING' || latest.status === 'WORKING') {
            pulseSound.current?.play().catch(() => { });
        }
    }, [events]);

    return null; // Invisible component
}
