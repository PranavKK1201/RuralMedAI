"use client";

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import { PatientData } from '@/types';
import { ClipboardList, Thermometer, User, Activity } from 'lucide-react';

interface LiveFormProps {
    data: PatientData;
}

export function LiveForm({ data }: LiveFormProps) {
    const { register, setValue, watch, control } = useForm<PatientData>({ defaultValues: data });
    const [lastUpdatedField, setLastUpdatedField] = useState<string | null>(null);

    useEffect(() => {
        Object.keys(data).forEach((key) => {
            const k = key as keyof PatientData;
            if (data[k] !== undefined) {
                // Special handling for vitals object
                if (k === 'vitals' && typeof data[k] === 'object') {
                    Object.keys(data[k]!).forEach(vKey => {
                        const path = `vitals.${vKey}` as any;
                        if (JSON.stringify((data[k] as any)[vKey]) !== JSON.stringify(watch(path))) {
                            setValue(path, (data[k] as any)[vKey]);
                            setLastUpdatedField('vitals');
                            setTimeout(() => setLastUpdatedField(null), 1000);
                        }
                    });
                } else if (JSON.stringify(data[k]) !== JSON.stringify(watch(k))) {
                    setValue(k, data[k]);
                    setLastUpdatedField(k);
                    setTimeout(() => setLastUpdatedField(null), 1000);
                }
            }
        });
    }, [data, setValue, watch]);

    return (
        <div className="space-y-6 p-6 lg:p-8 bg-card/30 backdrop-blur-xl border border-border/50 rounded-2xl shadow-xl h-full">
            <div className="flex items-center justify-between mb-6 border-b border-border/50 pb-6">
                <div>
                    <h2 className="text-2xl font-bold text-foreground font-outfit tracking-tight flex items-center gap-3">
                        <ClipboardList className="w-6 h-6 text-primary" />
                        Clinical Intake Sheet
                    </h2>
                </div>
                <div className="px-3 py-1.5 bg-primary/10 rounded-full border border-primary/20 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Live Syncing</span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                {/* Patient Profile (Span 7) */}
                <div className="md:col-span-7 space-y-5">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-4">
                        <User className="w-3.5 h-3.5" /> Patient Profile
                    </div>
                    <InputField label="Full Name" name="name" register={register} highlight={lastUpdatedField === 'name'} placeholder="Awaiting identification..." textSize="text-lg" />
                    <div className="grid grid-cols-2 gap-4">
                        <InputField label="Age" name="age" register={register} highlight={lastUpdatedField === 'age'} placeholder="--" textSize="text-base" />
                        <InputField label="Gender" name="gender" register={register} highlight={lastUpdatedField === 'gender'} placeholder="--" textSize="text-base" />
                    </div>
                    <InputField label="Chief Complaint" name="chief_complaint" register={register} highlight={lastUpdatedField === 'chief_complaint'} isTextArea placeholder="Reason for seeking care..." textSize="text-base" />
                </div>

                {/* Vitals Summary (Span 5) */}
                <div className="md:col-span-5 space-y-5">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-4">
                        <Thermometer className="w-3.5 h-3.5" /> Vitals Monitor
                    </div>
                    <div className="grid grid-cols-2 gap-3 bg-muted/20 p-4 rounded-xl border border-border/50 h-[calc(100%-2rem)] content-start">
                        <VitalField label="Blood Pressure" name="vitals.blood_pressure" register={register} highlight={lastUpdatedField === 'vitals'} unit="mmHg" />
                        <VitalField label="Pulse Rate" name="vitals.pulse" register={register} highlight={lastUpdatedField === 'vitals'} unit="BPM" />
                        <VitalField label="Temperature" name="vitals.temperature" register={register} highlight={lastUpdatedField === 'vitals'} unit="°C" />
                        <VitalField label="SpO2 Level" name="vitals.spo2" register={register} highlight={lastUpdatedField === 'vitals'} unit="%" />
                    </div>
                </div>

                {/* Clinical Notes & Observations (Full Width) */}
                <div className="md:col-span-12 space-y-6 border-t border-border/30 pt-6">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-4">
                        <Activity className="w-3.5 h-3.5" /> Professional Findings
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        <ListSection title="Subjective Symptoms" items={data.symptoms} placeholder="Listening for patient complaints..." />
                        <ListSection title="Current Medications" items={data.medications} placeholder="Identify current regimen..." color="emerald" />
                        <ListSection title="Known Allergies" items={data.allergies} placeholder="Scan for drug/food reactions..." color="rose" />
                        <ListSection title="Personal History" items={data.medical_history} placeholder="Past conditions/surgeries..." color="blue" />
                        <ListSection title="Family History" items={data.family_history} placeholder="Relatives' conditions..." color="primary" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4">
                        <InputField
                            label="Doctor's Tentative Diagnosis"
                            name="tentative_doctor_diagnosis"
                            register={register}
                            highlight={lastUpdatedField === 'tentative_doctor_diagnosis'}
                            isTextArea
                            placeholder="Awaiting doctor's clinical input..."
                            textSize="text-base"
                        />
                        <InputField
                            label="Initial AI Insights"
                            name="initial_llm_diagnosis"
                            register={register}
                            highlight={lastUpdatedField === 'initial_llm_diagnosis'}
                            isTextArea
                            placeholder="AI analysis based on symptoms/history..."
                            textSize="text-base"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

function InputField({ label, name, register, highlight, isTextArea, placeholder, textSize = "text-sm" }: any) {
    return (
        <div className="relative group w-full">
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 px-1 transition-colors group-hover:text-primary">{label}</label>
            <motion.div
                animate={highlight ? { scale: 1.01, borderColor: "var(--color-primary)" } : { scale: 1, borderColor: "rgba(255,255,255,0.1)" }}
                className="relative overflow-hidden rounded-lg border bg-background/50 backdrop-blur-sm transition-all shadow-sm w-full"
            >
                {isTextArea ? (
                    <textarea
                        {...register(name)}
                        placeholder={placeholder}
                        className={`w-full p-3 ${textSize} bg-transparent outline-none transition-all placeholder:text-muted-foreground/30 min-h-[120px] resize-none leading-relaxed`}
                    />
                ) : (
                    <input
                        {...register(name)}
                        placeholder={placeholder}
                        className={`w-full p-3 ${textSize} bg-transparent outline-none transition-all placeholder:text-muted-foreground/30`}
                    />
                )}
                <AnimatePresence>
                    {highlight && (
                        <motion.div
                            initial={{ opacity: 0, x: -100 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0 }}
                            className="absolute bottom-0 left-0 h-0.5 w-full bg-primary"
                        />
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    )
}

function VitalField({ label, name, register, highlight, unit }: any) {
    return (
        <div className="p-3 bg-background/30 rounded-lg border border-border/50 transition-all hover:bg-background/50 flex flex-col justify-center min-h-[90px]">
            <label className="block text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1">{label}</label>
            <div className="flex items-baseline gap-1">
                <input
                    {...register(name)}
                    className="w-full bg-transparent text-xl font-bold font-mono outline-none text-foreground placeholder:text-muted-foreground/20"
                    placeholder="--"
                />
                <span className="text-[10px] font-bold text-muted-foreground/60">{unit}</span>
            </div>
        </div>
    )
}

function ListSection({ title, items, placeholder, color = "primary" }: any) {
    const list = Array.isArray(items) ? items : [];
    const colors: any = {
        primary: "bg-primary/20 text-primary border-primary/30",
        emerald: "bg-emerald-500/20 text-emerald-500 border-emerald-500/30",
        rose: "bg-rose-500/20 text-rose-500 border-rose-500/30",
        blue: "bg-blue-500/20 text-blue-500 border-blue-500/30"
    };

    return (
        <div className="space-y-2">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{title}</label>
            <div className="p-3 bg-muted/10 min-h-[80px] rounded-xl border border-border/50 shadow-inner group transition-all hover:bg-muted/20">
                <AnimatePresence mode="popLayout">
                    {list.length ? (
                        <div className="flex flex-wrap gap-2">
                            {list.map(s => (
                                <motion.span
                                    key={s}
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0.8, opacity: 0 }}
                                    className={`inline-flex items-center px-3 py-1 rounded-md text-[10px] font-bold border ${colors[color]}`}
                                >
                                    {s}
                                </motion.span>
                            ))}
                        </div>
                    ) : (
                        <span className="text-xs text-muted-foreground/40 italic font-medium">{placeholder}</span>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
