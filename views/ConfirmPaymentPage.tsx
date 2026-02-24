import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService, readSessionUid } from '../authService';

interface ConfirmPaymentPageProps {
  onPaymentSuccess: () => void;
  onToggleTheme?: (isDark: boolean) => void;
  isDarkMode?: boolean;
}

type Stage = 'checkout' | 'processing' | 'success';

function formatCardNumber(val: string) {
  return val.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
}

function formatExpiry(val: string) {
  const digits = val.replace(/\D/g, '').slice(0, 4);
  if (digits.length >= 3) return digits.slice(0, 2) + '/' + digits.slice(2);
  return digits;
}

function formatCVV(val: string) {
  return val.replace(/\D/g, '').slice(0, 3);
}

export default function ConfirmPaymentPage({
  onPaymentSuccess,
  onToggleTheme,
  isDarkMode,
}: ConfirmPaymentPageProps) {
  const navigate = useNavigate();

  const [stage, setStage] = useState<Stage>('checkout');
  const [error, setError] = useState('');

  // Card form fields
  const [cardName, setCardName]     = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry]         = useState('');
  const [cvv, setCvv]               = useState('');

  // Processing steps shown during fake payment
  const [processingStep, setProcessingStep] = useState(0);

  // Read plan from localStorage
  const selectedPlan = localStorage.getItem('selected_plan') || 'student';
  
  const PLAN_CONFIG = {
    student: {
      name: 'Student Plan',
      price: '₹99',
      amount: 99,
      features: [
        'Auto-apply to 30+ jobs daily',
        'Get noticed by recruiters first',
        'Entry-level profile matches',
        'Manual applications',
        'Profile improvement tips',
        'Track all applications',
        'Email match alerts',
        'Priority support'
      ]
    },
    recruiter: {
      name: 'Recruiter Pro',
      price: '₹1,999',
      amount: 1999,
      features: [
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
      ]
    }
  };

  const plan = PLAN_CONFIG[selectedPlan as keyof typeof PLAN_CONFIG] || PLAN_CONFIG.student;
  const PLAN_PRICE = plan.price;
  const features = plan.features;

  const PROCESSING_STEPS = [
    'Verifying card details…',
    'Contacting payment network…',
    'Authorizing transaction…',
    'Confirming subscription…',
  ];

  /* ── Validation ───────────────────────────────────────── */
  const validate = () => {
    if (!cardName.trim()) return 'Please enter the cardholder name.';
    if (cardNumber.replace(/\s/g, '').length < 16) return 'Please enter a valid 16-digit card number.';
    if (expiry.length < 5) return 'Please enter a valid expiry date (MM/YY).';
    if (cvv.length < 3) return 'Please enter a valid 3-digit CVV.';
    return null;
  };

  /* ── Fake payment flow ────────────────────────────────── */
  const handlePay = async () => {
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setError('');
    setStage('processing');
    setProcessingStep(0);

    // Animate through processing steps
    for (let i = 1; i < PROCESSING_STEPS.length; i++) {
      await new Promise(r => setTimeout(r, 900));
      setProcessingStep(i);
    }
    await new Promise(r => setTimeout(r, 800));

    // Write plan to Firestore
    try {
      const uid = readSessionUid();
      if (!uid) throw new Error('No user session');

      const planData = {
        plan: selectedPlan === 'recruiter' ? 'pro' : 'premium',
        status: 'active',
        isPremium: selectedPlan === 'recruiter' ? false : true,
        isStudent: selectedPlan === 'student' ? true : false,
        isRecruiterPro: selectedPlan === 'recruiter' ? true : false,
        amount: plan.amount,
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        paymentId: `FAKE_${Date.now()}`,
        autoRenew: true,
      };

      await authService.updateSubscription(planData);
      await authService.getCurrentUser();
      setStage('success');
    } catch (err: any) {
      setStage('checkout');
      setError('Something went wrong activating your plan. Please try again.');
    }
  };

  const handleSuccess = () => {
    onPaymentSuccess();
  };

  const handleSkip  = () => { localStorage.removeItem('auth_intent'); localStorage.removeItem('selected_plan'); navigate('/candidate', { replace: true }); };
  const handleBack  = () => navigate(-1);
  const handleLogo  = () => navigate('/', { replace: true });

  /* ═══════════════════════════════════════════════════════
     SUCCESS SCREEN
  ═══════════════════════════════════════════════════════ */
  if (stage === 'success') {
    return (
      <div className="h-screen bg-white dark:bg-black text-black dark:text-white flex flex-col items-center justify-center gap-8 px-6">
        <div className="flex flex-col items-center gap-6 text-center max-w-sm">
          {/* Animated checkmark */}
          <div className="size-24 bg-emerald-500 flex items-center justify-center shadow-[0_0_60px_rgba(16,185,129,0.4)]">
            <span className="material-symbols-outlined text-5xl text-white" style={{ animation: 'popIn 0.4s cubic-bezier(0.175,0.885,0.32,1.275) forwards' }}>
              check
            </span>
          </div>

          <div className="space-y-2">
            <p className="text-[9px] font-black uppercase tracking-[0.4em] text-emerald-500">Payment Confirmed</p>
            <h1 className="text-4xl font-black uppercase tracking-tighter leading-none">
              You're<br />{plan.name}
            </h1>
            <p className="text-sm font-bold opacity-40 uppercase tracking-widest leading-relaxed">
              {selectedPlan === 'recruiter' ? 'Pro plan activated. Unlimited posting unlocked.' : 'Student plan activated. Manual applications unlocked.'}
            </p>
          </div>

          {/* Receipt snippet */}
          <div className="w-full border-2 border-black dark:border-white p-5 text-left space-y-3 bg-black/5 dark:bg-white/5">
            {[
              ['Plan', plan.name],
              ['Amount', PLAN_PRICE + '/mo'],
              ['Status', 'ACTIVE'],
              ['Billing', 'Monthly'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between items-center">
                <span className="text-[8px] font-black uppercase tracking-widest opacity-40">{k}</span>
                <span className={`text-xs font-black uppercase ${k === 'Status' ? 'text-emerald-500' : ''}`}>{v}</span>
              </div>
            ))}
          </div>

          <button
            onClick={handleSuccess}
            className="w-full bg-black dark:bg-white text-white dark:text-black py-4 text-[10px] font-black uppercase tracking-widest hover:invert transition-all shadow-xl flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-base">rocket_launch</span>
            Access Dashboard
          </button>
        </div>

        <style>{`
          @keyframes popIn {
            0%   { transform: scale(0); opacity: 0; }
            100% { transform: scale(1); opacity: 1; }
          }
        `}</style>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════
     PROCESSING SCREEN
  ═══════════════════════════════════════════════════════ */
  if (stage === 'processing') {
    return (
      <div className="h-screen bg-white dark:bg-black text-black dark:text-white flex flex-col items-center justify-center gap-10 px-6">
        {/* Spinning ring */}
        <div className="relative size-24">
          <div className="absolute inset-0 border-4 border-black/10 dark:border-white/10 rounded-full" />
          <div className="absolute inset-0 border-4 border-transparent border-t-black dark:border-t-white rounded-full animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl opacity-40">credit_card</span>
          </div>
        </div>

        <div className="text-center space-y-3 max-w-xs">
          <p className="text-[9px] font-black uppercase tracking-[0.4em] opacity-40">Secure Transaction</p>
          <h2 className="text-2xl font-black uppercase tracking-tighter">Processing Payment</h2>

          {/* Step list */}
          <div className="space-y-2 pt-4 text-left">
            {PROCESSING_STEPS.map((step, i) => (
              <div key={i} className={`flex items-center gap-3 transition-all duration-500 ${i <= processingStep ? 'opacity-100' : 'opacity-20'}`}>
                <div className={`size-5 flex items-center justify-center shrink-0 border transition-all duration-300
                  ${i < processingStep ? 'bg-emerald-500 border-emerald-500' :
                    i === processingStep ? 'border-black dark:border-white' :
                    'border-black/20 dark:border-white/20'}`}
                >
                  {i < processingStep
                    ? <span className="material-symbols-outlined text-white text-xs">check</span>
                    : i === processingStep
                      ? <span className="text-[8px] font-black">{i + 1}</span>
                      : null
                  }
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest">{step}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-[8px] font-black uppercase tracking-[0.3em] opacity-20">Do not close this window</p>

        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          .animate-spin { animation: spin 0.9s linear infinite; }
        `}</style>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════
     CHECKOUT SCREEN
  ═══════════════════════════════════════════════════════ */
  return (
    <div className="h-screen bg-white dark:bg-black text-black dark:text-white flex flex-col overflow-hidden">

      {/* Header */}
      <header className="border-b border-black dark:border-white px-6 py-4 flex items-center justify-between flex-shrink-0">
        <button onClick={handleLogo} className="flex items-center gap-3 hover:opacity-60 transition-opacity">
          <div className="w-7 h-7 bg-black dark:bg-white flex items-center justify-center">
            <span className="text-white dark:text-black font-black text-sm">✦</span>
          </div>
          <span className="font-black text-xs uppercase tracking-[0.2em]">Asterix</span>
        </button>
        {onToggleTheme && (
          <button
            onClick={() => onToggleTheme(!isDarkMode)}
            className="p-1.5 border border-black/10 dark:border-white/10 hover:border-black dark:hover:border-white transition-colors"
          >
            <span className="material-symbols-outlined text-lg">{isDarkMode ? 'light_mode' : 'dark_mode'}</span>
          </button>
        )}
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center px-6 py-6 overflow-hidden">
        <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">

          {/* Left: Copy */}
          <div className="flex flex-col justify-center border-b lg:border-b-0 lg:border-r border-black dark:border-white pb-6 lg:pb-0 lg:pr-8 overflow-y-auto">
            <div className="space-y-4">
              <div className="inline-block border-2 border-emerald-500 px-3 py-1 bg-emerald-500/10">
                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-emerald-500">{plan.name}</span>
              </div>
              <h1 className="text-4xl lg:text-5xl font-black uppercase tracking-tight leading-tight">
                Unlock<br />Premium
              </h1>
              <p className="text-sm lg:text-base leading-relaxed max-w-sm opacity-60 font-bold uppercase tracking-wide">
                {selectedPlan === 'recruiter' 
                  ? 'Full recruiter toolkit with advanced sourcing and analytics.'
                  : 'Full manual application access + priority recruiter visibility.'}
              </p>
            </div>

            <div className="space-y-3 mt-6">
              {features.map((feature, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-sm text-emerald-500 shrink-0 mt-0.5">check_circle</span>
                  <span className="text-sm font-bold uppercase tracking-wide leading-tight">{feature}</span>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-4 border-t border-black dark:border-white">
              <p className="text-[9px] font-black uppercase tracking-widest opacity-40">
                ✓ Cancel anytime &nbsp;·&nbsp; ✓ Instant activation &nbsp;·&nbsp; ✓ 30-day guarantee
              </p>
            </div>
          </div>

          {/* Right: Card Form */}
          <div className="flex items-center justify-center lg:pl-8 overflow-y-auto">
            <div className="w-full max-w-sm">

              {/* Price header */}
              <div className="border-2 border-black dark:border-white p-6 space-y-6">

                <div className="flex items-baseline justify-between">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.3em] opacity-40 mb-1">Total Today</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-5xl font-black">{PLAN_PRICE}</span>
                      <span className="text-sm font-bold opacity-60">/mo</span>
                    </div>
                  </div>
                  <div className="size-12 bg-black dark:bg-white flex items-center justify-center">
                    <span className="material-symbols-outlined text-white dark:text-black text-xl">credit_card</span>
                  </div>
                </div>

                <div className="h-px bg-black dark:bg-white opacity-10" />

                {/* Error */}
                {error && (
                  <div className="px-4 py-3 border-2 border-red-500 bg-red-500/10 text-red-500 text-[9px] font-black uppercase tracking-widest">
                    ⚠ {error}
                  </div>
                )}

                {/* ── Card Form ── */}
                <div className="space-y-4">

                  {/* Cardholder name */}
                  <div className="space-y-1.5">
                    <label className="text-[8px] font-black uppercase tracking-widest opacity-40">Cardholder Name</label>
                    <input
                      type="text"
                      value={cardName}
                      onChange={e => setCardName(e.target.value)}
                      placeholder="FULL NAME"
                      className="w-full bg-black/5 dark:bg-white/5 border border-black/20 dark:border-white/20 px-4 py-3 text-xs font-black uppercase tracking-wide focus:border-black dark:focus:border-white outline-none transition-colors placeholder:opacity-20"
                    />
                  </div>

                  {/* Card number */}
                  <div className="space-y-1.5">
                    <label className="text-[8px] font-black uppercase tracking-widest opacity-40">Card Number</label>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={cardNumber}
                        onChange={e => setCardNumber(formatCardNumber(e.target.value))}
                        placeholder="0000 0000 0000 0000"
                        className="w-full bg-black/5 dark:bg-white/5 border border-black/20 dark:border-white/20 px-4 py-3 text-xs font-black uppercase tracking-widest focus:border-black dark:focus:border-white outline-none transition-colors placeholder:opacity-20 pr-12"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-base opacity-20">credit_card</span>
                    </div>
                  </div>

                  {/* Expiry + CVV */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[8px] font-black uppercase tracking-widest opacity-40">Expiry</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={expiry}
                        onChange={e => setExpiry(formatExpiry(e.target.value))}
                        placeholder="MM/YY"
                        className="w-full bg-black/5 dark:bg-white/5 border border-black/20 dark:border-white/20 px-4 py-3 text-xs font-black uppercase tracking-widest focus:border-black dark:focus:border-white outline-none transition-colors placeholder:opacity-20"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[8px] font-black uppercase tracking-widest opacity-40">CVV</label>
                      <div className="relative">
                        <input
                          type="password"
                          inputMode="numeric"
                          value={cvv}
                          onChange={e => setCvv(formatCVV(e.target.value))}
                          placeholder="•••"
                          className="w-full bg-black/5 dark:bg-white/5 border border-black/20 dark:border-white/20 px-4 py-3 text-xs font-black uppercase tracking-widest focus:border-black dark:focus:border-white outline-none transition-colors placeholder:opacity-20"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Pay button */}
                <button
                  onClick={handlePay}
                  className="w-full py-4 px-4 font-black uppercase tracking-widest text-sm bg-black text-white dark:bg-white dark:text-black border-2 border-black dark:border-white hover:invert active:scale-95 transition-all flex items-center justify-center gap-2 shadow-[4px_4px_0px_rgba(0,0,0,0.15)]"
                >
                  <span className="material-symbols-outlined text-base">lock</span>
                  Pay {PLAN_PRICE} &amp; Activate
                </button>

                {/* Trust line */}
                <div className="flex items-center justify-center gap-2 text-[8px] font-black uppercase tracking-widest opacity-30">
                  <span className="material-symbols-outlined text-xs">shield</span>
                  256-bit encrypted · Secure checkout
                </div>

                {/* Back */}
                <button
                  onClick={handleBack}
                  className="w-full py-2.5 px-4 font-bold uppercase tracking-widest text-[9px] border border-black/10 dark:border-white/10 hover:border-black dark:hover:border-white transition-colors opacity-40 hover:opacity-100"
                >
                  ← Back
                </button>
              </div>

              {/* Skip */}
              <button
                onClick={handleSkip}
                className="w-full mt-4 py-2 font-bold uppercase tracking-widest text-[9px] opacity-30 hover:opacity-70 transition-opacity"
              >
                Skip for now
              </button>

              <p className="text-center text-[8px] font-black uppercase tracking-widest opacity-20 mt-3">
                50K+ users · 4.8★ rating
              </p>
            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-black dark:border-white px-6 py-3 text-center text-[8px] font-black uppercase tracking-widest opacity-20 flex-shrink-0">
        © 2026 Asterix-find · All transactions simulated
      </footer>
    </div>
  );
}