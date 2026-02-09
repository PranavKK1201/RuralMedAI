import type { Metadata } from 'next';
import { Inter, Outfit } from 'next/font/google';
import './globals.css';

const inter = Inter({
    subsets: ['latin'],
    variable: '--font-inter',
});

const outfit = Outfit({
    subsets: ['latin'],
    variable: '--font-outfit',
});

export const metadata: Metadata = {
    title: 'RuralMedAI - Live Medical Scribe',
    description: 'Real-time AI scribe for rural medical consultations',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" className="dark">
            <body className={`${inter.variable} ${outfit.variable} font-sans bg-background text-foreground antialiased min-h-screen relative`}>
                {/* Global Design Elements */}
                <div className="fixed inset-0 z-[-1] mesh-gradient opacity-40" />
                <div className="fixed inset-0 z-[-1] bg-grid-premium opacity-20" />

                <div className="relative z-10 font-sans">
                    {children}
                </div>
            </body>
        </html>
    );
}
