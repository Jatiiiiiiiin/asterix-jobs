import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, onSnapshot, doc } from 'firebase/firestore';

interface LandingPageProps {
  onToggleTheme: () => void;
  isDarkMode: boolean;
}


const LandingPage: React.FC<LandingPageProps> = ({ onToggleTheme, isDarkMode }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  // Live stats from Firestore
  const [liveJobsMatched, setLiveJobsMatched] = useState<number | null>(null);
  const [liveMembers, setLiveMembers] = useState<number | null>(null);
  const [liveCompanies, setLiveCompanies] = useState<number | null>(null);

  useEffect(() => {
    // Real-time listener: read from global stats doc (using path with public read rule)
    const unsubStats = onSnapshot(
      doc(db, 'jobApplicationCounts', 'global'),
      (snap) => {
        const data = snap.data() as any;
        if (data) {
          if (data.applicationCount !== undefined) setLiveJobsMatched(data.applicationCount);
          if (data.memberCount !== undefined) setLiveMembers(data.memberCount);
        }
      },
      () => { /* fall back to static */ }
    );

    // Real-time listener: count distinct companies from jobs (if public)
    const unsubJobs = onSnapshot(
      collection(db, 'jobs'),
      (snap) => {
        const unique = new Set(
          snap.docs.map(d => {
            const data = d.data();
            return (data.company?.name ?? data.companyName ?? '').toLowerCase().trim();
          }).filter(Boolean)
        );
        if (unique.size > 0) setLiveCompanies(unique.size);
      },
      () => { /* fall back to static */ }
    );

    return () => { unsubStats(); unsubJobs(); };
  }, []);

  useEffect(() => {
    setIsVisible(true);
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [isMobileMenuOpen]);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const offset = 96; // Increased offset to account for header height (24 * 4 = 96px)
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = element.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
    setIsMobileMenuOpen(false);
  };

  /* ════════════════════════════════════════════════════════════════
     PAYMENT HANDLERS - Simple flow to /confirm-payment
  ════════════════════════════════════════════════════════════════ */

  const handleUpgradePlan = (plan: 'student' | 'recruiter') => {
    localStorage.setItem('auth_intent', 'buy_plan');
    localStorage.setItem('selected_plan', plan);
    navigate('/confirm-payment');
  };

  const handleFreeSignup = () => {
    localStorage.removeItem('auth_intent');
    localStorage.removeItem('selected_plan');
    navigate('/signup');
  };

  /* ════════════════════════════════════════════════════════════════ */

  const FeatureCard = ({ icon, title, desc }: { icon: string, title: string, desc: string }) => (
    <div className="group border border-black dark:border-white/20 p-6 sm:p-8 md:p-10 hover:bg-black dark:hover:bg-white transition-all duration-500 flex flex-col gap-5 md:gap-6 h-full">
      <div className="size-10 md:size-12 border border-black dark:border-white flex items-center justify-center group-hover:bg-white dark:group-hover:bg-black group-hover:text-black dark:group-hover:text-white transition-colors duration-500">
        <span className="material-symbols-outlined text-xl md:text-2xl">{icon}</span>
      </div>
      <h3 className="text-xl md:text-2xl font-black uppercase tracking-tighter group-hover:text-white dark:group-hover:text-black transition-colors duration-500">
        {title}
      </h3>
      <p className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-black/50 dark:text-white/50 group-hover:text-white/70 dark:group-hover:text-black/70 leading-relaxed transition-colors duration-500">
        {desc}
      </p>
    </div>
  );

  return (
    <div className="flex flex-col scroll-smooth bg-white dark:bg-background-dark text-black dark:text-white overflow-x-hidden">
      {/* Navigation */}
      <header className="fixed top-0 w-full z-[130] glass-nav border-b border-black dark:border-white/10">
        <div className="max-w-[1440px] mx-auto px-5 sm:px-6 md:px-10 h-20 md:h-24 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-9 md:size-12 bg-black dark:bg-white flex items-center justify-center text-white dark:text-black hover:rotate-90 transition-transform duration-500 cursor-pointer">
              <span className="material-symbols-outlined text-xl md:text-3xl font-black">auto_awesome</span>
            </div>
            <h2 className="text-xl md:text-3xl font-black tracking-tighter uppercase leading-none">Asterix</h2>
          </div>

          <nav className="hidden lg:flex items-center gap-10 xl:gap-12">
            {['Features', 'Process', 'Pricing', 'Network'].map(item => (
              <button
                key={item}
                onClick={() => scrollToSection(item.toLowerCase())}
                className="text-[10px] xl:text-[11px] font-black uppercase tracking-[0.25em] hover:opacity-50 transition-opacity"
              >
                {item}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3 md:gap-6">
            <button onClick={onToggleTheme} className="p-2 md:p-3 border border-black dark:border-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all">
              <span className="material-symbols-outlined text-[18px] md:text-[24px]">{isDarkMode ? 'light_mode' : 'dark_mode'}</span>
            </button>
            <button
              onClick={handleFreeSignup}
              className="bg-black dark:bg-white text-white dark:text-black px-5 md:px-10 py-2.5 md:py-4 text-[10px] md:text-[11px] font-black uppercase tracking-[0.2em] hover:scale-105 active:scale-95 transition-all shadow-xl"
            >
              Sign In
            </button>
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden size-10 flex items-center justify-center border border-black dark:border-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all relative z-[140]"
            >
              <span className="material-symbols-outlined text-2xl">{isMobileMenuOpen ? 'close' : 'menu'}</span>
            </button>
          </div>
        </div>

        {/* Mobile Nav Overlay */}
        <div
          className={`mobile-menu-overlay fixed inset-0 z-[110] lg:hidden ${isMobileMenuOpen ? 'visible' : 'invisible'}`}
          style={{
            backgroundColor: isDarkMode ? '#000000' : '#ffffff',
            backdropFilter: 'none',
            WebkitBackdropFilter: 'none'
          }}
        >
          <div className={`flex flex-col p-8 sm:p-12 h-full justify-center gap-8 md:gap-12 pt-32 transition-all duration-500 ${isMobileMenuOpen ? 'opacity-100' : 'opacity-0'}`}>
            {['Features', 'Pricing', 'Process', 'Network'].map((item, idx) => (
              <button
                key={item}
                onClick={() => scrollToSection(item.toLowerCase())}
                className={`text-4xl sm:text-6xl font-black uppercase tracking-tighter text-left border-b border-black/5 dark:border-white/5 pb-4 transform transition-all duration-500 delay-${idx * 100} ${isMobileMenuOpen ? 'translate-x-0 opacity-100' : '-translate-x-10 opacity-0'}`}
              >
                {item}
              </button>
            ))}
            <button
              onClick={handleFreeSignup}
              className={`text-xl font-black uppercase tracking-widest mt-4 transition-all duration-700 delay-500 ${isMobileMenuOpen ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}
            >
              Get Started <span className="inline-block animate-bounce-x ml-2">—&gt;</span>
            </button>
          </div>
        </div>
      </header>

      <main className="pt-20 md:pt-24">
        {/* Hero Section */}
        <section className={`relative pt-32 sm:pt-40 md:pt-48 pb-20 sm:pb-32 md:pb-48 transition-all duration-1000 transform ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          <div className="max-w-[1440px] mx-auto px-5 sm:px-8 md:px-10">
            <div className="inline-flex items-center gap-2 md:gap-3 border border-black/10 dark:border-white/10 px-4 md:px-6 py-2 text-[8px] md:text-[11px] font-black uppercase tracking-[0.4em] mb-8 md:mb-12">
              <span className="size-1.5 bg-black dark:bg-white animate-ping"></span>
              Neural Protocol Active
            </div>

            <h1 className="text-[11vw] xs:text-[10vw] sm:text-[9vw] md:text-[8vw] lg:text-[7vw] font-black tracking-tighter leading-[1] mb-12 sm:mb-16 uppercase break-words">
              The <span className="text-black/5 dark:text-white/5 outline-text">Purest</span><br />
              Intelligence Match
            </h1>

            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-10 md:gap-12 lg:gap-20">
              <p className="text-lg sm:text-xl md:text-2xl text-black/50 dark:text-white/40 max-w-xl font-medium uppercase tracking-tight leading-tight">
                Stop wasting hours on job boards that never reply. Asterix matches you to the right roles based on your actual skills — and applies on your behalf.
              </p>
              <div className="flex flex-col sm:flex-row items-stretch gap-4 md:gap-6 w-full lg:w-auto">
                <button
                  onClick={handleFreeSignup}
                  className="flex-1 sm:flex-none bg-black dark:bg-white text-white dark:text-black px-10 md:px-16 py-5 md:py-6 text-xs md:text-sm font-black uppercase tracking-[0.25em] hover:invert transition-all text-center cursor-pointer"
                >
                  Find a Job
                </button>
                <button
                  onClick={handleFreeSignup}
                  className="flex-1 sm:flex-none border-2 border-black dark:border-white px-10 md:px-16 py-5 md:py-6 text-xs md:text-sm font-black uppercase tracking-[0.25em] hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all text-center cursor-pointer"
                >
                  Hire Talent
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Logo Ticker */}
        <section className="py-10 md:py-20 border-y border-black/5 dark:border-white/5 overflow-hidden bg-black/[0.01] dark:bg-white/[0.01]">
          <div className="flex whitespace-nowrap gap-12 md:gap-24 animate-marquee">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <span key={i} className="text-2xl sm:text-3xl md:text-5xl font-black uppercase tracking-tighter opacity-10 select-none">Partner Company {i}</span>
            ))}
            {[1, 2, 3, 4, 5, 6].map(i => (
              <span key={i + 'copy'} className="text-2xl sm:text-3xl md:text-5xl font-black uppercase tracking-tighter opacity-10 select-none">Partner Company {i}</span>
            ))}
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-20 sm:py-32 md:py-40 bg-white dark:bg-background-dark">
          <div className="max-w-[1440px] mx-auto px-5 sm:px-8 md:px-10">
            <div className="flex flex-col lg:flex-row justify-between items-start gap-8 lg:gap-20 mb-16 md:mb-24">
              <h2 className="text-4xl sm:text-5xl md:text-6xl font-black uppercase tracking-tighter leading-[0.9]">More  Than<br />a  Job  Board</h2>
              <p className="max-w-xl text-base sm:text-lg font-bold uppercase tracking-widest text-black/50 dark:text-white/50 leading-relaxed">
                Not a Regular job site that just search for keywords in your resume. Asterix actually understands what you're good at — and finds companies where you'll genuinely thrive.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 border-t md:border-l border-black/5 dark:border-white/10 items-stretch">
              <div className="border-r border-b border-black/5 dark:border-white/10 flex">
                <FeatureCard
                  icon="bolt"
                  title="Smart Matching"
                  desc="We score every match across 40+ factors — not just your job title, but your actual skills, work style, and what each company really needs."
                />
              </div>
              <div className="border-r border-b border-black/5 dark:border-white/10 flex">
                <FeatureCard
                  icon="psychology"
                  title="Reads Between the Lines"
                  desc="Our AI knows that the same job title means very different things at different companies. It matches you to roles where your experience will actually count."
                />
              </div>
              <div className="border-r border-b border-black/5 dark:border-white/10 flex">
                <FeatureCard
                  icon="rocket_launch"
                  title="Applies for You"
                  desc="Our AI handles the repetitive applying and scheduling so you can spend your energy on the interviews that actually matter."
                />
              </div>
            </div>
          </div>
        </section>

        {/* Process Section */}
        <section id="process" className="py-20 sm:py-32 md:py-40 bg-black text-white dark:bg-white dark:text-black">
          <div className="max-w-[1440px] mx-auto px-5 sm:px-8 md:px-10">
            <div className="mb-16 md:mb-24">
              <h2 className="text-4xl sm:text-5xl md:text-6xl font-black uppercase tracking-tighter leading-none">How It Works</h2>
              <p className="text-[10px] md:text-sm font-black uppercase tracking-[0.4em] opacity-40 mt-4">Three simple steps to your next role</p>
            </div>

            <div className="space-y-16 sm:space-y-24 md:space-y-32">
              {[
                { step: '01', title: 'Upload Your Resume', desc: 'Just drop in your resume or LinkedIn profile. We read your experience, skills, and career history to build a complete picture of who you are professionally.' },
                { step: '02', title: 'We Analyse Your Profile', desc: 'Our AI studies your background and compares it against thousands of open roles in real time — looking at skills, growth potential, and team fit, not just job titles.' },
                { step: '03', title: 'See Your Matches', desc: 'Within seconds, your personal dashboard shows the jobs where you have the best shot — ranked by how well they fit you, with a clear score explaining why.' }
              ].map((item, i) => (
                <div key={i} className="flex flex-col md:flex-row items-start gap-8 md:gap-12 border-t border-white/20 dark:border-black/20 pt-8 md:pt-12 group">
                  <span className="text-6xl sm:text-7xl md:text-8xl font-black leading-none opacity-20 group-hover:opacity-100 transition-opacity duration-500">{item.step}</span>
                  <div className="flex-grow max-w-2xl">
                    <h3 className="text-2xl sm:text-3xl md:text-4xl font-black uppercase tracking-tighter mb-4 md:mb-6">{item.title}</h3>
                    <p className="text-lg sm:text-xl font-medium uppercase tracking-tight opacity-70 leading-relaxed group-hover:opacity-100 transition-opacity duration-500">{item.desc}</p>
                  </div>
                  <div className="hidden lg:block size-32 xl:size-40 bg-white/5 dark:bg-black/5 border border-white/10 dark:border-black/10 shrink-0 group-hover:bg-white/10 dark:group-hover:bg-black/10 transition-all"></div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-20 sm:py-32 md:py-40 border-t border-black/5 dark:border-white/10">
          <div className="max-w-[1440px] mx-auto px-5 sm:px-8 md:px-10">
            <div className="flex flex-col items-center text-center mb-16 md:mb-32">
              <h2 className="text-4xl sm:text-5xl md:text-7xl font-black uppercase tracking-tighter mb-6 md:mb-8 leading-none">
                Pick Your Plan
              </h2>
              <p className="text-[10px] sm:text-xs md:text-sm text-black/50 dark:text-white/50 font-black uppercase tracking-[0.3em]">
                Simple plans for job seekers and hiring teams
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 max-w-5xl mx-auto">
              {/* Job Seeker Plan */}
              <div className="border border-black dark:border-white/20 p-8 sm:p-12 md:p-16 flex flex-col justify-between hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all duration-500 group">
                <div className="space-y-8">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl sm:text-2xl md:text-3xl font-black uppercase tracking-tighter">
                      Job Seeker
                    </h3>
                    <div className="text-[8px] sm:text-[9px] font-black uppercase border border-black/20 dark:border-white/20 group-hover:border-white/30 dark:group-hover:border-black/30 px-3 py-1.5 tracking-[0.25em]">
                      Popular
                    </div>
                  </div>

                  <div className="text-6xl sm:text-7xl md:text-8xl font-black leading-none uppercase tracking-tighter">
                    ₹99
                  </div>
                  <p className="text-[8px] font-black uppercase tracking-widest opacity-60">
                    Per Month
                  </p>

                  <ul className="space-y-4 md:space-y-6">
                    {[
                      'Auto-apply to 30+ jobs every day',
                      'Get noticed by recruiters first',
                      'Matches even for entry-level profiles',
                      'Apply manually whenever you want',
                      'Tips to improve your profile',
                      'Track all your applications',
                      'Email alerts for new matches',
                      'Fast support when you need help'
                    ].map(feature => (
                      <li
                        key={feature}
                        className="text-[9px] sm:text-[10px] md:text-xs font-black uppercase tracking-[0.15em] flex items-center gap-3 md:gap-4"
                      >
                        <span className="size-1.5 md:size-2 bg-black dark:bg-white group-hover:bg-white dark:group-hover:bg-black transition-colors"></span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex flex-col gap-4 mt-12 md:mt-20">
                  {/* Free Button */}
                  <button
                    onClick={handleFreeSignup}
                    className="block w-full text-center border-2 border-black dark:border-white py-5 md:py-6 text-[10px] md:text-xs font-black uppercase tracking-[0.2em] group-hover:bg-white group-hover:text-black dark:group-hover:bg-black dark:group-hover:text-white transition-all cursor-pointer"
                  >
                    Start for Free
                  </button>

                  {/* Premium Button */}
                  <button
                    onClick={() => handleUpgradePlan('student')}
                    className="block w-full text-center border-2 border-black dark:border-white py-5 md:py-6 text-[10px] md:text-xs font-black uppercase tracking-[0.2em] group-hover:bg-white group-hover:text-black dark:group-hover:bg-black dark:group-hover:text-white transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-sm">lock</span>
                    Upgrade to Premium (₹99/mo)
                  </button>
                </div>
              </div>

              {/* Recruiter Plan */}
              <div className="bg-black dark:bg-white text-white dark:text-black p-8 sm:p-12 md:p-16 flex flex-col justify-between relative shadow-2xl md:scale-105 z-10 transition-transform duration-500">
                <div className="absolute top-6 sm:top-8 right-6 sm:right-8 text-[8px] sm:text-[10px] font-black uppercase border border-white/20 dark:border-black/20 px-3 md:px-4 py-1.5 md:py-2 tracking-[0.25em] bg-white/10 dark:bg-black/10">
                  For Teams
                </div>

                <div className="space-y-8">
                  <h3 className="text-xl sm:text-2xl md:text-3xl font-black uppercase tracking-tighter">
                    Recruiter Pro
                  </h3>

                  <div className="text-5xl sm:text-6xl md:text-7xl font-black leading-none uppercase tracking-tighter">
                    ₹1,999
                  </div>
                  <p className="text-[8px] font-black uppercase tracking-widest opacity-60">
                    Per Month
                  </p>

                  <ul className="space-y-4 md:space-y-6">
                    {[
                      'Unlimited job postings',
                      'Advanced candidate matching',
                      'AI-powered screening',
                      'Access to highlighted students',
                      'Custom filters & search',
                      'Analytics dashboard',
                      'Team collaboration tools',
                      'Priority listing',
                      'Dedicated account manager',
                      'Interview scheduling'
                    ].map(feature => (
                      <li
                        key={feature}
                        className="text-[9px] sm:text-[10px] md:text-xs font-black uppercase tracking-[0.15em] flex items-center gap-3 md:gap-4"
                      >
                        <span className="size-1.5 md:size-2 bg-white dark:bg-black"></span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  onClick={() => handleUpgradePlan('recruiter')}
                  className="block w-full text-center border-2 border-white dark:border-black py-5 md:py-6 text-[10px] md:text-xs font-black uppercase tracking-[0.2em] mt-6 hover:invert transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm">lock</span>
                  Upgrade to Pro (₹1,999/mo)
                </button>
              </div>
            </div>

            {/* Additional Info */}
            <div className="mt-16 md:mt-24 text-center">
              <p className="text-[9px] sm:text-[10px] md:text-xs text-black/50 dark:text-white/50 font-black uppercase tracking-[0.2em]">
                All plans include 24/7 support • Cancel anytime • Payments are secure
              </p>
            </div>
          </div>
        </section>

        {/* Network Section */}
        <section id="network" className="py-20 sm:py-32 md:py-40 bg-black text-white dark:bg-white dark:text-black">
          <div className="max-w-[1440px] mx-auto px-5 sm:px-8 md:px-10 text-center">
            <h2 className="text-3xl sm:text-5xl md:text-8xl font-black uppercase tracking-tighter mb-12 sm:mb-20 leading-[0.9]">Built for<br />Real Careers</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-8 md:gap-12 lg:gap-16 mt-12 md:mt-20 border-t border-white/10 dark:border-black/10 pt-12 md:pt-20">
              <div className="space-y-2">
                <p className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-black leading-none whitespace-nowrap">
                  {liveMembers !== null ? `${liveMembers.toLocaleString()}` : '20+'}
                </p>
                <p className="text-[7px] sm:text-[8px] md:text-[9px] lg:text-[10px] font-black uppercase tracking-widest opacity-50">Talents Registered</p>
              </div>
              <div className="space-y-2">
                <p className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-black leading-none whitespace-nowrap">
                  98.2%
                </p>
                <p className="text-[7px] sm:text-[8px] md:text-[9px] lg:text-[10px] font-black uppercase tracking-widest opacity-50">Match Accuracy</p>
              </div>
              <div className="space-y-2">
                <p className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-black leading-none whitespace-nowrap">
                  {liveCompanies !== null ? `${liveCompanies.toLocaleString()}` : '1+'}
                </p>
                <p className="text-[7px] sm:text-[8px] md:text-[9px] lg:text-[10px] font-black uppercase tracking-widest opacity-50">Hiring Companies</p>
              </div>
              <div className="space-y-2">
                <p className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-black leading-none">2ms</p>
                <p className="text-[7px] sm:text-[8px] md:text-[9px] lg:text-[10px] font-black uppercase tracking-widest opacity-50">Match Speed</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-black dark:border-white/10 bg-white dark:bg-background-dark">
        <div className="max-w-[1440px] mx-auto px-5 sm:px-8 md:px-10">

          {/* Main grid */}
          <div className="py-16 md:py-24 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-x-8 gap-y-12">

            {/* Brand col — spans 2 on lg */}
            <div className="col-span-2 md:col-span-3 lg:col-span-2 space-y-6">
              <div className="flex items-center gap-3">
                <div className="size-9 bg-black dark:bg-white flex items-center justify-center text-white dark:text-black">
                  <span className="material-symbols-outlined text-xl">auto_awesome</span>
                </div>
                <span className="text-xl font-black uppercase tracking-tighter">Asterix</span>
              </div>
              <p className="text-sm text-black/50 dark:text-white/50 leading-relaxed max-w-xs">
                AI-powered job matching and auto-application platform. We match you to the right roles — and apply on your behalf.
              </p>
              {/* Social links */}
              <div className="flex items-center gap-3">
                {[
                  { icon: 'link', label: 'LinkedIn', href: 'https://linkedin.com/company/asterix-jobs' },
                  { icon: 'code', label: 'GitHub', href: 'https://github.com/asterix-jobs' },
                  { icon: 'alternate_email', label: 'Twitter', href: 'https://x.com/asterixjobs' },
                  { icon: 'camera_alt', label: 'Instagram', href: 'https://instagram.com/asterixjobs' },
                ].map(s => (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noreferrer"
                    title={s.label}
                    className="size-8 border border-black/15 dark:border-white/15 flex items-center justify-center text-black/40 dark:text-white/40 hover:border-black dark:hover:border-white hover:text-black dark:hover:text-white transition-all"
                  >
                    <span className="material-symbols-outlined text-sm">{s.icon}</span>
                  </a>
                ))}
              </div>
              {/* Contact shortcut */}
              <a href="mailto:hello@asterix-jobs.in" className="inline-flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white transition-colors">
                <span className="material-symbols-outlined text-sm">mail</span>
                hello@asterix-jobs.in
              </a>
            </div>

            {/* Product */}
            <div className="space-y-5">
              <h5 className="text-[9px] font-black uppercase tracking-[0.4em] text-black/40 dark:text-white/40">Product</h5>
              <div className="flex flex-col gap-3 text-[10px] font-black uppercase tracking-widest">
                <button onClick={() => scrollToSection('features')} className="text-left hover:text-black/60 dark:hover:text-white/60 transition-colors">Features</button>
                <button onClick={() => scrollToSection('process')} className="text-left hover:text-black/60 dark:hover:text-white/60 transition-colors">How It Works</button>
                <button onClick={() => scrollToSection('pricing')} className="text-left hover:text-black/60 dark:hover:text-white/60 transition-colors">Pricing</button>
                <button onClick={() => scrollToSection('network')} className="text-left hover:text-black/60 dark:hover:text-white/60 transition-colors">Network</button>
              </div>
            </div>

            {/* Job Seekers */}
            <div className="space-y-5">
              <h5 className="text-[9px] font-black uppercase tracking-[0.4em] text-black/40 dark:text-white/40">Job Seekers</h5>
              <div className="flex flex-col gap-3 text-[10px] font-black uppercase tracking-widest">
                <Link to="/signup" className="hover:text-black/60 dark:hover:text-white/60 transition-colors">Create Account</Link>
                <Link to="/signup" className="hover:text-black/60 dark:hover:text-white/60 transition-colors">Upload Resume</Link>
                <Link to="/candidate/jobs" className="hover:text-black/60 dark:hover:text-white/60 transition-colors">Browse Jobs</Link>
                <Link to="/candidate" className="hover:text-black/60 dark:hover:text-white/60 transition-colors">Dashboard</Link>
                <Link to="/candidate/applications" className="hover:text-black/60 dark:hover:text-white/60 transition-colors">My Applications</Link>
              </div>
            </div>

            {/* Recruiters */}
            <div className="space-y-5">
              <h5 className="text-[9px] font-black uppercase tracking-[0.4em] text-black/40 dark:text-white/40">Recruiters</h5>
              <div className="flex flex-col gap-3 text-[10px] font-black uppercase tracking-widest">
                <Link to="/signup" className="hover:text-black/60 dark:hover:text-white/60 transition-colors">Post a Job</Link>
                <Link to="/recruiter" className="hover:text-black/60 dark:hover:text-white/60 transition-colors">Recruiter Portal</Link>
                <Link to="/recruiter/talent" className="hover:text-black/60 dark:hover:text-white/60 transition-colors">Talent Pipeline</Link>
                <Link to="/recruiter/reports" className="hover:text-black/60 dark:hover:text-white/60 transition-colors">Analytics</Link>
                <button onClick={() => handleUpgradePlan('recruiter')} className="text-left hover:text-black/60 dark:hover:text-white/60 transition-colors">Upgrade to Pro</button>
              </div>
            </div>

            {/* Company */}
            <div className="space-y-5">
              <h5 className="text-[9px] font-black uppercase tracking-[0.4em] text-black/40 dark:text-white/40">Company</h5>
              <div className="flex flex-col gap-3 text-[10px] font-black uppercase tracking-widest">
                <Link to="/about" className="hover:text-black/60 dark:hover:text-white/60 transition-colors">About Us</Link>
                <Link to="/contact" className="hover:text-black/60 dark:hover:text-white/60 transition-colors">Contact</Link>
                <a href="mailto:careers@asterix-jobs.in" className="hover:text-black/60 dark:hover:text-white/60 transition-colors">Careers</a>
                <a href="mailto:press@asterix-jobs.in" className="hover:text-black/60 dark:hover:text-white/60 transition-colors">Press / Media</a>
                <a href="mailto:partnerships@asterix-jobs.in" className="hover:text-black/60 dark:hover:text-white/60 transition-colors">Partnerships</a>
              </div>
            </div>
          </div>

          {/* Trust badges */}
          <div className="py-6 border-t border-black/5 dark:border-white/5 flex flex-wrap items-center gap-6">
            {[
              { icon: 'lock', text: 'Payments Secured by Cashfree' },
              { icon: 'verified_user', text: 'Firebase Auth' },
              { icon: 'privacy_tip', text: 'GDPR Compliant' },
              { icon: 'https', text: 'SSL Encrypted' },
            ].map(b => (
              <div key={b.text} className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest text-black/30 dark:text-white/30">
                <span className="material-symbols-outlined text-xs">{b.icon}</span>
                {b.text}
              </div>
            ))}
          </div>

          {/* Bottom bar */}
          <div className="py-6 border-t border-black/5 dark:border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-[8px] font-black uppercase tracking-[0.4em] text-black/30 dark:text-white/30">
              © {new Date().getFullYear()} Asterix Technologies. All rights reserved.
            </p>
            <div className="flex flex-wrap justify-center gap-6 text-[8px] font-black uppercase tracking-[0.3em] text-black/30 dark:text-white/30">
              <Link to="/privacy" className="hover:text-black dark:hover:text-white transition-colors">Privacy Policy</Link>
              <Link to="/terms" className="hover:text-black dark:hover:text-white transition-colors">Terms of Service</Link>
              <a href="mailto:hello@asterix-jobs.in" className="hover:text-black dark:hover:text-white transition-colors">Contact</a>
              <Link to="/about" className="hover:text-black dark:hover:text-white transition-colors">About</Link>
            </div>
          </div>

        </div>
      </footer>




      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 40s linear infinite;
        }
        @keyframes bounce-x {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(5px); }
        }
        .animate-bounce-x {
          animation: bounce-x 1s infinite;
        }
        .outline-text {
          -webkit-text-stroke: 1px black;
        }
        @media (min-width: 768px) {
          .outline-text {
            -webkit-text-stroke: 2px black;
          }
        }
        .dark .outline-text {
          -webkit-text-stroke: 1px white;
        }
        @media (min-width: 768px) {
          .dark .outline-text {
            -webkit-text-stroke: 2px white;
          }
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .glass-nav {
          background-color: rgba(255, 255, 255, 0.8) !important;
          backdrop-filter: blur(10px);
        }
        .dark .glass-nav {
          background-color: rgba(0, 0, 0, 0.8) !important;
        }
        /* Force mobile menu to be solid */
        .mobile-menu-overlay {
          background-color: #ffffff !important;
          opacity: 1 !important;
        }
        .dark .mobile-menu-overlay {
          background-color: #000000 !important;
        }
      `}</style>
    </div >
  );
};

export default LandingPage;