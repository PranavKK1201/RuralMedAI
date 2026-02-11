"use client";

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import { PatientData } from '@/types';
import { ClipboardList, Thermometer, User, Activity, ShieldAlert, FileText, Zap, CreditCard, CheckCircle2, XCircle, Info } from 'lucide-react';

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
        <div className="space-y-4 p-4 bg-transparent h-full flex flex-col overflow-hidden">
            {/* Header Section */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded bg-white/5 border border-white/10 flex items-center justify-center shadow-2xl">
                        <ClipboardList className="w-4.5 h-4.5 text-foreground/80" />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold tracking-[0.2rem] uppercase text-foreground/90">Intelligent Clinical Scribe</h2>
                        <p className="text-[8px] text-white/30 uppercase tracking-[0.2em] font-mono mt-0.5">Real-time Data Extraction & Analysis</p>
                    </div>
                </div>
                <div className="px-3 py-1 bg-white/5 rounded border border-white/10 flex items-center gap-2">
                    <div className="w-1.2 h-1.2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                    <span className="text-[9px] font-bold text-foreground/80 uppercase tracking-widest">LIVE_EXTRACTION</span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-x-6 gap-y-4 flex-1 overflow-hidden">
                {/* Patient Profile */}
                <div className="md:col-span-8 space-y-3 flex flex-col">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.4em]">
                        <User className="w-3 h-3" /> Identification
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div className="md:col-span-2">
                            <InputField label="Name" name="name" register={register} highlight={lastUpdatedField === 'name'} placeholder="Full Name" />
                        </div>
                        <InputField label="Age" name="age" register={register} highlight={lastUpdatedField === 'age'} placeholder="--" />
                        <InputField label="Gender" name="gender" register={register} highlight={lastUpdatedField === 'gender'} placeholder="--" />
                    </div>
                    <div className="flex-1 min-h-[50px]">
                        <InputField label="Chief Complaint" name="chief_complaint" register={register} highlight={lastUpdatedField === 'chief_complaint'} isTextArea placeholder="Describe symptoms..." />
                    </div>
                </div>

                {/* Vitals Summary */}
                <div className="md:col-span-4 space-y-3 flex flex-col">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.4em]">
                        <Thermometer className="w-3 h-3" /> Biometrics
                    </div>
                    <div className="grid grid-cols-2 gap-3 flex-1">
                        <VitalField label="BP" name="vitals.blood_pressure" register={register} highlight={lastUpdatedField === 'vitals'} unit="mmHg" />
                        <VitalField label="HR" name="vitals.pulse" register={register} highlight={lastUpdatedField === 'vitals'} unit="BPM" />
                        <VitalField label="TEMP" name="vitals.temperature" register={register} highlight={lastUpdatedField === 'vitals'} unit="°C" />
                        <VitalField label="SPO2" name="vitals.spo2" register={register} highlight={lastUpdatedField === 'vitals'} unit="%" />
                    </div>
                </div>

                {/* Scheme Eligibility Checker */}
                <div className="md:col-span-12 pt-1.5 border-t border-white/5">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-blue-400/60 uppercase tracking-[0.4em] mb-3">
                        <CreditCard className="w-3.5 h-3.5" /> Eligibility Verification
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                        <div className="md:col-span-8 grid grid-cols-1 md:grid-cols-3 gap-3">
                            <InputField label="Ration Card" name="ration_card_type" register={register} highlight={lastUpdatedField === 'ration_card_type'} placeholder="Type..." />
                            <InputField label="Income" name="income_bracket" register={register} highlight={lastUpdatedField === 'income_bracket'} placeholder="Annual..." />
                            <InputField label="Occupation" name="occupation" register={register} highlight={lastUpdatedField === 'occupation'} placeholder="Job..." />
                        </div>
                        
                        <div className="md:col-span-4 h-full">
                            <EligibilityStatus data={data} />
                        </div>
                    </div>
                </div>

                {/* Clinical Notes */}
                <div className="md:col-span-12 space-y-4 pt-1.5 border-t border-white/5 flex flex-col flex-1">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.4em]">
                        <Activity className="w-3.5 h-3.5 text-white/40" /> Clinical Intelligence
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3 shrink-0">
                        <ListSection title="Symptoms" items={data.symptoms} placeholder="..." />
                        <ListSection title="Medications" items={data.medications} placeholder="..." />
                        <ListSection title="Allergies" items={data.allergies} placeholder="..." />
                        <ListSection title="History" items={data.medical_history} placeholder="..." />
                        <ListSection title="Family History" items={data.family_history} placeholder="..." />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-[60px]">
                        <InputField
                            label="Clinical Impression"
                            name="tentative_doctor_diagnosis"
                            register={register}
                            highlight={lastUpdatedField === 'tentative_doctor_diagnosis'}
                            isTextArea
                            placeholder="Physician findings..."
                        />
                        <InputField
                            label="Diagnostic Rationale"
                            name="initial_llm_diagnosis"
                            register={register}
                            highlight={lastUpdatedField === 'initial_llm_diagnosis'}
                            isTextArea
                            placeholder="AI rationale..."
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

function EligibilityStatus({ data }: { data: any }) {
    // Check if we have backend-provided eligibility data, otherwise fallback to simple frontend logic
    const backendData = data.scheme_eligibility;
    
    const isEligiblePMJAY = backendData ? backendData.pmjay?.eligible : (
        data.ration_card_type?.toLowerCase().includes('bpl') || 
        data.ration_card_type?.toLowerCase().includes('antyodaya') ||
        data.occupation?.toLowerCase().includes('laborer')
    );

    const isEligibleState = backendData ? backendData.state_scheme?.eligible : (
        data.age > 60 || isEligiblePMJAY
    );

    const reasons = backendData?.pmjay?.reasons || [];

    return (
        <div className="bg-white/[0.03] border border-white/10 rounded-md p-2.5 space-y-2 h-full flex flex-col justify-center min-h-[70px]">
            <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Eligibility Record</span>
                {backendData && (
                    <span className="text-[7px] font-bold text-blue-400/80 bg-blue-500/10 px-1 border border-blue-500/20 rounded">VERIFIED</span>
                )}
            </div>

            <div className="space-y-1">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                        {isEligiblePMJAY ? <CheckCircle2 className="w-3 h-3 text-green-400" /> : <Info className="w-3 h-3 text-white/10" />}
                        <span className="text-[10px] font-bold text-white/80">PM-JAY</span>
                    </div>
                    <span className={`text-[8px] font-bold uppercase tracking-wider ${isEligiblePMJAY ? 'text-green-400' : 'text-white/10'}`}>
                        {isEligiblePMJAY ? 'ELIGIBLE' : 'PENDING'}
                    </span>
                </div>

                {isEligiblePMJAY && reasons.length > 0 && (
                    <div className="pl-4.5 space-y-0.5">
                        {reasons.map((r: string, i: number) => (
                            <p key={i} className="text-[6px] text-white/30 uppercase leading-none italic">
                                • {r}
                            </p>
                        ))}
                    </div>
                )}

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                        {isEligibleState ? <CheckCircle2 className="w-3 h-3 text-green-400" /> : <Info className="w-3 h-3 text-white/10" />}
                        <span className="text-[10px] font-bold text-white/80">State Health</span>
                    </div>
                    <span className={`text-[8px] font-bold uppercase tracking-wider ${isEligibleState ? 'text-green-400' : 'text-white/10'}`}>
                        {isEligibleState ? 'ELIGIBLE' : 'PENDING'}
                    </span>
                </div>
            </div>
        </div>
    );
}

function InputField({ label, name, register, highlight, isTextArea, placeholder }: any) {
    return (
        <div className="relative group w-full flex flex-col h-full">
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-1 px-0.5">{label}</label>
            <div className={`relative transition-all duration-500 rounded border flex-1 ${highlight ? 'border-white/50 bg-white/10' : 'border-white/30 bg-white/[0.03]'}`}>
                {isTextArea ? (
                    <textarea
                        {...register(name)}
                        placeholder={placeholder}
                        className="w-full p-2.5 text-sm bg-transparent outline-none placeholder:text-white/10 min-h-[60px] h-full resize-none leading-relaxed font-mono text-foreground"
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
        <div className={`p-3 rounded border transition-all duration-500 h-full flex flex-col justify-between ${highlight ? 'border-white/50 bg-white/10' : 'border-white/30 bg-white/[0.03]'}`}>
            <label className="block text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1">{label}</label>
            <div className="flex items-baseline gap-1.5">
                <input
                    {...register(name)}
                    className="w-full bg-transparent text-lg font-bold font-mono outline-none text-foreground placeholder:text-white/5"
                    placeholder="--"
                />
                <span className="text-[9px] font-bold text-white/40">{unit}</span>
            </div>
        </div>
    )
}

function ListSection({ title, items, placeholder }: any) {
    const list = Array.isArray(items) ? items : [];

    return (
        <div className="space-y-1.5 flex flex-col h-full">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{title}</label>
            <div className="p-2.5 bg-white/[0.03] min-h-[60px] h-full rounded border border-white/20 flex-1">
                <AnimatePresence mode="popLayout">
                    {list.length ? (
                        <div className="flex flex-col gap-1">
                            {list.map(s => (
                                <motion.div
                                    key={s}
                                    initial={{ opacity: 0, x: -5 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="text-[11px] text-foreground font-mono flex items-center gap-1.5"
                                >
                                    <span className="w-1 h-1 rounded-full bg-white/20" />
                                    {s}
                                </motion.div>
                            ))}
                        </div>
                    ) : (
                        <span className="text-[9px] text-white/10 font-mono">{placeholder}</span>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
