import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { onSnapshot, doc } from 'firebase/firestore';
import BrandLogo from '../components/BrandLogo';

/*
  Redesign notes (see /impeccable audit + design-taste-frontend review):
  - Accent moved off the app-wide #826BF0 purple to a dedicated emerald for
    this page only, per explicit user direction. Rest of the app is untouched.
  - Dropped: fake "Partner 1-6" trust bar, hotlinked Unsplash stock photos,
    the 98%/98.2% unverified accuracy stats, social-proof-in-hero, eyebrows,
    3-equal feature cards, split-header pattern, duplicate CTA labels,
    bounce/ping/marquee loops, pure-black light-mode sections.
  - Real Firestore member count is preserved and used honestly (no fake
    stat cards), folded into ordinary copy instead of a metric widget.
*/

const ACCENT = '#059669';        // icons, numerals on light bg, borders, meters
const ACCENT_STRONG = '#047857'; // solid button fills carrying white text (AA-safe)
const ACCENT_ON_DARK = '#34D399'; // small text sitting directly on dark sections

interface LandingPageProps {
  onToggleTheme: () => void;
  isDarkMode: boolean;
}

const NAV_ITEMS = [
  { id: 'features', label: 'Features' },
  { id: 'process', label: 'How It Works' },
  { id: 'pricing', label: 'Pricing' },
];

const STEPS = [
  { n: '01', title: 'Upload your resume', desc: 'Drop in your resume or LinkedIn profile. Asterix reads your experience, skills, and career history.' },
  { n: '02', title: 'AI analysis', desc: 'Your background is compared against thousands of open roles in real time, weighing skills, growth potential, and team fit.' },
  { n: '03', title: 'Get your matches', desc: 'Within seconds, your dashboard shows the jobs where you have the best shot, ranked by fit.' },
];

const JOB_SEEKER_FEATURES = [
  'Auto-apply to 30+ jobs every day',
  'Get noticed by recruiters first',
  'Matches even for entry-level profiles',
  'Track all your applications',
  'Email alerts for new matches',
];

const RECRUITER_FEATURES = [
  'Unlimited job postings',
  'Advanced candidate matching',
  'Access to highlighted students',
  'Team collaboration tools',
  'Priority listing and support',
];

const LandingPage: React.FC<LandingPageProps> = ({ onToggleTheme, isDarkMode }) => {
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [heroVisible, setHeroVisible] = useState(false);
  const [liveMembers, setLiveMembers] = useState<number | null>(null);

  useEffect(() => {
    const unsubStats = onSnapshot(
      doc(db, 'jobApplicationCounts', 'global'),
      (snap) => {
        const data = snap.data() as any;
        if (data?.memberCount !== undefined) setLiveMembers(data.memberCount);
      },
      () => { /* fall back to unqualified copy below */ }
    );
    return () => unsubStats();
  }, []);

  useEffect(() => {
    const t = requestAnimationFrame(() => setHeroVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? 'hidden' : 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [isMobileMenuOpen]);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const offset = 88;
      const top = element.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
    setIsMobileMenuOpen(false);
  };

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  const handleUpgradePlan = (plan: 'student' | 'recruiter') => {
    localStorage.setItem('auth_intent', 'buy_plan');
    localStorage.setItem('selected_plan', plan);
    localStorage.setItem('payment_redirect_path', window.location.pathname);
    navigate('/confirm-payment');
  };

  const handleFreeSignup = () => {
    localStorage.removeItem('auth_intent');
    localStorage.removeItem('selected_plan');
    navigate('/signup');
  };

  const memberLabel = liveMembers !== null
    ? (liveMembers >= 1000 ? `${(liveMembers / 1000).toFixed(1)}K+` : `${liveMembers}+`)
    : null;

  const featuresIntro = memberLabel
    ? `Most job sites match keywords in your resume. Asterix understands what you're actually good at, and has already matched ${memberLabel} people to companies where that fits.`
    : `Most job sites match keywords in your resume. Asterix understands what you're actually good at, and finds companies where that fits.`;

  return (
    <div className={`landing-root flex flex-col min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 overflow-x-hidden font-display ${isDarkMode ? 'dark' : ''}`}>

      {/* Header */}
      <header className="fixed top-0 w-full z-[130] h-16 md:h-[72px] bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md border-b border-zinc-900/5 dark:border-white/5">
        <div className="max-w-[1280px] mx-auto px-6 h-full flex items-center justify-between">
          <button onClick={scrollToTop} className="flex items-center gap-2.5 min-h-[44px]" aria-label="Asterix, back to top">
            <BrandLogo isDarkMode={isDarkMode} className="size-8" />
            <span className="text-lg font-bold tracking-tight">Asterix</span>
          </button>

          <nav className="hidden lg:flex items-center gap-8">
            {NAV_ITEMS.map(item => (
              <button
                key={item.id}
                onClick={() => scrollToSection(item.id)}
                className="text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors"
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={onToggleTheme}
              aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-900/5 dark:hover:bg-white/5 transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">{isDarkMode ? 'light_mode' : 'dark_mode'}</span>
            </button>
            <button
              onClick={handleFreeSignup}
              className="hidden md:flex items-center min-h-[44px] px-5 rounded-full text-sm font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-900/5 dark:hover:bg-white/5 transition-colors"
            >
              Sign In
            </button>
            <button
              onClick={() => handleUpgradePlan('recruiter')}
              className="hidden sm:flex items-center min-h-[44px] px-5 rounded-full text-sm font-semibold border border-zinc-900/15 dark:border-white/20 hover:border-zinc-900/40 dark:hover:border-white/40 transition-colors"
            >
              Hire Talent
            </button>
            <button
              onClick={() => setIsMobileMenuOpen(v => !v)}
              aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
              className="lg:hidden p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-zinc-900/5 dark:hover:bg-white/5 transition-colors"
            >
              <span className="material-symbols-outlined text-[22px]">{isMobileMenuOpen ? 'close' : 'menu'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile nav */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[150] lg:hidden bg-white dark:bg-zinc-950 pt-16">
          <div className="flex flex-col p-6 gap-1">
            {NAV_ITEMS.map(item => (
              <button
                key={item.id}
                onClick={() => scrollToSection(item.id)}
                className="text-left text-2xl font-semibold py-4 border-b border-zinc-900/5 dark:border-white/5"
              >
                {item.label}
              </button>
            ))}
            <button
              onClick={() => { setIsMobileMenuOpen(false); handleUpgradePlan('recruiter'); }}
              className="text-left text-2xl font-semibold py-4 border-b border-zinc-900/5 dark:border-white/5"
            >
              Hire Talent
            </button>
            <button
              onClick={handleFreeSignup}
              className="mt-6 min-h-[52px] rounded-full text-white font-semibold"
              style={{ backgroundColor: ACCENT_STRONG }}
            >
              Find a Job
            </button>
          </div>
        </div>
      )}

      <main className="pt-16 md:pt-[72px] flex-grow">

        {/* Hero — asymmetric split, real product preview instead of stock photography */}
        <section
          className={`max-w-[1280px] mx-auto px-6 pt-16 pb-20 md:pt-24 md:pb-28 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-10 items-center transition-all duration-700 ease-out ${heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
        >
          <div className="lg:col-span-7">
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] max-w-xl">
              Stop searching.
              <br />
              Start matching.
            </h1>
            <p className="mt-6 text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-md">
              Asterix reads your actual skills and matches you to roles where you'll genuinely succeed, then applies for you.
            </p>
            <div className="mt-9 flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleFreeSignup}
                className="min-h-[52px] px-8 rounded-full text-white font-semibold text-[15px] transition-transform hover:scale-[1.02] active:scale-[0.98]"
                style={{ backgroundColor: ACCENT_STRONG }}
              >
                Find a Job
              </button>
              <button
                onClick={() => handleUpgradePlan('recruiter')}
                className="min-h-[52px] px-8 rounded-full font-semibold text-[15px] border border-zinc-900/15 dark:border-white/20 hover:border-zinc-900/40 dark:hover:border-white/40 transition-colors"
              >
                Hire Talent
              </button>
            </div>
          </div>

          <div className="lg:col-span-5">
            <MatchCardPreview />
          </div>
        </section>

        {/* Features — asymmetric bento, not three equal cards */}
        <section id="features" className="max-w-[1280px] mx-auto px-6 py-20 md:py-28">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight max-w-lg">
            More than a job board.
          </h2>
          <p className="mt-4 text-zinc-600 dark:text-zinc-400 max-w-[65ch] leading-relaxed">
            {featuresIntro}
          </p>

          <div className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-5">
            <FeatureBlock
              className="lg:col-span-2"
              icon="bolt"
              title="Smart matching"
              desc="Every match is scored across 40-plus factors: your skills, work style, and what each company actually needs, not just your job title."
              large
            />
            <FeatureBlock
              icon="psychology"
              title="Reads between the lines"
              desc="The same job title means different things at different companies. Asterix matches you to roles where your real experience counts."
            />
            <FeatureBlock
              className="lg:col-span-2"
              icon="rocket_launch"
              title="Applies for you"
              desc="Asterix handles the repetitive applying and scheduling, so you can spend your energy on interviews that matter."
            />
            <FeatureBlock
              icon="verified"
              title="Built on real data"
              desc="Every score comes from an actual comparison of your resume against the job, run fresh each time you upload."
            />
          </div>
        </section>

        {/* How it works — numbered steps carry real sequence information */}
        <section id="process" className="bg-zinc-900 text-white rounded-[32px] mx-4 md:mx-6 py-20 md:py-28">
          <div className="max-w-[900px] mx-auto px-6">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-center">How it works</h2>
            <div className="mt-16">
              {STEPS.map((step) => (
                <div key={step.n} className="flex flex-col md:flex-row gap-3 md:gap-10 items-start md:items-center py-8 border-t border-white/10 first:border-t-0">
                  <span className="text-sm font-mono font-semibold shrink-0 md:w-10" style={{ color: ACCENT_ON_DARK }}>{step.n}</span>
                  <div>
                    <h3 className="text-xl md:text-2xl font-semibold">{step.title}</h3>
                    <p className="mt-2 text-zinc-400 leading-relaxed max-w-[60ch]">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="max-w-[1280px] mx-auto px-6 py-20 md:py-28">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight">Simple pricing</h2>
            <p className="mt-3 text-zinc-600 dark:text-zinc-400">For job seekers and hiring teams.</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl mx-auto items-stretch">
            <PricingCard
              title="Job Seeker"
              price="₹99"
              period="/mo"
              features={JOB_SEEKER_FEATURES}
              primaryLabel="Upgrade to Premium"
              onPrimary={() => handleUpgradePlan('student')}
              secondaryLabel="Find a Job"
              onSecondary={handleFreeSignup}
            />
            <PricingCard
              dark
              title="Recruiter Pro"
              price="₹1,999"
              period="/mo"
              features={RECRUITER_FEATURES}
              primaryLabel="Hire Talent"
              onPrimary={() => handleUpgradePlan('recruiter')}
            />
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-900/5 dark:border-white/5 py-14 px-6">
        <div className="max-w-[1280px] mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          <button onClick={scrollToTop} className="flex items-center gap-2.5">
            <BrandLogo isDarkMode={isDarkMode} className="size-7" />
            <span className="font-semibold">Asterix</span>
          </button>
          <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-zinc-600 dark:text-zinc-400">
            {NAV_ITEMS.map(item => (
              <button key={item.id} onClick={() => scrollToSection(item.id)} className="hover:text-zinc-900 dark:hover:text-white transition-colors">
                {item.label}
              </button>
            ))}
            <Link to="/about" className="hover:text-zinc-900 dark:hover:text-white transition-colors">About</Link>
            <Link to="/contact" className="hover:text-zinc-900 dark:hover:text-white transition-colors">Contact</Link>
            <Link to="/privacy" className="hover:text-zinc-900 dark:hover:text-white transition-colors">Privacy</Link>
            <Link to="/terms" className="hover:text-zinc-900 dark:hover:text-white transition-colors">Terms</Link>
          </nav>
          <p className="text-xs text-zinc-500 dark:text-zinc-500">© {new Date().getFullYear()} Asterix Technologies</p>
        </div>
      </footer>

      <style>{`
        .landing-root ::selection { background: ${ACCENT}; color: #fff; }
        .landing-root button:focus-visible,
        .landing-root a:focus-visible {
          outline: 2px solid ${ACCENT};
          outline-offset: 2px;
        }
        @media (prefers-reduced-motion: reduce) {
          .landing-root * {
            transition-duration: 0.01ms !important;
            animation-duration: 0.01ms !important;
          }
        }
      `}</style>
    </div>
  );
};

/* ── Feature block: asymmetric bento cell, not a same-size card grid ── */
const FeatureBlock = ({
  icon, title, desc, large, className = '',
}: { icon: string; title: string; desc: string; large?: boolean; className?: string }) => (
  <div className={`rounded-3xl border border-zinc-900/8 dark:border-white/10 bg-zinc-50 dark:bg-zinc-900/60 p-8 ${large ? 'md:p-10' : ''} flex flex-col gap-5 ${className}`}>
    <div className="size-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${ACCENT}1A`, color: ACCENT }}>
      <span className="material-symbols-outlined text-2xl">{icon}</span>
    </div>
    <h3 className={`${large ? 'text-2xl md:text-3xl' : 'text-xl'} font-semibold tracking-tight`}>{title}</h3>
    <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-[60ch]">{desc}</p>
  </div>
);

/* ── Pricing card ── */
const PricingCard = ({
  dark, title, price, period, features, primaryLabel, onPrimary, secondaryLabel, onSecondary,
}: {
  dark?: boolean; title: string; price: string; period: string; features: string[];
  primaryLabel: string; onPrimary: () => void; secondaryLabel?: string; onSecondary?: () => void;
}) => (
  <div className={`rounded-3xl p-8 md:p-10 flex flex-col justify-between border ${dark ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white dark:bg-zinc-900/60 border-zinc-900/8 dark:border-white/10'}`}>
    <div className="space-y-6">
      <h3 className="text-xl font-semibold">{title}</h3>
      <div className="flex items-baseline gap-1">
        <span className="text-5xl font-bold tracking-tight">{price}</span>
        <span className={dark ? 'text-zinc-400' : 'text-zinc-600 dark:text-zinc-400'}>{period}</span>
      </div>
      <ul className="space-y-3">
        {features.map(f => (
          <li key={f} className="flex items-start gap-3 text-sm">
            <span className="material-symbols-outlined text-lg mt-0.5 shrink-0" style={{ color: dark ? ACCENT_ON_DARK : ACCENT }}>check_circle</span>
            <span className={dark ? 'text-zinc-300' : 'text-zinc-600 dark:text-zinc-300'}>{f}</span>
          </li>
        ))}
      </ul>
    </div>
    <div className="mt-10 flex flex-col gap-3">
      <button
        onClick={onPrimary}
        className={`min-h-[48px] rounded-full font-semibold text-sm transition-colors ${dark ? 'bg-white text-zinc-900 hover:bg-zinc-200' : 'text-white'}`}
        style={dark ? undefined : { backgroundColor: ACCENT_STRONG }}
      >
        {primaryLabel}
      </button>
      {secondaryLabel && onSecondary && (
        <button
          onClick={onSecondary}
          className="min-h-[48px] rounded-full font-semibold text-sm border border-zinc-900/15 dark:border-white/20 hover:border-zinc-900/40 dark:hover:border-white/40 transition-colors"
        >
          {secondaryLabel}
        </button>
      )}
    </div>
  </div>
);

/* ── Hero visual: a real illustrative match card, not a stock photo or a fake dashboard div-mess ── */
const MatchCardPreview: React.FC = () => (
  <div className="relative max-w-[420px] mx-auto lg:mx-0" aria-hidden="true">
    <div className="absolute top-6 -right-4 md:-right-6 w-full h-full rounded-3xl bg-zinc-900/[0.03] dark:bg-white/[0.04]" />
    <div className="relative rounded-3xl border border-zinc-900/8 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.2)] dark:shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)] p-7 md:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Senior Frontend Engineer</p>
          <h3 className="mt-1 text-lg font-semibold tracking-tight">Kestrel Systems</h3>
        </div>
        <div className="text-right shrink-0">
          <div className="text-3xl font-bold tracking-tight" style={{ color: ACCENT }}>94%</div>
          <p className="text-[11px] text-zinc-600 dark:text-zinc-400">match</p>
        </div>
      </div>

      <div className="mt-5 h-1.5 rounded-full bg-zinc-900/5 dark:bg-white/10 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: '94%', backgroundColor: ACCENT }} />
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {['React', 'TypeScript', 'System Design'].map(tag => (
          <span key={tag} className="px-3 py-1.5 rounded-full text-xs font-medium bg-zinc-900/5 dark:bg-white/10 text-zinc-700 dark:text-zinc-300">
            {tag}
          </span>
        ))}
      </div>

      <div
        className="mt-7 w-full min-h-[44px] rounded-full text-sm font-semibold text-white flex items-center justify-center gap-2"
        style={{ backgroundColor: ACCENT_STRONG }}
      >
        <span className="material-symbols-outlined text-base">bolt</span>
        Auto-applied for you
      </div>
    </div>
  </div>
);

export default LandingPage;
