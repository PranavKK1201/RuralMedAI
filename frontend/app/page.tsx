"use client";

import { useState, useCallback, useEffect, useRef } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { useAudioStream } from '@/hooks/useAudioStream';
import { LiveForm } from '@/components/LiveForm';
import { AudioVisualizer } from '@/components/AudioVisualizer';
import { PatientData, TranscriptItem } from '@/types';
import { Mic, Square, Save, RefreshCw, FileText, ShieldCheck, Eraser, Clock3, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { clearScribeSession, loadScribeSession, saveScribeSession } from '@/lib/sessionStore';

function nowClock() {
    return new Date().toLocaleTimeString([], {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

function makeId(prefix: string) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function applyPatientUpdate(prev: PatientData, field: string, value: unknown): PatientData {
    const next: PatientData = { ...prev };

    if (field.startsWith('vitals.')) {
        const vitalField = field.split('.')[1] as keyof NonNullable<PatientData['vitals']>;
        if (['temperature', 'blood_pressure', 'pulse', 'spo2'].includes(vitalField)) {
            next.vitals = { ...(next.vitals || {}), [vitalField]: value as string };
            return next;
        }
    }

    if (['temperature', 'blood_pressure', 'pulse', 'spo2'].includes(field)) {
        next.vitals = { ...(next.vitals || {}), [field]: value as string };
        return next;
    }

    (next as Record<string, unknown>)[field] = value;
    return next;
}

function hasMeaningfulPatientData(data: PatientData): boolean {
    return Object.entries(data).some(([key, value]) => {
        if (key === 'id') return false;
        if (value === null || value === undefined) return false;
        if (typeof value === 'string') return value.trim() !== '';
        if (Array.isArray(value)) return value.length > 0;
        if (typeof value === 'object') {
            return Object.values(value as Record<string, unknown>).some((item) => {
                if (item === null || item === undefined) return false;
                return String(item).trim() !== '';
            });
        }
        return true;
    });
}

export default function Home() {
    const [patientData, setPatientData] = useState<PatientData>({});
    const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
    const [activePatientId, setActivePatientId] = useState<number | null>(null);

    // Resume Logic
    const [searchParams, setSearchParams] = useState<URLSearchParams | null>(null);
    useEffect(() => {
        setSearchParams(new URLSearchParams(window.location.search));
    }, []);

    useEffect(() => {
        const patientId = searchParams?.get('patient_id');
        if (patientId) {
            console.log(`Resuming session for patient ${patientId}...`);
            fetch(`http://localhost:8003/api/ehr/patients/${patientId}`)
                .then(res => res.json())
                .then(data => {
                    console.log("Loaded patient data:", data);
                    setPatientData(data);

                    // Add Summary to Transcript
                    if (data.transcript_summary) {
                        const now = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
                        setTranscript(prev => [...prev, {
                            id: 'sys-resume-' + Date.now(),
                            type: 'text',
                            content: `**RESUMED SESSION**\n\nIMPORTANT POINTS:\n${data.transcript_summary}`,
                            timestamp: now
                        }]);
                    }
                })
                .catch(err => console.error("Failed to load patient", err));
        }
    }, [searchParams]);
    const [entryMode, setEntryMode] = useState<'create' | 'update'>('create');
    const [formInstanceKey, setFormInstanceKey] = useState(0);
    const [sessionHydrated, setSessionHydrated] = useState(false);
    const [sessionSyncedAt, setSessionSyncedAt] = useState<string | null>(null);

    const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
    const [isCommiting, setIsCommiting] = useState(false);

    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const snapshot = loadScribeSession();
        if (snapshot) {
            const restoredId = typeof snapshot.activePatientId === 'number'
                ? snapshot.activePatientId
                : typeof snapshot.patientData?.id === 'number'
                    ? snapshot.patientData.id
                    : null;
            setActivePatientId(restoredId);
            setEntryMode(snapshot.entryMode || (restoredId ? 'update' : 'create'));
            setPatientData(snapshot.patientData || {});
            setTranscript(Array.isArray(snapshot.transcript) ? snapshot.transcript : []);
            setSessionSyncedAt(new Date(snapshot.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
        }
        setSessionHydrated(true);
    }, []);

    useEffect(() => {
        if (!sessionHydrated) return;

        const updatedAt = new Date().toISOString();
        saveScribeSession({
            patientData: activePatientId ? { ...patientData, id: activePatientId } : patientData,
            transcript: transcript.slice(-400),
            activePatientId,
            entryMode,
            updatedAt
        });
        setSessionSyncedAt(nowClock());
    }, [patientData, transcript, activePatientId, entryMode, sessionHydrated]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [transcript]);

    const handleMessage = useCallback((data: any) => {
        const ts = nowClock();

        if (data.type === 'update' && data.field) {
            setPatientData(prev => applyPatientUpdate(prev, data.field, data.value));
            setTranscript(prev => ([
                ...prev,
                {
                    id: makeId('tool'),
                    type: 'tool',
                    toolInfo: { field: String(data.field), value: data.value },
                    timestamp: ts
                }
            ]));
            return;
        }

        if (data.type === 'content' && data.text) {
            setTranscript(prev => {
                const lastItem = prev[prev.length - 1];
                if (lastItem && lastItem.type === 'text') {
                    return [
                        ...prev.slice(0, -1),
                        { ...lastItem, content: `${lastItem.content || ''}${data.text}` }
                    ];
                }

                return [
                    ...prev,
                    {
                        id: makeId('txt'),
                        type: 'text',
                        content: data.text,
                        timestamp: ts
                    }
                ];
            });
        }
    }, []);

    const { isConnected, connect, disconnect, sendMessage } = useSocket(handleMessage);

    const onAudioChunk = useCallback((base64Audio: string) => {
        if (!isConnected) return;

        sendMessage({
            realtimeInput: {
                mediaChunks: [{
                    mimeType: 'audio/pcm',
                    data: base64Audio
                }]
            }
        });
    }, [isConnected, sendMessage]);

    const { isRecording, startRecording, stopRecording, getAudioDevices } = useAudioStream(onAudioChunk);

    useEffect(() => {
        getAudioDevices().then(devices => {
            setAudioDevices(devices);
            if (devices.length > 0) {
                const defaultDevice = devices.find(d => d.deviceId === 'default');
                setSelectedDeviceId(defaultDevice ? defaultDevice.deviceId : devices[0].deviceId);
            }
        });
    }, [getAudioDevices]);

    useEffect(() => {
        if (isConnected && !isRecording) {
            startRecording(selectedDeviceId);
        }
    }, [isConnected, isRecording, startRecording, selectedDeviceId]);

    const handleStart = () => connect();

    const handleStop = () => {
        stopRecording();
        disconnect();
    };

    const handleResetSession = () => {
        stopRecording();
        disconnect();
        setActivePatientId(null);
        setEntryMode('create');
        setPatientData({});
        setFormInstanceKey((prev) => prev + 1);
        setTranscript([]);
        clearScribeSession();
        setSessionSyncedAt(null);
    };

    const handleStartNewEntry = async () => {
        let nextId = 1;

        try {
            const response = await fetch('http://localhost:8003/api/ehr/patients');
            if (response.ok) {
                const data = await response.json();
                if (Array.isArray(data) && data.length > 0) {
                    const maxId = data.reduce((max: number, item: unknown) => {
                        const rawId = typeof item === 'object' && item !== null ? (item as { id?: unknown }).id : null;
                        const parsed = Number.parseInt(String(rawId ?? ''), 10);
                        if (Number.isNaN(parsed)) return max;
                        return Math.max(max, parsed);
                    }, 0);
                    nextId = maxId + 1;
                }
            }
        } catch (error) {
            console.error('Failed to fetch latest patient id:', error);
        }

        setActivePatientId(nextId);
        setEntryMode('create');
        setPatientData({ id: nextId });
        setFormInstanceKey((prev) => prev + 1);
        setTranscript([
            {
                id: makeId('sys-new'),
                type: 'text',
                content: `System: Started a new patient entry (ID: ${nextId}).`,
                timestamp: nowClock(),
            }
        ]);
    };

    const handlePatientIdChange = (raw: string) => {
        const normalized = raw.replace(/[^\d]/g, '');
        if (!normalized) {
            setActivePatientId(null);
            setEntryMode('create');
            setPatientData(prev => {
                if (prev.id === undefined) return prev;
                const { id, ...rest } = prev;
                return rest;
            });
            return;
        }

        const parsed = Number.parseInt(normalized, 10);
        if (Number.isNaN(parsed) || parsed <= 0) return;
        setActivePatientId(parsed);
        setEntryMode('update');
        setPatientData(prev => ({ ...prev, id: parsed }));
    };

    const handleCommit = async () => {
        if (!hasMeaningfulPatientData(patientData)) {
            alert('No patient data to commit.');
            return;
        }

        setIsCommiting(true);
        const ts = nowClock();
        const isUpdate = entryMode === 'update' && activePatientId !== null;
        setTranscript(prev => [...prev, {
            id: makeId('sys'),
            type: 'text',
            content: isUpdate
                ? `System: Updating EHR record ${activePatientId}...`
                : 'System: Creating a new EHR record...',
            timestamp: ts
        }]);

        try {
            const payload: PatientData = isUpdate && activePatientId
                ? { ...patientData, id: activePatientId }
                : (() => {
                    const { id, ...rest } = patientData;
                    return rest;
                })();
            const updateEndpoint = activePatientId ? `http://localhost:8003/api/ehr/patients/${activePatientId}` : '';
            const createEndpoint = 'http://localhost:8003/api/ehr/commit';
            const createPayload = (() => {
                const { id, ...rest } = payload;
                return rest;
            })();

            let response = await fetch(isUpdate ? updateEndpoint : createEndpoint, {
                method: isUpdate ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(isUpdate ? payload : createPayload),
            });
            let result = await response.json();

            const shouldFallbackToCreate = isUpdate && !response.ok && (
                response.status === 404 ||
                String(result?.detail || '').toLowerCase().includes('not found')
            );

            if (shouldFallbackToCreate) {
                setTranscript(prev => [...prev, {
                    id: makeId('sys-fallback'),
                    type: 'text',
                    content: `System: Record ${activePatientId} not found. Creating a new record instead...`,
                    timestamp: ts
                }]);
                response = await fetch(createEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(createPayload),
                });
                result = await response.json();
            }

            if (response.ok) {
                const savedId = Number.parseInt(String(result.patient_id ?? activePatientId ?? ''), 10);
                if (!Number.isNaN(savedId)) {
                    setActivePatientId(savedId);
                    setEntryMode('update');
                    setPatientData(prev => ({ ...prev, id: savedId }));
                }
                setTranscript(prev => [...prev, {
                    id: makeId('sys-success'),
                    type: 'text',
                    content: `System: Success! Record ${isUpdate ? 'updated' : 'saved'} (ID: ${result.patient_id ?? activePatientId})`,
                    timestamp: ts
                }]);
                alert(`Successfully ${isUpdate ? 'updated' : 'saved'} EHR record. Patient ID: ${result.patient_id ?? activePatientId}`);
            } else {
                throw new Error(result.detail || 'Failed to commit');
            }
        } catch (error) {
            console.error(error);
            setTranscript(prev => [...prev, { id: makeId('sys-error'), type: 'text', content: 'System Error: EHR Commit Failed', timestamp: ts }]);
            alert('Failed to commit to EHR. Check backend connection.');
        } finally {
            setIsCommiting(false);
        }
    };

    return (
        <main className="h-screen flex flex-col bg-[#f3f4f6] text-foreground overflow-hidden text-[13px]">
            <header className="flex-none border-b border-slate-200 bg-white backdrop-blur-xl z-50">
                <div className="flex items-center justify-between px-3 py-1.5 gap-3">
                    <div className="flex items-center gap-2 pl-1">
                        <h1 className="text-sm font-bold tracking-[0.4em] text-slate-900 pl-3">RURALMED</h1>
                        <span className="text-[9px] px-2 py-1 border border-cyan-500/30 bg-cyan-500/10 text-cyan-300/80 rounded uppercase tracking-widest font-bold">
                            Scribe Console
                        </span>
                    </div>

                    <div className="flex-1 max-w-2xl mx-2 hidden md:flex items-center gap-3 bg-slate-100 p-1 rounded-xl border border-slate-200">
                        <select
                            className="bg-transparent text-[11px] font-medium text-foreground/70 focus:outline-none cursor-pointer hover:text-slate-900 transition-colors max-w-[180px]"
                            value={selectedDeviceId}
                            onChange={(e) => setSelectedDeviceId(e.target.value)}
                            disabled={isRecording}
                        >
                            {audioDevices.map(device => (
                                <option key={device.deviceId} value={device.deviceId} className="bg-white text-slate-900">
                                    {device.label || `Mic ${device.deviceId.slice(0, 5)}...`}
                                </option>
                            ))}
                        </select>

                        <div className="h-3 w-px bg-slate-300" />
                        <div className="flex-1"><AudioVisualizer isRecording={isRecording} /></div>
                        <div className="h-3 w-px bg-slate-300" />
                        <div className="flex items-center gap-1">
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.2em]">ID</span>
                            <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={activePatientId ? String(activePatientId) : ''}
                                onChange={(e) => handlePatientIdChange(e.target.value)}
                                placeholder="New"
                                className="w-20 h-7 px-2 rounded border border-slate-200 bg-slate-100 text-[11px] font-mono text-slate-900/85 outline-none focus:border-cyan-400/40"
                            />
                            <button
                                onClick={handleStartNewEntry}
                                className="h-7 w-7 inline-flex items-center justify-center rounded border border-cyan-400/50 bg-cyan-50 text-cyan-700 hover:bg-cyan-100 transition-colors"
                                title="Start new entry"
                            >
                                <Plus className="w-3 h-3" />
                            </button>
                        </div>
                        <div className="h-3 w-px bg-slate-300" />

                        {!isRecording ? (
                            <button
                                onClick={handleStart}
                                className="flex items-center gap-1 px-3 py-1 bg-slate-900 text-white rounded text-[11px] font-bold hover:bg-slate-800 transition-all cursor-pointer"
                            >
                                <Mic className="w-2.5 h-2.5" /> START
                            </button>
                        ) : (
                            <button
                                onClick={handleStop}
                                className="flex items-center gap-1 px-3 py-1 bg-slate-900 text-white rounded text-[11px] font-bold hover:bg-slate-800 transition-all border border-slate-700 cursor-pointer"
                            >
                                <Square className="w-2.5 h-2.5 fill-current" /> STOP
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="hidden lg:flex items-center gap-1.5 text-[9px] border border-slate-200 rounded px-2 py-1 bg-white">
                            <Clock3 className="w-3 h-3 text-slate-500" />
                            <span className="text-slate-500 uppercase tracking-widest font-bold">Sync</span>
                            <span className="font-mono text-slate-600">{sessionSyncedAt || '--:--:--'}</span>
                        </div>

                        <Link
                            href="/claims"
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-400/90 text-black rounded text-[10px] font-black uppercase tracking-widest hover:bg-emerald-300 transition-colors"
                        >
                            <ShieldCheck className="w-3 h-3" /> Claims Track
                        </Link>
                    </div>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden bg-[#f3f4f6]">
                <div className="flex-1 flex flex-col min-w-0 border-r border-slate-200 relative bg-[#f3f4f6]">
                    {/* Form Header REMOVED */}

                    {/* Scrollable Form Content */}
                    <div className="flex-1 overflow-y-auto p-2">
                        <div className="max-w-7xl mx-auto h-full">
                            <LiveForm key={formInstanceKey} data={patientData} />
                        </div>
                    </div>
                </div>

                <div className="w-[300px] xl:w-[340px] flex flex-col bg-white border-l border-slate-200">
                    <div className="flex-none p-3 border-b border-slate-200 space-y-2 bg-white">
                        <button
                            onClick={handleCommit}
                            disabled={isCommiting}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white text-black hover:bg-neutral-200 rounded font-bold transition-all disabled:opacity-50 uppercase tracking-[0.2em] text-[10px] shadow-lg"
                        >
                            {isCommiting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                            {entryMode === 'update' && activePatientId ? 'Update EHR' : 'Push to EHR'}
                        </button>

                        <div className="grid grid-cols-2 gap-2">
                            <Link
                                href="/patients"
                                className="flex items-center justify-center gap-2 py-2 rounded bg-slate-100 border border-slate-200 hover:bg-slate-200 hover:border-slate-300 text-slate-900 font-bold transition-all text-[9px] uppercase tracking-widest"
                            >
                                <FileText className="w-3 h-3" /> Archive
                            </Link>
                            <button
                                onClick={handleResetSession}
                                className="flex items-center justify-center gap-2 py-2 rounded bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 font-bold transition-all text-[9px] uppercase tracking-widest"
                            >
                                <Eraser className="w-3 h-3" /> Reset
                            </button>
                        </div>
                    </div>

                    <div className="flex-none px-3 py-2 border-b border-slate-200 flex items-center justify-between bg-white">
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Session Stream</h3>
                        <div className="flex items-center gap-1.5 text-[8px] text-slate-400 font-mono">
                            <span className={`w-1 h-1 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-slate-300'}`} />
                            {isConnected ? 'LIVE' : 'IDLE'}
                        </div>
                    </div>

                    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
                        {transcript.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-center p-4 opacity-20">
                                <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-slate-500">Awaiting Uplink...</p>
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
                                            <p className="text-slate-700 whitespace-pre-wrap leading-relaxed font-mono text-[11px]">{item.content}</p>
                                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <div className="h-px flex-1 bg-slate-200" />
                                                <span className="text-[8px] text-slate-400 font-mono">{item.timestamp}</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="my-2 p-3 rounded bg-slate-50 border border-slate-200 space-y-1.5">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">{item.toolInfo?.field}</span>
                                                <span className="text-[8px] text-slate-400 font-mono">{item.timestamp}</span>
                                            </div>
                                            <p className="text-[10px] font-mono text-slate-500 truncate bg-slate-100 p-1.5 rounded border border-slate-200">
                                                {typeof item.toolInfo?.value === 'string' ? item.toolInfo.value : JSON.stringify(item.toolInfo?.value)}
                                            </p>
                                        </div>
                                    )}
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>

                    <div className="flex-none p-3 border-t border-slate-200 bg-slate-100 text-[8px] tracking-[0.4em] uppercase font-bold text-center text-slate-400">
                        SESSION CACHE ACTIVE • AES-256
                    </div>
                </div>
            </div>
        </main>
    );
}
