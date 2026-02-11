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

            for (let i = 0; i < bars; i++) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';

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
        <div className="w-full bg-white/5 rounded-md p-1 border border-white/5">
            <canvas
                ref={canvasRef}
                width={300}
                height={24}
                className="w-full h-[24px] opacity-100"
            />
        </div>
    );
}
