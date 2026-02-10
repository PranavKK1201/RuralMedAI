"use client";

import { useState, useCallback, useEffect, useRef } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { useAudioStream } from '@/hooks/useAudioStream';
import { LiveForm } from '@/components/LiveForm';
import { AudioVisualizer } from '@/components/AudioVisualizer';
import { PatientData } from '@/types';
import { Mic, Square, Save, Activity, RefreshCw, Database, Settings, FileText, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

export default function Home() {
    const [patientData, setPatientData] = useState<PatientData>({});
    const [transcript, setTranscript] = useState<any[]>([]);
    const [lastUpdated, setLastUpdated] = useState<string | null>(null);

    // Audio Device Handling
    const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");

    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll transcript
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [transcript]);

    const handleMessage = useCallback((data: any) => {
        const now = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

        // Handle Direct Tool Updates from Backend
        if (data.type === 'update') {
            setPatientData(prev => {
                const newData = { ...prev };

                // Handle nested vitals updates (e.g. "vitals.temperature")
                if (data.field.startsWith('vitals.')) {
                    const vitalField = data.field.split('.')[1];
                    if (['temperature', 'blood_pressure', 'pulse', 'spo2'].includes(vitalField)) {
                        if (!newData.vitals) newData.vitals = {};
                        (newData.vitals as any)[vitalField] = data.value;
                    }
                }
                // Handle direct vitals updates (legacy/fallback)
                else if (['temperature', 'blood_pressure', 'pulse', 'spo2'].includes(data.field)) {
                    if (!newData.vitals) newData.vitals = {};
                    (newData.vitals as any)[data.field] = data.value;
                }
                // Handle other fields
                else if (['symptoms', 'medications', 'allergies', 'medical_history', 'family_history', 'chief_complaint'].includes(data.field)) {
                    (newData as any)[data.field] = data.value;
                }
                else if (['tentative_doctor_diagnosis', 'initial_llm_diagnosis'].includes(data.field)) {
                    (newData as any)[data.field] = data.value;
                }
                else {
                    (newData as any)[data.field] = data.value;
                }
                return newData;
            });

            // Add Tool Call to Transcript
            setTranscript(prev => [
                ...prev,
                {
                    id: Math.random().toString(36).substring(7),
                    type: 'tool',
                    toolInfo: { field: data.field, value: data.value },
                    timestamp: now
                }
            ]);
            setLastUpdated(now);
            return;
        }

        // Handle Standard Text Content
        if (data.type === 'content' && data.text) {
            setTranscript(prev => {
                const lastItem = prev[prev.length - 1];
                // If last item is text, append to it
                if (lastItem && lastItem.type === 'text') {
                    return [
                        ...prev.slice(0, -1),
                        { ...lastItem, content: (lastItem.content || '') + data.text }
                    ];
                }
                // Otherwise start new text block
                return [
                    ...prev,
                    {
                        id: Math.random().toString(36).substring(7),
                        type: 'text',
                        content: data.text,
                        timestamp: now
                    }
                ];
            });
        }
    }, []);

    const { isConnected, connect, disconnect, sendMessage } = useSocket(handleMessage);

    // Initial audio chunk callback
    const onAudioChunk = useCallback((base64Audio: string) => {
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
    }, [isConnected, sendMessage]);

    const { isRecording, startRecording, stopRecording, getAudioDevices } = useAudioStream(onAudioChunk);

    // Fetch devices on mount
    useEffect(() => {
        getAudioDevices().then(devices => {
            setAudioDevices(devices);
            if (devices.length > 0) {
                // Try to find default or first
                const defaultDevice = devices.find(d => d.deviceId === 'default');
                setSelectedDeviceId(defaultDevice ? defaultDevice.deviceId : devices[0].deviceId);
            }
        });
    }, [getAudioDevices]);


    const handleStart = async () => {
        connect();
    };

    useEffect(() => {
        if (isConnected && !isRecording) {
            startRecording(selectedDeviceId);
        }
    }, [isConnected, isRecording, startRecording, selectedDeviceId]);


    const handleStop = () => {
        stopRecording();
        disconnect();
    };

    const [isCommiting, setIsCommiting] = useState(false);

    const handleCommit = async () => {
        if (!patientData || Object.keys(patientData).length === 0) {
            alert("No patient data to commit.");
            return;
        }
        setIsCommiting(true);
        const now = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setTranscript(prev => [...prev, { id: 'sys-' + Date.now(), type: 'text', content: 'System: Committing record to EHR database...', timestamp: now }]);

        console.log("DEBUG: Committing patientData:", patientData);

        try {
            const response = await fetch('http://localhost:8000/api/ehr/commit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(patientData)
            });

            const result = await response.json();

            if (response.ok) {
                setTranscript(prev => [...prev, { id: 'sys-success-' + Date.now(), type: 'text', content: `System: Success! Record committed (ID: ${result.patient_id})`, timestamp: now }]);
                alert(`Successfully committed to EHR! Patient ID: ${result.patient_id}`);
            } else {
                throw new Error(result.detail || 'Failed to commit');
            }
        } catch (error) {
            console.error(error);
            setTranscript(prev => [...prev, { id: 'sys-err-' + Date.now(), type: 'text', content: `System Error: EHR Commit Failed`, timestamp: now }]);
            alert("Failed to commit to EHR. Check backend connection.");
        } finally {
            setIsCommiting(false);
        }
    };

    return (
        <main className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
            {/* 1. Header & Toolbar - Fixed Top */}
            <header className="flex-none border-b border-border/40 bg-background/80 backdrop-blur-md z-50">
                <div className="flex items-center justify-between px-4 py-3">
                    {/* Brand */}
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                            <Database className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold font-outfit tracking-tight">RuralMed AI</h1>
                            <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Secure Scribe Active</span>
                            </div>
                        </div>
                    </div>

                    {/* Central Toolbar */}
                    <div className="flex-1 max-w-2xl mx-8 hidden md:flex items-center gap-4 bg-muted/30 p-1.5 rounded-xl border border-border/50">
                        <select
                            className="bg-transparent text-xs font-medium text-foreground/80 focus:outline-none cursor-pointer hover:text-foreground transition-colors max-w-[200px]"
                            value={selectedDeviceId}
                            onChange={(e) => setSelectedDeviceId(e.target.value)}
                            disabled={isRecording}
                        >
                            {audioDevices.map(device => (
                                <option key={device.deviceId} value={device.deviceId}>
                                    {device.label || `Mic ${device.deviceId.slice(0, 5)}...`}
                                </option>
                            ))}
                        </select>
                        <div className="h-4 w-px bg-border" />

                        <div className="flex-1">
                            <AudioVisualizer isRecording={isRecording} />
                        </div>

                        <div className="h-4 w-px bg-border" />

                        {!isRecording ? (
                            <button
                                onClick={handleStart}
                                className="flex items-center gap-2 px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-bold hover:opacity-90 transition-all shadow-sm"
                            >
                                <Mic className="w-3.5 h-3.5" />
                                Start Protocol
                            </button>
                        ) : (
                            <button
                                onClick={handleStop}
                                className="flex items-center gap-2 px-4 py-1.5 bg-destructive text-destructive-foreground rounded-lg text-xs font-bold hover:opacity-90 transition-all shadow-sm animate-pulse"
                            >
                                <Square className="w-3.5 h-3.5 fill-current" />
                                End Protocol
                            </button>
                        )}
                    </div>

                    {/* Right Actions */}
                    <div className="flex items-center gap-3">
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-bold uppercase tracking-widest ${isConnected ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                            }`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                            {isConnected ? 'Online' : 'Offline'}
                        </div>

                        <Link href="/patients" className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                            <FileText className="w-5 h-5" />
                            <span className="text-xs font-bold uppercase tracking-widest hidden md:inline-block">History</span>
                        </Link>
                    </div>
                </div>
            </header>

            {/* 2. Main Workspace - Fluid Split Layout */}
            <div className="flex-1 flex overflow-hidden">

                {/* Left Panel: Clinical Form (65%) */}
                <div className="flex-1 flex flex-col min-w-0 border-r border-border/40 relative">
                    {/* Form Header */}
                    <div className="flex-none p-4 flex items-center justify-between border-b border-border/40 bg-muted/10">
                        <div className="flex items-center gap-2">
                            <Activity className="w-4 h-4 text-primary" />
                            <h2 className="text-sm font-bold uppercase tracking-widest text-foreground/80">Clinical Intake Sheet</h2>
                        </div>
                        <AnimatePresence>
                            {lastUpdated && (
                                <motion.span
                                    initial={{ opacity: 0, x: 10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0 }}
                                    className="text-[10px] bg-primary/10 text-primary px-2 py-1 rounded-md font-mono"
                                >
                                    UPDATED: {lastUpdated}
                                </motion.span>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Scrollable Form Content */}
                    <div className="flex-1 overflow-y-auto p-6 lg:p-10 scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent">
                        <div className="max-w-4xl mx-auto space-y-8">
                            <LiveForm data={patientData} />

                            <div className="h-20" /> {/* Spacer */}
                        </div>
                    </div>

                    {/* Floating Commit Button */}
                    <div className="absolute bottom-6 right-6 z-10">
                        <button
                            onClick={handleCommit}
                            disabled={isCommiting}
                            className="group flex items-center gap-2 pl-4 pr-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full font-bold shadow-lg shadow-emerald-900/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isCommiting ? (
                                <RefreshCw className="w-5 h-5 animate-spin" />
                            ) : (
                                <Save className="w-5 h-5" />
                            )}
                            <span className="uppercase tracking-wide text-xs">Commit Record</span>
                        </button>
                    </div>
                </div>


                {/* Right Panel: Consultation Stream (35%) */}
                <div className="w-[400px] xl:w-[480px] flex flex-col bg-muted/5 glass-premium border-l border-white/5">
                    <div className="flex-none p-4 border-b border-border/40 flex items-center justify-between">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Session Transcript</h3>
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                            Processing
                        </div>
                    </div>

                    <div
                        ref={scrollRef}
                        className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin"
                    >
                        {transcript.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-40">
                                <Activity className="w-8 h-8 mb-4" />
                                <p className="text-xs font-medium">Listening for conversation...</p>
                            </div>
                        )}

                        <AnimatePresence initial={false}>
                            {transcript.map((item) => (
                                <motion.div
                                    key={item.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="text-sm"
                                >
                                    {item.type === 'text' ? (
                                        <div className="group relative pl-4 border-l-2 border-border/50 hover:border-primary/50 transition-colors py-1">
                                            <p className="text-foreground/90 whitespace-pre-wrap leading-relaxed">{item.content}</p>
                                            <span className="absolute right-0 top-1 text-[9px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">{item.timestamp}</span>
                                        </div>
                                    ) : (
                                        <div className="my-2 p-3 rounded-lg bg-primary/5 border border-primary/10 flex items-start gap-3">
                                            <Database className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                                            <div className="space-y-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold text-primary uppercase">{item.toolInfo.field}</span>
                                                    <span className="text-[9px] text-muted-foreground">{item.timestamp}</span>
                                                </div>
                                                <p className="text-xs font-mono text-foreground/70 truncate">{JSON.stringify(item.toolInfo.value)}</p>
                                            </div>
                                        </div>
                                    )}
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>

                    {/* Footer Info */}
                    <div className="flex-none p-3 border-t border-border/40 bg-background/50 text-[10px] text-center text-muted-foreground">
                        SHA-256 Encrypted • HIPAA Compliant Storage • Gemini 1.5 Pro
                    </div>
                </div>

            </div>
        </main>
    );
}

