import React from 'react';
import { Link } from 'react-router-dom';

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="space-y-3 border-t border-black/10 dark:border-white/10 pt-8">
        <h2 className="text-xl font-black uppercase tracking-tight">{title}</h2>
        <div className="space-y-3 text-black/70 dark:text-white/60 text-sm leading-relaxed">{children}</div>
    </div>
);

const PrivacyPage: React.FC = () => (
    <div className="min-h-screen bg-white dark:bg-background-dark text-black dark:text-white">
        <header className="px-6 md:px-16 py-6 border-b border-black/10 dark:border-white/10 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3">
                <div className="size-9 bg-black dark:bg-white flex items-center justify-center text-white dark:text-black">
                    <span className="material-symbols-outlined text-xl">auto_awesome</span>
                </div>
                <span className="text-xl font-black uppercase tracking-tighter">Asterix</span>
            </Link>
            <Link to="/" className="text-[9px] font-black uppercase tracking-widest opacity-50 hover:opacity-100 transition-opacity">← Back</Link>
        </header>

        <main className="max-w-3xl mx-auto px-6 py-20 md:py-32 space-y-8">
            <div>
                <p className="text-[9px] font-black uppercase tracking-[0.5em] opacity-40 mb-4">Legal</p>
                <h1 className="text-5xl font-black uppercase tracking-tighter mb-4">Privacy Policy</h1>
                <p className="text-sm opacity-50">Last updated: February 28, 2025</p>
            </div>

            <Section title="Overview">
                <p>Asterix ("we", "us", "our") is committed to protecting your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform at asterix-jobs.in.</p>
            </Section>

            <Section title="Information We Collect">
                <p><strong>Account Information:</strong> Name, email address, and password when you register.</p>
                <p><strong>Resume Data:</strong> The resume or profile you upload, including work history, skills, and education. This is used to match you to relevant job opportunities.</p>
                <p><strong>Usage Data:</strong> Pages visited, features used, session duration, and device information collected automatically via analytics tools.</p>
                <p><strong>Payment Information:</strong> We do not store payment card details. Payments are processed securely by Cashfree Payments.</p>
            </Section>

            <Section title="How We Use Your Information">
                <p>• To create and manage your account</p>
                <p>• To match you with relevant job opportunities using AI analysis</p>
                <p>• To communicate with you about your account and matches</p>
                <p>• To process subscription payments</p>
                <p>• To improve our platform and develop new features</p>
                <p>• To comply with legal obligations</p>
            </Section>

            <Section title="Data Sharing">
                <p>We do not sell your personal data. We may share your information with:</p>
                <p><strong>Recruiters:</strong> Your profile and application data is shared with recruiters only when you (or our auto-pilot) apply to their job posting.</p>
                <p><strong>Service Providers:</strong> Firebase (authentication and database), Vercel (hosting), Cashfree (payments), and Hugging Face (AI processing). Each operates under their own privacy policies.</p>
                <p><strong>Legal Requirements:</strong> If required by law or to protect the rights and safety of our users.</p>
            </Section>

            <Section title="Data Retention">
                <p>We retain your data for as long as your account is active. You may delete your account at any time from Settings, which will remove your personal data within 30 days, except where retention is required by law.</p>
            </Section>

            <Section title="Your Rights">
                <p>You have the right to: access your personal data, correct inaccurate data, request deletion of your data, withdraw consent for processing, and lodge a complaint with a data protection authority.</p>
                <p>To exercise any of these rights, contact us at <a href="mailto:privacy@asterix-jobs.in" className="underline">privacy@asterix-jobs.in</a>.</p>
            </Section>

            <Section title="Cookies">
                <p>We use essential cookies for authentication and session management. We also use analytics cookies (Vercel Analytics) to understand how the platform is used. You can disable non-essential cookies in your browser settings.</p>
            </Section>

            <Section title="Security">
                <p>We implement industry-standard security measures including HTTPS encryption, Firebase Authentication, and secure data storage. However, no method of transmission over the internet is 100% secure.</p>
            </Section>

            <Section title="Contact">
                <p>For privacy-related questions: <a href="mailto:privacy@asterix-jobs.in" className="underline">privacy@asterix-jobs.in</a></p>
                <p>General inquiries: <a href="mailto:hello@asterix-jobs.in" className="underline">hello@asterix-jobs.in</a></p>
            </Section>
        </main>
    </div>
);

export default PrivacyPage;
