import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, onSnapshot, doc } from 'firebase/firestore';
import BrandLogo from '../components/BrandLogo';


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

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /* ════════════════════════════════════════════════════════════════
     PAYMENT HANDLERS - Simple flow to /confirm-payment
  ════════════════════════════════════════════════════════════════ */

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

  /* ════════════════════════════════════════════════════════════════ */

  const FeatureCard = ({ icon, title, desc }: { icon: string, title: string, desc: string }) => (
    <div className="bg-white dark:bg-[#1A1A1A] rounded-[30px] p-8 md:p-10 flex flex-col gap-6 group hover:-translate-y-2 transition-transform duration-500 shadow-xl border border-black/5 dark:border-white/5">
      <div className="size-16 rounded-full bg-[#826BF0]/10 text-[#826BF0] flex items-center justify-center group-hover:bg-[#826BF0] group-hover:text-white transition-colors duration-500">
        <span className="material-symbols-outlined text-3xl">{icon}</span>
      </div>
      <h3 className="text-2xl md:text-3xl font-bold tracking-tighter text-black dark:text-white">
        {title}
      </h3>
      <p className="text-sm font-medium tracking-wide text-gray-500 leading-relaxed">
        {desc}
      </p>
    </div>
  );

  return (
    <div className={`flex flex-col min-h-screen bg-[#F0F2F5] dark:bg-background-dark text-black dark:text-white overflow-x-hidden font-sans ${isDarkMode ? 'dark' : ''}`}>

      {/* 
        =================
        HEADER
        =================
      */}
      <header className="fixed top-0 w-full z-[130] bg-white/80 dark:bg-black/80 backdrop-blur-md border-b border-black/5 dark:border-white/5">
        <div className="max-w-[1440px] mx-auto px-6 h-20 md:h-24 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={scrollToTop}>
            <BrandLogo isDarkMode={isDarkMode} className="size-10" />
            <h2 className="text-2xl font-black tracking-tighter leading-none hidden sm:block">Asterix</h2>
          </div>

          <nav className="hidden lg:flex items-center gap-10">
            {['Features', 'Process', 'Pricing', 'Network'].map(item => (
              <button
                key={item}
                onClick={() => scrollToSection(item.toLowerCase())}
                className="text-xs font-bold tracking-[0.2em] uppercase hover:text-[#826BF0] transition-colors"
              >
                {item}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            <button onClick={onToggleTheme} className="p-2 border border-black/10 dark:border-white/10 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
              <span className="material-symbols-outlined text-sm">{isDarkMode ? 'light_mode' : 'dark_mode'}</span>
            </button>
            <button
              onClick={handleFreeSignup}
              className="hidden md:block px-6 py-2.5 rounded-full border border-black dark:border-white text-xs font-bold uppercase tracking-[0.1em] hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors"
            >
              Sign In
            </button>
            <button
              onClick={() => handleUpgradePlan('recruiter')}
              className="bg-black text-white dark:bg-white dark:text-black px-6 py-2.5 rounded-full text-xs font-bold uppercase tracking-[0.1em] hover:opacity-80 transition-opacity whitespace-nowrap"
            >
              Hire Talent
            </button>
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 rounded-full border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              <span className="material-symbols-outlined text-xl">{isMobileMenuOpen ? 'close' : 'menu'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Nav Overlay */}
      <div className={`fixed inset-0 z-[150] lg:hidden bg-white dark:bg-black transition-all duration-500 ease-in-out ${isMobileMenuOpen ? 'visible opacity-100' : 'invisible opacity-0'}`}>
        <div className="absolute top-0 w-full h-20 md:h-24 flex items-center justify-between px-6 border-b border-black/5 dark:border-white/5">
          <div className="flex items-center gap-3">
            <BrandLogo isDarkMode={isDarkMode} className="size-10" />
            <h2 className="text-2xl font-black tracking-tighter leading-none">Asterix</h2>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="p-2 rounded-full border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <div className="flex flex-col p-8 sm:p-12 h-full justify-between pt-32 pb-12 overflow-y-auto">
          <div className="flex flex-col gap-6 sm:gap-8">
            {['Features', 'Pricing', 'Process', 'Network'].map((item, idx) => (
              <button
                key={item}
                onClick={() => scrollToSection(item.toLowerCase())}
                className={`group flex items-end gap-4 text-4xl sm:text-6xl font-black tracking-tighter text-left border-b border-black/5 dark:border-white/5 pb-4 transition-all duration-700 ${isMobileMenuOpen ? 'translate-x-0 opacity-100' : '-translate-x-10 opacity-0'}`}
                style={{ transitionDelay: `${idx * 100}ms` }}
              >
                <span className="text-black/20 dark:text-white/20 text-lg sm:text-2xl mb-2 sm:mb-4 font-mono font-bold">0{idx + 1}</span>
                <span className="group-hover:translate-x-3 transition-transform duration-500">{item}</span>
              </button>
            ))}

            <button
              onClick={handleFreeSignup}
              className={`inline-flex rounded-full items-center justify-center gap-4 text-sm font-bold tracking-[0.2em] uppercase mt-8 bg-[#826BF0] text-white px-8 py-5 transition-all duration-1000 ${isMobileMenuOpen ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}
              style={{ transitionDelay: '500ms' }}
            >
              GET STARTED <span className="material-symbols-outlined animate-bounce-x">arrow_forward</span>
            </button>
          </div>
        </div>
      </div>

      <main className="pt-20 md:pt-24 flex-grow">

        {/* 
          =================
          HERO SECTION
          =================
        */}
        <div className={`relative pt-16 pb-20 md:pt-24 md:pb-24 min-h-[90vh] flex items-center transition-all duration-1000 transform ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          {/* Left Purple Sidebar Element */}
          <div className="hidden lg:flex absolute top-0 left-0 h-[85vh] w-16 bg-[#826BF0] rounded-br-[40px] items-end pb-12 z-10">
            <div className="w-full relative h-[300px]">
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 whitespace-nowrap -rotate-90 origin-left text-white font-bold text-[12px] tracking-[0.2em] uppercase">
                Neural Protocol Active
              </span>
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-16 bg-white/30"></div>
            </div>
          </div>

          {/* Main Hero Layout */}
          <div className="w-full max-w-[1400px] mx-auto px-6 sm:px-16 md:px-24 flex flex-col md:flex-row items-center relative z-20">

            {/* Left Text */}
            <div className="w-full md:w-1/2 flex flex-col items-start relative z-30">
              <div className="inline-flex lg:hidden items-center gap-2 border border-black/10 dark:border-white/10 rounded-full px-4 py-2 text-[10px] font-bold tracking-[0.2em] uppercase mb-8">
                <span className="size-1.5 rounded-full bg-[#826BF0] animate-ping"></span>
                Neural Protocol Active
              </div>

              <h1 className="text-[12vw] sm:text-[10vw] md:text-[8vw] xl:text-[7vw] font-black leading-[0.85] tracking-tighter uppercase text-black dark:text-white">
                The<br />Purest<br />
                <span className="text-black/5 dark:text-white/5 outline-text">Match</span>
              </h1>

              <p className="mt-8 text-base md:text-lg text-gray-500 dark:text-gray-400 font-medium tracking-tight leading-relaxed max-w-md">
                Stop wasting hours on job boards that never reply. Asterix matches you to the right roles based on your actual skills — and applies on your behalf.
              </p>

              {/* Status Pill */}
              <div className="mt-8 bg-white dark:bg-black rounded-full shadow-lg border border-black/5 dark:border-white/5 p-2 pr-6 flex flex-wrap items-center gap-4 animate-fade-in-up">
                <div className="flex -space-x-3">
                  <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop" alt="User" className="w-10 h-10 rounded-full border-2 border-white dark:border-black object-cover" />
                  <img src="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&h=100&fit=crop" alt="User" className="w-10 h-10 rounded-full border-2 border-white dark:border-black object-cover" />
                  <div className="w-10 h-10 rounded-full border-2 border-white dark:border-black bg-[#826BF0] flex items-center justify-center text-white text-xs font-bold">+</div>
                </div>
                <div className="flex flex-col">
                  <span className="text-xl font-black leading-none tracking-tight">
                    {liveMembers !== null ? (liveMembers >= 1000 ? `${(liveMembers / 1000).toFixed(1)}K+` : `${liveMembers}+`) : '87K+'}
                  </span>
                  <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">People Hired</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch gap-4 mt-12 w-full lg:w-auto">
                <button
                  onClick={handleFreeSignup}
                  className="bg-[#826BF0] hover:opacity-90 text-white px-10 py-4 rounded-full text-xs font-bold uppercase tracking-[0.2em] transition-all shadow-lg shadow-[#826BF0]/30"
                >
                  Find a Job
                </button>
                <button
                  onClick={() => handleUpgradePlan('recruiter')}
                  className="bg-transparent border-2 border-black dark:border-white px-10 py-4 rounded-full text-xs font-bold uppercase tracking-[0.2em] hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all"
                >
                  Hire Talent
                </button>
              </div>
            </div>

            {/* Right Image Container */}
            <div className="w-full md:w-1/2 relative mt-16 md:mt-0 flex justify-center md:justify-end pr-0 lg:pr-12">
              <div className="relative z-10 w-full max-w-[500px]">
                <img
                  src="https://images.unsplash.com/photo-1600880292203-757bb62b4baf?q=80&w=1740&auto=format&fit=crop"
                  alt="Happy Professional"
                  className="w-full object-cover rounded-[40px] aspect-[4/5] shadow-2xl"
                />

                {/* NO.1 Badge Floating */}
                <div className="absolute top-10 -right-4 md:-right-8 size-24 rounded-full bg-gradient-to-tr from-blue-400 to-[#826BF0] flex flex-col items-center justify-center shadow-2xl shadow-[#826BF0]/50 animate-bounce-slow border-4 border-white dark:border-background-dark">
                  <span className="text-white font-black text-2xl tracking-tighter leading-none">98%</span>
                  <span className="text-white/80 font-bold text-[8px] uppercase tracking-widest leading-none mt-1">Accuracy</span>
                </div>
              </div>

              {/* Background design element */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] h-[90%] rounded-[50px] border-2 border-[#826BF0]/20 -rotate-6 z-0"></div>
            </div>
          </div>
        </div>

        {/* Logo Ticker */}
        <section className="py-12 border-y border-black/5 dark:border-white/5 overflow-hidden bg-white/50 dark:bg-black/50 backdrop-blur-sm">
          <div className="flex whitespace-nowrap gap-16 md:gap-32 animate-marquee items-center">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <span key={i} className="text-2xl sm:text-4xl font-black tracking-tighter opacity-20 dark:opacity-40 select-none grayscale uppercase">Partner {i}</span>
            ))}
            {[1, 2, 3, 4, 5, 6].map(i => (
              <span key={i + 'copy'} className="text-2xl sm:text-4xl font-black tracking-tighter opacity-20 dark:opacity-40 select-none grayscale uppercase">Partner {i}</span>
            ))}
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-20 sm:py-32">
          <div className="max-w-[1440px] mx-auto px-6 sm:px-16 md:px-24">
            <div className="flex flex-col lg:flex-row justify-between items-start gap-8 lg:gap-20 mb-16 md:mb-24">
              <h2 className="text-5xl md:text-6xl font-black tracking-tighter uppercase leading-[0.9]">More Than<br />a Job Board</h2>
              <p className="max-w-xl text-sm md:text-base font-medium tracking-wide text-gray-500 leading-relaxed">
                Not a Regular job site that just search for keywords in your resume. Asterix actually understands what you're good at — and finds companies where you'll genuinely thrive.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
              <FeatureCard
                icon="bolt"
                title="Smart Matching"
                desc="We score every match across 40+ factors — not just your job title, but your actual skills, work style, and what each company really needs."
              />
              <FeatureCard
                icon="psychology"
                title="Reads Between"
                desc="Our AI knows that the same job title means very different things at different companies. It matches you to roles where your experience will actually count."
              />
              <FeatureCard
                icon="rocket_launch"
                title="Applies for You"
                desc="Our AI handles the repetitive applying and scheduling so you can spend your energy on the interviews that actually matter."
              />
            </div>
          </div>
        </section>

        {/* Process Section */}
        <section id="process" className="py-20 sm:py-32 bg-black text-white dark:bg-[#0A0A0A] rounded-[40px] mx-4 md:mx-10 mb-20 shadow-2xl">
          <div className="max-w-[1440px] mx-auto px-6 sm:px-12 md:px-20">
            <div className="mb-16 md:mb-24 text-center">
              <h2 className="text-5xl md:text-7xl font-black tracking-tighter uppercase leading-none text-white">How It Works</h2>
              <p className="text-xs md:text-sm font-bold tracking-[0.3em] uppercase opacity-40 mt-6 text-[#826BF0]">Three simple steps to your next role</p>
            </div>

            <div className="space-y-12">
              {[
                { step: '01', title: 'Upload Resume', desc: 'Just drop in your resume or LinkedIn profile. We read your experience, skills, and career history to build a complete picture of who you are.' },
                { step: '02', title: 'AI Analysis', desc: 'Our AI studies your background and compares it against thousands of open roles in real time — looking at skills, growth potential, and team fit.' },
                { step: '03', title: 'Get Matches', desc: 'Within seconds, your personal dashboard shows the jobs where you have the best shot — ranked by how well they fit you.' }
              ].map((item, i) => (
                <div key={i} className="flex flex-col md:flex-row items-center md:items-start gap-6 md:gap-12 bg-white/5 dark:bg-white/5 rounded-[30px] p-8 md:p-12 border border-white/10 group hover:-translate-y-2 hover:bg-white/10 transition-all duration-300">
                  <span className="text-6xl md:text-8xl font-black leading-none text-[#826BF0] opacity-50 group-hover:opacity-100 transition-opacity">{item.step}</span>
                  <div className="flex-grow text-center md:text-left mt-2 md:mt-0">
                    <h3 className="text-2xl md:text-4xl font-bold tracking-tighter mb-4 uppercase">{item.title}</h3>
                    <p className="text-sm md:text-base font-medium text-gray-400 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-20 sm:py-32">
          <div className="max-w-[1440px] mx-auto px-6 sm:px-16 md:px-24">
            <div className="flex flex-col items-center text-center mb-16 md:mb-24">
              <h2 className="text-5xl md:text-7xl font-black tracking-tighter uppercase mb-6 leading-none">
                Pick Your Plan
              </h2>
              <p className="text-xs md:text-sm text-gray-500 font-bold tracking-[0.2em] uppercase">
                Simple plans for job seekers and hiring teams
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 max-w-5xl mx-auto">
              {/* Job Seeker Plan */}
              <div className="bg-white dark:bg-[#1A1A1A] rounded-[40px] p-8 md:p-16 flex flex-col justify-between border border-black/5 dark:border-white/5 shadow-xl hover:-translate-y-2 transition-transform duration-500 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-[#826BF0]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4"></div>
                <div className="space-y-8 relative z-10">
                  <div className="flex items-center justify-between">
                    <h3 className="text-2xl md:text-3xl font-black tracking-tighter uppercase">Job Seeker</h3>
                    <div className="text-[10px] font-bold bg-[#826BF0]/10 text-[#826BF0] px-4 py-2 rounded-full tracking-[0.2em] uppercase">
                      Popular
                    </div>
                  </div>

                  <div className="text-5xl md:text-7xl font-black leading-none tracking-tighter text-[#826BF0]">
                    ₹99<span className="text-lg text-gray-400">/mo</span>
                  </div>

                  <ul className="space-y-4 pt-4">
                    {[
                      'Auto-apply to 30+ jobs every day',
                      'Get noticed by recruiters first',
                      'Matches even for entry-level profiles',
                      'Track all your applications',
                      'Email alerts for new matches'
                    ].map(feature => (
                      <li key={feature} className="text-xs md:text-sm font-bold tracking-wide text-gray-600 dark:text-gray-300 flex items-center gap-3">
                        <span className="material-symbols-outlined text-[#826BF0] text-lg">check_circle</span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex flex-col gap-4 mt-12 relative z-10">
                  <button onClick={handleFreeSignup} className="block w-full text-center border-2 border-[#826BF0] text-[#826BF0] py-4 rounded-full text-xs font-bold uppercase tracking-[0.2em] hover:bg-[#826BF0] hover:text-white transition-colors">
                    Start for Free
                  </button>
                  <button onClick={() => handleUpgradePlan('student')} className="block w-full text-center bg-[#826BF0] text-white py-4 rounded-full text-xs font-bold uppercase tracking-[0.2em] hover:bg-[#6c56d6] transition-colors shadow-lg shadow-[#826BF0]/30 flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-sm">lock_open</span> Upgrade Premium
                  </button>
                </div>
              </div>

              {/* Recruiter Plan */}
              <div className="bg-black dark:bg-[#0A0A0A] text-white rounded-[40px] p-8 md:p-16 flex flex-col justify-between shadow-2xl md:scale-105 z-10 border border-white/10 hover:-translate-y-2 transition-transform duration-500 relative overflow-hidden">
                <div className="absolute bottom-0 right-0 w-64 h-64 bg-[#826BF0]/10 rounded-full blur-3xl translate-y-1/2 translate-x-1/4"></div>
                <div className="absolute top-8 right-8 text-[10px] font-bold border border-white/20 px-4 py-2 rounded-full tracking-[0.2em] uppercase text-white/80">
                  For Teams
                </div>

                <div className="space-y-8 relative z-10">
                  <h3 className="text-2xl md:text-3xl font-black tracking-tighter uppercase">Recruiter Pro</h3>

                  <div className="text-5xl md:text-7xl font-black leading-none tracking-tighter">
                    ₹1,999<span className="text-lg text-gray-500">/mo</span>
                  </div>

                  <ul className="space-y-4 pt-4">
                    {[
                      'Unlimited job postings',
                      'Advanced candidate matching',
                      'Access to highlighted students',
                      'Team collaboration tools',
                      'Priority listing & Support'
                    ].map(feature => (
                      <li key={feature} className="text-xs md:text-sm font-bold tracking-wide text-gray-300 flex items-center gap-3">
                        <span className="material-symbols-outlined text-white text-lg">check_circle</span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>

                <button onClick={() => handleUpgradePlan('recruiter')} className="relative z-10 block w-full text-center bg-white text-black py-4 rounded-full text-xs font-bold uppercase tracking-[0.2em] mt-12 hover:bg-gray-200 transition-colors flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-sm">rocket_launch</span> Upgrade to Pro
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Network Section */}
        <section id="network" className="py-20 sm:py-32">
          <div className="max-w-[1440px] mx-auto px-6 sm:px-16 md:px-24">
            <h2 className="text-4xl md:text-6xl font-black tracking-tighter uppercase mb-16 text-center leading-[0.9]">Built for<br />Real Careers</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 md:gap-12 bg-white dark:bg-[#1A1A1A] rounded-[40px] p-8 md:p-12 shadow-xl border border-black/5 dark:border-white/5">
              <div className="flex flex-col items-center justify-center text-center space-y-2">
                <p className="text-4xl sm:text-5xl md:text-6xl font-black leading-none text-[#826BF0]">
                  {liveMembers !== null ? `${liveMembers.toLocaleString()}` : '20+'}
                </p>
                <p className="text-[10px] md:text-xs font-bold tracking-[0.2em] uppercase text-gray-500">Talents</p>
              </div>
              <div className="flex flex-col items-center justify-center text-center space-y-2 border-l border-black/5 dark:border-white/5">
                <p className="text-4xl sm:text-5xl md:text-6xl font-black leading-none text-[#826BF0]">
                  {liveJobsMatched !== null ? `${liveJobsMatched.toLocaleString()}` : '98%'}
                </p>
                <p className="text-[10px] md:text-xs font-bold tracking-[0.2em] uppercase text-gray-500">Accuracy</p>
              </div>
              <div className="flex flex-col items-center justify-center text-center space-y-2 border-l-0 lg:border-l border-t lg:border-t-0 border-black/5 dark:border-white/5 pt-6 lg:pt-0">
                <p className="text-4xl sm:text-5xl md:text-6xl font-black leading-none text-[#826BF0]">
                  {liveCompanies !== null ? `${liveCompanies.toLocaleString()}` : '1+'}
                </p>
                <p className="text-[10px] md:text-xs font-bold tracking-[0.2em] uppercase text-gray-500">Companies</p>
              </div>
              <div className="flex flex-col items-center justify-center text-center space-y-2 border-l border-t lg:border-t-0 border-black/5 dark:border-white/5 pt-6 lg:pt-0">
                <p className="text-4xl sm:text-5xl md:text-6xl font-black leading-none text-[#826BF0]">1s</p>
                <p className="text-[10px] md:text-xs font-bold tracking-[0.2em] uppercase text-gray-500">Speed</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* 
        =================
        FOOTER
        =================
      */}
      <div className="flex justify-center -mb-8 relative z-20">
        <button onClick={scrollToTop} className="size-16 rounded-full bg-gradient-to-t from-[#6c56d6] to-[#826BF0] text-white flex items-center justify-center shadow-lg hover:-translate-y-2 transition-transform">
          <span className="material-symbols-outlined">arrow_upward</span>
        </button>
      </div>

      <footer className="bg-black text-white dark:bg-[#0A0A0A] pt-24 pb-12 px-6 sm:px-16 md:px-24 mx-4 md:mx-10 rounded-t-[40px] md:rounded-t-[60px] relative z-10 shadow-2xl">
        <div className="max-w-[1200px] mx-auto flex flex-col items-center">

          <div className="flex items-center justify-center gap-3 mb-16 cursor-pointer" onClick={scrollToTop}>
            <BrandLogo isDarkMode={true} className="size-10" />
            <span className="text-2xl font-black tracking-tighter uppercase">Asterix</span>
          </div>

          <div className="flex flex-wrap justify-center gap-8 md:gap-16 lg:gap-32 text-xs font-bold tracking-[0.2em] uppercase mb-16 text-gray-400">
            <button onClick={() => scrollToSection('features')} className="hover:text-white transition-colors">Features</button>
            <button onClick={() => scrollToSection('process')} className="hover:text-white transition-colors">How It Works</button>
            <button onClick={() => scrollToSection('pricing')} className="hover:text-white transition-colors">Pricing</button>
            <button onClick={() => scrollToSection('network')} className="hover:text-white transition-colors">Network</button>
          </div>

          <div className="w-full flex flex-col items-center gap-6 text-[10px] font-bold tracking-widest text-gray-600 uppercase border-t border-white/10 pt-8">
            <div className="flex items-center gap-6">
              <Link to="/about" className="hover:text-gray-300 transition-colors">About</Link>
              <Link to="/contact" className="hover:text-gray-300 transition-colors">Contact</Link>
              <Link to="/privacy" className="hover:text-gray-300 transition-colors">Privacy</Link>
              <Link to="/terms" className="hover:text-gray-300 transition-colors">Terms</Link>
            </div>
            <p>© {new Date().getFullYear()} ASTERIX TECHNOLOGIES. ALL RIGHTS RESERVED.</p>
          </div>

        </div>
      </footer>

      <style>{`
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
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 40s linear infinite;
        }
        @keyframes fade-in-up {
          0% { opacity: 0; transform: translateY(20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          animation: fade-in-up 1s ease-out forwards;
        }
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-bounce-slow {
          animation: bounce-slow 4s ease-in-out infinite;
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
};

export default LandingPage;