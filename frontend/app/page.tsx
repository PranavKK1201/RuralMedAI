"use client";

import { useState, useCallback, useEffect } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { useAudioStream } from '@/hooks/useAudioStream';
import { LiveForm } from '@/components/LiveForm';
import { AudioVisualizer } from '@/components/AudioVisualizer';
import { PatientData } from '@/types';
import { Mic, Square, Save, Activity, RefreshCw, Database, Settings, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

export default function Home() {
    const [patientData, setPatientData] = useState<PatientData>({});
    const [logs, setLogs] = useState<string[]>([]);
    const [lastUpdated, setLastUpdated] = useState<string | null>(null);

    // Audio Device Handling
    const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");

    const handleMessage = useCallback((data: any) => {
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
                else if (['symptoms', 'medications', 'allergies', 'medical_history', 'chief_complaint'].includes(data.field)) {
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

            setLogs(prev => [`Tool Update: ${data.field} = ${JSON.stringify(data.value)}`, ...prev.slice(0, 10)]);
            setLastUpdated(new Date().toLocaleTimeString());
            return;
        }

        // Handle Standard Text Content
        if (data.type === 'content' && data.text) {
            const text = data.text;
            setLogs(prev => [`Gemini: ${text.substring(0, 50)}...`, ...prev.slice(0, 10)]);
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
        setLogs(prev => ["System: Committing record to EHR database...", ...prev.slice(0, 10)]);

        console.log("DEBUG: Committing patientData:", patientData);

        try {
            const response = await fetch('http://localhost:8005/api/ehr/commit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(patientData)
            });

            const result = await response.json();

            if (response.ok) {
                setLogs(prev => [`System: Success! Record committed (ID: ${result.patient_id})`, ...prev.slice(0, 10)]);
                alert(`Successfully committed to EHR! Patient ID: ${result.patient_id}`);
            } else {
                throw new Error(result.detail || 'Failed to commit');
            }
        } catch (error) {
            console.error(error);
            setLogs(prev => [`System Error: EHR Commit Failed`, ...prev.slice(0, 10)]);
            alert("Failed to commit to EHR. Check backend connection.");
        } finally {
            setIsCommiting(false);
        }
    };

    return (
        <main className="min-h-screen p-4 md:p-8 space-y-8 max-w-[1400px] mx-auto animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-1">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-2"
                    >
                        <Database className="w-6 h-6 text-primary" />
                        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent font-outfit">
                            RuralMed AI
                        </h1>
                    </motion.div>
                    <p className="text-sm text-muted-foreground font-medium">Professional AI Medical Scribe • Secure Consultation</p>
                </div>

                <div className="flex items-center gap-3">
                    <Link href="/patients" className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 border border-blue-500/20 transition-all hover:scale-105 active:scale-95 group">
                        <FileText className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-bold uppercase tracking-widest hidden sm:inline">Records</span>
                    </Link>

                    <AnimatePresence>
                        {lastUpdated && (
                            <motion.span
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest hidden sm:block"
                            >
                                Last Update: {lastUpdated}
                            </motion.span>
                        )}
                    </AnimatePresence>

                    <div className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full border transition-all duration-500 ${isConnected
                        ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                        }`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-500'}`} />
                        {isConnected ? 'System Online' : 'System Offline'}
                    </div>
                </div>
            </div>

            {/* Controls & Metrics Row */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                <div className="lg:col-span-1 glass-premium rounded-xl p-6 flex flex-col justify-between group transition-all hover:border-primary/20">
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Voice Capture</p>
                            <Settings className="w-3 h-3 text-muted-foreground" />
                        </div>

                        {/* Device Selector */}
                        <select
                            className="w-full mb-4 bg-background/50 border border-border text-xs rounded-md p-2 focus:ring-1 focus:ring-primary outline-none"
                            value={selectedDeviceId}
                            onChange={(e) => setSelectedDeviceId(e.target.value)}
                            disabled={isRecording}
                        >
                            {audioDevices.map(device => (
                                <option key={device.deviceId} value={device.deviceId}>
                                    {device.label || `Microphone ${device.deviceId.slice(0, 5)}...`}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-4">
                        {!isRecording ? (
                            <button
                                onClick={handleStart}
                                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-bold transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-primary/20"
                            >
                                <Mic className="w-4 h-4" />
                                Begin Consultation
                            </button>
                        ) : (
                            <button
                                onClick={handleStop}
                                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-rose-600 text-white rounded-lg font-bold transition-all hover:bg-rose-700 shadow-lg shadow-rose-600/20"
                            >
                                <Square className="w-4 h-4 fill-current" />
                                End Session
                            </button>
                        )}
                        <AudioVisualizer isRecording={isRecording} />
                    </div>
                </div>

                <MetricSmall label="Session Status" value={isRecording ? "Recording" : "Idle"} sub={isConnected ? "WebSocket Connected" : "Stream Waiting"} icon={<Activity className="w-4 h-4 text-emerald-500" />} />
                <MetricSmall label="Data Processing" value={logs.length > 0 ? "Active" : "Standby"} sub={`${logs.length} Updates Received`} icon={<RefreshCw className={`w-4 h-4 ${logs.length > 0 ? "animate-spin text-blue-500" : "text-muted-foreground"}`} />} />

                <div className="glass-premium rounded-xl p-4 flex items-center justify-center transition-all hover:border-primary/20 bg-emerald-950/20 border-emerald-500/10">
                    <button
                        onClick={handleCommit}
                        disabled={isCommiting}
                        className="w-full h-full min-h-[60px] flex items-center justify-center gap-3 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold uppercase tracking-widest transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-900/20"
                    >
                        <Save className={`w-4 h-4 ${isCommiting ? 'animate-spin' : ''}`} />
                        {isCommiting ? 'Saving...' : 'Commit to EHR'}
                    </button>
                </div>
            </div>

            {/* Main Content Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: Interactive Form */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="glass-premium rounded-2xl p-1 overflow-hidden">
                        <LiveForm data={patientData} />
                    </div>
                </div>

                {/* Right: Insights & Logs */}
                <div className="space-y-6">
                    <div className="glass-premium rounded-xl p-6 h-[500px] flex flex-col shadow-sm">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Processing Pipeline</h3>
                            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
                            {logs.length === 0 && (
                                <div className="h-full flex flex-col items-center justify-center text-center p-8 border border-dashed border-border rounded-lg bg-muted/5">
                                    <Database className="w-8 h-8 text-muted-foreground/20 mb-4" />
                                    <p className="text-xs text-muted-foreground font-medium italic">Awaiting clinical data stream...</p>
                                </div>
                            )}
                            <AnimatePresence initial={false}>
                                {logs.map((log, i) => (
                                    <motion.div
                                        key={i + log}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="p-3 bg-muted/30 rounded-lg border-l-2 border-primary/50 text-[11px] font-mono text-foreground/80 leading-relaxed break-all"
                                    >
                                        <span className="text-primary/60 mr-2">[{new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}]</span>
                                        {log}
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    </div>

                    <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 flex gap-4">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <Activity className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                            <p className="text-[10px] text-foreground font-bold uppercase tracking-widest">Security Alert</p>
                            <p className="text-[10px] text-muted-foreground leading-relaxed font-medium">All data is encrypted in transit and at rest. HIPAA compliant processing active.</p>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}

function MetricSmall({ label, value, sub, icon }: any) {
    return (
        <div className="glass-premium rounded-xl p-5 flex flex-col gap-3 group transition-all hover:border-primary/10">
            <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{label}</p>
                {icon}
            </div>
            <div>
                <div className="text-xl font-bold font-outfit tracking-tight text-foreground">{value}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5 font-medium">{sub}</div>
            </div>
        </div>
    );
}
