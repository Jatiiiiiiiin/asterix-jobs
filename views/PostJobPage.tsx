import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMatchingSummary } from '../geminiService';
import { readSessionUid } from '../authService';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

interface PostJobPageProps {
  onToggleTheme: () => void;
  isDarkMode: boolean;
  isPremium: boolean;
}

type Status = 'idle' | 'saving' | 'saved' | 'error';

interface FormState {
  title: string;
  department: string;
  employmentType: string;
  location: string;
  remoteAllowed: boolean;
  companyName: string;
  salaryMin: string;
  salaryMax: string;
  currency: string;
  experienceRequired: string;
  openings: string;
  jobSummary: string;
  responsibilities: string;   // newline-separated → string[]
  requiredSkills: string;     // comma-separated  → string[]
  preferredSkills: string;
  techStack: string;
  benefits: string;
  applicationDeadline: string;
  matchThreshold: number;
}

const EMPTY: FormState = {
  title: '',
  department: 'Engineering',
  employmentType: 'Full-Time',
  location: '',
  remoteAllowed: false,
  companyName: '',
  salaryMin: '',
  salaryMax: '',
  currency: 'USD',
  experienceRequired: '',
  openings: '1',
  jobSummary: '',
  responsibilities: '',
  requiredSkills: '',
  preferredSkills: '',
  techStack: '',
  benefits: '',
  applicationDeadline: '',
  matchThreshold: 75,
};

const DEPARTMENTS = ['Engineering', 'Design', 'Product', 'Operations', 'Marketing', 'Sales', 'Finance', 'Legal'];
const EMP_TYPES = ['Full-Time', 'Part-Time', 'Contract', 'Freelance', 'Internship'];
const CURRENCIES = ['USD', 'EUR', 'GBP', 'AED', 'INR', 'SGD', 'AUD'];

const splitLines = (s: string) => s.split('\n').map(l => l.trim()).filter(Boolean);
const splitCommas = (s: string) => s.split(',').map(l => l.trim()).filter(Boolean);

/* ================================================================
   COMPONENT
================================================================ */
const PostJobPage: React.FC<PostJobPageProps> = ({ onToggleTheme, isDarkMode, isPremium }) => {
  const navigate = useNavigate();

  const [form, setForm] = useState<FormState>(EMPTY);
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [aiAnalysis, setAiAnalysis] = useState<{ requirements?: string[]; estimatedMatchPool?: number } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeSection, setActiveSection] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Load Recruiter Profile for pre-filling ───────────────── */
  useEffect(() => {
    const loadProfile = async () => {
      const uid = readSessionUid();
      if (!uid) return;

      const { doc, getDoc } = await import('firebase/firestore');
      const snap = await getDoc(doc(db, 'profiles', uid));
      if (snap.exists()) {
        const data = snap.data();
        if (data.company?.name) {
          setForm(prev => ({ ...prev, companyName: data.company.name }));
        }
      }
    };
    loadProfile();
  }, []);

  /* ── AI analysis on description change ─────────────────────── */
  useEffect(() => {
    if (form.jobSummary.length < 50) { setAiAnalysis(null); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setIsAnalyzing(true);
      try {
        const result = await getMatchingSummary(form.jobSummary);
        setAiAnalysis(result);
      } catch { /* silent */ }
      setIsAnalyzing(false);
    }, 900);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [form.jobSummary]);

  /* ── Field helpers ──────────────────────────────────────────── */
  const set = (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }));

  const toggle = (field: keyof FormState) => () =>
    setForm(prev => ({ ...prev, [field]: !prev[field] }));

  /* ── Validation ─────────────────────────────────────────────── */
  const validate = (): string | null => {
    if (!form.title.trim()) return 'Job title is required.';
    if (!form.companyName.trim()) return 'Company name is required.';
    if (!form.location.trim()) return 'Location is required.';
    if (!form.jobSummary.trim()) return 'Job summary is required.';
    return null;
  };

  /* ── Save draft ─────────────────────────────────────────────── */
  const saveDraft = async () => {
    await persist('draft');
  };

  /* ── Activate ────────────────────────────────────────────────── */
  const activate = async () => {
    const err = validate();
    if (err) { setErrorMsg(err); return; }
    await persist('active');
  };

  /* ── Firestore write ─────────────────────────────────────────── */
  const persist = async (jobStatus: 'draft' | 'active') => {
    const recruiterId = readSessionUid();
    if (!recruiterId) { setErrorMsg('Not authenticated. Please log in.'); return; }

    setStatus('saving');
    setErrorMsg('');

    try {
      const payload = {
        recruiterId,

        // Core identity
        title: form.title.trim(),
        department: form.department,
        employmentType: form.employmentType,
        status: jobStatus,

        // Company
        company: {
          name: form.companyName.trim(),
        },

        // Location
        location: {
          city: form.location.trim(),
          type: form.remoteAllowed ? 'Remote' : 'On-site',
          remoteAllowed: form.remoteAllowed,
        },

        // Compensation
        salaryRange: {
          min: form.salaryMin ? parseInt(form.salaryMin, 10) : null,
          max: form.salaryMax ? parseInt(form.salaryMax, 10) : null,
          currency: form.currency,
        },

        // Job content
        openings: parseInt(form.openings, 10) || 1,
        experienceRequired: form.experienceRequired.trim(),
        jobSummary: form.jobSummary.trim(),
        responsibilities: splitLines(form.responsibilities),
        requiredSkills: splitCommas(form.requiredSkills),
        preferredSkills: splitCommas(form.preferredSkills),
        techStack: splitCommas(form.techStack),
        benefits: splitLines(form.benefits),

        // Matching
        matchThreshold: form.matchThreshold,
        applicationDeadline: form.applicationDeadline || null,

        // Metadata
        isAdminPosted: false,

        // Timestamps
        postedDate: new Date().toISOString().split('T')[0],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'jobs'), payload);
      setStatus('saved');

      // Brief pause then navigate to recruiter dashboard
      setTimeout(() => navigate('/recruiter'), 1200);
    } catch (err: any) {
      console.error('[PostJob] Firestore write failed:', err);
      setErrorMsg(err?.message ?? 'Failed to save. Please try again.');
      setStatus('error');
    }
  };

  /* ── Progress indicator ─────────────────────────────────────── */
  const sections = ['Role', 'Company', 'Compensation', 'Description', 'Skills', 'Settings'];
  const filled = [
    !!form.title,
    !!form.companyName,
    !!(form.salaryMin || form.salaryMax),
    !!form.jobSummary,
    !!form.requiredSkills,
    true,
  ];
  const completePct = Math.round((filled.filter(Boolean).length / sections.length) * 100);

  /* ================================================================
     RENDER
  ================================================================ */
  return (
    <div className="min-h-screen bg-[#080808] text-white">

      {/* ── HEADER ──────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 px-6 md:px-10 py-5 border-b border-white/5 bg-[#080808]/90 backdrop-blur-xl flex items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 text-white/30 hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div>
            <p className="text-[8px] font-black tracking-[0.5em] text-white/30">
              Mandate Protocol
            </p>
            <h1 className="text-2xl font-black tracking-tight">Post New Role</h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Completion ring */}
          <div className="hidden md:flex items-center gap-2">
            <div className="w-24 h-1 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${completePct}%` }}
              />
            </div>
            <span className="text-[8px] font-black text-white/30">{completePct}%</span>
          </div>

          <button
            onClick={onToggleTheme}
            className="p-2.5 border border-white/10 hover:border-white/30 transition-colors text-white/40 hover:text-white"
          >
            <span className="material-symbols-outlined text-base">
              {isDarkMode ? 'light_mode' : 'dark_mode'}
            </span>
          </button>
        </div>
      </header>

      {/* ── BODY ────────────────────────────────────────────────── */}
      <div className="max-w-[1400px] mx-auto px-6 md:px-10 py-10 grid grid-cols-1 lg:grid-cols-12 gap-10">

        {/* ── LEFT: FORM ──────────────────────────────────────── */}
        <div className="lg:col-span-8 space-y-0">

          {/* Error banner */}
          {errorMsg && (
            <div className="mb-6 flex items-center gap-3 border border-red-500/30 bg-red-500/10 px-5 py-4 text-[10px] font-black tracking-widest text-red-400">
              <span className="material-symbols-outlined text-sm">error</span>
              {errorMsg}
            </div>
          )}

          {/* ──────────────── 01 ROLE ──────────────────────────── */}
          <FormSection index={0} label="01 / Role Identity" active={activeSection} onFocus={() => setActiveSection(0)}>
            <Field label="Job Title *">
              <input
                value={form.title}
                onChange={set('title')}
                placeholder="E.G. SENIOR ML ENGINEER"
                className={INPUT_CLS + ' text-2xl font-black tracking-tight'}
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Department">
                <select value={form.department} onChange={set('department')} className={SELECT_CLS}>
                  {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                </select>
              </Field>
              <Field label="Employment Type">
                <select value={form.employmentType} onChange={set('employmentType')} className={SELECT_CLS}>
                  {EMP_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Experience Required">
                <input
                  value={form.experienceRequired}
                  onChange={set('experienceRequired')}
                  placeholder="E.G. 3–5 YEARS"
                  className={INPUT_CLS}
                />
              </Field>
              <Field label="Openings">
                <input
                  type="number"
                  min="1"
                  value={form.openings}
                  onChange={set('openings')}
                  className={INPUT_CLS}
                />
              </Field>
            </div>

            <Field label="Application Deadline">
              <input
                type="date"
                value={form.applicationDeadline}
                onChange={set('applicationDeadline')}
                className={INPUT_CLS + ' text-white/60'}
              />
            </Field>
          </FormSection>

          {/* ──────────────── 02 COMPANY ───────────────────────── */}
          <FormSection index={1} label="02 / Company" active={activeSection} onFocus={() => setActiveSection(1)}>
            <Field label="Company Name *">
              <input
                value={form.companyName}
                onChange={set('companyName')}
                placeholder="ACME CORP"
                className={INPUT_CLS}
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Location / City *">
                <input
                  value={form.location}
                  onChange={set('location')}
                  placeholder="SAN FRANCISCO / REMOTE"
                  className={INPUT_CLS}
                />
              </Field>
              <Field label="Remote Allowed">
                <button
                  type="button"
                  onClick={toggle('remoteAllowed')}
                  className={`w-full px-5 py-4 text-[9px] font-black tracking-widest border transition-colors ${form.remoteAllowed
                    ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10'
                    : 'border-white/10 text-white/30 hover:border-white/20'
                    }`}
                >
                  {form.remoteAllowed ? '✓ Remote OK' : 'On-site Only'}
                </button>
              </Field>
            </div>
          </FormSection>

          {/* ──────────────── 03 COMPENSATION ─────────────────── */}
          <FormSection index={2} label="03 / Compensation" active={activeSection} onFocus={() => setActiveSection(2)}>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Currency">
                <select value={form.currency} onChange={set('currency')} className={SELECT_CLS}>
                  {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Min Salary">
                <input
                  type="number"
                  value={form.salaryMin}
                  onChange={set('salaryMin')}
                  placeholder="80000"
                  className={INPUT_CLS}
                />
              </Field>
              <Field label="Max Salary">
                <input
                  type="number"
                  value={form.salaryMax}
                  onChange={set('salaryMax')}
                  placeholder="120000"
                  className={INPUT_CLS}
                />
              </Field>
            </div>

            {(form.salaryMin || form.salaryMax) && (
              <p className="text-[9px] font-black text-white/30 tracking-widest">
                Range: {form.currency}{' '}
                {form.salaryMin ? parseInt(form.salaryMin).toLocaleString() : '?'}
                {' – '}
                {form.currency}{' '}
                {form.salaryMax ? parseInt(form.salaryMax).toLocaleString() : '?'}
              </p>
            )}
          </FormSection>

          {/* ──────────────── 04 DESCRIPTION ──────────────────── */}
          <FormSection index={3} label="04 / Job Description" active={activeSection} onFocus={() => setActiveSection(3)}>
            <Field label="Job Summary *">
              <textarea
                value={form.jobSummary}
                onChange={set('jobSummary')}
                placeholder="DESCRIBE THE IMPACT, CONTEXT, AND VISION FOR THIS ROLE..."
                rows={6}
                className={TEXTAREA_CLS}
              />
            </Field>

            <Field label="Responsibilities (one per line)">
              <textarea
                value={form.responsibilities}
                onChange={set('responsibilities')}
                placeholder={"Lead the design of distributed systems\nOwn the full ML pipeline\nMentor junior engineers"}
                rows={5}
                className={TEXTAREA_CLS}
              />
            </Field>

            <Field label="Benefits (one per line)">
              <textarea
                value={form.benefits}
                onChange={set('benefits')}
                placeholder={"Equity package\nRemote-first\nUnlimited PTO"}
                rows={4}
                className={TEXTAREA_CLS}
              />
            </Field>
          </FormSection>

          {/* ──────────────── 05 SKILLS ───────────────────────── */}
          <FormSection index={4} label="05 / Skills & Stack" active={activeSection} onFocus={() => setActiveSection(4)}>
            <Field label="Required Skills (comma-separated) *">
              <input
                value={form.requiredSkills}
                onChange={set('requiredSkills')}
                placeholder="React, TypeScript, Node.js, System Design"
                className={INPUT_CLS}
              />
            </Field>

            <Field label="Preferred Skills (comma-separated)">
              <input
                value={form.preferredSkills}
                onChange={set('preferredSkills')}
                placeholder="GraphQL, Kubernetes, Rust"
                className={INPUT_CLS}
              />
            </Field>

            <Field label="Tech Stack (comma-separated)">
              <input
                value={form.techStack}
                onChange={set('techStack')}
                placeholder="AWS, PostgreSQL, Redis, Docker"
                className={INPUT_CLS}
              />
            </Field>

            {/* Live skill chips */}
            {splitCommas(form.requiredSkills).length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {splitCommas(form.requiredSkills).map(s => (
                  <span
                    key={s}
                    className="text-[7px] font-black tracking-widest px-2.5 py-1 border border-emerald-500/30 text-emerald-400"
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}
          </FormSection>

          {/* ──────────────── 06 MATCH SETTINGS ──────────────── */}
          <FormSection index={5} label="06 / Match Settings" active={activeSection} onFocus={() => setActiveSection(5)}>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="text-[9px] font-black tracking-widest text-white/40">
                  Auto-shortlist Threshold
                </label>
                <span className="text-2xl font-black text-emerald-400">{form.matchThreshold}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={form.matchThreshold}
                onChange={(e) => setForm(prev => ({ ...prev, matchThreshold: parseInt(e.target.value) }))}
                className="w-full h-0.5 appearance-none bg-white/10 accent-emerald-500"
              />
              <p className="text-[8px] font-medium text-white/20 leading-relaxed">
                Candidates scoring above this threshold will be auto-shortlisted. Lower = broader pool.
              </p>
            </div>
          </FormSection>

          {/* ──────────────── ACTIONS ─────────────────────────── */}
          <div className="pt-8 pb-20 flex flex-col sm:flex-row gap-4">
            <button
              onClick={saveDraft}
              disabled={status === 'saving'}
              className="flex-1 border border-white/10 py-5 text-[9px] font-black tracking-widest text-white/40 hover:border-white/30 hover:text-white transition-all disabled:opacity-30"
            >
              Save Draft
            </button>
            <button
              onClick={activate}
              disabled={status === 'saving' || status === 'saved'}
              className={`flex-1 py-5 text-[9px] font-black tracking-widest transition-all disabled:opacity-40 flex items-center justify-center gap-2 ${status === 'saved'
                ? 'bg-emerald-500 text-white'
                : 'bg-white text-black hover:bg-white/80'
                }`}
            >
              {status === 'saving' ? (
                <>
                  <span className="material-symbols-outlined text-sm animate-spin">autorenew</span>
                  Publishing…
                </>
              ) : status === 'saved' ? (
                <>
                  <span className="material-symbols-outlined text-sm">check_circle</span>
                  Published — Redirecting
                </>
              ) : (
                'Activate Listing'
              )}
            </button>
          </div>
        </div>

        {/* ── RIGHT: AI SIDEBAR ─────────────────────────────── */}
        <aside className="lg:col-span-4 space-y-4 lg:sticky lg:top-24 h-fit">

          {/* AI Analysis panel */}
          <div className="border border-white/5 bg-white/[0.01] p-6 space-y-6">
            <div className="flex items-center gap-2 text-emerald-400">
              <span className={`material-symbols-outlined text-base ${isAnalyzing ? 'animate-pulse' : ''}`}>
                auto_awesome
              </span>
              <h4 className="text-[9px] font-black tracking-[0.4em]">Neural Prediction</h4>
            </div>

            {isAnalyzing ? (
              <div className="space-y-3 animate-pulse">
                <div className="h-3 bg-white/10 w-3/4 rounded" />
                <div className="h-3 bg-white/10 w-1/2 rounded" />
                <div className="h-12 bg-white/10 rounded" />
              </div>
            ) : aiAnalysis ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[7px] font-black tracking-widest text-white/30 mb-1">Est. Match Pool</p>
                    <p className="text-3xl font-black">{aiAnalysis.estimatedMatchPool ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-[7px] font-black tracking-widest text-white/30 mb-1">Threshold</p>
                    <p className="text-3xl font-black text-emerald-400">{form.matchThreshold}%</p>
                  </div>
                </div>
                {(aiAnalysis.requirements ?? []).length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[7px] font-black tracking-widest text-white/30">
                      Detected Key Skills
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {aiAnalysis.requirements!.map((r: string, i: number) => (
                        <span
                          key={i}
                          className="text-[7px] font-black tracking-widest px-2 py-1 bg-white/5 border border-white/10 text-white/60"
                        >
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[9px] text-white/20 font-medium leading-relaxed">
                Start typing a job summary to activate the neural prediction engine.
              </p>
            )}
          </div>

          {/* Form completion */}
          <div className="border border-white/5 bg-white/[0.01] p-6 space-y-4">
            <h4 className="text-[8px] font-black tracking-[0.3em] text-white/30">
              Completion
            </h4>
            <div className="space-y-2">
              {sections.map((sec, i) => (
                <div key={sec} className="flex items-center gap-3">
                  <div
                    className={`size-1.5 rounded-full shrink-0 transition-colors ${filled[i] ? 'bg-emerald-500' : 'bg-white/10'
                      }`}
                  />
                  <span
                    className={`text-[8px] font-black tracking-widest transition-colors ${filled[i] ? 'text-white/60' : 'text-white/20'
                      }`}
                  >
                    {sec}
                  </span>
                </div>
              ))}
            </div>
            <div className="h-0.5 bg-white/5 overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${completePct}%` }}
              />
            </div>
            <p className="text-[7px] font-black tracking-widest text-white/20">
              {completePct}% complete
            </p>
          </div>

          {/* Tip */}
          <div className="bg-white text-black p-6 space-y-3">
            <h4 className="text-[8px] font-black tracking-widest opacity-40">Tip</h4>
            <p className="text-[9px] font-bold tracking-widest leading-relaxed">
              Listing specific tech stack items increases candidate match fidelity by up to 24%.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
};

/* ================================================================
   SUB-COMPONENTS
================================================================ */

const INPUT_CLS =
  'w-full bg-white/[0.03] border border-white/10 px-4 py-3.5 text-[10px] font-black tracking-widest placeholder:text-white/20 outline-none focus:border-white/30 transition-colors text-white';

const SELECT_CLS =
  'w-full bg-[#111111] border border-white/10 px-4 py-3.5 text-[10px] font-black tracking-widest outline-none focus:border-white/30 transition-colors text-white appearance-none [color-scheme:dark]';

const TEXTAREA_CLS =
  'w-full bg-white/[0.03] border border-white/10 px-4 py-3.5 text-[10px] font-medium tracking-widest placeholder:text-white/20 outline-none focus:border-white/30 transition-colors text-white resize-y';

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="space-y-2">
    <label className="text-[8px] font-black tracking-[0.4em] text-white/30">{label}</label>
    {children}
  </div>
);

const FormSection: React.FC<{
  index: number;
  label: string;
  active: number;
  onFocus: () => void;
  children: React.ReactNode;
}> = ({ index, label, active, onFocus, children }) => (
  <div
    onFocus={onFocus}
    className={`border-t border-white/5 py-8 space-y-5 transition-opacity ${active === index ? 'opacity-100' : 'opacity-60 hover:opacity-80'
      }`}
  >
    <p className="text-[8px] font-black tracking-[0.5em] text-white/30">{label}</p>
    {children}
  </div>
);

export default PostJobPage;
