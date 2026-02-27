import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { UserRole } from '../types';
import { authService, AuthUser } from '../authService';
import '../App.css';


interface SidebarProps {
  role: UserRole;
  isOpen?: boolean;
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ role, isOpen, onClose }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutPhase, setLogoutPhase] = useState(0);
  const [glitchText, setGlitchText] = useState('DE-AUTHORIZING');

  /* ── Load auth user ── */
  useEffect(() => {
    let mounted = true;
    authService.getCurrentUser().then(u => { if (mounted) setUser(u); });
    return () => { mounted = false; };
  }, []);

  /* ── Logout animation ── */
  const GLITCH_CHARS = '!<>-_\\/[]{}=+*^?#@$%ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const scramble = (target: string, progress: number) =>
    target.split('').map((char, i) => {
      if (char === ' ') return ' ';
      if (i < Math.floor(target.length * progress)) return char;
      return GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];
    }).join('');

  const handleLogout = async () => {
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
    onClose?.();
    navigate('/login', { replace: true });
  };

  /* ── Upgrade handler ── */
  const handleUpgrade = (plan: 'student' | 'recruiter') => {
    localStorage.setItem('auth_intent', 'buy_plan');
    localStorage.setItem('selected_plan', plan);
    navigate('/confirm-payment');
    onClose?.();
  };

  /* ── Nav items ── */
  const navItems = role === 'candidate'
    ? [
      { name: 'Dashboard', icon: 'dashboard', path: '/candidate' },
      { name: 'Jobs', icon: 'work', path: '/candidate/jobs' },
      { name: 'Profile', icon: 'person', path: '/candidate/profile' },
      { name: 'My Applications', icon: 'work_history', path: '/candidate/applications' },
      { name: 'Settings', icon: 'settings', path: '/candidate/settings' },
    ]
    : [
      { name: 'Dashboard', icon: 'dashboard', path: '/recruiter' },
      { name: 'Active Sourcing', icon: 'work', path: '/recruiter/active-jobs' },
      { name: 'Talent Pipeline', icon: 'groups', path: '/recruiter/talent' },
      { name: 'Intelligence', icon: 'bar_chart', path: '/recruiter/reports' },
      { name: 'Settings', icon: 'settings', path: '/recruiter/settings' },
    ];

  const isPremium = user?.isPremium ?? false;
  const isStudent = user?.isStudent ?? false;
  const hasAccess = isPremium || isStudent;

  /* ════════════════════════════════════════════════════════════════
     SIDEBAR CONTENT
  ════════════════════════════════════════════════════════════════ */
  const sidebarContent = (
    <div className="h-full flex flex-col p-6">
      <div className="flex flex-col gap-8 flex-1">

        {/* Brand */}
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 px-2" onClick={onClose}>
            <div className="bg-black dark:bg-white size-10 flex items-center justify-center text-white dark:text-black">
              <span className="material-symbols-outlined text-2xl">auto_awesome</span>
            </div>
            <div className="flex flex-col">
              <h1 className="text-black dark:text-white text-base font-black uppercase tracking-tighter">Asterix</h1>
              <p className="text-black/60 dark:text-white/60 text-[10px] font-bold uppercase tracking-widest">
                {role === 'candidate' ? 'Job Seeker' : 'Talent Lead'}
              </p>
            </div>
          </Link>
          {onClose && (
            <button onClick={onClose} className="md:hidden p-2 text-black dark:text-white">
              <span className="material-symbols-outlined">close</span>
            </button>
          )}
        </div>

        {/* ── Plan section ── */}
        {role === 'candidate' && (
          <div className="border-2 border-black/10 dark:border-white/10 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-black/60 dark:text-white/60">
                  {hasAccess ? (isStudent ? 'Student Plan' : 'Premium') : 'Free Plan'}
                </p>
                {hasAccess && (
                  <p className="text-[8px] font-bold text-black/40 dark:text-white/40 mt-1">₹99 / month</p>
                )}
              </div>
              {isStudent && (
                <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-1 text-[9px] font-black uppercase tracking-widest">
                  Student
                </span>
              )}
              {isPremium && !isStudent && (
                <span className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-2 py-1 text-[9px] font-black uppercase tracking-widest">
                  Premium
                </span>
              )}
            </div>

            {/* Upgrade CTA — only when not on a paid plan */}
            {!hasAccess && (
              <button
                onClick={() => handleUpgrade('student')}
                className="w-full bg-black dark:bg-white text-white dark:text-black py-2.5 text-[9px] font-black uppercase tracking-widest hover:invert transition-all"
              >
                Upgrade to Student Plan
              </button>
            )}

            {hasAccess && (
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <span className="material-symbols-outlined text-sm">check_circle</span>
                <span className="text-[9px] font-black uppercase tracking-widest">Full access active</span>
              </div>
            )}
          </div>
        )}

        {/* Recruiter: plan badge + Pro upgrade */}
        {role === 'recruiter' && (
          <div className="border-2 border-black/10 dark:border-white/10 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-black/60 dark:text-white/60">
                  {hasAccess ? 'Pro Plan' : 'Starter Plan'}
                </p>
                {hasAccess && (
                  <p className="text-[8px] font-bold text-black/40 dark:text-white/40 mt-1">₹1,999 / month</p>
                )}
              </div>
              <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-2 py-1 text-[9px] font-black uppercase tracking-widest">
                Recruiter
              </span>
            </div>

            {/* Upgrade to Pro CTA — only when not on Pro plan */}
            {!hasAccess && (
              <button
                onClick={() => handleUpgrade('recruiter')}
                className="w-full bg-black dark:bg-white text-white dark:text-black py-2.5 text-[9px] font-black uppercase tracking-widest hover:invert transition-all flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">lock</span>
                Upgrade to Pro
              </button>
            )}

            {hasAccess && (
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <span className="material-symbols-outlined text-sm">check_circle</span>
                <span className="text-[9px] font-black uppercase tracking-widest">Pro access active</span>
              </div>
            )}
          </div>
        )}

        {/* Nav */}
        <nav className="flex flex-col gap-1">
          {navItems.map(item => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.name}
                to={item.path}
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-3 transition-all ${isActive
                    ? 'bg-black text-white dark:bg-white dark:text-black font-black'
                    : 'text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
              >
                <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                <span className="text-[10px] uppercase tracking-widest font-black">{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* User + logout */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3 px-2 pt-4 border-t border-black/10 dark:border-white/10">
          <div className="size-10 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 overflow-hidden">
            {user?.photoURL
              ? <img src={user.photoURL} alt="" className="size-full object-cover" />
              : <span className="material-symbols-outlined size-full flex items-center justify-center text-black/40 dark:text-white/40">person</span>}
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="text-[10px] font-black text-black dark:text-white truncate uppercase">
              {user?.displayName || user?.email?.split('@')[0] || 'User'}
            </span>
            <span className="text-[8px] font-bold text-black/40 dark:text-white/40 truncate">{user?.email}</span>
          </div>
        </div>

        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className={`w-full flex items-center justify-center gap-2 py-3 border transition-all text-[9px] font-black uppercase tracking-widest group relative overflow-hidden
            ${isLoggingOut
              ? 'border-red-500 text-red-500 bg-red-500/10 cursor-not-allowed'
              : 'border-black dark:border-white text-black dark:text-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black'}`}
        >
          {isLoggingOut
            ? <span className="font-mono text-[9px]">{glitchText}</span>
            : <><span className="material-symbols-outlined text-sm group-hover:translate-x-1 transition-transform">logout</span> De-authorize</>}
          {isLoggingOut && <span className="absolute top-0 left-0 w-full h-px bg-red-500/80 animate-scan-line" />}
        </button>
      </div>
    </div>
  );

  /* ── Logout overlay ── */
  const logoutOverlay = isLoggingOut && logoutPhase >= 2
    ? createPortal(
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
            <p className="text-[8px] font-black uppercase tracking-[0.5em] text-white/20 text-center animate-pulse">Redirecting to login</p>
          </div>
        </div>
      </div>,
      document.body
    )
    : null;

  /* ── Render ── */
  return (
    <>
      {logoutOverlay}

      {/* Mobile overlay */}
      <div
        className={`fixed inset-0 z-[150] bg-black/50 md:hidden transition-opacity duration-300 ${isOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`}
        onClick={onClose}
      />

      {/* Mobile sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-[160] w-64 bg-white dark:bg-background-dark border-r border-black dark:border-white/20 transform transition-transform duration-300 ease-in-out md:hidden overflow-y-auto ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="w-64 hidden md:flex flex-col border-r border-black dark:border-white/20 bg-white dark:bg-background-dark overflow-y-auto">
        {sidebarContent}
      </aside>

      <style>{`
        @keyframes scan-line { 0% { top: -1px; } 100% { top: 100%; } }
        .animate-scan-line { animation: scan-line 0.5s linear infinite; }
        @keyframes logout-progress { 0% { width: 0%; } 100% { width: 100%; } }
        .animate-logout-progress { animation: logout-progress 1.4s cubic-bezier(0.4,0,0.2,1) forwards; animation-delay: 0.4s; }
        @keyframes overlay-in { 0% { clip-path: inset(50% 50% 50% 50%); } 100% { clip-path: inset(0% 0% 0% 0%); } }
        .animate-overlay-in { animation: overlay-in 0.35s cubic-bezier(0.16,1,0.3,1) forwards; }
        @keyframes ping-slow { 0% { transform: scale(1); opacity: 0.6; } 70% { transform: scale(1.4); opacity: 0; } 100% { transform: scale(1.4); opacity: 0; } }
        .animate-ping-slow { animation: ping-slow 2s ease-out infinite; }
      `}</style>
    </>
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

export default Sidebar;