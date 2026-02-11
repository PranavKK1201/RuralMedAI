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
        <div className="space-y-6 p-4 bg-transparent">
            {/* Header Section */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-white/5 border border-white/10 flex items-center justify-center">
                        <ClipboardList className="w-4 h-4 text-foreground/60" />
                    </div>
                    <h2 className="text-sm font-bold tracking-[0.2em] uppercase text-foreground/80">Clinical Summary</h2>
                </div>
                <div className="px-2 py-1 bg-white/5 rounded border border-white/10 flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full bg-white animate-pulse" />
                    <span className="text-[9px] font-bold text-foreground/40 uppercase tracking-widest">Active Sink</span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                {/* Patient Profile */}
                <div className="md:col-span-8 space-y-4">
                    <div className="flex items-center gap-2 text-[9px] font-bold text-muted-foreground uppercase tracking-[0.3em]">
                        <User className="w-3 h-3" /> Identification
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="md:col-span-2">
                            <InputField label="Name" name="name" register={register} highlight={lastUpdatedField === 'name'} placeholder="Required" />
                        </div>
                        <InputField label="Age" name="age" register={register} highlight={lastUpdatedField === 'age'} placeholder="--" />
                        <InputField label="Gender" name="gender" register={register} highlight={lastUpdatedField === 'gender'} placeholder="--" />
                    </div>
                    <InputField label="Chief Complaint" name="chief_complaint" register={register} highlight={lastUpdatedField === 'chief_complaint'} isTextArea placeholder="Describe primary symptoms..." />
                </div>

                {/* Vitals Summary */}
                <div className="md:col-span-4 space-y-4">
                    <div className="flex items-center gap-2 text-[9px] font-bold text-muted-foreground uppercase tracking-[0.3em]">
                        <Thermometer className="w-3 h-3" /> Biometrics
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <VitalField label="BP" name="vitals.blood_pressure" register={register} highlight={lastUpdatedField === 'vitals'} unit="mmHg" />
                        <VitalField label="HR" name="vitals.pulse" register={register} highlight={lastUpdatedField === 'vitals'} unit="BPM" />
                        <VitalField label="TEMP" name="vitals.temperature" register={register} highlight={lastUpdatedField === 'vitals'} unit="°C" />
                        <VitalField label="SPO2" name="vitals.spo2" register={register} highlight={lastUpdatedField === 'vitals'} unit="%" />
                    </div>
                </div>

                {/* Clinical Notes */}
                <div className="md:col-span-12 space-y-4 pt-4 border-t border-white/5">
                    <div className="flex items-center gap-2 text-[9px] font-bold text-muted-foreground uppercase tracking-[0.3em]">
                        <Activity className="w-3 h-3" /> Diagnostics
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                        <ListSection title="Symptoms" items={data.symptoms} placeholder="..." />
                        <ListSection title="Regimen" items={data.medications} placeholder="..." />
                        <ListSection title="Reactions" items={data.allergies} placeholder="..." />
                        <ListSection title="Medical" items={data.medical_history} placeholder="..." />
                        <ListSection title="Familial" items={data.family_history} placeholder="..." />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                        <InputField
                            label="Clinical Impression"
                            name="tentative_doctor_diagnosis"
                            register={register}
                            highlight={lastUpdatedField === 'tentative_doctor_diagnosis'}
                            isTextArea
                            placeholder="Awaiting provider input..."
                        />
                        <InputField
                            label="Heuristic Analysis"
                            name="initial_llm_diagnosis"
                            register={register}
                            highlight={lastUpdatedField === 'initial_llm_diagnosis'}
                            isTextArea
                            placeholder="Awaiting data..."
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

function InputField({ label, name, register, highlight, isTextArea, placeholder }: any) {
    return (
        <div className="relative group w-full">
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-1.5 px-0.5">{label}</label>
            <div className={`relative transition-all duration-500 rounded border ${highlight ? 'border-white/50 bg-white/10' : 'border-white/30 bg-white/[0.03]'}`}>
                {isTextArea ? (
                    <textarea
                        {...register(name)}
                        placeholder={placeholder}
                        className="w-full p-2.5 text-sm bg-transparent outline-none placeholder:text-white/10 min-h-[100px] resize-none leading-relaxed font-mono text-foreground"
                    />
                ) : (
                    <input
                        {...register(name)}
                        placeholder={placeholder}
                        className="w-full p-2.5 text-sm bg-transparent outline-none placeholder:text-white/10 font-mono text-foreground"
                    />
                )}
            </div>
        </div>
    )
}

function VitalField({ label, name, register, highlight, unit }: any) {
    return (
        <div className={`p-2 rounded border transition-all duration-500 ${highlight ? 'border-white/50 bg-white/10' : 'border-white/30 bg-white/[0.03]'}`}>
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">{label}</label>
            <div className="flex items-baseline gap-1">
                <input
                    {...register(name)}
                    className="w-full bg-transparent text-lg font-bold font-mono outline-none text-foreground placeholder:text-white/5"
                    placeholder="--"
                />
                <span className="text-[10px] font-bold text-white/40">{unit}</span>
            </div>
        </div>
    )
}

function ListSection({ title, items, placeholder }: any) {
    const list = Array.isArray(items) ? items : [];

    return (
        <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{title}</label>
            <div className="p-2 bg-white/[0.03] min-h-[80px] rounded border border-white/30">
                <AnimatePresence mode="popLayout">
                    {list.length ? (
                        <div className="flex flex-col gap-1">
                            {list.map(s => (
                                <motion.div
                                    key={s}
                                    initial={{ opacity: 0, x: -5 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="text-[11px] text-foreground font-mono flex items-center gap-2"
                                >
                                    <span className="w-1 h-1 rounded-full bg-white/20" />
                                    {s}
                                </motion.div>
                            ))}
                        </div>
                    ) : (
                        <span className="text-[10px] text-white/10 font-mono">{placeholder}</span>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
