import React from 'react';
import { Link } from 'react-router-dom';

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="space-y-3 border-t border-black/10 dark:border-white/10 pt-8">
        <h2 className="text-xl font-black tracking-tight">{title}</h2>
        <div className="space-y-3 text-black/70 dark:text-white/60 text-sm leading-relaxed">{children}</div>
    </div>
);

const TermsPage: React.FC = () => (
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

        <main className="max-w-3xl mx-auto px-6 py-20 md:py-32 space-y-8">
            <div>
                <p className="text-[9px] font-black tracking-[0.5em] opacity-40 mb-4">Legal</p>
                <h1 className="text-5xl font-black tracking-tighter mb-4">Terms of Service</h1>
                <p className="text-sm opacity-50">Last updated: February 28, 2025</p>
            </div>

            <Section title="Acceptance of Terms">
                <p>By accessing or using Asterix ("Platform"), you agree to be bound by these Terms of Service. If you do not agree to these terms, do not use the Platform.</p>
            </Section>

            <Section title="Description of Service">
                <p>Asterix is an AI-powered job matching and application platform. We help job seekers find relevant opportunities and help recruiters discover qualified candidates. Our service includes automated job matching, resume analysis, and auto-application features.</p>
            </Section>

            <Section title="User Accounts">
                <p>You must provide accurate and complete information when creating an account. You are responsible for maintaining the confidentiality of your credentials and for all activities under your account.</p>
                <p>You must be at least 18 years old to use this Platform.</p>
                <p>We reserve the right to suspend or terminate accounts that violate these Terms.</p>
            </Section>

            <Section title="Acceptable Use">
                <p>You agree not to:</p>
                <p>• Upload false, misleading, or fraudulent resume or job information</p>
                <p>• Attempt to reverse-engineer, scrape, or access our systems without authorization</p>
                <p>• Use the Platform for any unlawful purpose</p>
                <p>• Harass, abuse, or harm other users</p>
                <p>• Create multiple accounts to circumvent limits or bans</p>
            </Section>

            <Section title="Subscriptions and Payments">
                <p>Certain features require a paid subscription (Student Plan or Recruiter Pro). Subscriptions are billed monthly and renew automatically unless cancelled.</p>
                <p>You may cancel your subscription at any time from your account settings. Cancellation takes effect at the end of the current billing period. We do not offer refunds for the current billing period except where required by law.</p>
                <p>Prices are listed in INR (Indian Rupees) and are inclusive of applicable taxes.</p>
            </Section>

            <Section title="Auto-Apply Feature">
                <p>When the Auto-Pilot feature is enabled, Asterix may automatically submit applications on your behalf to jobs that meet our matching criteria. You remain responsible for reviewing companies you apply to. Asterix is not liable for the outcome of any application, interview, or employment relationship.</p>
            </Section>

            <Section title="Intellectual Property">
                <p>Asterix and its original content, features, and functionality are owned by Asterix and are protected by copyright, trademark, and other applicable laws. You retain ownership of content you upload (resume, profile) and grant us a license to process it to provide the service.</p>
            </Section>

            <Section title="Disclaimers">
                <p>The Platform is provided "as is" without warranties of any kind. We do not guarantee employment outcomes, interview invitations, or the accuracy of match scores. Job listings are provided by third-party recruiters and we are not responsible for their content or accuracy.</p>
            </Section>

            <Section title="Limitation of Liability">
                <p>To the maximum extent permitted by applicable law, Asterix shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from use of the Platform.</p>
            </Section>

            <Section title="Governing Law">
                <p>These Terms shall be governed by the laws of India. Any disputes shall be resolved in the courts of India.</p>
            </Section>

            <Section title="Changes to Terms">
                <p>We may update these Terms at any time. We will notify you of significant changes via email or platform notice. Continued use of the Platform after changes constitutes acceptance.</p>
            </Section>

            <Section title="Contact">
                <p>For questions about these Terms: <a href="mailto:legal@asterix-jobs.in" className="underline">legal@asterix-jobs.in</a></p>
            </Section>
        </main>
    </div>
);

export default TermsPage;

