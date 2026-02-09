import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import { PatientData } from '@/types';
import { cn } from '@/lib/utils'; // Assuming you have a utils file from shadcn or similar, or we create a simple one.

// Simple cn utility if not present
// import { clsx, type ClassValue } from "clsx"
// import { twMerge } from "tailwind-merge"
// export function cn(...inputs: ClassValue[]) {
//   return twMerge(clsx(inputs))
// }

interface LiveFormProps {
    data: PatientData;
}

export function LiveForm({ data }: LiveFormProps) {
    const { register, setValue, watch } = useForm<PatientData>({ defaultValues: data });
    const [lastUpdatedField, setLastUpdatedField] = useState<string | null>(null);

    // Sync external data with form state
    useEffect(() => {
        Object.keys(data).forEach((key) => {
            const k = key as keyof PatientData;
            if (data[k] !== undefined && JSON.stringify(data[k]) !== JSON.stringify(watch(k))) {
                setValue(k, data[k]);
                setLastUpdatedField(key);
                // Reset highlight after 1s
                setTimeout(() => setLastUpdatedField(null), 1500);
            }
        });
    }, [data, setValue, watch]);

    return (
        <div className="space-y-6 p-6 bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span>📋</span> Live Consultation Intake
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Basic Demographics */}
                <InputField label="Patient Name" name="name" register={register} highlight={lastUpdatedField === 'name'} />
                <div className="grid grid-cols-2 gap-4">
                    <InputField label="Age" name="age" register={register} highlight={lastUpdatedField === 'age'} />
                    <InputField label="Gender" name="gender" register={register} highlight={lastUpdatedField === 'gender'} />
                </div>

                {/* Vitals Section */}
                <div className="md:col-span-2 p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-100 dark:border-zinc-800">
                    <h3 className="text-sm font-medium text-zinc-500 mb-3 uppercase tracking-wider">Vitals</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <InputField label="BP" name="vitals.blood_pressure" register={register} highlight={lastUpdatedField === 'vitals'} />
                        <InputField label="Pulse" name="vitals.pulse" register={register} highlight={lastUpdatedField === 'vitals'} />
                        <InputField label="Temp" name="vitals.temperature" register={register} highlight={lastUpdatedField === 'vitals'} />
                        <InputField label="SpO2" name="vitals.spo2" register={register} highlight={lastUpdatedField === 'vitals'} />
                    </div>
                </div>

                {/* Clinical Notes */}
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Symptoms</label>
                    <div className="p-3 bg-zinc-50 min-h-[60px] rounded-md border border-zinc-200 text-sm">
                        {/* Specialized display for arrays */}
                        {data.symptoms?.map(s => (
                            <span key={s} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 mr-2 mb-2">
                                {s}
                            </span>
                        ))}
                        {(!data.symptoms || data.symptoms.length === 0) && <span className="text-zinc-400 italic">Listening...</span>}
                    </div>
                </div>

                <InputField label="diagnosis" name="diagnosis" register={register} highlight={lastUpdatedField === 'diagnosis'} isTextArea />

            </div>
        </div>
    );
}

function InputField({ label, name, register, highlight, isTextArea }: any) {
    return (
        <div className="relative">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-400 mb-1 capitalize">{label}</label>
            <motion.div
                animate={highlight ? { boxShadow: "0 0 0 2px #3b82f6", scale: 1.02 } : { boxShadow: "0 0 0 0px transparent", scale: 1 }}
                transition={{ duration: 0.3 }}
                className="rounded-md"
            >
                {isTextArea ? (
                    <textarea {...register(name)} className="w-full p-2 rounded-md border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all" rows={3} />
                ) : (
                    <input {...register(name)} className="w-full p-2 rounded-md border border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
                )}
            </motion.div>
        </div>
    )
}
