import { useState, useRef, useCallback } from 'react';

export const useAudioStream = (onAudioChunk: (data: string) => void) => {
    const [isRecording, setIsRecording] = useState(false);
    const audioContextRef = useRef<AudioContext | null>(null);
    const workletNodeRef = useRef<AudioWorkletNode | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const getAudioDevices = useCallback(async () => {
        try {
            // Request permission first to get labels
            await navigator.mediaDevices.getUserMedia({ audio: true });
            const devices = await navigator.mediaDevices.enumerateDevices();
            return devices.filter(device => device.kind === 'audioinput');
        } catch (error) {
            console.error("Error fetching audio devices:", error);
            return [];
        }
    }, []);

    const startRecording = useCallback(async (deviceId?: string) => {
        try {
            // 1. Init AudioContext at 16kHz to match Gemini requirement
            const audioContext = new AudioContext({ sampleRate: 16000 });
            audioContextRef.current = audioContext;

            // 2. Load the Worklet
            await audioContext.audioWorklet.addModule('/worklet.js');

            // 3. Get Mic Stream with specific device if provided
            const constraints: MediaStreamConstraints = {
                audio: {
                    channelCount: 1,
                    sampleRate: 16000,
                    deviceId: deviceId ? { exact: deviceId } : undefined
                },
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
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
            // Do not connect to destination to avoid feedback loop

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

    return { isRecording, startRecording, stopRecording, getAudioDevices };
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
