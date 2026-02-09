import { useEffect, useRef } from 'react';

export function AudioVisualizer({ isRecording }: { isRecording: boolean }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!isRecording) return;

        // Allow the animation to run
        let animationFrameId: number;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');

        const draw = () => {
            if (!canvas || !ctx) return;

            // Clear
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Draw Fake Waveform for POC (In real app we'd attach a loopback analyser to the AudioContext)
            // Since useAudioStream doesn't expose the AnalyserNode yet (to keep it simple), we simulate activity.
            ctx.fillStyle = '#3b82f6';
            const bars = 20;
            const gap = 4;
            const width = (canvas.width - ((bars - 1) * gap)) / bars;

            for (let i = 0; i < bars; i++) {
                const height = Math.random() * canvas.height * 0.8;
                ctx.fillRect(i * (width + gap), (canvas.height - height) / 2, width, height);
            }

            animationFrameId = requestAnimationFrame(() => {
                // slow down animation
                setTimeout(draw, 100);
            });
        };

        draw();

        return () => {
            cancelAnimationFrame(animationFrameId);
        }
    }, [isRecording]);

    return (
        <canvas ref={canvasRef} width={200} height={40} className="w-full max-w-[200px] h-[40px]" />
    );
}
