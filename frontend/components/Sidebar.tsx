"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    Stethoscope,
    HeartPulse,
    ClipboardList,
    Activity,
    ChevronRight,
    Search
} from 'lucide-react';
import { motion } from 'framer-motion';

const NAV_ITEMS = [
    {
        name: 'Scribe',
        href: '/',
        icon: Stethoscope,
        description: 'AI Consultation Scribe'
    },
    {
        name: 'Insurance',
        href: '/claims',
        icon: HeartPulse,
        description: 'Claims & Eligibility'
    },
    {
        name: 'Records',
        href: '/patients',
        icon: ClipboardList,
        description: 'Patient History'
    }
];

export function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="w-[260px] flex-none border-r border-slate-200 bg-white flex flex-col z-[100] relative">
            {/* Logo Section */}
            <div className="p-6">
                <div>
                    <h1 className="text-xl font-bold tracking-tight text-slate-900 leading-none">Parchee</h1>
                    <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-[0.2em]">EHR Console</p>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 space-y-1">
                {NAV_ITEMS.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`group relative flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${isActive
                                    ? 'bg-slate-900 text-white shadow-lg shadow-slate-200'
                                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                                }`}
                        >
                            <item.icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-900'}`} />
                            <div className="flex-1">
                                <p className="text-[13px] font-bold tracking-tight">{item.name}</p>
                                <p className={`text-[10px] font-semibold ${isActive ? 'text-white/70' : 'text-slate-500'}`}>
                                    {item.description}
                                </p>
                            </div>
                            {isActive && (
                                <motion.div
                                    layoutId="active-indicator"
                                    className="absolute right-3"
                                >
                                    <ChevronRight className="w-3 h-3 text-slate-400" />
                                </motion.div>
                            )}
                        </Link>
                    );
                })}
            </nav>

            {/* Search Placeholder / Footer */}
            <div className="p-4 mt-auto">
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                    <div className="flex items-center gap-2 text-slate-400 mb-2">
                        <Search className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Quick Search</span>
                    </div>
                    <div className="h-6 bg-white border border-slate-100 rounded text-[9px] flex items-center px-2 text-slate-300 font-mono">
                        PRESS ⌘K TO SEARCH
                    </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between px-2">
                    <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-[8px] font-bold text-white">PK</div>
                        <span className="text-[10px] font-bold text-slate-600">Dr. Pranav</span>
                    </div>
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                </div>
            </div>
        </aside>
    );
}
