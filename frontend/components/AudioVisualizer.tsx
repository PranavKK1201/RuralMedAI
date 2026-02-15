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
                ctx.fillStyle = 'hsla(236, 27%, 22%, 0.1)';
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

            for (let i = 0; i < bars; i++) {
                const t = (i / bars);
                const r1 = 35, g1 = 39, b1 = 71;   // primary navy hsl(236,27%,22%)
                const r2 = 32, g2 = 178, b2 = 170;  // accent teal hsl(188,72%,44%)
                const r = Math.round(r1 + (r2 - r1) * t);
                const g = Math.round(g1 + (g2 - g1) * t);
                const b = Math.round(b1 + (b2 - b1) * t);
                ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.7)`;

                // Simulate audio frequency data with smoother randomness
                const seed = Date.now() / 200;
                const height = Math.abs(Math.sin(seed + i * 0.2)) * canvas.height * 0.6 + (Math.random() * 5);

                const x = i * (width + gap);
                const y = (canvas.height - height) / 2;

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
        <div className="w-full bg-primary/5 rounded-md p-1 border border-primary/10">
            <canvas
                ref={canvasRef}
                width={300}
                height={24}
                className="w-full h-[24px] opacity-100"
            />
        </div>
    );
}
