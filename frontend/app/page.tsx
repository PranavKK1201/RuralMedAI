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
        <main className="h-screen flex flex-col bg-background text-foreground overflow-hidden text-[13px]">
            {/* 1. Header & Toolbar - Fixed Top */}
            <header className="flex-none border-b border-white/5 bg-white/[0.03] backdrop-blur-xl z-50">
                <div className="flex items-center justify-between px-3 py-1">
                    {/* Brand */}
                    <div className="flex items-center gap-2 pl-10 pt-3">
                        <div>
                            <h1 className="text-sm font-bold tracking-[0.4em] text-white">RURALMED</h1>
                        </div>
                    </div>

                    {/* Central Toolbar */}
                    <div className="flex-1 max-w-lg mx-4 hidden md:flex items-center gap-3 bg-white/5 p-1 rounded border border-white/5">
                        <select
                            className="bg-transparent text-[11px] font-medium text-foreground/70 focus:outline-none cursor-pointer hover:text-white transition-colors max-w-[130px]"
                            value={selectedDeviceId}
                            onChange={(e) => setSelectedDeviceId(e.target.value)}
                            disabled={isRecording}
                        >
                            {audioDevices.map(device => (
                                <option key={device.deviceId} value={device.deviceId} className="bg-black text-white">
                                    {device.label || `Mic ${device.deviceId.slice(0, 5)}...`}
                                </option>
                            ))}
                        </select>
                        <div className="h-3 w-px bg-white/5" />

                        <div className="flex-1">
                            <AudioVisualizer isRecording={isRecording} />
                        </div>

                        <div className="h-3 w-px bg-white/5" />

                        {!isRecording ? (
                            <button
                                onClick={handleStart}
                                className="flex items-center gap-1 px-3 py-1 bg-white text-black rounded text-[11px] font-bold hover:bg-white/90 transition-all cursor-pointer"
                            >
                                <Mic className="w-2.5 h-2.5" />
                                START
                            </button>
                        ) : (
                            <button
                                onClick={handleStop}
                                className="flex items-center gap-1 px-3 py-1 bg-white text-black rounded text-[11px] font-bold hover:bg-white/90 transition-all border border-white/5 cursor-pointer"
                            >
                                <Square className="w-2.5 h-2.5 fill-current" />
                                STOP
                            </button>
                        )}
                    </div>

                    {/* Right Status REMOVED */}
                    <div className="flex items-center gap-3">
                    </div>
                </div>
            </header>

            {/* 2. Main Workspace - Fluid Split Layout */}
            <div className="flex-1 flex overflow-hidden">

                {/* Left Panel: Clinical Form (65%) */}
                <div className="flex-1 flex flex-col min-w-0 border-r border-white/5 relative">
                    {/* Form Header REMOVED */}
                    
                    {/* Scrollable Form Content */}
                    <div className="flex-1 overflow-y-auto p-2 scrollbar-hide">
                        <div className="max-w-6xl mx-auto">
                            <LiveForm data={patientData} />
                        </div>
                    </div>
                </div>


                {/* Right Panel: Consultation Stream */}
                <div className="w-[280px] xl:w-[320px] flex flex-col bg-white/[0.04] border-l border-white/5">
                    {/* Action box for Push to EHR and Archive */}
                    <div className="flex-none p-3 border-b border-white/5 space-y-2 bg-white/[0.04]">
                        <button
                            onClick={handleCommit}
                            disabled={isCommiting}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white text-black hover:bg-neutral-200 rounded font-bold transition-all disabled:opacity-50 uppercase tracking-[0.2em] text-[10px] shadow-lg"
                        >
                            {isCommiting ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                                <Save className="w-3.5 h-3.5" />
                            )}
                            Push to EHR
                        </button>

                        <Link
                            href="/patients"
                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-white font-bold transition-all text-[10px] uppercase tracking-widest shadow-sm"
                        >
                            <FileText className="w-3.5 h-3.5" />
                            Records Archive
                        </Link>
                    </div>

                    <div className="flex-none px-3 py-2 border-b border-white/5 flex items-center justify-between bg-white/[0.04]">
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/40">Session Stream</h3>
                        <div className="flex items-center gap-1.5 text-[8px] text-white/20 font-mono">
                            <span className="w-1 h-1 rounded-full bg-white/20" />
                            ACTIVE
                        </div>
                    </div>

                    <div
                        ref={scrollRef}
                        className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide"
                    >
                        {transcript.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-center p-4 opacity-20">
                                <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/40">Awaiting Uplink...</p>
                            </div>
                        )}

                        <AnimatePresence initial={false}>
                            {transcript.map((item) => (
                                <motion.div
                                    key={item.id}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="text-[12px]"
                                >
                                    {item.type === 'text' ? (
                                        <div className="group relative space-y-1">
                                            <p className="text-white/80 whitespace-pre-wrap leading-relaxed font-mono text-[11px]">{item.content}</p>
                                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <div className="h-px flex-1 bg-white/5" />
                                                <span className="text-[8px] text-white/30 font-mono">{item.timestamp}</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="my-2 p-3 rounded bg-white/[0.02] border border-white/10 space-y-1.5">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[8px] font-bold text-white/50 uppercase tracking-widest">{item.toolInfo.field}</span>
                                                </div>
                                                <span className="text-[8px] text-white/20 font-mono">{item.timestamp}</span>
                                            </div>
                                            <p className="text-[10px] font-mono text-white/40 truncate bg-black/40 p-1.5 rounded border border-white/5">
                                                {typeof item.toolInfo.value === 'string' ? item.toolInfo.value : JSON.stringify(item.toolInfo.value)}
                                            </p>
                                        </div>
                                    )}
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>

                    {/* Footer Info */}
                    <div className="flex-none p-3 border-t border-white/5 bg-black/40 text-[8px] tracking-[0.4em] uppercase font-bold text-center text-white/20">
                        AES-256 • ENCRYPTED_UPLINK
                    </div>
                </div>
            </div>
        </main>
    );
}

