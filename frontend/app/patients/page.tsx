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
        fetch('http://localhost:8000/api/ehr/patients')
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
            const res = await fetch(`http://localhost:8000/api/ehr/patients/${patientToDelete.id}`, {
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
        <main className="min-h-screen p-4 md:p-8 space-y-8 max-w-[1400px] mx-auto animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-1">
                    <Link href="/" className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest hover:text-primary transition-colors mb-2">
                        <ArrowLeft className="w-3 h-3" /> Back to Scribe
                    </Link>
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent font-outfit">
                        Patient Records
                    </h1>
                </div>

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search patients..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 pr-4 py-2 bg-background/50 border border-border rounded-lg text-sm focus:ring-1 focus:ring-primary outline-none w-full md:w-[300px]"
                    />
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-[400px]">
                    <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredPatients.map((patient) => (
                        <motion.div
                            key={patient.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="glass-premium rounded-xl p-6 group hover:border-primary/20 transition-all cursor-pointer"
                            onClick={() => setSelectedPatient(patient)}
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                        <User className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-foreground">{patient.name || "Unknown Patient"}</h3>
                                        <p className="text-xs text-muted-foreground">{patient.age} yrs • {patient.gender}</p>
                                    </div>
                                </div>
                                <span className="text-[10px] font-mono text-muted-foreground bg-muted/50 px-2 py-1 rounded">
                                    ID: {patient.id}
                                </span>
                            </div>

                            <div className="space-y-4">
                                <div className="p-3 bg-muted/20 rounded-lg space-y-2">
                                    <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                        <Activity className="w-3 h-3" /> Vitals
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div><span className="text-muted-foreground">BP:</span> <span className="font-mono font-bold">{patient.bp || "--"}</span></div>
                                        <div><span className="text-muted-foreground">HR:</span> <span className="font-mono font-bold">{patient.pulse || "--"}</span></div>
                                        <div><span className="text-muted-foreground">Temp:</span> <span className="font-mono font-bold">{patient.temp || "--"}</span></div>
                                        <div><span className="text-muted-foreground">SpO2:</span> <span className="font-mono font-bold">{patient.spo2 || "--"}</span></div>
                                    </div>
                                </div>

                                <div>
                                    <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">
                                        <FileText className="w-3 h-3" /> Latest Insight
                                    </div>
                                    <p className="text-sm font-medium text-foreground line-clamp-2">
                                        {patient.tentative_doctor_diagnosis || patient.initial_llm_diagnosis || "No diagnosis recorded"}
                                    </p>
                                </div>

                                <div className="pt-4 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
                                    <div className="flex items-center gap-1">
                                        <Calendar className="w-3 h-3" />
                                        {new Date(patient.created_at).toLocaleDateString()}
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button
                                            className="text-primary font-bold hover:underline"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedPatient(patient);
                                            }}
                                        >
                                            View Details
                                        </button>
                                        <button
                                            className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setPatientToDelete(patient);
                                            }}
                                            title="Delete Record"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ))}

                    {filteredPatients.length === 0 && (
                        <div className="col-span-full py-12 text-center text-muted-foreground">
                            <p>No patients found.</p>
                        </div>
                    )}
                </div>
            )}

            {/* Patient Detail Modal */}
            <AnimatePresence>
                {selectedPatient && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
                        >
                            <div className="p-6 border-b border-border flex items-center justify-between bg-muted/20">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                                        <User className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold">{selectedPatient.name}</h2>
                                        <p className="text-sm text-muted-foreground">{selectedPatient.age} yrs • {selectedPatient.gender} • ID: {selectedPatient.id}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectedPatient(null)}
                                    className="p-2 hover:bg-muted rounded-full transition-colors"
                                >
                                    <ArrowLeft className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-8 space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {/* Vitals */}
                                    <div className="md:col-span-1 space-y-4">
                                        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                            <Activity className="w-3 h-3" /> Vitals
                                        </h3>
                                        <div className="grid grid-cols-1 gap-3">
                                            <DetailBox label="Blood Pressure" value={selectedPatient.bp} />
                                            <DetailBox label="Pulse Rate" value={selectedPatient.pulse} unit="BPM" />
                                            <DetailBox label="Temperature" value={selectedPatient.temp} />
                                            <DetailBox label="SpO2" value={selectedPatient.spo2} unit="%" />
                                        </div>
                                    </div>

                                    {/* Clinical Info */}
                                    <div className="md:col-span-2 space-y-6">
                                        <div className="space-y-4">
                                            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                                <ClipboardList className="w-3 h-3" /> Consultation Summary
                                            </h3>
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Chief Complaint</label>
                                                    <p className="text-sm border-l-2 border-primary/30 pl-3 py-1">{selectedPatient.chief_complaint || "None recorded"}</p>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="text-[10px] font-bold text-primary uppercase block mb-1">Doctor's Diagnosis</label>
                                                        <p className="text-sm bg-primary/5 p-3 rounded-lg border border-primary/10">
                                                            {selectedPatient.tentative_doctor_diagnosis || "Awaiting physician input..."}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] font-bold text-blue-500 uppercase block mb-1">AI clinical Insights</label>
                                                        <p className="text-sm bg-blue-500/5 p-3 rounded-lg border border-blue-500/10 italic">
                                                            {selectedPatient.initial_llm_diagnosis || "None generated"}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <ListSection title="Symptoms" items={selectedPatient.symptoms} />
                                            <ListSection title="Medications" items={selectedPatient.medications} />
                                            <ListSection title="Personal History" items={selectedPatient.medical_history} />
                                            <ListSection title="Family History" items={selectedPatient.family_history} />
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
        <div className="p-3 bg-muted/20 border border-border/50 rounded-lg">
            <label className="text-[9px] font-bold text-muted-foreground uppercase block mb-1">{label}</label>
            <p className="text-sm font-bold font-mono">
                {value || "--"} <span className="text-[10px] font-normal text-muted-foreground ml-1">{unit}</span>
            </p>
        </div>
    )
}

function ListSection({ title, items }: any) {
    const list = Array.isArray(items) ? items : [];
    return (
        <div className="space-y-2">
            <h4 className="text-[10px] font-bold text-muted-foreground uppercase">{title}</h4>
            <div className="flex flex-wrap gap-2">
                {list.length > 0 ? list.map((item: string, i: number) => (
                    <span key={i} className="px-2 py-1 bg-muted rounded text-[10px] font-medium border border-border/50">{item}</span>
                )) : (
                    <span className="text-[10px] text-muted-foreground italic">None recorded</span>
                )}
            </div>
        </div>
    )
}

