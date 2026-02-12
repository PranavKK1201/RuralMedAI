import { ScribeSessionSnapshot } from '@/types';

const SESSION_KEY = 'ruralmedai:sessions:live-scribe';

export function loadScribeSession(): ScribeSessionSnapshot | null {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;

    try {
        const parsed = JSON.parse(raw) as ScribeSessionSnapshot;
        if (!parsed || typeof parsed !== 'object') return null;
        if (!parsed.patientData || !parsed.transcript) return null;
        return parsed;
    } catch {
        return null;
    }
}

export function saveScribeSession(snapshot: ScribeSessionSnapshot): void {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(snapshot));
}

export function clearScribeSession(): void {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(SESSION_KEY);
}
