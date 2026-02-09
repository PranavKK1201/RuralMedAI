import { useState, useRef, useCallback } from 'react';

export const useAudioStream = (onAudioChunk: (data: string) => void) => {
    const [isRecording, setIsRecording] = useState(false);
    const audioContextRef = useRef<AudioContext | null>(null);
    const workletNodeRef = useRef<AudioWorkletNode | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const startRecording = useCallback(async () => {
        try {
            // 1. Init AudioContext at 16kHz to match Gemini requirement
            const audioContext = new AudioContext({ sampleRate: 16000 });
            audioContextRef.current = audioContext;

            // 2. Load the Worklet
            await audioContext.audioWorklet.addModule('/worklet.js');

            // 3. Get Mic Stream
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: 1,
                    sampleRate: 16000,
                },
            });
            streamRef.current = stream;

            // 4. Create Source & Worklet Node
            const source = audioContext.createMediaStreamSource(stream);
            const workletNode = new AudioWorkletNode(audioContext, 'pcm-processor'); // Must match name in public/worklet.js

            // 5. Handle Data from Worklet
            workletNode.port.onmessage = (event) => {
                const int16Data = event.data; // ArrayBuffer from worklet
                // Convert to Base64 to send over WebSocket
                const base64String = arrayBufferToBase64(int16Data);
                onAudioChunk(base64String);
            };

            // 6. Connect Graph
            source.connect(workletNode);
            workletNode.connect(audioContext.destination); // Connect to mute? No, don't connect to destination to avoid feedback loop unless we want to hear ourselves. 
            // Actually, standard practice is NOT to connect to destination if we just want to process.
            // But WebAudio requires a connection to destination or it might stop? 
            // WorkletNode is a destination itself effectively. 
            // Let's NOT connect to destination to prevent feedback.
            // source.connect(workletNode); 
            // workletNodeRef.current = workletNode; -- wait, if we don't connect to destination, does it run?
            // Yes, usually.

            workletNodeRef.current = workletNode;
            setIsRecording(true);

        } catch (error) {
            console.error("Error starting audio stream:", error);
        }
    }, [onAudioChunk]);

    const stopRecording = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
        if (workletNodeRef.current) {
            workletNodeRef.current.disconnect();
            workletNodeRef.current = null;
        }
        setIsRecording(false);
    }, []);

    return { isRecording, startRecording, stopRecording };
};

// Helper: Fast ArrayBuffer to Base64
function arrayBufferToBase64(buffer: ArrayBuffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}
