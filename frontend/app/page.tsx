"use client";

import { useState, useCallback, useEffect } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { useAudioStream } from '@/hooks/useAudioStream';
import { LiveForm } from '@/components/LiveForm';
import { AudioVisualizer } from '@/components/AudioVisualizer';
import { PatientData } from '@/types';
import { Mic, Square, Save, Loader2 } from 'lucide-react';

export default function Home() {
    const [patientData, setPatientData] = useState<PatientData>({});
    const [logs, setLogs] = useState<string[]>([]); // For debugging

    // 1. WebSocket Handler
    const handleMessage = useCallback((data: any) => {
        // Gemini sends: { type: "content", text: "..." }
        if (data.type === 'content' && data.text) {
            const text = data.text;
            try {
                // Basic JSON extraction logic for streaming text
                // Clean code fencing if present
                const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();

                // In a real stream, we might get partial JSON "{ "type": "update", ..." 
                // or multiple JSONs "{...}{...}". 
                // For this POC, we try to parse the whole chunk or rely on Gemini sending complete objects per turn

                if (cleanText.startsWith('{') && cleanText.endsWith('}')) {
                    const update = JSON.parse(cleanText);

                    if (update.type === 'update') {
                        // Apply update to state
                        setPatientData(prev => {
                            const newData = { ...prev };

                            // Handle nested vitals
                            if (['temperature', 'blood_pressure', 'pulse', 'spo2'].includes(update.field)) {
                                if (!newData.vitals) newData.vitals = {};
                                (newData.vitals as any)[update.field] = update.value;
                            }
                            // Handle arrays (symptoms, vitals is object, meds)
                            else if (['symptoms', 'medications', 'allergies', 'medical_history'].includes(update.field)) {
                                // If value is array, replace? or append? 
                                // Prompt says: "symptoms": ["fever"]. 
                                // Usually we merge or replace. Let's replace for now.
                                (newData as any)[update.field] = update.value;
                            }
                            // Handle simple fields
                            else {
                                (newData as any)[update.field] = update.value;
                            }
                            return newData;
                        });

                        setLogs(prev => [`Updated ${update.field}: ${JSON.stringify(update.value)}`, ...prev.slice(0, 4)]);
                    }
                }
            } catch (e) {
                // Ignoring partial JSONs in this simple POC
                // console.log("Partial or text:", text);
            }
        }
    }, []);

    const { isConnected, connect, disconnect, sendMessage } = useSocket(handleMessage);

    // 2. Audio Handler
    const { isRecording, startRecording, stopRecording } = useAudioStream((base64Audio) => {
        if (isConnected) {
            sendMessage({
                realtimeInput: {
                    mediaChunks: [{
                        mimeType: "audio/pcm",
                        data: base64Audio
                    }]
                }
            });
        }
    });

    const handleStart = async () => {
        connect();
        // Wait a bit for connection? useSocket handles queueing? 
        // Our simple useSocket checks readyState. 
        // Ideally we wait for onopen. 
        // For POC, we click "Start" which connects WS, then we click "Mic" or we do both?
        // Let's do both sequentially with a small delay or check isConnected in a useEffect.
    };

    // Auto-start recording when connected if we triggered it? 
    // Let's keep it manual: Link Connect -> Start Recording
    useEffect(() => {
        if (isConnected && !isRecording) {
            startRecording();
        }
    }, [isConnected]); // Run when connected


    const handleStop = () => {
        stopRecording();
        disconnect();
    };

    return (
        <main className="min-h-screen bg-zinc-50 dark:bg-black p-4 md:p-8 font-sans">
            <div className="max-w-6xl mx-auto space-y-8">

                {/* Header */}
                <header className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                            RuralMed AI
                        </h1>
                        <p className="text-zinc-500 text-sm">Automated Medical Scribe</p>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Status Indicators */}
                        <div className={`flex items-center gap-2 text-xs font-medium px-3 py-1 rounded-full ${isConnected ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'}`}>
                            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-zinc-400'}`} />
                            {isConnected ? 'Online' : 'Offline'}
                        </div>

                        <AudioVisualizer isRecording={isRecording} />
                    </div>
                </header>

                {/* Controls */}
                <div className="flex gap-4 p-4 bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 items-center justify-between">
                    <div className="flex gap-4">
                        {!isRecording ? (
                            <button
                                onClick={handleStart}
                                className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-blue-200 shadow-lg"
                            >
                                <Mic className="w-5 h-5" />
                                Start <span className="hidden sm:inline">Consultation</span>
                            </button>
                        ) : (
                            <button
                                onClick={handleStop}
                                className="flex items-center gap-2 px-6 py-3 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg font-medium transition-colors"
                            >
                                <Square className="w-5 h-5 fill-current" />
                                End Session
                            </button>
                        )}
                    </div>

                    <button className="flex items-center gap-2 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 rounded-lg border border-zinc-200 transition-colors">
                        <Save className="w-4 h-4" />
                        Commit to Record
                    </button>
                </div>

                {/* Main Workspace */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left: The Live Form */}
                    <div className="lg:col-span-2">
                        <LiveForm data={patientData} />
                    </div>

                    {/* Right: Transcript / Logs (Debug view for POC) */}
                    <div className="space-y-6">
                        <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-4 h-[400px] flex flex-col">
                            <h3 className="text-sm font-semibold text-zinc-500 mb-4 uppercase tracking-wider">Live Updates</h3>
                            <div className="flex-1 overflow-y-auto space-y-2 font-mono text-xs text-zinc-600">
                                {logs.length === 0 && <span className="text-zinc-400 italic">Waiting for updates...</span>}
                                {logs.map((log, i) => (
                                    <div key={i} className="p-2 bg-zinc-50 dark:bg-zinc-800 rounded border-l-2 border-blue-400 animate-in fade-in slide-in-from-left-2 duration-300">
                                        {log}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
