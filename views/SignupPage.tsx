import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { UserRole } from '../types';
import { authService, AuthUser } from '../authService';


interface SignupPageProps {
  onSignupSuccess: (authUser: AuthUser) => void;  // ✅ CORRECT
}


const SignupPage: React.FC<SignupPageProps> = ({ onSignupSuccess }) => {
  const [isLogin, setIsLogin] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole>('candidate');
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
      setSelectedRole('candidate');
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

    // Firebase error codes
    if (errorCode.includes('auth/invalid-credential') || errorCode.includes('auth/wrong-password')) {
      return 'Incorrect email or password. Please try again.';
    }
    if (errorCode.includes('auth/user-not-found')) {
      return 'No account found with this email. Please sign up instead.';
    }
    if (errorCode.includes('auth/email-already-in-use')) {
      return 'Email already registered. Please log in instead.';
    }
    if (errorCode.includes('auth/weak-password')) {
      return 'Password is too weak. Use at least 6 characters with letters and numbers.';
    }
    if (errorCode.includes('auth/too-many-requests')) {
      return 'Too many login attempts. Please try again later.';
    }
    if (errorCode.includes('auth/account-exists-with-different-credential')) {
      return 'Account exists with this email but different provider. Try another login method.';
    }
    if (errorCode.includes('auth/invalid-email')) {
      return 'Invalid email address. Please check and try again.';
    }
    if (errorCode.includes('auth/operation-not-allowed')) {
      return 'Email/password login is currently disabled. Please try social login.';
    }
    if (errorCode.includes('auth/network-request-failed')) {
      return 'Network error. Please check your connection and try again.';
    }

    // Fallback
    return 'Authentication failed. Please try again.';
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Reset error state
    setErrorMessage('');

    // Validate inputs BEFORE Firebase call
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
    setLoadingText(isLogin ? 'Authenticating Protocol...' : 'Building Profile Node...');

    try {
      const intentBefore = localStorage.getItem('auth_intent');

      let user: AuthUser;

      if (isLogin) {
        user = await authService.loginWithEmail(email, password);
      } else {
        user = await authService.signupWithEmail(email, password, selectedRole);
      }

      const intentAfter = localStorage.getItem('auth_intent');

      setIsLoading(false);
      onSignupSuccess(user); // Route decision is made in App.tsx

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
    setLoadingText(`Connecting to ${provider.toUpperCase()} Bridge...`);

    try {
      console.log('[SignupPage] Starting social auth:', provider, {
        buyPlanIntent,
        intent: localStorage.getItem('auth_intent')
      });

      const user = await authService.loginWithSocial(provider, selectedRole);
      
      console.log('[SignupPage] Social auth successful:', { 
        uid: user.uid,
        role: user.role,
        intent: localStorage.getItem('auth_intent')
      });

      setIsLoading(false);
      onSignupSuccess(user);

    } catch (err) {
      console.error(`[SignupPage] ${provider} Auth Failure:`, err);
      const userFriendlyError = getErrorMessage(err);
      setErrorMessage(userFriendlyError);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-background-dark flex flex-col transition-colors duration-500">
      <header className="w-full px-6 lg:px-20 py-8 border-b border-black dark:border-white/10 flex items-center justify-between z-10">
        <Link to="/" className="flex items-center gap-3">
          <div className="bg-black dark:bg-white size-10 flex items-center justify-center text-white dark:text-black">
            <span className="material-symbols-outlined text-2xl font-black">auto_awesome</span>
          </div>
          <h2 className="text-2xl font-black tracking-tighter uppercase">Asterix</h2>
        </Link>
        <button
          onClick={() => setIsLogin(!isLogin)}
          className="text-[10px] font-black uppercase tracking-[0.4em] hover:opacity-100 transition-opacity flex items-center gap-2"
        >
          {isLogin ? 'Need an account?' : 'Returning user?'}
          <span className="border-b-2 border-black dark:border-white pb-0.5">{isLogin ? 'Sign Up' : 'Log In'}</span>
        </button>
      </header>

      <main className="flex-grow flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none opacity-5">
          <div className="absolute top-0 left-0 w-full h-full" style={{ backgroundImage: 'radial-gradient(circle, black 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
        </div>

        {isLoading ? (
          <div className="z-50 flex flex-col items-center justify-center space-y-8 animate-in fade-in zoom-in duration-500 text-center">
            <div className="relative size-32 flex items-center justify-center">
              <div className="absolute inset-0 border-8 border-black/5 dark:border-white/5 rounded-full"></div>
              <div className="absolute inset-0 border-8 border-t-black dark:border-t-white rounded-full animate-spin"></div>
              <span className="material-symbols-outlined text-4xl animate-pulse">encrypted</span>
            </div>
            <div className="space-y-3">
              <h2 className="text-2xl font-black uppercase tracking-[0.3em]">{loadingText}</h2>
              <p className="text-[10px] font-black uppercase tracking-[0.5em] opacity-40">Verifying Identity Integrity</p>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-[460px] border-2 border-black dark:border-white p-8 md:p-12 z-20 bg-white dark:bg-background-dark space-y-10 animate-in slide-in-from-bottom-5 duration-700 shadow-[20px_20px_0px_rgba(0,0,0,0.05)] dark:shadow-[20px_20px_0px_rgba(255,255,255,0.02)]">
            <div className="space-y-4">
              <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter leading-none">
                {isLogin ? 'Welcome Back' : 'Join Network'}
              </h1>
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 leading-relaxed">
                {buyPlanIntent 
                  ? 'Unlock premium access with AI-powered job matching.' 
                  : isLogin 
                    ? 'Resume your neural matching session.' 
                    : 'Select your operational role to begin.'}
              </p>
            </div>

            {!isLogin && !buyPlanIntent && (
              <div className="flex border border-black dark:border-white p-1">
                <button
                  onClick={() => setSelectedRole('candidate')}
                  className={`flex-1 flex items-center justify-center py-4 text-[10px] font-black uppercase tracking-widest transition-all ${selectedRole === 'candidate' ? 'bg-black text-white dark:bg-white dark:text-black' : 'opacity-40 hover:opacity-60'}`}
                >
                  Candidate
                </button>
                <button
                  onClick={() => setSelectedRole('recruiter')}
                  className={`flex-1 flex items-center justify-center py-4 text-[10px] font-black uppercase tracking-widest transition-all ${selectedRole === 'recruiter' ? 'bg-black text-white dark:bg-white dark:text-black' : 'opacity-40 hover:opacity-60'}`}
                >
                  Recruiter
                </button>
              </div>
            )}

            {buyPlanIntent && !isLogin && (
              <div className="bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 p-4 rounded">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-60 flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">check_circle</span>
                  Premium Plan Selected
                </p>
              </div>
            )}

            {/* Error Message Display */}
            {errorMessage && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded">
                <p className="text-[9px] font-black uppercase tracking-[0.1em] text-red-700 dark:text-red-300 flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">error</span>
                  {errorMessage}
                </p>
              </div>
            )}

            <form onSubmit={handleEmailAuth} className="space-y-6">
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-[0.3em] opacity-40">Operational ID (Email)</label>
                  <input
                    required
                    disabled={isLoading}
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setErrorMessage(''); // Clear error on input change
                    }}
                    className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 p-4 text-xs font-bold uppercase tracking-widest focus:ring-0 focus:border-black dark:focus:border-white outline-none transition-all disabled:opacity-50"
                    placeholder="ID_0000@ASTERIX.NETWORK"
                    type="email"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-[0.3em] opacity-40">Passphrase</label>
                  <input
                    required
                    disabled={isLoading}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setErrorMessage(''); // Clear error on input change
                    }}
                    className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 p-4 text-xs font-bold uppercase tracking-widest focus:ring-0 focus:border-black dark:focus:border-white outline-none transition-all disabled:opacity-50"
                    placeholder="••••••••"
                    type="password"
                  />
                </div>
              </div>

              <button 
                type="submit"
                disabled={isLoading}
                className="w-full bg-black dark:bg-white text-white dark:text-black py-6 font-black uppercase tracking-[0.4em] text-[10px] hover:invert transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-4"
              >
                {isLogin ? 'Enter Portal' : 'Register Node'}
                <span className="material-symbols-outlined text-base">arrow_right_alt</span>
              </button>
            </form>

            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <span className="flex-1 h-px bg-black/10 dark:bg-white/10"></span>
                <span className="text-[8px] font-black uppercase tracking-widest opacity-20 whitespace-nowrap">External Auth Bridges</span>
                <span className="flex-1 h-px bg-black/10 dark:bg-white/10"></span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => handleSocialAuth('google')}
                  disabled={isLoading}
                  className="flex items-center justify-center gap-3 py-4 border border-black dark:border-white/20 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all text-[9px] font-black uppercase tracking-widest group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="" className="size-4 grayscale group-hover:grayscale-0 transition-all" />
                  Google
                </button>
                <button
                  onClick={() => handleSocialAuth('linkedin')}
                  disabled={isLoading}
                  className="flex items-center justify-center gap-3 py-4 border border-black dark:border-white/20 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all text-[9px] font-black uppercase tracking-widest group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <img src="https://www.svgrepo.com/show/448234/linkedin.svg" alt="" className="size-4 grayscale group-hover:grayscale-0 transition-all" />
                  LinkedIn
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="w-full px-6 py-8 flex flex-col md:flex-row items-center justify-between text-[8px] font-black uppercase tracking-[0.4em] opacity-20 border-t border-black/5 dark:border-white/5">
        <p>© 2024 Asterix-find. Session Protocol: V.0.9.1</p>
        <div className="flex gap-8 mt-4 md:mt-0">
          <a href="#" className="hover:opacity-100">Contact Node</a>
          <a href="#" className="hover:opacity-100">Privacy Manifesto</a>
          <a href="#" className="hover:opacity-100">Logic License</a>
        </div>
      </footer>
    </div>
  );
};

export default SignupPage;