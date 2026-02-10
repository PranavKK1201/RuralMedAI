"use client";

import { useEffect, useRef } from 'react';

export function AudioVisualizer({ isRecording }: { isRecording: boolean }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!isRecording) {
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext('2d');
            if (canvas && ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                // Draw static baseline
                ctx.fillStyle = 'rgba(255,255,255,0.05)';
                ctx.fillRect(0, canvas.height / 2 - 1, canvas.width, 2);
            }
            return;
        }

        let animationFrameId: number;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');

        const draw = () => {
            if (!canvas || !ctx) return;

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Audio visualization configuration
            const bars = 32;
            const gap = 2;
            const width = (canvas.width - ((bars - 1) * gap)) / bars;

            // Draw a subtle baseline
            ctx.fillStyle = 'rgba(255,255,255,0.05)';
            ctx.fillRect(0, canvas.height / 2 - 0.5, canvas.width, 1);

            for (let i = 0; i < bars; i++) {
                // Professional color scheme - matching oklch primary
                const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
                gradient.addColorStop(0, '#92c5ff'); // Lighter blue
                gradient.addColorStop(0.5, '#3b82f6'); // Primary blue
                gradient.addColorStop(1, '#1e40af'); // Deeper blue

                ctx.fillStyle = gradient;

                // Simulate audio frequency data with smoother randomness
                const seed = Date.now() / 200;
                const height = Math.abs(Math.sin(seed + i * 0.2)) * canvas.height * 0.6 + (Math.random() * 5);

                // Rounded bar effect
                const x = i * (width + gap);
                const y = (canvas.height - height) / 2;

                // Drawing paths for rounded rects
                ctx.beginPath();
                const radius = width / 2;
                ctx.roundRect(x, y, width, height, radius);
                ctx.fill();
            }

            animationFrameId = requestAnimationFrame(draw);
        };

        draw();

        return () => {
            cancelAnimationFrame(animationFrameId);
        }
    }, [isRecording]);

    return (
        <div className="w-full bg-black/20 rounded-lg p-2 border border-white/5 shadow-inner">
            <canvas
                ref={canvasRef}
                width={300}
                height={40}
                className="w-full h-[40px] opacity-80"
            />
        </div>
    );
}
