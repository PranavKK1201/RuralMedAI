"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, CircleX, RefreshCw } from 'lucide-react';
import { PatientData, TranscriptItem } from '@/types';
import { loadScribeSession } from '@/lib/sessionStore';
import {
    buildEligibilityWorkspace,
    FieldMatchStatus,
    getFieldMatchStatus,
    SchemeEvaluation,
} from '@/lib/claimsEngine';

function cx(...values: Array<string | false | null | undefined>) {
    return values.filter(Boolean).join(' ');
}

export default function ClaimsPage() {
    const [patientData, setPatientData] = useState<PatientData>({});
    const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
    const [lastSyncedAt, setLastSyncedAt] = useState<string>('Not synced');
    const [selectedSchemeId, setSelectedSchemeId] = useState<string | null>(null);
    const [archivedPatients, setArchivedPatients] = useState<any[]>([]);
    const [selectedPatientKey, setSelectedPatientKey] = useState<string>('live');
    const [documentChecks, setDocumentChecks] = useState<Record<string, Record<string, boolean>>>({});

    const lastSessionUpdateRef = useRef<string | null>(null);
    const selectedPatientKeyRef = useRef<string>('live');

    const hydrateFromSession = useCallback(() => {
        if (selectedPatientKeyRef.current !== 'live') return;
        const snapshot = loadScribeSession();
        if (!snapshot) return;
        if (snapshot.updatedAt === lastSessionUpdateRef.current) return;

        lastSessionUpdateRef.current = snapshot.updatedAt;
        setPatientData(snapshot.patientData || {});
        setTranscript(snapshot.transcript || []);

        const parsedDate = new Date(snapshot.updatedAt);
        setLastSyncedAt(
            Number.isNaN(parsedDate.getTime())
                ? 'Not synced'
                : parsedDate.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false,
                })
        );
    }, []);

    const loadArchivedPatients = useCallback(async () => {
        try {
            const response = await fetch('http://localhost:8003/api/ehr/patients');
            const data = await response.json();
            if (Array.isArray(data)) setArchivedPatients(data);
        } catch (error) {
            console.error('Failed to fetch archived patients:', error);
        }
    }, []);

    useEffect(() => {
        selectedPatientKeyRef.current = selectedPatientKey;
    }, [selectedPatientKey]);

    useEffect(() => {
        hydrateFromSession();
        loadArchivedPatients();

        const interval = window.setInterval(hydrateFromSession, 2500);
        const onStorage = (event: StorageEvent) => {
            if (event.key === 'ruralmedai:sessions:live-scribe') {
                hydrateFromSession();
            }
        };

        window.addEventListener('storage', onStorage);

        return () => {
            window.clearInterval(interval);
            window.removeEventListener('storage', onStorage);
        };
    }, [hydrateFromSession, loadArchivedPatients]);

    useEffect(() => {
        if (selectedPatientKey === 'live') {
            hydrateFromSession();
            return;
        }

        const patientId = Number.parseInt(selectedPatientKey.replace('ehr-', ''), 10);
        if (Number.isNaN(patientId)) return;

        const record = archivedPatients.find((item) => item.id === patientId);
        if (!record) return;

        const mapped: PatientData = {
            id: record.id,
            name: record.name,
            age: record.age,
            gender: record.gender,
            chief_complaint: record.chief_complaint,
            symptoms: Array.isArray(record.symptoms) ? record.symptoms : [],
            medical_history: Array.isArray(record.medical_history) ? record.medical_history : [],
            family_history: Array.isArray(record.family_history) ? record.family_history : [],
            allergies: Array.isArray(record.allergies) ? record.allergies : [],
            medications: Array.isArray(record.medications) ? record.medications : [],
            tentative_doctor_diagnosis: record.tentative_doctor_diagnosis,
            initial_llm_diagnosis: record.initial_llm_diagnosis,
            ration_card_type: record.ration_card_type,
            income: record.income,
            occupation: record.occupation,
            caste_category: record.caste_category,
            housing_type: record.housing_type,
            location: record.location,
            scheme_eligibility: record.scheme_eligibility,
            vitals: {
                blood_pressure: record.bp,
                pulse: record.pulse,
                temperature: record.temp,
                spo2: record.spo2,
            },
        };

        setPatientData(mapped);
        setTranscript([]);
        setLastSyncedAt(
            record.created_at
                ? new Date(record.created_at).toLocaleString()
                : `Archive ID ${record.id}`
        );
    }, [selectedPatientKey, archivedPatients, hydrateFromSession]);

    const workspace = useMemo(() => buildEligibilityWorkspace(patientData, transcript), [patientData, transcript]);

    useEffect(() => {
        if (!workspace.schemes.length) {
            setSelectedSchemeId(null);
            return;
        }

        if (!selectedSchemeId || !workspace.schemes.some((scheme) => scheme.id === selectedSchemeId)) {
            setSelectedSchemeId(workspace.schemes[0].id);
        }
    }, [workspace.schemes, selectedSchemeId]);

    const selectedScheme = useMemo(
        () => workspace.schemes.find((scheme) => scheme.id === selectedSchemeId) || null,
        [workspace.schemes, selectedSchemeId]
    );

    const handleRefresh = async () => {
        await loadArchivedPatients();
        hydrateFromSession();
    };

    const getCheckedDocumentsCount = useCallback(
        (scheme: SchemeEvaluation) =>
            scheme.requiredDocuments.filter((document) => Boolean(documentChecks[scheme.id]?.[document.id])).length,
        [documentChecks]
    );

    const toggleDocumentCheck = useCallback((schemeId: string, documentId: string) => {
        setDocumentChecks((prev) => ({
            ...prev,
            [schemeId]: {
                ...(prev[schemeId] || {}),
                [documentId]: !prev[schemeId]?.[documentId],
            },
        }));
    }, []);

    return (
        <main className="h-screen bg-background text-foreground overflow-hidden px-3 py-3 md:px-4 md:py-4">
            <div className="h-full flex flex-col max-w-[1700px] mx-auto">
                <header className="flex-none border border-slate-200 rounded-lg bg-slate-50 px-4 py-3 mb-3 grid grid-cols-1 xl:grid-cols-3 gap-3 items-center">
                    <div className="justify-self-start">
                        <Link
                            href="/"
                            className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.2em] text-slate-500 hover:text-slate-900 transition-colors"
                        >
                            <ArrowLeft className="w-3 h-3" /> Back to Scribe
                        </Link>
                        <h1 className="text-xl font-bold text-slate-900 mt-1">Scheme Eligibility</h1>
                        <p className="text-[11px] text-slate-500">Eligibility is computed from captured patient data only</p>
                    </div>

                    <div className="justify-self-center w-full max-w-md">
                        <label className="block text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-1.5">Patient selector</label>
                        <select
                            value={selectedPatientKey}
                            onChange={(e) => {
                                setSelectedPatientKey(e.target.value);
                                setDocumentChecks({});
                            }}
                            className="w-full h-9 px-3 rounded border border-slate-200 bg-white text-sm text-slate-900 outline-none focus:border-cyan-400/40"
                        >
                            <option value="live" className="bg-[#f6f7fb] text-slate-900">Live session patient</option>
                            {archivedPatients.map((patient) => (
                                <option key={patient.id} value={`ehr-${patient.id}`} className="bg-[#f6f7fb] text-slate-900">
                                    {patient.name || 'Unnamed'} • ID {patient.id}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="justify-self-end flex items-center gap-2">
                        <div className="text-[10px] font-mono text-slate-500 border border-slate-200 rounded px-2 py-1">
                            Session sync: {lastSyncedAt}
                        </div>
                        <button
                            onClick={handleRefresh}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-slate-200 bg-white/5 hover:bg-white/10 text-[10px] uppercase tracking-wider font-bold"
                        >
                            <RefreshCw className="w-3 h-3" /> Refresh
                        </button>
                    </div>
                </header>

                <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-12 gap-3">
                    <section className="xl:col-span-4 min-h-0 border border-slate-200 rounded-lg bg-slate-50 p-3 overflow-y-auto">
                        <h2 className="text-sm font-semibold text-slate-900 mb-2">Patient biodata</h2>
                        <p className="text-[11px] text-slate-500 mb-3">Fields turn green/red based on selected scheme criteria.</p>

                        <div className="space-y-2">
                            {workspace.patientFields.map((field) => {
                                const status = getFieldMatchStatus(field.key, selectedScheme);
                                return <BiodataRow key={field.key} label={field.label} value={field.value} status={status} />;
                            })}
                        </div>
                    </section>

                    <section className="xl:col-span-3 min-h-0 border border-slate-200 rounded-lg bg-slate-50 p-3 overflow-y-auto">
                        <h2 className="text-sm font-semibold text-slate-900 mb-2">Schemes list</h2>
                        <p className="text-[11px] text-slate-500 mb-3">Select a scheme to inspect matched and missing criteria.</p>

                        <div className="space-y-2">
                            {workspace.schemes.map((scheme) => (
                                <SchemeCard
                                    key={scheme.id}
                                    scheme={scheme}
                                    checkedDocumentCount={getCheckedDocumentsCount(scheme)}
                                    selected={scheme.id === selectedSchemeId}
                                    onSelect={() => setSelectedSchemeId(scheme.id)}
                                />
                            ))}
                        </div>
                    </section>

                    <section className="xl:col-span-5 min-h-0 border border-slate-200 rounded-lg bg-slate-50 p-3 overflow-y-auto">
                        {!selectedScheme ? (
                            <div className="h-full flex items-center justify-center text-slate-500 text-sm">No scheme selected</div>
                        ) : (
                            <SchemeDetails
                                scheme={selectedScheme}
                                checkedDocuments={documentChecks[selectedScheme.id] || {}}
                                onToggleDocument={toggleDocumentCheck}
                            />
                        )}
                    </section>
                </div>
            </div>
        </main>
    );
}

function BiodataRow({ label, value, status }: { label: string; value: string; status: FieldMatchStatus }) {
    return (
        <div
            className={cx(
                'rounded border p-2.5 space-y-1 transition-colors',
                status === 'match' && 'border-emerald-500/40 bg-emerald-500/10',
                status === 'mismatch' && 'border-rose-500/40 bg-rose-500/10',
                status === 'neutral' && 'border-slate-200 bg-white'
            )}
        >
            <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{label}</p>
                {status === 'match' && <span className="text-[10px] font-semibold text-emerald-700">Matched</span>}
                {status === 'mismatch' && <span className="text-[10px] font-semibold text-rose-700">Not met</span>}
            </div>
            <p className="text-sm text-slate-900 font-medium break-words">{value}</p>
        </div>
    );
}

function SchemeCard({
    scheme,
    checkedDocumentCount,
    selected,
    onSelect,
}: {
    scheme: SchemeEvaluation;
    checkedDocumentCount: number;
    selected: boolean;
    onSelect: () => void;
}) {
    const isEligible = scheme.eligibilityBand === 'eligible';
    const isLikelyNotEligible = scheme.eligibilityBand === 'likely_not_eligible';

    return (
        <button
            onClick={onSelect}
            className={cx(
                'w-full text-left rounded border p-2.5 transition-colors',
                selected ? 'border-cyan-400/40 bg-cyan-500/10' : 'border-slate-200 bg-white hover:bg-white'
            )}
        >
            <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900 leading-tight">{scheme.name}</p>
                <span
                    className={cx(
                        'text-[10px] px-1.5 py-0.5 rounded border font-semibold',
                        isEligible
                            ? 'text-emerald-700 border-emerald-500/40 bg-emerald-500/10'
                            : isLikelyNotEligible
                                ? 'text-amber-700 border-amber-500/40 bg-amber-500/10'
                                : 'text-rose-700 border-rose-500/40 bg-rose-500/10'
                    )}
                >
                    {isEligible ? 'Eligible' : isLikelyNotEligible ? 'Possibly eligible' : 'Not eligible'}
                </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">{scheme.description}</p>
            <div className="text-[10px] text-slate-500 mt-2 flex items-center gap-3">
                <span>Criteria: {scheme.metCriteriaCount}/{scheme.totalCriteriaCount}</span>
                <span>Documents: {checkedDocumentCount}/{scheme.totalDocumentCount}</span>
            </div>
        </button>
    );
}

function SchemeDetails({
    scheme,
    checkedDocuments,
    onToggleDocument,
}: {
    scheme: SchemeEvaluation;
    checkedDocuments: Record<string, boolean>;
    onToggleDocument: (schemeId: string, documentId: string) => void;
}) {
    const metCriteria = scheme.criteria.filter((criterion) => criterion.met);
    const unmetCriteria = scheme.criteria.filter((criterion) => !criterion.met);
    const checkedCount = scheme.requiredDocuments.filter((document) => Boolean(checkedDocuments[document.id])).length;
    const allDocumentsChecked = scheme.requiredDocuments.length > 0 && checkedCount === scheme.requiredDocuments.length;
    const isEligible = scheme.eligibilityBand === 'eligible';
    const isLikelyNotEligible = scheme.eligibilityBand === 'likely_not_eligible';

    return (
        <div className="space-y-4">
            <div className="border-b border-slate-200 pb-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h2 className="text-lg font-semibold text-slate-900">{scheme.name}</h2>
                    <span
                        className={cx(
                            'text-[11px] px-2 py-1 rounded border font-semibold',
                            isEligible
                                ? 'text-emerald-700 border-emerald-500/40 bg-emerald-500/10'
                                : isLikelyNotEligible
                                    ? 'text-amber-700 border-amber-500/40 bg-amber-500/10'
                                    : 'text-rose-700 border-rose-500/40 bg-rose-500/10'
                        )}
                    >
                        {isEligible
                            ? 'Eligible based on current data'
                            : isLikelyNotEligible
                                ? 'Possibly eligible based on current data'
                                : 'Not eligible based on current data'}
                    </span>
                </div>
                <p className="text-[12px] text-slate-500 mt-1">{scheme.description}</p>
                <p className="text-[11px] text-amber-800 mt-2 border border-amber-400/40 bg-amber-100 rounded px-2.5 py-1.5">
                    Signal-based match: Yes/No profile markers are treated as preliminary. Exact scheme criteria and document classes need manual verification.
                </p>
                <p className="text-[11px] text-amber-800 mt-2 border border-amber-400/40 bg-amber-100 rounded px-2.5 py-1.5">
                    ⚠️ Verify Ration Card: Ensure card type is explicitly correct (BPL/AAY/etc.) before proceeding with claim filing.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div className="rounded border border-emerald-400/40 bg-emerald-100 p-3">
                    <h3 className="text-sm font-semibold text-emerald-800 mb-2">Criteria met</h3>
                    {metCriteria.length === 0 ? (
                        <p className="text-[12px] text-emerald-700">No criteria met yet.</p>
                    ) : (
                        <ul className="space-y-2">
                            {metCriteria.map((criterion) => (
                                <li key={criterion.id} className="text-[12px] text-emerald-900">
                                    <div className="flex items-start gap-2">
                                        <CheckCircle2 className="w-3.5 h-3.5 mt-0.5" />
                                        <div>
                                            <p className="font-medium">{criterion.label}</p>
                                            <p className="text-emerald-800">{criterion.description}</p>
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="rounded border border-rose-400/40 bg-rose-100 p-3">
                    <h3 className="text-sm font-semibold text-rose-800 mb-2">Criteria not met</h3>
                    {unmetCriteria.length === 0 ? (
                        <p className="text-[12px] text-rose-700">All criteria are met.</p>
                    ) : (
                        <ul className="space-y-2">
                            {unmetCriteria.map((criterion) => (
                                <li key={criterion.id} className="text-[12px] text-rose-900">
                                    <div className="flex items-start gap-2">
                                        <CircleX className="w-3.5 h-3.5 mt-0.5" />
                                        <div>
                                            <p className="font-medium">{criterion.label}</p>
                                            <p className="text-rose-800">{criterion.description}</p>
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            <div
                className={cx(
                    'rounded border p-3',
                    allDocumentsChecked ? 'border-emerald-400/40 bg-emerald-100' : 'border-rose-400/40 bg-rose-100'
                )}
            >
                <div className="flex items-center justify-between gap-2 mb-2">
                    <h3 className="text-sm font-semibold text-slate-900">Required documents</h3>
                    <span className={cx('text-[10px] font-semibold', allDocumentsChecked ? 'text-emerald-700' : 'text-rose-700')}>
                        {checkedCount}/{scheme.requiredDocuments.length} checked
                    </span>
                </div>
                <div className="space-y-2">
                    {scheme.requiredDocuments.map((document) => (
                        <button
                            key={document.id}
                            onClick={() => onToggleDocument(scheme.id, document.id)}
                            className={cx(
                                'w-full rounded border p-2.5 text-left transition-colors',
                                checkedDocuments[document.id]
                                    ? 'border-emerald-400/40 bg-emerald-100'
                                    : 'border-rose-400/40 bg-rose-100 hover:bg-rose-200/70'
                            )}
                        >
                            <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-medium text-slate-900">{document.name}</p>
                                <span className={cx('text-[10px] font-semibold', checkedDocuments[document.id] ? 'text-emerald-700' : 'text-rose-700')}>
                                    {checkedDocuments[document.id] ? 'Checked' : 'Unchecked'}
                                </span>
                            </div>
                            <p className="text-[11px] mt-1 text-slate-600">{document.evidence}</p>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
