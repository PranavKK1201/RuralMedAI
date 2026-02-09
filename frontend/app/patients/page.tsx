"use client";

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, User, Activity, Calendar, FileText, Search } from 'lucide-react';
import Link from 'next/link';

export default function PatientsPage() {
    const [patients, setPatients] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        fetch('http://localhost:8005/api/ehr/patients')
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
        p.diagnosis?.toLowerCase().includes(searchTerm.toLowerCase())
    );

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
                            className="glass-premium rounded-xl p-6 group hover:border-primary/20 transition-all"
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
                                        <div><span className="text-muted-foreground">SpO2:</span> <span className="font-mono font-bold">{patient.spo2 || "--"}</span>%</div>
                                    </div>
                                </div>

                                <div>
                                    <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">
                                        <FileText className="w-3 h-3" /> Diagnosis
                                    </div>
                                    <p className="text-sm font-medium text-foreground line-clamp-2">
                                        {patient.diagnosis || "No diagnosis recorded"}
                                    </p>
                                </div>

                                <div className="pt-4 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
                                    <div className="flex items-center gap-1">
                                        <Calendar className="w-3 h-3" />
                                        {new Date(patient.created_at).toLocaleDateString()}
                                    </div>
                                    <button className="text-primary font-bold hover:underline">View Details</button>
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
        </main>
    );
}
