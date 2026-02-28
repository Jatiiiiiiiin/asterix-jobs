import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { contactService } from '../contactService';

const ContactPage: React.FC = () => {
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
    const [dropdownOpen, setDropdownOpen] = useState(false);

    const topics = ['General Inquiry', 'Candidate Support', 'Recruiter / Business', 'Bug Report', 'Partnership', 'Press / Media'];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            await contactService.submitContactMessage(form);
            setSubmitted(true);
            setForm({ name: '', email: '', subject: '', message: '' });
        } catch (err: any) {
            setError(err.message || 'Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const field = 'w-full bg-black/5 dark:bg-white/10 text-black dark:text-white border border-black/10 dark:border-white/10 px-4 py-3 text-sm font-medium focus:outline-none focus:border-black dark:focus:border-white transition-colors placeholder:text-black/30 dark:placeholder:text-white/30';

    return (
        <div className="min-h-screen bg-white dark:bg-background-dark text-black dark:text-white" onClick={() => setDropdownOpen(false)}>
            <header className="px-6 md:px-16 py-6 border-b border-black/10 dark:border-white/10 flex items-center justify-between">
                <Link to="/" className="flex items-center gap-3">
                    <div className="size-9 bg-black dark:bg-white flex items-center justify-center text-white dark:text-black">
                        <span className="material-symbols-outlined text-xl">auto_awesome</span>
                    </div>
                    <span className="text-xl font-black tracking-tighter">Asterix</span>
                </Link>
                <Link to="/" className="text-[9px] font-black tracking-widest opacity-50 hover:opacity-100 transition-opacity">← Back</Link>
            </header>

            <main className="max-w-6xl mx-auto px-6 md:px-10 py-20 md:py-32">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 md:gap-24">
                    <div className="space-y-10">
                        <div>
                            <p className="text-[9px] font-black tracking-[0.5em] opacity-40 mb-4">Contact</p>
                            <h1 className="text-5xl md:text-6xl font-black tracking-tighter leading-none">Let's Talk</h1>
                        </div>

                        <div className="space-y-6">
                            {[
                                { icon: 'mail', label: 'General Inquiries', value: 'hello@asterix-jobs.in', href: 'mailto:hello@asterix-jobs.in' },
                                { icon: 'support_agent', label: 'Candidate Support', value: 'support@asterix-jobs.in', href: 'mailto:support@asterix-jobs.in' },
                                { icon: 'business', label: 'Business & Partnerships', value: 'partnerships@asterix-jobs.in', href: 'mailto:partnerships@asterix-jobs.in' },
                                { icon: 'location_on', label: 'Location', value: 'India (Remote-first)', href: null },
                            ].map(c => (
                                <div key={c.label} className="flex items-start gap-4 p-4 border border-black/10 dark:border-white/10">
                                    <span className="material-symbols-outlined text-lg opacity-40 mt-0.5">{c.icon}</span>
                                    <div>
                                        <p className="text-[8px] font-black tracking-widest opacity-40 mb-1">{c.label}</p>
                                        {c.href
                                            ? <a href={c.href} className="text-sm font-black hover:opacity-60 transition-opacity">{c.value}</a>
                                            : <p className="text-sm font-black">{c.value}</p>
                                        }
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="space-y-3">
                            <p className="text-[8px] font-black tracking-widest opacity-40">Response Time</p>
                            <p className="text-sm font-medium opacity-70">We typically respond within 24 hours on business days.</p>
                        </div>
                    </div>

                    <div>
                        {submitted ? (
                            <div className="h-full flex flex-col items-center justify-center text-center gap-6 border border-emerald-500/30 bg-emerald-500/5 p-12">
                                <span className="material-symbols-outlined text-5xl text-emerald-500">check_circle</span>
                                <div>
                                    <h2 className="text-2xl font-black tracking-tight mb-2">Message Sent</h2>
                                    <p className="text-sm opacity-60">We'll get back to you within 24 hours.</p>
                                </div>
                                <button onClick={() => setSubmitted(false)} className="px-6 py-3 border border-black/20 dark:border-white/20 text-[9px] font-black tracking-widest hover:border-black dark:hover:border-white transition-colors">
                                    Send Another
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[8px] font-black tracking-widest opacity-50">Name</label>
                                        <input required className={field} placeholder="Your name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[8px] font-black tracking-widest opacity-50">Email</label>
                                        <input required type="email" className={field} placeholder="your@email.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                                    </div>
                                </div>

                                {/* Custom dropdown — avoids native OS white popup */}
                                <div className="space-y-1.5">
                                    <label className="text-[8px] font-black tracking-widest opacity-50">Subject</label>
                                    <div className="relative" onClick={e => e.stopPropagation()}>
                                        <button
                                            type="button"
                                            onClick={() => setDropdownOpen(o => !o)}
                                            className={`${field} flex items-center justify-between text-left ${!form.subject ? 'opacity-40' : ''}`}
                                        >
                                            <span>{form.subject || 'Select a topic'}</span>
                                            <span className={`material-symbols-outlined text-base transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}>expand_more</span>
                                        </button>
                                        {dropdownOpen && (
                                            <div className="absolute top-full left-0 right-0 z-50 border border-black/10 dark:border-white/10 bg-white dark:bg-[#111111] divide-y divide-black/5 dark:divide-white/5 shadow-2xl">
                                                {topics.map(t => (
                                                    <button
                                                        key={t}
                                                        type="button"
                                                        onClick={() => { setForm(f => ({ ...f, subject: t })); setDropdownOpen(false); }}
                                                        className={`w-full text-left px-4 py-3 text-xs font-black tracking-widest hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors ${form.subject === t ? 'bg-black text-white dark:bg-white dark:text-black' : ''}`}
                                                    >
                                                        {t}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    {/* Hidden readable input so form validation works */}
                                    <input type="text" required value={form.subject} onChange={() => { }} className="sr-only" tabIndex={-1} aria-hidden />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[8px] font-black tracking-widest opacity-50">Message</label>
                                    <textarea required rows={6} className={field} placeholder="Tell us what's on your mind..." value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} />
                                </div>

                                {error && (
                                    <div className="p-4 border border-red-500/30 bg-red-500/5 text-red-500 text-[10px] font-black tracking-widest uppercase">
                                        {error}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className={`w-full py-4 bg-black dark:bg-white text-white dark:text-black text-[10px] font-black tracking-widest hover:opacity-80 transition-opacity flex items-center justify-center gap-2 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    {loading ? (
                                        <>
                                            <span className="animate-spin size-3 border-2 border-current border-t-transparent rounded-full" />
                                            Sending...
                                        </>
                                    ) : (
                                        'Send Message'
                                    )}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default ContactPage;

