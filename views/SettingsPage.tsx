import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { UserRole } from '../types';
import { authService, AuthUser } from '../authService';

interface SettingsPageProps {
  onToggleTheme: () => void;
  isDarkMode: boolean;
  role: Exclude<UserRole, null>;
  onLogout: () => void;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ onToggleTheme, isDarkMode, role, onLogout }) => {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('ACCOUNT');
  const [isSaving, setIsSaving] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'done'>('idle');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutPhase, setLogoutPhase] = useState(0);
  const [glitchText, setGlitchText] = useState('SIGN OUT');

  /* ── Auth user (includes isPremium / isStudent) ── */
  const [user, setUser] = useState<AuthUser | null>(null);
  const [account, setAccount] = useState({ email: '', name: '', phone: '' });
  const [company, setCompany] = useState({ name: '', website: '', bio: '', headCount: '' });

  // Add import for Firestore
  // import { doc, getDoc, setDoc } from 'firebase/firestore';
  // import { db } from '../firebase';

  useEffect(() => {
    let mounted = true;
    const loadSettings = async () => {
      const u = await authService.getCurrentUser();
      if (!mounted || !u) return;
      setUser(u);

      // Try to load from Firestore 'profiles' collection first
      const { doc, getDoc } = await import('firebase/firestore');
      const { db } = await import('../firebase');
      const snap = await getDoc(doc(db, 'profiles', u.uid));

      if (snap.exists()) {
        const data = snap.data();
        setAccount({
          email: u.email || '',
          name: data.profile?.name || u.displayName || '',
          phone: data.contact?.phone || '',
        });
        if (role === 'recruiter') {
          setCompany({
            name: data.company?.name || '',
            website: data.company?.website || '',
            bio: data.company?.bio || '',
            headCount: data.company?.headCount || '',
          });
        }
        if (data.preferences) {
          setPreferences(prev => ({ ...prev, ...data.preferences }));
        }
      } else {
        // Fallback to existing logic if no Firestore profile found
        setAccount({
          email: u.email || '',
          name: u.displayName || '',
          phone: localStorage.getItem(`asterix_phone_${u.uid}`) || '',
        });
      }
    };
    loadSettings();
    return () => { mounted = false; };
  }, [role]);

  /* ── Plan helpers ── */
  const isPremium = user?.isPremium ?? false;
  const isStudent = user?.isStudent ?? false;
  const hasAccess = isPremium || isStudent;

  /* ── Upgrade handler ── */
  const handleUpgrade = (plan: 'student' | 'recruiter') => {
    localStorage.setItem('auth_intent', 'buy_plan');
    localStorage.setItem('selected_plan', plan);
    localStorage.setItem('payment_redirect_path', window.location.pathname);
    navigate('/confirm-payment');
  };

  /* ── Preferences ── */
  const [preferences, setPreferences] = useState({
    publicProfile: true,
    aiAssistant: true,
    autoApply: false,
    emailNotifications: true,
  });

  useEffect(() => {
    if (!user) return;
    const saved = localStorage.getItem(`asterix_settings_prefs_${user.uid}`);
    if (saved) setPreferences(JSON.parse(saved));
  }, [user]);

  const togglePreference = (key: keyof typeof preferences) => {
    setPreferences(prev => {
      const next = { ...prev, [key]: !prev[key] };
      if (user?.uid) localStorage.setItem(`asterix_settings_prefs_${user.uid}`, JSON.stringify(next));
      return next;
    });
  };

  const handleAccountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAccount(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleCompanyChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setCompany(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  /* ── Save ── */
  const saveSettings = async () => {
    if (isSaving || !user?.uid) return;
    setIsSaving(true);
    setSaveState('saving');

    try {
      const { doc, setDoc } = await import('firebase/firestore');
      const { db } = await import('../firebase');

      const payload: any = {
        profile: { name: account.name },
        contact: { phone: account.phone },
        preferences: preferences,
        updatedAt: new Date().toISOString()
      };

      if (role === 'recruiter') {
        payload.company = company;
      }

      await setDoc(doc(db, 'profiles', user.uid), payload, { merge: true });

      if (typeof (window as any).addNotification === 'function') {
        (window as any).addNotification('Neural Link', 'Operation parameters synchronized.', 'success');
      }

      // Legacy support for other pages reading from localStorage
      localStorage.setItem(`asterix_phone_${user.uid}`, account.phone);
      localStorage.setItem(`asterix_settings_prefs_${user.uid}`, JSON.stringify(preferences));

      setSaveState('done');
    } catch (err) {
      console.error("[Settings] Save failed:", err);
      setSaveState('idle');
    } finally {
      await new Promise(r => setTimeout(r, 900));
      setIsSaving(false);
      await new Promise(r => setTimeout(r, 2000));
      setSaveState('idle');
    }
  };

  /* ── Logout animation ── */
  const GLITCH_CHARS = '!<>-_\\/[]{}=+*^?#@$%ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const scramble = (target: string, progress: number) =>
    target.split('').map((char, i) => {
      if (char === ' ') return ' ';
      if (i < Math.floor(target.length * progress)) return char;
      return GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];
    }).join('');

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    setLogoutPhase(1);
    const messages = ['DE-AUTHORIZING', 'REVOKING ACCESS', 'WIPING SESSION', 'TERMINATING'];
    let msgIndex = 0, progress = 0;
    const iv = setInterval(() => {
      progress += 0.05;
      if (progress > 1) { progress = 0; msgIndex = (msgIndex + 1) % messages.length; }
      setGlitchText(scramble(messages[msgIndex], progress));
    }, 40);
    await new Promise(r => setTimeout(r, 800));
    clearInterval(iv);
    setLogoutPhase(2);
    await new Promise(r => setTimeout(r, 200));
    setLogoutPhase(3);
    await new Promise(r => setTimeout(r, 1600));
    await authService.logout();
    onLogout();
  };

  const tabs = role === 'candidate'
    ? [
      { id: 'ACCOUNT', label: 'Account', icon: 'person' },
      { id: 'BILLING', label: 'Billing', icon: 'credit_card' },
      { id: 'AI', label: 'Neural', icon: 'neurology' },
      { id: 'SECURITY', label: 'Security', icon: 'lock' },
      { id: 'NOTIFICATIONS', label: 'Alerts', icon: 'notifications' },
    ]
    : [
      { id: 'ACCOUNT', label: 'Account', icon: 'person' },
      { id: 'COMPANY', label: 'Company', icon: 'business' },
      { id: 'BILLING', label: 'Billing', icon: 'credit_card' },
      { id: 'AI', label: 'Neural', icon: 'neurology' },
      { id: 'SECURITY', label: 'Security', icon: 'lock' },
    ];

  const aiFeatures = role === 'candidate'
    ? [
      { id: 'publicProfile', label: 'Visible Profile', desc: 'Allow recruiters to discover your node.' },

      { id: 'autoApply', label: 'Auto-Pilot', desc: 'Auto-apply to 95%+ fidelity matches.' },
      { id: 'emailNotifications', label: 'Alert Pings', desc: 'Receive match and status notifications.' },
    ]
    : [
      { id: 'publicProfile', label: 'Enterprise Visibility', desc: 'Allow vetted candidates to see mandate context.' },
      { id: 'aiAssistant', label: 'Recruitment Copilot', desc: 'Enable AI-driven sourcing and audits.' },
      { id: 'autoApply', label: 'Neural Sourcing', desc: 'Auto-shortlist leads with 95%+ fit scores.' },
      { id: 'emailNotifications', label: 'Pipeline Alerts', desc: 'Receive real-time pipeline notifications.' },
    ];

  /* ── Plan config per role ── */
  const planConfig = role === 'candidate'
    ? {
      freeName: 'Free Tier',
      paidName: isStudent ? 'Student Plan' : 'Premium',
      freeDesc: 'Core neural features active. Auto-pilot available on all mandates.',
      paidDesc: isStudent
        ? 'Student plan active — manual initialize and full pipeline access unlocked.'
        : 'Premium active — unlimited auto-pilot, manual apply, and priority matching.',
      upgradeLabel: 'Upgrade to Student Plan (₹99/mo)',
      price: '₹99 / month',
      features: [
        { label: 'Auto-Pilot Apply', free: true },
        { label: 'AI Match Scoring', free: true },
        { label: 'Manual Initialize', free: false },
        { label: 'Priority in Pipeline', free: false },
        { label: 'Resume Cloud Storage', free: false },
        { label: 'Unlimited Applications', free: false },
      ],
    }
    : {
      freeName: 'Starter',
      paidName: 'Pro',
      freeDesc: 'Post mandates and receive auto-matched candidates. Core sourcing tools active.',
      paidDesc: 'Pro plan active — advanced analytics, bulk sourcing, and priority candidate access.',
      upgradeLabel: 'Upgrade to Pro (₹1,999/mo)',
      price: '₹1,999 / month',
      features: [
        { label: 'Post Mandates', free: true },
        { label: 'Auto-Match Candidates', free: true },
        { label: 'Basic Analytics', free: true },
        { label: 'Advanced Sourcing Intel', free: false },
        { label: 'Bulk Candidate Export', free: false },
        { label: 'Priority Support', free: false },
      ],
    };

  /* ── Security actions ── */
  const handleSecurityAction = async (action: string) => {
    if (action === 'Rotate Access Keys' && user?.email) {
      try {
        const { getAuth, sendPasswordResetEmail } = await import('firebase/auth');
        await sendPasswordResetEmail(getAuth(), user.email);
        alert(`Reset link transmitted to ${user.email}`);
      } catch (err) {
        console.error("Reset failed:", err);
      }
    } else {
      alert(`${action} protocol initiated.`);
    }
  };

  /* ── Logout overlay ── */
  const logoutOverlay = isLoggingOut && logoutPhase >= 2 && (
    <div className="fixed inset-0 z-[99999] bg-black flex flex-col items-center justify-center animate-overlay-in">
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.025) 2px, rgba(255,255,255,0.025) 4px)' }} />
      <div className="absolute top-8 left-8 w-12 h-12 border-t-2 border-l-2 border-white/20" />
      <div className="absolute top-8 right-8 w-12 h-12 border-t-2 border-r-2 border-white/20" />
      <div className="absolute bottom-8 left-8 w-12 h-12 border-b-2 border-l-2 border-white/20" />
      <div className="absolute bottom-8 right-8 w-12 h-12 border-b-2 border-r-2 border-white/20" />
      <div className={`flex flex-col items-center gap-10 transition-all duration-500 ${logoutPhase >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
        <div className="relative flex items-center justify-center">
          <div className="absolute size-24 border border-white/10 animate-ping-slow" />
          <div className="absolute size-32 border border-white/5 animate-ping-slow" style={{ animationDelay: '0.4s' }} />
          <div className="size-20 border-2 border-white flex items-center justify-center bg-black">
            <span className="material-symbols-outlined text-4xl text-white">lock</span>
          </div>
        </div>
        <div className="font-mono text-left space-y-3 min-w-[280px]">
          <TerminalLine text="SESSION_TOKEN.revoke()" delay={0} color="text-white/80" />
          <TerminalLine text="NEURAL_SYNC.terminate()" delay={220} color="text-white/50" />
          <TerminalLine text="IDENTITY.wipe()" delay={440} color="text-white/50" />
          <TerminalLine text="ACCESS: DENIED" delay={700} color="text-red-400" bold />
        </div>
        <div className="w-64 space-y-2">
          <div className="h-px bg-white/10 relative overflow-hidden">
            <div className="absolute inset-y-0 left-0 bg-white animate-logout-progress" />
          </div>
          <p className="text-[8px] font-black tracking-[0.5em] text-white/20 text-center animate-pulse">Redirecting to login</p>
        </div>
      </div>
    </div>
  );

  /* ════════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════════ */
  return (
    <div className="flex h-screen bg-white dark:bg-background-dark text-black dark:text-white transition-colors duration-500 overflow-hidden font-display">
      {logoutOverlay}
      <Sidebar role={role} isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />

      <main className="flex-1 overflow-y-auto border-l border-black dark:border-white/10 relative custom-scrollbar">

        {/* Save toast */}
        <div className={`fixed top-6 right-6 z-[500] transition-all duration-500 ${saveState === 'done' ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`}>
          <div className="bg-emerald-500 text-white px-8 py-4 flex items-center gap-3 shadow-2xl">
            <span className="material-symbols-outlined text-lg animate-bounce">check_circle</span>
            <span className="text-[10px] font-black tracking-widest">Protocol Updated</span>
          </div>
        </div>

        <div className="p-6 md:p-12 lg:p-20 space-y-12 md:space-y-20 pb-32">

          {/* Header */}
          <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
            <div className="flex items-center gap-4">
              <button onClick={() => setIsMenuOpen(true)} className="md:hidden p-2 -ml-2 text-black dark:text-white">
                <span className="material-symbols-outlined">menu</span>
              </button>
              <div className="min-w-0">
                <div className="text-[7px] md:text-[10px] font-black tracking-[0.5em] opacity-40 mb-0.5 md:mb-1 truncate">Operational Parameters</div>
                <h1 className="text-2xl md:text-6xl font-black tracking-tighter truncate">System Settings</h1>
              </div>
            </div>
            <div className="flex gap-2 md:gap-3 items-center w-full md:w-auto">
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className={`flex-1 md:flex-none relative overflow-hidden px-4 md:px-6 py-2.5 md:py-3 border text-[8px] md:text-[10px] font-black tracking-widest transition-all
                  ${isLoggingOut ? 'border-red-500 text-red-500 bg-red-500/10 cursor-not-allowed' : 'border-red-500 text-red-500 hover:bg-red-500 hover:text-white'}`}
              >
                {isLoggingOut ? <span className="font-mono text-[8px] md:text-[9px]">{glitchText}</span> : 'Sign Out'}
                {isLoggingOut && <span className="absolute top-0 left-0 w-full h-px bg-red-500/80 animate-scan-line" />}
              </button>
              <button onClick={onToggleTheme} className="p-2.5 md:p-4 border border-black dark:border-white hover:invert transition-all">
                <span className="material-symbols-outlined text-lg md:text-xl">{isDarkMode ? 'light_mode' : 'dark_mode'}</span>
              </button>
            </div>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-16">

            {/* Tabs */}
            <div className="lg:col-span-3 relative">
              <div className="flex flex-row lg:flex-col gap-2 overflow-x-auto pb-4 lg:pb-0 no-scrollbar pr-12 lg:pr-0">
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`whitespace-nowrap flex-shrink-0 flex items-center gap-2.5 md:gap-3 text-left px-4 md:px-5 py-3 md:py-4 lg:p-6 border text-[8px] md:text-[10px] font-black tracking-widest transition-all
                      ${activeTab === tab.id
                        ? 'bg-black text-white dark:bg-white dark:text-black border-black dark:border-white'
                        : 'border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5'}`}
                  >
                    <span className="material-symbols-outlined text-[14px] md:text-[16px]">{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="absolute right-0 top-0 bottom-4 w-12 bg-gradient-to-l from-white dark:from-background-dark to-transparent pointer-events-none lg:hidden" />
            </div>

            {/* Panel */}
            <div className="lg:col-span-9 space-y-16 md:space-y-20">

              {/* ── ACCOUNT ── */}
              {activeTab === 'ACCOUNT' && (
                <section className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-400">
                  <h3 className="text-lg md:text-xl font-black tracking-widest border-b border-black/10 dark:border-white/10 pb-6">Profile Matrix</h3>

                  {user && (
                    <div className="flex items-center gap-5 p-6 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10">
                      <div className="size-14 border border-black/20 dark:border-white/20 overflow-hidden bg-black/10 flex items-center justify-center shrink-0">
                        {user.photoURL
                          ? <img src={user.photoURL} alt="" className="size-full object-cover" />
                          : <span className="material-symbols-outlined text-2xl opacity-40">person</span>}
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-sm font-black tracking-tight">{account.name || 'Unknown'}</p>
                        <p className="text-[10px] font-bold tracking-widest opacity-40">{account.email}</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[8px] font-black tracking-widest px-2 py-0.5 border border-emerald-500 text-emerald-500">LIVE SESSION</span>
                          {hasAccess && (
                            <span className="text-[8px] font-black tracking-widest px-2 py-0.5 border border-blue-400 text-blue-400">
                              {role === 'candidate' ? (isStudent ? 'STUDENT' : 'PREMIUM') : 'PRO'}
                            </span>
                          )}
                          <span className="text-[8px] font-black tracking-widest px-2 py-0.5 border border-purple-400 text-purple-400">{role.toUpperCase()}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid gap-8">
                    {[
                      { label: 'Operational ID (Email)', name: 'email', type: 'email', value: account.email },
                      { label: 'Display Name', name: 'name', type: 'text', value: account.name },
                      { label: 'Contact Node (Phone)', name: 'phone', type: 'tel', value: account.phone },
                    ].map(field => (
                      <div key={field.name} className="space-y-3">
                        <label className="text-[9px] md:text-[10px] font-black tracking-[0.3em] opacity-40">{field.label}</label>
                        <input
                          type={field.type}
                          name={field.name}
                          value={field.value}
                          onChange={handleAccountChange}
                          readOnly={field.name === 'email'}
                          className={`w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:border-black dark:focus:border-white p-4 md:p-5 text-xs md:text-sm font-bold outline-none tracking-wide transition-colors ${field.name === 'email' ? 'opacity-50 cursor-not-allowed' : ''}`}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* ── COMPANY ── */}
              {activeTab === 'COMPANY' && role === 'recruiter' && (
                <section className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-400">
                  <h3 className="text-lg md:text-xl font-black tracking-widest border-b border-black/10 dark:border-white/10 pb-6">Enterprise Profile</h3>

                  <div className="grid gap-8">
                    {[
                      { label: 'Organization Name', name: 'name', type: 'text', value: company.name },
                      { label: 'Official Website', name: 'website', type: 'url', value: company.website },
                      { label: 'Headcount / Size', name: 'headCount', type: 'text', value: company.headCount },
                    ].map(field => (
                      <div key={field.name} className="space-y-3">
                        <label className="text-[9px] md:text-[10px] font-black tracking-[0.3em] opacity-40">{field.label}</label>
                        <input
                          type={field.type}
                          name={field.name}
                          value={field.value}
                          onChange={handleCompanyChange}
                          className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:border-black dark:focus:border-white p-4 md:p-5 text-xs md:text-sm font-bold outline-none tracking-wide transition-colors"
                        />
                      </div>
                    ))}

                    <div className="space-y-3">
                      <label className="text-[9px] md:text-[10px] font-black tracking-[0.3em] opacity-40">Organization Manifesto (Bio)</label>
                      <textarea
                        name="bio"
                        value={company.bio}
                        onChange={handleCompanyChange}
                        rows={4}
                        className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:border-black dark:focus:border-white p-4 md:p-5 text-xs md:text-sm font-bold outline-none tracking-wide transition-colors resize-none"
                      />
                    </div>
                  </div>
                </section>
              )}

              {/* ── BILLING ── */}
              {activeTab === 'BILLING' && (
                <section className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-400">
                  <h3 className="text-lg md:text-xl font-black tracking-widest border-b border-black/10 dark:border-white/10 pb-6">Billing Matrix</h3>

                  {/* Current plan card */}
                  <div className={`p-8 md:p-12 space-y-4 ${hasAccess ? 'bg-emerald-500 text-white' : 'bg-black dark:bg-white text-white dark:text-black'}`}>
                    <p className="text-[9px] font-black tracking-widest opacity-60">Current Plan</p>
                    <p className="text-4xl md:text-5xl font-black tracking-tighter">
                      {hasAccess ? planConfig.paidName : planConfig.freeName}
                    </p>
                    <p className="text-[9px] font-bold tracking-widest opacity-60 max-w-sm leading-relaxed">
                      {hasAccess ? planConfig.paidDesc : planConfig.freeDesc}
                    </p>
                    {hasAccess && (
                      <div className="flex items-center gap-2 pt-2">
                        <span className="material-symbols-outlined text-sm">check_circle</span>
                        <span className="text-[9px] font-black tracking-widest">All features unlocked</span>
                      </div>
                    )}
                  </div>

                  {/* Feature comparison */}
                  <div className="border border-black dark:border-white/20 divide-y divide-black/5 dark:divide-white/5">
                    <div className="grid grid-cols-3 px-6 py-3 bg-black/5 dark:bg-white/5">
                      <span className="text-[8px] font-black tracking-widest opacity-40 col-span-1">Feature</span>
                      <span className="text-[8px] font-black tracking-widest opacity-40 text-center">{planConfig.freeName}</span>
                      <span className="text-[8px] font-black tracking-widest opacity-40 text-center">{planConfig.paidName}</span>
                    </div>
                    {planConfig.features.map((f) => (
                      <div key={f.label} className="grid grid-cols-3 px-6 py-4 items-center">
                        <span className="text-[9px] font-black tracking-widest col-span-1">{f.label}</span>
                        <div className="flex justify-center">
                          {f.free
                            ? <span className="material-symbols-outlined text-sm text-emerald-500">check</span>
                            : <span className="material-symbols-outlined text-sm opacity-20">remove</span>}
                        </div>
                        <div className="flex justify-center">
                          <span className="material-symbols-outlined text-sm text-emerald-500">check</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Upgrade CTA — only if not already paid */}
                  {!hasAccess ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-6 border-2 border-black dark:border-white">
                        <div>
                          <p className="text-[9px] font-black tracking-widest opacity-40">Unlock Full Access</p>
                          <p className="text-2xl font-black tracking-tighter mt-1">{planConfig.price}</p>
                        </div>
                        <button
                          onClick={() => handleUpgrade(role === 'candidate' ? 'student' : 'recruiter')}
                          className="bg-black dark:bg-white text-white dark:text-black px-8 py-4 text-[10px] font-black tracking-widest hover:invert transition-all"
                        >
                          {planConfig.upgradeLabel}
                        </button>
                      </div>
                      <p className="text-[8px] font-black tracking-widest opacity-30 text-center">
                        Secure payment via Cashfree PG · Cancel anytime
                      </p>
                    </div>
                  ) : (
                    <div className="p-6 border border-emerald-500/30 bg-emerald-500/5 flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-[9px] font-black tracking-widest text-emerald-500">Plan Active</p>
                        <p className="text-[8px] font-bold tracking-widest opacity-40">Renews automatically · Manage via payment provider</p>
                      </div>
                      <span className="material-symbols-outlined text-emerald-500">verified</span>
                    </div>
                  )}
                </section>
              )}

              {/* ── NEURAL / AI ── */}
              {activeTab === 'AI' && (
                <section className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-400">
                  <h3 className="text-lg md:text-xl font-black tracking-widest border-b border-black/10 dark:border-white/10 pb-6">Neural Protocol</h3>
                  <div className="space-y-0 divide-y divide-black/5 dark:divide-white/5">
                    {aiFeatures.map(f => (
                      <div key={f.id} className="flex items-center justify-between py-8 group">
                        <div className="space-y-2 pr-8">
                          <p className="text-base md:text-lg font-black tracking-tighter">{f.label}</p>
                          <p className="text-[9px] font-bold tracking-widest opacity-40 leading-relaxed max-w-sm">{f.desc}</p>
                        </div>
                        <button
                          onClick={() => togglePreference(f.id as keyof typeof preferences)}
                          className={`size-11 md:size-12 border-2 flex items-center justify-center shrink-0 p-1.5 transition-all
                            ${preferences[f.id as keyof typeof preferences]
                              ? 'border-black dark:border-white bg-black dark:bg-white'
                              : 'border-black/20 dark:border-white/20 bg-transparent'}`}
                        >
                          <span className={`material-symbols-outlined text-lg transition-all ${preferences[f.id as keyof typeof preferences] ? 'text-white dark:text-black opacity-100' : 'opacity-0'}`}>
                            check
                          </span>
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* ── SECURITY ── */}
              {activeTab === 'SECURITY' && (
                <section className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-400">
                  <h3 className="text-lg md:text-xl font-black tracking-widest border-b border-black/10 dark:border-white/10 pb-6">Access Control</h3>
                  <div className="space-y-4">
                    {[
                      { label: 'Rotate Access Keys', icon: 'key', desc: 'Generate a new password reset link.' },
                      { label: 'Active Sessions', icon: 'devices', desc: 'View and revoke all logged-in devices.' },
                      { label: 'Two-Factor Auth', icon: 'shield', desc: 'Add an extra verification layer.' },
                    ].map(action => (
                      <button
                        key={action.label}
                        onClick={() => handleSecurityAction(action.label)}
                        className="w-full flex items-center justify-between p-5 md:p-6 border border-black/10 dark:border-white/10 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all group text-left"
                      >
                        <div className="flex items-center gap-4">
                          <span className="material-symbols-outlined text-xl">{action.icon}</span>
                          <div>
                            <p className="text-[10px] md:text-xs font-black tracking-widest">{action.label}</p>
                            <p className="text-[8px] font-bold tracking-widest opacity-40 mt-1">{action.desc}</p>
                          </div>
                        </div>
                        <span className="material-symbols-outlined text-lg opacity-30 group-hover:opacity-100 group-hover:translate-x-1 transition-all">arrow_forward</span>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* ── NOTIFICATIONS ── */}
              {activeTab === 'NOTIFICATIONS' && (
                <section className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-400">
                  <h3 className="text-lg md:text-xl font-black tracking-widest border-b border-black/10 dark:border-white/10 pb-6">Alert Matrix</h3>
                  <div className="divide-y divide-black/5 dark:divide-white/5">
                    {[
                      { id: 'emailNotifications', label: 'Email Pings', desc: 'Match alerts and application updates.' },
                      { id: 'publicProfile', label: 'Profile Views', desc: 'Notify when a recruiter views your profile.' },
                    ].map(f => (
                      <div key={f.id} className="flex items-center justify-between py-8">
                        <div className="space-y-2 pr-8">
                          <p className="text-base md:text-lg font-black tracking-tighter">{f.label}</p>
                          <p className="text-[9px] font-bold tracking-widest opacity-40 max-w-sm">{f.desc}</p>
                        </div>
                        <button
                          onClick={() => togglePreference(f.id as keyof typeof preferences)}
                          className={`size-11 md:size-12 border-2 flex items-center justify-center shrink-0 p-1.5 transition-all
                            ${preferences[f.id as keyof typeof preferences]
                              ? 'border-black dark:border-white bg-black dark:bg-white'
                              : 'border-black/20 dark:border-white/20 bg-transparent'}`}
                        >
                          <span className={`material-symbols-outlined text-lg transition-all ${preferences[f.id as keyof typeof preferences] ? 'text-white dark:text-black opacity-100' : 'opacity-0'}`}>check</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* ── Save bar ── */}
              <div
                onClick={saveSettings}
                className={`bg-black text-white dark:bg-white dark:text-black p-6 md:p-12 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 cursor-pointer group transition-opacity ${saveState === 'saving' ? 'opacity-60 pointer-events-none' : 'opacity-100'}`}
              >
                <div className="space-y-1.5 md:space-y-2">
                  <h4 className="text-xl md:text-3xl font-black tracking-tighter leading-none">
                    {saveState === 'saving' ? 'Syncing...' : saveState === 'done' ? 'Synced ✓' : 'Sync Protocol'}
                  </h4>
                  <p className="text-[7px] md:text-[9px] font-black tracking-[0.4em] opacity-40">Apply new operational parameters to network.</p>
                </div>
                <button className="w-full md:w-auto bg-white text-black dark:bg-black dark:text-white px-6 md:px-12 py-3.5 md:py-5 text-[8px] md:text-[10px] font-black tracking-[0.4em] group-hover:invert transition-all flex items-center justify-center gap-3">
                  {saveState === 'saving'
                    ? <span className="material-symbols-outlined animate-spin text-sm">refresh</span>
                    : saveState === 'done'
                      ? <><span className="material-symbols-outlined text-sm">check_circle</span> Done</>
                      : 'Execute Sync'}
                </button>
              </div>

              {/* Danger zone */}
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4 border-t border-black/5 dark:border-white/5 pt-10">
                <button className="text-[9px] font-black tracking-[0.4em] text-red-600 hover:text-red-700 transition-colors">
                  Decommission Profile
                </button>
                <span className="text-[9px] font-black tracking-[0.5em] opacity-10">
                  CORE-V4-{role?.toUpperCase()}
                </span>
              </div>

            </div>
          </div>
        </div>
      </main>

      <style>{`
        @keyframes scan-line { 0% { top: -1px; opacity: 1; } 100% { top: 100%; opacity: 0.3; } }
        .animate-scan-line { animation: scan-line 0.5s linear infinite; }
        @keyframes logout-progress { 0% { width: 0%; } 100% { width: 100%; } }
        .animate-logout-progress { animation: logout-progress 1.4s cubic-bezier(0.4,0,0.2,1) forwards; animation-delay: 0.4s; }
        @keyframes overlay-in { 0% { clip-path: inset(50% 50% 50% 50%); } 100% { clip-path: inset(0% 0% 0% 0%); } }
        .animate-overlay-in { animation: overlay-in 0.35s cubic-bezier(0.16,1,0.3,1) forwards; }
        @keyframes ping-slow { 0% { transform: scale(1); opacity: 0.6; } 70% { transform: scale(1.4); opacity: 0; } 100% { transform: scale(1.4); opacity: 0; } }
        .animate-ping-slow { animation: ping-slow 2s ease-out infinite; }
      `}</style>
    </div>
  );
};

/* ── Terminal Line ── */
interface TerminalLineProps { text: string; delay: number; color?: string; bold?: boolean; }
const TerminalLine: React.FC<TerminalLineProps> = ({ text, delay, color = 'text-white', bold }) => {
  const [visible, setVisible] = useState(false);
  const [displayed, setDisplayed] = useState('');
  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(true);
      let i = 0;
      const iv = setInterval(() => { i++; setDisplayed(text.slice(0, i)); if (i >= text.length) clearInterval(iv); }, 16);
      return () => clearInterval(iv);
    }, delay);
    return () => clearTimeout(t);
  }, [text, delay]);
  if (!visible) return <div className="h-5" />;
  return (
    <div className={`text-[11px] ${color} ${bold ? 'font-black tracking-widest' : 'font-mono'} flex items-center gap-2`}>
      <span className="text-white/20 select-none">{'>'}</span>
      <span>{displayed}</span>
      {displayed.length < text.length && <span className="inline-block w-[6px] h-[13px] bg-current animate-pulse" />}
    </div>
  );
};

export default SettingsPage;
