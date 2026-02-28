import React, { useState } from 'react';
import { readSessionUid } from '../authService';
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import '../App.css';


const STEPS = [
  { id: 'identity', label: 'Identity Matrix' },
  { id: 'stack', label: 'Neural Stack' },
  { id: 'experience', label: 'History' },
  { id: 'directives', label: 'Directives' },
  { id: 'review', label: 'Review' },
];

const SKILLS = [
  'React.js', 'TypeScript', 'Node.js', 'Python', 'AI/ML', 'Docker',
  'AWS', 'Firebase', 'Next.js', 'Go', 'Kubernetes', 'Tailwind', 'SQL', 'NoSQL',
  'GraphQL', 'Redis', 'PostgreSQL', 'MongoDB', 'FastAPI', 'Flutter',
];

interface FormState {
  name: string; title: string; phone: string; location: string;
  github: string; linkedin: string; skills: string[];
  experience: string; education: string;
  minSalary: string; jobType: string; remotePreference: string;
}

const EMPTY: FormState = {
  name: '', title: '', phone: '', location: '', github: '', linkedin: '',
  skills: [], experience: '', education: '',
  minSalary: '', jobType: 'Full-time', remotePreference: 'Hybrid',
};

interface CandidateOnboardingProps {
  onOnboardingSuccess: () => void;
  onToggleTheme?: (isDark: boolean) => void;
  isDarkMode?: boolean;
}

export default function CandidateOnboarding({
  onOnboardingSuccess,
  onToggleTheme,
  isDarkMode,
}: CandidateOnboardingProps) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [customSkillInput, setCustomSkillInput] = useState('');

  const handle = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const toggleSkill = (skill: string) =>
    setForm(prev => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter(s => s !== skill)
        : [...prev.skills, skill],
    }));

  const addCustomSkill = () => {
    const trimmed = customSkillInput.trim();
    if (!trimmed) return;
    // Avoid duplicates (case-insensitive)
    if (form.skills.some(s => s.toLowerCase() === trimmed.toLowerCase())) {
      setCustomSkillInput('');
      return;
    }
    setForm(prev => ({ ...prev, skills: [...prev.skills, trimmed] }));
    setCustomSkillInput('');
  };

  /* ══════════════════════════════════════════════════════════════════
     FINALIZE ONBOARDING
     ══════════════════════════════════════════════════════════════════ */

  const finalizeOnboarding = async () => {

    const uid = readSessionUid();

    if (!uid) {
      console.error('[❌ Onboarding] No session UID found');
      setError('Session lost. Please log in again.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      // 1. Write full profile to profiles/{uid}
      await setDoc(doc(db, 'profiles', uid), {
        profile: {
          name: form.name,
          title: form.title,
          manifesto: form.experience,
          availability: form.jobType,
          coordinates: form.location,
          accessLevel: 'CANDIDATE',
        },
        deployments: form.experience.trim() ? [{
          id: Date.now(),
          date: 'RECENT',
          role: form.title,
          co: 'Self Reported',
          desc: form.experience,
        }] : [],
        skills: form.skills.map((s, i) => ({ id: i + 1, s, l: 80 })),
        contact: { phone: form.phone, github: form.github, linkedin: form.linkedin },
        preferences: { minSalary: form.minSalary, remotePreference: form.remotePreference },
        education: form.education,
        createdAt: new Date(),
      });

      // 2. Mark isOnboarded = true in users/{uid}
      await setDoc(doc(db, 'users', uid), { isOnboarded: true }, { merge: true });


      // 3. Call parent callback to handle routing
      // This will re-hydrate the user state and route to dashboard
      onOnboardingSuccess();

    } catch (err: any) {
      console.error('[❌ Onboarding] Error:', err);
      setError(err?.message ?? 'Failed to save. Please try again.');
      setSaving(false);
    }
  };

  /* ══════════════════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════════════════ */

  const INPUT = 'w-full bg-black/5 dark:bg-[#111111] border border-black/10 dark:border-white/10 p-4 font-black uppercase tracking-tight outline-none focus:border-black dark:focus:border-white transition-colors text-black dark:text-white [color-scheme:light] dark:[color-scheme:dark]';
  const TEXTAREA = INPUT + ' font-medium resize-y';

  return (
    <div className="min-h-screen bg-white dark:bg-background-dark text-black dark:text-white flex flex-col transition-colors duration-500">

      {/* Header */}
      <header className="px-6 md:px-12 py-8 border-b border-black dark:border-white/10 flex items-center justify-between sticky top-0 bg-white/90 dark:bg-background-dark/90 backdrop-blur-xl z-50">
        <div className="flex items-center gap-4">
          <div className="bg-black dark:bg-white size-10 flex items-center justify-center text-white dark:text-black">
            <span className="material-symbols-outlined font-black">auto_awesome</span>
          </div>
          <h2 className="text-2xl font-black uppercase tracking-tighter">Onboarding Protocol</h2>
        </div>
        <div className="hidden md:flex gap-4">
          {STEPS.map((s, idx) => (
            <div key={s.id} className="flex items-center gap-2">
              <span className={`text-[10px] font-black uppercase tracking-widest transition-opacity ${idx <= step ? 'opacity-100' : 'opacity-20'}`}>
                {s.label}
              </span>
              {idx < STEPS.length - 1 && <span className="text-[10px] opacity-20">—</span>}
            </div>
          ))}
        </div>
      </header>

      {/* Main */}
      <main className="flex-grow flex items-center justify-center p-6 md:p-12 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none opacity-5 select-none overflow-hidden">
          <div className="text-[25vw] font-black uppercase tracking-tighter leading-none absolute -bottom-10 -left-10 opacity-20">PROTOCOL</div>
        </div>

        <div className="w-full max-w-4xl bg-white dark:bg-background-dark border-4 border-black dark:border-white p-8 md:p-16 space-y-12 relative z-10 shadow-[40px_40px_0px_rgba(0,0,0,0.05)]">

          {/* Progress */}
          <div className="w-full h-1 bg-black/5 dark:bg-white/5 relative">
            <div className="absolute h-full bg-emerald-500 transition-all duration-700" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
          </div>

          {/* Error */}
          {error && (
            <div className="border border-red-500/30 bg-red-500/10 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-red-500">
              {error}
            </div>
          )}

          <div className="space-y-12">

            {/* ── Step 0: Identity ── */}
            {step === 0 && (
              <div className="space-y-10">
                <div className="space-y-2">
                  <h3 className="text-4xl md:text-6xl font-black uppercase tracking-tighter">01 / Identity Matrix</h3>
                  <p className="text-xs font-bold uppercase tracking-widest opacity-40">Core bio and professional coordinates.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {[
                    { name: 'name', label: 'Professional Name', placeholder: 'FULL NAME' },
                    { name: 'title', label: 'Primary Role', placeholder: 'E.G. SOFTWARE ENGINEER' },
                    { name: 'phone', label: 'Phone Number', placeholder: '+1 XXX XXX XXXX' },
                    { name: 'location', label: 'Location (City, Country)', placeholder: 'E.G. NEW YORK, USA' },
                    { name: 'github', label: 'GitHub URL', placeholder: 'GITHUB.COM/USER' },
                    { name: 'linkedin', label: 'LinkedIn URL', placeholder: 'LINKEDIN.COM/IN/USER' },
                  ].map(f => (
                    <div key={f.name} className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-widest opacity-60">{f.label}</label>
                      <input name={f.name} value={(form as any)[f.name]} onChange={handle} className={INPUT} placeholder={f.placeholder} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Step 1: Skills ── */}
            {step === 1 && (
              <div className="space-y-10">
                <div className="space-y-2">
                  <h3 className="text-4xl md:text-6xl font-black uppercase tracking-tighter">02 / Neural Stack</h3>
                  <p className="text-xs font-bold uppercase tracking-widest opacity-40">Select your core technical competencies or add your own.</p>
                </div>

                {/* Predefined skill chips */}
                <div className="flex flex-wrap gap-4">
                  {SKILLS.map(skill => (
                    <button
                      key={skill}
                      type="button"
                      onClick={() => toggleSkill(skill)}
                      className={`px-6 py-3 border-2 text-[10px] font-black uppercase tracking-widest transition-all ${form.skills.includes(skill)
                          ? 'bg-black text-white dark:bg-white dark:text-black border-transparent shadow-xl'
                          : 'border-black/10 dark:border-white/10 hover:border-black dark:hover:border-white'
                        }`}
                    >
                      {skill}
                    </button>
                  ))}
                </div>

                {/* Custom skill input */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest opacity-60">Add Custom Skill</label>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={customSkillInput}
                      onChange={e => setCustomSkillInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomSkill(); } }}
                      className={INPUT + ' flex-1'}
                      placeholder="E.G. SOLIDITY, FIGMA, RUST..."
                    />
                    <button
                      type="button"
                      onClick={addCustomSkill}
                      disabled={!customSkillInput.trim()}
                      className="px-6 py-3 bg-black dark:bg-white text-white dark:text-black text-[10px] font-black uppercase tracking-widest hover:invert transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2 shrink-0"
                    >
                      <span className="material-symbols-outlined text-sm">add</span>
                      Add
                    </button>
                  </div>
                </div>

                {/* Custom-added skills (ones not in the SKILLS preset) */}
                {form.skills.filter(s => !SKILLS.includes(s)).length > 0 && (
                  <div className="space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Custom Skills Added</p>
                    <div className="flex flex-wrap gap-3">
                      {form.skills.filter(s => !SKILLS.includes(s)).map(skill => (
                        <span
                          key={skill}
                          className="flex items-center gap-2 px-4 py-2 bg-black text-white dark:bg-white dark:text-black text-[10px] font-black uppercase tracking-widest"
                        >
                          {skill}
                          <button
                            type="button"
                            onClick={() => toggleSkill(skill)}
                            className="hover:opacity-60 transition-opacity leading-none"
                          >
                            <span className="material-symbols-outlined text-sm">close</span>
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {form.skills.length > 0 && (
                  <p className="text-[9px] font-black uppercase tracking-widest text-emerald-500">
                    {form.skills.length} skill{form.skills.length !== 1 ? 's' : ''} selected
                  </p>
                )}
              </div>
            )}

            {/* ── Step 2: Experience ── */}
            {step === 2 && (
              <div className="space-y-10">
                <div className="space-y-2">
                  <h3 className="text-4xl md:text-6xl font-black uppercase tracking-tighter">03 / Experience Log</h3>
                  <p className="text-xs font-bold uppercase tracking-widest opacity-40">Detail your professional trajectory.</p>
                </div>
                <div className="space-y-8">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest opacity-60">Work History</label>
                    <textarea name="experience" value={form.experience} onChange={handle} rows={5} className={TEXTAREA} placeholder="COMPANY – ROLE – ACHIEVEMENT..." />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest opacity-60">Education Matrix</label>
                    <textarea name="education" value={form.education} onChange={handle} rows={3} className={TEXTAREA} placeholder="DEGREE @ UNIVERSITY – YEAR" />
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 3: Directives ── */}
            {step === 3 && (
              <div className="space-y-10">
                <div className="space-y-2">
                  <h3 className="text-4xl md:text-6xl font-black uppercase tracking-tighter">04 / Target Directives</h3>
                  <p className="text-xs font-bold uppercase tracking-widest opacity-40">Mission parameters for job matching.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest opacity-60">Min Salary Expectation</label>
                    <input name="minSalary" value={form.minSalary} onChange={handle} className={INPUT} placeholder="E.G. $120,000" />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest opacity-60">Preferred Deployment</label>
                    <select name="jobType" value={form.jobType} onChange={handle} className={INPUT}>
                      <option>Full-time</option><option>Contract</option><option>Part-time</option>
                    </select>
                  </div>
                  <div className="space-y-3 md:col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-widest opacity-60">Remote Protocol</label>
                    <select name="remotePreference" value={form.remotePreference} onChange={handle} className={INPUT}>
                      <option>Remote Only</option><option>Hybrid</option><option>On-site</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 4: Review ── */}
            {step === 4 && (
              <div className="space-y-10">
                <div className="space-y-2">
                  <h3 className="text-4xl md:text-6xl font-black uppercase tracking-tighter">05 / Profile Review</h3>
                  <p className="text-xs font-bold uppercase tracking-widest opacity-40">Verify before deployment.</p>
                </div>
                <div className="border-2 border-emerald-500/30 p-8 bg-black/5 dark:bg-white/5 space-y-6">
                  <div className="grid grid-cols-2 gap-6 text-sm">
                    {[
                      ['Name', form.name],
                      ['Title', form.title],
                      ['Location', form.location],
                      ['Phone', form.phone],
                      ['Salary', form.minSalary],
                      ['Job Type', form.jobType],
                    ].map(([label, val]) => (
                      <div key={label}>
                        <span className="opacity-60 text-[10px] uppercase tracking-widest">{label}:</span>{' '}
                        <strong>{val || '—'}</strong>
                      </div>
                    ))}
                    <div className="col-span-2">
                      <span className="opacity-60 text-[10px] uppercase tracking-widest">Skills:</span>{' '}
                      <strong>{form.skills.join(', ') || 'None selected'}</strong>
                    </div>
                    <div className="col-span-2">
                      <span className="opacity-60 text-[10px] uppercase tracking-widest">Remote:</span>{' '}
                      <strong>{form.remotePreference}</strong>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between items-center pt-12 border-t border-black/10 dark:border-white/10">
              <button
                type="button"
                onClick={() => setStep(s => s - 1)}
                disabled={step === 0}
                className="text-[10px] font-black uppercase tracking-widest opacity-40 hover:opacity-100 disabled:opacity-0 transition-opacity"
              >
                [ Back ]
              </button>

              {step === 4 ? (
                <button
                  type="button"
                  onClick={finalizeOnboarding}
                  disabled={saving}
                  className="bg-emerald-500 text-white px-12 py-5 text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl disabled:opacity-50 disabled:scale-100 flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <span className="material-symbols-outlined text-sm animate-spin">autorenew</span>
                      Deploying…
                    </>
                  ) : 'Deploy Identity'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    // Mandatory phone validation on Step 0
                    if (step === 0) {
                      if (!form.name.trim()) { setError('Name is required.'); return; }
                      if (!form.phone.trim()) { setError('Phone number is required for payment processing.'); return; }
                      const phoneRegex = /^[+]?[\d\s\-()]{7,15}$/;
                      if (!phoneRegex.test(form.phone.trim())) { setError('Enter a valid phone number (e.g. +91 9999999999).'); return; }
                    }
                    setError('');
                    setStep(s => s + 1);
                  }}
                  className="bg-black dark:bg-white text-white dark:text-black px-12 py-5 text-[10px] font-black uppercase tracking-widest hover:invert transition-all flex items-center gap-2"
                >
                  Proceed <span className="material-symbols-outlined text-base">arrow_right_alt</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </main>

      <footer className="px-6 py-8 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-[8px] font-black uppercase tracking-[0.4em] opacity-20">
        <p>© 2026 Asterix-find. All telemetry encrypted.</p>
        <p>Step {step + 1} of {STEPS.length}</p>
      </footer>
    </div>
  );
}