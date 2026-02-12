"use client";

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, User, Activity, Calendar, FileText, Search, ClipboardList, Trash2 } from 'lucide-react';
import Link from 'next/link';

export default function PatientsPage() {
    const [patients, setPatients] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedPatient, setSelectedPatient] = useState<any | null>(null);
    const [patientToDelete, setPatientToDelete] = useState<any | null>(null);

    useEffect(() => {
        fetch('http://localhost:8003/api/ehr/patients')
            .then(res => res.json())
            .then(data => {
                setPatients(data);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, []);

    const filteredPatients = patients.filter(p =>
        p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.tentative_doctor_diagnosis?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.initial_llm_diagnosis?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const deletePatient = async () => {
        if (!patientToDelete) return;

        try {
            const res = await fetch(`http://localhost:8003/api/ehr/patients/${patientToDelete.id}`, {
                method: 'DELETE',
            });
            if (res.ok) {
                setPatients(prev => prev.filter(p => p.id !== patientToDelete.id));
                setPatientToDelete(null);
                if (selectedPatient?.id === patientToDelete.id) {
                    setSelectedPatient(null);
                }
            } else {
                alert("Failed to delete patient");
            }
        } catch (error) {
            console.error(error);
            alert("Error deleting patient");
        }
    };

    return (
        <main className="min-h-screen p-3 md:p-6 space-y-6 max-w-[1440px] mx-auto animate-in fade-in duration-1000 bg-black">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
                <div className="space-y-1">
                    <Link href="/" className="inline-flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em] hover:text-white transition-colors mb-2">
                        <ArrowLeft className="w-2.5 h-2.5" /> Back to Console
                    </Link>
                    <h1 className="text-2xl font-bold tracking-tighter text-white font-outfit uppercase">
                        Archive <span className="text-white/20">/</span> Patients
                    </h1>
                </div>

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20" />
                    <input
                        type="text"
                        placeholder="SEARCH_RECORDS..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded text-[10px] font-mono focus:border-white/40 outline-none w-full md:w-[260px] text-white transition-colors uppercase"
                    />
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-[300px]">
                    <div className="w-4 h-4 border border-white/20 border-t-white animate-spin rounded-full" />
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredPatients.map((patient) => (
                        <motion.div
                            key={patient.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="bg-white/[0.02] border border-white/5 rounded-lg p-4 group hover:border-white/20 hover:bg-white/[0.04] transition-all cursor-pointer relative"
                            onClick={() => setSelectedPatient(patient)}
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded border border-white/10 bg-white/5 flex items-center justify-center text-white/40">
                                        <User className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-xs tracking-tight text-white/90 truncate max-w-[140px] uppercase">{patient.name || "Unknown"}</h3>
                                        <p className="text-[9px] text-white/30 font-mono">{patient.age}Y • {patient.gender}</p>
                                    </div>
                                </div>
                                <span className="text-[8px] font-mono text-white/20 bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
                                    {String(patient.id ?? '').slice(0, 8)}
                                </span>
                            </div>

                            <div className="space-y-4">
                                <div className="p-3 bg-black/40 border border-white/5 rounded space-y-2">
                                    <div className="flex items-center gap-2 text-[8px] font-bold text-white/20 uppercase tracking-[0.2em]">
                                        <Activity className="w-2.5 h-2.5" /> Biometrics
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                                        <div><span className="text-white/20 font-mono">BP:</span> <span className="font-mono text-white/60">{patient.bp || "--"}</span></div>
                                        <div><span className="text-white/20 font-mono">HR:</span> <span className="font-mono text-white/60">{patient.pulse || "--"}</span></div>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-1.5 text-[8px] font-bold text-white/20 uppercase tracking-[0.2em]">
                                        <FileText className="w-2.5 h-2.5" /> Impression
                                    </div>
                                    <p className="text-[11px] font-medium text-white/60 line-clamp-2 leading-relaxed italic">
                                        "{patient.tentative_doctor_diagnosis || patient.initial_llm_diagnosis || "No diagnosis"}"
                                    </p>
                                </div>

                                <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 text-[9px] text-white/20 font-mono">
                                        <Calendar className="w-2.5 h-2.5" />
                                        {new Date(patient.created_at).toLocaleDateString()}
                                    </div>
                                    <button
                                        className="p-1.5 text-white/20 hover:text-rose-500 hover:bg-rose-500/5 rounded transition-all opacity-0 group-hover:opacity-100"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setPatientToDelete(patient);
                                        }}
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    ))}

                    {filteredPatients.length === 0 && (
                        <div className="col-span-full py-12 text-center text-white/20 text-[10px] font-mono uppercase tracking-widest bg-white/[0.01] border border-dashed border-white/5 rounded-xl">
                            <p>Query returned 0 results</p>
                        </div>
                    )}
                </div>
            )}

            {/* Patient Detail Modal */}
            <AnimatePresence>
                {selectedPatient && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.98 }}
                            className="bg-[#050505] border border-white/10 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
                        >
                            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded border border-white/10 bg-white/5 flex items-center justify-center text-white/40">
                                        <User className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold tracking-tight text-white uppercase">{selectedPatient.name}</h2>
                                        <p className="text-[10px] font-mono text-white/30 uppercase">{selectedPatient.age}Y • {selectedPatient.gender} • ID:{selectedPatient.id}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectedPatient(null)}
                                    className="p-2 hover:bg-white/5 rounded-full transition-colors text-white/40 hover:text-white"
                                >
                                    <ArrowLeft className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                    {/* Vitals */}
                                    <div className="md:col-span-1 space-y-6">
                                        <h3 className="text-[10px] font-bold text-white/20 uppercase tracking-[0.3em] flex items-center gap-2">
                                            <Activity className="w-3 h-3" /> Biometrics
                                        </h3>
                                        <div className="grid grid-cols-1 gap-2">
                                            <DetailBox label="Blood Pressure" value={selectedPatient.bp} />
                                            <DetailBox label="Heart Rate" value={selectedPatient.pulse} unit="BPM" />
                                            <DetailBox label="Temperature" value={selectedPatient.temp} />
                                            <DetailBox label="SpO2" value={selectedPatient.spo2} unit="%" />
                                        </div>
                                    </div>

                                    {/* Clinical Info */}
                                    <div className="md:col-span-2 space-y-8">
                                        <div className="space-y-4">
                                            <h3 className="text-[10px] font-bold text-white/20 uppercase tracking-[0.3em] flex items-center gap-2">
                                                <ClipboardList className="w-3 h-3" /> Analysis
                                            </h3>
                                            <div className="space-y-6">
                                                <div>
                                                    <label className="text-[9px] font-bold text-white/20 uppercase block mb-2 tracking-widest">Chief Complaint</label>
                                                    <p className="text-xs text-white/80 border-l border-white/10 pl-4 py-1 leading-relaxed">{selectedPatient.chief_complaint || "None"}</p>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div className="p-4 bg-white/[0.02] border border-white/5 rounded-lg space-y-2">
                                                        <label className="text-[9px] font-bold text-white/40 uppercase block tracking-widest">Medical Impression</label>
                                                        <p className="text-xs text-white/80 leading-relaxed italic">
                                                            {selectedPatient.tentative_doctor_diagnosis || "Awaiting verification"}
                                                        </p>
                                                    </div>
                                                    <div className="p-4 bg-white/[0.01] border border-white/5 rounded-lg space-y-2">
                                                        <label className="text-[9px] font-bold text-white/20 uppercase block tracking-widest">Heuristic Output</label>
                                                        <p className="text-xs text-white/40 leading-relaxed font-mono">
                                                            {selectedPatient.initial_llm_diagnosis || "None"}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4 border-t border-white/5">
                                            <ListSection title="Symptoms" items={selectedPatient.symptoms} />
                                            <ListSection title="Medications" items={selectedPatient.medications} />
                                            <ListSection title="History" items={selectedPatient.medical_history} />
                                            <ListSection title="Family" items={selectedPatient.family_history} />
                                            <ListSection title="Allergies" items={selectedPatient.allergies} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Delete Confirmation Modal */}
            <AnimatePresence>
                {patientToDelete && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4"
                        >
                            <div className="space-y-2 text-center">
                                <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center text-destructive mx-auto">
                                    <Trash2 className="w-6 h-6" />
                                </div>
                                <h3 className="text-lg font-bold">Delete Patient Record?</h3>
                                <p className="text-sm text-muted-foreground">
                                    Are you sure you want to delete the record for <span className="font-bold text-foreground">{patientToDelete.name}</span>? This action cannot be undone.
                                </p>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setPatientToDelete(null)}
                                    className="px-4 py-2 rounded-lg border border-border bg-background hover:bg-muted font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={deletePatient}
                                    className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 font-bold transition-colors"
                                >
                                    Delete
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </main>
    );
}

function DetailBox({ label, value, unit }: any) {
    return (
        <div className="p-3 bg-white/[0.02] border border-white/5 rounded">
            <label className="text-[8px] font-bold text-white/20 uppercase block tracking-widest mb-1">{label}</label>
            <p className="text-xs font-bold font-mono text-white/80">
                {value || "--"}<span className="text-[10px] font-normal text-white/20 ml-1">{unit}</span>
            </p>
        </div>
    )
}

function ListSection({ title, items }: any) {
    const list = Array.isArray(items) ? items : [];
    return (
        <div className="space-y-2">
            <h4 className="text-[9px] font-bold text-white/20 uppercase tracking-widest">{title}</h4>
            <div className="flex flex-wrap gap-1.5">
                {list.length > 0 ? list.map((item: string, i: number) => (
                    <span key={i} className="px-1.5 py-0.5 bg-white/5 text-white/60 text-[9px] font-mono border border-white/5 rounded capitalize">{item}</span>
                )) : (
                    <span className="text-[9px] text-white/10 font-mono italic">None</span>
                )}
            </div>
        </div>
    )
}
