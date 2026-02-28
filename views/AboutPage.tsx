import React from 'react';
import { Link } from 'react-router-dom';

const AboutPage: React.FC = () => (
    <div className="min-h-screen bg-white dark:bg-background-dark text-black dark:text-white">
        <header className="px-6 md:px-16 py-6 border-b border-black/10 dark:border-white/10 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3">
                <div className="size-9 bg-black dark:bg-white flex items-center justify-center text-white dark:text-black">
                    <span className="material-symbols-outlined text-xl">auto_awesome</span>
                </div>
                <span className="text-xl font-black tracking-tighter">Asterix</span>
            </Link>
            <Link to="/" className="text-[9px] font-black tracking-widest opacity-50 hover:opacity-100 transition-opacity">← Back</Link>
        </header>

        <main className="max-w-4xl mx-auto px-6 md:px-10 py-20 md:py-32 space-y-20">
            <div>
                <p className="text-[9px] font-black tracking-[0.5em] opacity-40 mb-4">About Us</p>
                <h1 className="text-5xl md:text-7xl font-black tracking-tighter leading-none mb-8">
                    We're Building the<br />Future of Hiring
                </h1>
                <p className="text-lg md:text-xl text-black/60 dark:text-white/60 font-medium leading-relaxed max-w-2xl">
                    Asterix was founded with a simple belief: the best candidates never get seen because job boards are broken. We're changing that.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 border border-black/10 dark:border-white/10">
                {[
                    { label: 'Founded', value: '2024' },
                    { label: 'Headquarters', value: 'India' },
                    { label: 'Mission', value: 'Better Matches' },
                ].map(s => (
                    <div key={s.label} className="p-8 border-r last:border-0 border-black/10 dark:border-white/10">
                        <p className="text-[8px] font-black tracking-widest opacity-40 mb-2">{s.label}</p>
                        <p className="text-2xl font-black tracking-tight">{s.value}</p>
                    </div>
                ))}
            </div>

            <div className="space-y-6 max-w-2xl">
                <h2 className="text-3xl font-black tracking-tight">Our Story</h2>
                <div className="space-y-4 text-black/70 dark:text-white/60 leading-relaxed">
                    <p>Traditional job boards match candidates on keywords. If your resume doesn't have the exact phrase a recruiter typed, you're invisible — even if you're the best person for the role.</p>
                    <p>Asterix uses AI to understand what you're actually good at and what companies actually need. We score compatibility across 40+ factors: skills, work style, growth trajectory, and company culture — then auto-apply on your behalf to roles where you'll genuinely thrive.</p>
                    <p>We're a small, focused team of engineers and designers who believe the best hiring experience is one you barely notice — because it just works.</p>
                </div>
            </div>

            <div className="border-t border-black/10 dark:border-white/10 pt-16">
                <h2 className="text-2xl font-black tracking-tight mb-8">Get in Touch</h2>
                <div className="flex flex-col sm:flex-row gap-4">
                    <Link to="/contact" className="px-8 py-4 bg-black dark:bg-white text-white dark:text-black text-[10px] font-black tracking-widest hover:opacity-80 transition-opacity">
                        Contact Us
                    </Link>
                    <a href="mailto:hello@asterix-jobs.in" className="px-8 py-4 border border-black/20 dark:border-white/20 text-[10px] font-black tracking-widest hover:border-black dark:hover:border-white transition-colors">
                        hello@asterix-jobs.in
                    </a>
                </div>
            </div>
        </main>
    </div>
);

export default AboutPage;

