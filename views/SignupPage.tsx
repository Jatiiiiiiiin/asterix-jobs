import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { authService, AuthUser } from '../authService';
import BrandLogo from '../components/BrandLogo';


interface SignupPageProps {
  onSignupSuccess: (authUser: AuthUser, isNewSignup?: boolean) => void;
}

const SignupPage: React.FC<SignupPageProps> = ({ onSignupSuccess }) => {
  const [isLogin, setIsLogin] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'candidate' | 'recruiter'>('candidate');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [buyPlanIntent, setBuyPlanIntent] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Check if user came from "Buy Plan" flow
  useEffect(() => {
    const intent = localStorage.getItem('auth_intent');
    if (intent === 'buy_plan') {
      setBuyPlanIntent(true);
      setSelectedRole('candidate'); // Recruiter buys also flow through candidate but with different selected_plan flag
    }
  }, []);

  // Validate email format
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Validate password strength
  const isValidPassword = (password: string): boolean => {
    return password.length >= 6;
  };

  // Parse Firebase error codes into user-friendly messages
  const getErrorMessage = (err: any): string => {
    const errorCode = err?.code || '';
    const errorMessage = err?.message || '';

    console.error('[SignupPage] Auth error details:', { errorCode, errorMessage });

    if (errorCode.includes('auth/invalid-credential') || errorCode.includes('auth/wrong-password')) {
      return 'Incorrect email or password.';
    }
    if (errorCode.includes('auth/user-not-found')) {
      return 'No account found with this email.';
    }
    if (errorCode.includes('auth/email-already-in-use')) {
      return 'Email already registered. Please log in.';
    }
    if (errorCode.includes('auth/weak-password')) {
      return 'Password is too weak. Use at least 6 characters.';
    }
    if (errorCode.includes('auth/invalid-email')) {
      return 'Invalid email address.';
    }
    if (errorCode.includes('auth/network-request-failed')) {
      return 'Network error. Please check your connection.';
    }
    return 'Authentication failed. Please try again.';
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!email.trim()) {
      setErrorMessage('Email is required');
      return;
    }
    if (!isValidEmail(email)) {
      setErrorMessage('Please enter a valid email address');
      return;
    }
    if (!password) {
      setErrorMessage('Password is required');
      return;
    }
    if (!isValidPassword(password)) {
      setErrorMessage('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);
    setLoadingText(isLogin ? 'Authenticating...' : 'Creating Profile...');

    try {
      let user: AuthUser;
      if (isLogin) {
        user = await authService.loginWithEmail(email, password);
      } else {
        user = await authService.signupWithEmail(email, password, selectedRole);
      }
      setIsLoading(false);
      onSignupSuccess(user, !isLogin); // Pass true only for new signups
    } catch (err) {
      console.error('[SignupPage] Email Auth Failure:', err);
      const userFriendlyError = getErrorMessage(err);
      setErrorMessage(userFriendlyError);
      setIsLoading(false);
    }
  };

  const handleSocialAuth = async (provider: 'google' | 'linkedin') => {
    setErrorMessage('');
    setIsLoading(true);
    setLoadingText(`Connecting to ${provider.toUpperCase()}...`);

    try {
      const user = await authService.loginWithSocial(provider, selectedRole);
      setIsLoading(false);
      onSignupSuccess(user, false);
    } catch (err) {
      console.error(`[SignupPage] ${provider} Auth Failure:`, err);
      const userFriendlyError = getErrorMessage(err);
      setErrorMessage(userFriendlyError);
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setErrorMessage('');
    setEmail('');
    setPassword('');
  };

  return (
    <div className="min-h-[100dvh] w-full bg-white dark:bg-[#1A1A1A] md:bg-[#F0F2F5] md:dark:bg-background-dark flex flex-col md:flex-row font-sans relative overflow-y-auto md:overflow-hidden">



      {/* 
        =================
        LEFT SIDE: FORM 
        =================
      */}
      <div className="w-full md:w-1/2 min-h-[100dvh] md:h-full bg-white dark:bg-[#1A1A1A] flex flex-col z-20 relative">

        {/* Header - Logo Only */}
        <div className="px-6 md:px-10 lg:px-16 py-4 md:py-6 flex justify-between items-center w-full z-30 shrink-0">
          <Link to="/" className="flex items-center gap-2">
            <BrandLogo className="size-6 md:size-7" />
            <h2 className="text-base md:text-lg lg:text-xl font-black tracking-tighter text-black dark:text-white uppercase leading-none mt-0.5">Asterix</h2>
          </Link>
        </div>

        {/* Form Container */}
        <div className="flex-1 flex flex-col justify-center items-center px-6 md:px-10 lg:px-16 xl:px-24 w-full h-full max-w-[600px] mx-auto animate-fade-in-up py-6 md:py-0">

          <div className="mb-4 xl:mb-6 shrink-0 mt-2 md:mt-0">
            <h1 className="text-[28px] md:text-[32px] lg:text-[40px] font-black tracking-tighter leading-[1] mb-1.5 uppercase shrink-0">
              <span className="text-black/5 dark:text-white/5 outline-text block leading-[0.85]">AUTOMATE</span>
              <span className="text-black/5 dark:text-white/5 outline-text block leading-[0.85]">YOUR CAREER</span>
              <span className="text-black dark:text-white block mt-1.5">GROWTH.</span>
            </h1>
            <p className="text-[10px] md:text-[11px] lg:text-xs font-bold tracking-wide text-gray-500 mt-2 xl:mt-3 shrink-0">
              {isLogin
                ? 'Sign in to review your applications and AI matches.'
                : 'Sign up to start your automated job hunt in minutes.'}
            </p>
          </div>



          {/* SOCIAL BUTTONS */}
          <div className="flex justify-center gap-4 md:gap-5 mb-4 xl:mb-5 w-full max-w-[400px] shrink-0">
            <button
              onClick={() => handleSocialAuth('google')}
              disabled={isLoading}
              className="size-12 md:size-14 border border-gray-200 dark:border-white/10 rounded-[14px] flex items-center justify-center bg-white dark:bg-[#1A1A1A] hover:bg-gray-50 dark:hover:bg-white/5 transition-all text-black dark:text-white disabled:opacity-50 shadow-sm"
              title={isLogin ? 'Sign in with Google' : 'Sign up with Google'}
            >
              <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="size-5 md:size-6" />
            </button>
            <button
              onClick={() => handleSocialAuth('linkedin')}
              disabled={isLoading}
              className="size-12 md:size-14 border border-gray-200 dark:border-white/10 rounded-[14px] flex items-center justify-center bg-white dark:bg-[#1A1A1A] hover:bg-gray-50 dark:hover:bg-white/5 transition-all text-[#0A66C2] dark:text-white disabled:opacity-50 shadow-sm"
              title={isLogin ? 'Sign in with LinkedIn' : 'Sign up with LinkedIn'}
            >
              <img src="https://www.svgrepo.com/show/448234/linkedin.svg" alt="LinkedIn" className="size-5 md:size-6" />
            </button>
          </div>

          {/* EMAIL FORM */}
          <div className="w-full max-w-[400px] shrink-0">
            <div className="flex items-center gap-3 mb-4 xl:mb-5 w-full">
              <div className="flex-1 h-px bg-gray-200 dark:bg-white/10"></div>
              <span className="text-[9px] md:text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">Or use email</span>
              <div className="flex-1 h-px bg-gray-200 dark:bg-white/10"></div>
            </div>

            {!isLogin && !buyPlanIntent && (
              <div className="flex bg-[#F5F5F5] dark:bg-white/5 p-1 rounded-[10px] mb-4 xl:mb-5 border border-transparent w-full shrink-0">
                <button
                  onClick={() => setSelectedRole('candidate')}
                  className={`flex-1 py-1.5 md:py-2 text-[10px] md:text-[11px] font-bold rounded-[6px] transition-all ${selectedRole === 'candidate' ? 'bg-white dark:bg-[#2A2A2A] text-black dark:text-white shadow-[0_2px_8px_rgba(0,0,0,0.05)]' : 'text-gray-500 hover:text-black dark:hover:text-white'}`}
                >
                  Candidate
                </button>
                <button
                  onClick={() => setSelectedRole('recruiter')}
                  className={`flex-1 py-1.5 md:py-2 text-[10px] md:text-[11px] font-bold rounded-[6px] transition-all ${selectedRole === 'recruiter' ? 'bg-white dark:bg-[#2A2A2A] text-black dark:text-white shadow-[0_2px_8px_rgba(0,0,0,0.05)]' : 'text-gray-500 hover:text-black dark:hover:text-white'}`}
                >
                  Employer
                </button>
              </div>
            )}

            {errorMessage && (
              <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-2.5 rounded-xl text-[10px] md:text-[11px] font-bold tracking-wide flex items-center gap-2 border border-red-100 dark:border-red-900/30 w-full mb-3 shrink-0">
                <span className="material-symbols-outlined text-[12px] shrink-0">error</span>
                <p>{errorMessage}</p>
              </div>
            )}

            <form onSubmit={handleEmailAuth} className="space-y-3 md:space-y-4 w-full shrink-0">
              <div>
                <label className="block text-[9px] md:text-[10px] font-black text-black dark:text-white mb-1 md:mb-1.5 ml-1">
                  Email<span className="text-red-500">*</span>
                </label>
                <input
                  required
                  disabled={isLoading}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setErrorMessage('');
                  }}
                  className="w-full bg-transparent border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 md:py-3 text-[11px] md:text-[12px] font-medium focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent outline-none transition-all disabled:opacity-50 placeholder:text-gray-400"
                  placeholder="Enter your email"
                  type="email"
                />
              </div>

              <div>
                <label className="block text-[9px] md:text-[10px] font-black text-black dark:text-white mb-1 md:mb-1.5 ml-1">
                  Password<span className="text-red-500">*</span>
                </label>
                <input
                  required
                  disabled={isLoading}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrorMessage('');
                  }}
                  className="w-full bg-transparent border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 md:py-3 text-[11px] md:text-[12px] font-medium focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent outline-none transition-all disabled:opacity-50 placeholder:text-gray-400"
                  placeholder="Enter your password"
                  type="password"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#1A1A1A] dark:bg-white text-white dark:text-black py-3 md:py-3.5 rounded-xl font-bold text-[11px] md:text-[12px] transition-colors hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2 xl:mt-4"
              >
                {isLoading ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-[12px]">progress_activity</span>
                    {loadingText}
                  </>
                ) : (
                  isLogin ? 'Log In' : 'Create Account'
                )}
              </button>
            </form>
          </div>

          <div className="mt-4 md:mt-5 text-left md:text-left text-center w-full max-w-[400px] shrink-0">
            <p className="text-[10px] md:text-[11px] text-gray-500 font-medium">
              {isLogin ? "Don't have an account?" : "Already have an account?"}&nbsp;
              <button
                onClick={toggleMode}
                className="font-bold text-black dark:text-white hover:underline transition-all"
              >
                {isLogin ? 'Sign up here' : 'Login Here'}
              </button>
            </p>
          </div>

        </div>
      </div>

      {/* 
        =================
        RIGHT SIDE: DESKTOP VISUAL
        =================
      */}
      <div className="hidden md:flex w-1/2 h-[100dvh] relative overflow-hidden bg-gradient-to-br from-[#E8E4FF] to-[#D6E3FF] dark:from-[#211E3B] dark:to-[#17223B] items-center justify-center p-8 lg:p-12 xl:p-16 shrink-0">

        {/* Floating Cards Container */}
        <div className="relative z-10 flex flex-col gap-4 xl:gap-6 w-full max-w-[440px] animate-fade-in-up">

          {/* Main Hero Card */}
          <div className="bg-white/90 dark:bg-[#1A1A1A]/90 backdrop-blur-md p-6 lg:p-10 rounded-[28px] lg:rounded-[32px] shadow-[0_20px_60px_-15px_rgba(130,107,240,0.15)] flex flex-col items-center text-center transform hover:-translate-y-1 transition-transform duration-500">
            <div className="size-12 lg:size-14 bg-gradient-to-tr from-[#6850E8] to-[#9181F5] rounded-full flex items-center justify-center mb-4 lg:mb-5 shadow-xl shadow-[#826BF0]/30 shrink-0">
              <span className="material-symbols-outlined text-xl lg:text-2xl text-white">temp_preferences_custom</span>
            </div>
            <h3 className="text-2xl lg:text-3xl xl:text-4xl font-black tracking-tight text-black dark:text-white mb-3 lg:mb-4 leading-none">
              Start finding your<br />ideal match.
            </h3>
            <p className="text-[11px] lg:text-[12px] xl:text-[13px] font-medium text-gray-500 dark:text-gray-400 leading-relaxed max-w-[280px]">
              Build a professional profile that actually highlights your unique skills, not just keywords.
            </p>
          </div>

          <div className="flex gap-4 xl:gap-6 w-full shrink-0">
            {/* Stats Card */}
            <div className="flex-1 bg-white/90 dark:bg-[#1A1A1A]/90 backdrop-blur-md p-4 lg:p-5 xl:p-6 rounded-[24px] lg:rounded-[32px] shadow-[0_20px_60px_-15px_rgba(130,107,240,0.15)] flex flex-col justify-between transform -translate-x-1 lg:-translate-x-2 hover:-translate-y-1 transition-transform duration-500">
              <div>
                <p className="text-[8px] lg:text-[9px] font-bold tracking-[0.2em] text-gray-400 uppercase mb-2 lg:mb-3">Success Rate</p>
                <p className="text-2xl lg:text-3xl font-black text-black dark:text-white tracking-tighter leading-none mb-1">98.2%</p>
                <p className="text-[8px] lg:text-[9px] font-bold text-[#826BF0]">+12% this month</p>
              </div>
              {/* Mock Chart line */}
              <div className="w-full h-8 lg:h-10 mt-4 border-b border-l border-gray-100 dark:border-white/10 relative flex items-end ml-1 shrink-0">
                <svg className="w-full h-full text-[#826BF0] overflow-visible" viewBox="0 0 100 40" preserveAspectRatio="none">
                  <polyline fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points="0,35 20,20 40,30 60,10 80,15 100,0" />
                  <circle cx="100" cy="0" r="3" fill="currentColor" />
                </svg>
              </div>
            </div>

            {/* Testimonial snippet */}
            <div className="flex-1 bg-white/90 dark:bg-[#1A1A1A]/90 backdrop-blur-md p-4 lg:p-5 xl:p-6 rounded-[24px] lg:rounded-[32px] shadow-[0_20px_60px_-15px_rgba(130,107,240,0.15)] flex flex-col justify-between transform translate-x-1 lg:translate-x-2 translate-y-4 lg:translate-y-8 hover:-translate-y-1 transition-transform duration-500">
              <p className="text-[10px] lg:text-[11px] xl:text-[12px] font-medium text-black dark:text-white tracking-wide leading-relaxed mb-4 lg:mb-6 italic">
                "Asterix found my dream job and applied for me while I slept."
              </p>
              <div className="flex items-center gap-2 lg:gap-3 mt-auto shrink-0">
                <img src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=1576&auto=format&fit=crop" className="size-6 lg:size-8 rounded-full object-cover border-2 border-white dark:border-[#1A1A1A] shadow-sm shrink-0" alt="User" />
                <div>
                  <p className="text-[9px] lg:text-[10px] font-black text-black dark:text-white tracking-tight">Sarah Jenkins</p>
                  <p className="text-[7px] lg:text-[8px] font-medium text-gray-500">Senior UX</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      <style>{`
        .outline-text {
          -webkit-text-stroke: 1px #E5E7EB;
          color: transparent;
        }
        .dark .outline-text {
          -webkit-text-stroke: 1px #374151;
        }
        @keyframes fade-in-up {
          0% { opacity: 0; transform: translateY(15px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default SignupPage;
