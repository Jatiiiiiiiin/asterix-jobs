import React, { useEffect, useState, ReactNode, useCallback } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";

import { auth } from "./firebase";
import { authService, AuthUser } from "./authService";
import { Analytics } from "@vercel/analytics/react"
import { SpeedInsights } from "@vercel/speed-insights/react"

/* Views */
import LandingPage from "./views/LandingPage";
import SignupPage from "./views/SignupPage";
import CandidateDashboard from "./views/CandidateDashboard";
import RecruiterDashboard from "./views/RecruiterDashboard";
import CandidateOnboarding from "./views/CandidateOnboarding";
import JobsPage from "./views/JobsPage";
import JobDetailsPage from "./views/JobDetailsPage";
import ProfilePage from "./views/ProfilePage";
import ApplicationsPage from "./views/ApplicationsPage";
import SettingsPage from "./views/SettingsPage";
import PostJobPage from "./views/PostJobPage";
import TalentPipelinePage from "./views/TalentPipelinePage";
import RecruiterReportsPage from "./views/RecruiterReportsPage";
import ConfirmPaymentPage from "./views/ConfirmPaymentPage";
import VerifyEmailPage from "./views/VerifyEmailPage";
import AboutPage from "./views/AboutPage";
import ContactPage from "./views/ContactPage";
import PrivacyPage from "./views/PrivacyPage";
import TermsPage from "./views/TermsPage";
import AdminPortal from "./views/AdminPortal";
import CampusConnectPage from "./views/CampusConnectPage";
import CampusConnectTestPage from "./views/CampusConnectTestPage";
import './App.css';

/* Components */

import PublicRoute from "./views/PublicRoute";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import AsterixAssistant from "./components/AsterixAssistant";



/* ───────────────── ROUTE GUARDS ───────────────── */

const RequireAuth = ({ user, children }: { user: AuthUser | null, children: ReactNode }) => {
  const params = new URLSearchParams(window.location.search);
  const isGuest = params.get("guest") === "true";
  if (!user && !isGuest) return <Navigate to="/signup" replace />;
  return <>{children}</>;
};

const RequireCandidate = ({ user, children }: { user: AuthUser | null, children: ReactNode }) => {
  const params = new URLSearchParams(window.location.search);
  const isGuest = params.get("guest") === "true";
  if (!user && !isGuest) return <Navigate to="/signup" replace />;
  if (user && user.role !== "candidate" && user.role !== "admin") return <Navigate to="/signup" replace />;
  return <>{children}</>;
};

const RequireRecruiter = ({ user, children }: { user: AuthUser | null, children: ReactNode }) => {
  if (!user) return <Navigate to="/signup" replace />;
  if (user.role !== "recruiter") return <Navigate to="/signup" replace />;
  return <>{children}</>;
};

const RequireAdmin = ({ user, children }: { user: AuthUser | null, children: ReactNode }) => {
  if (!user) return <Navigate to="/signup" replace />;
  if (user.role !== "admin") return <Navigate to="/signup" replace />;
  return <>{children}</>;
};

const App: React.FC = () => {
  const navigate = useNavigate();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);


  useEffect(() => {
    const saved = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

    // Determine initial dark mode state
    const shouldBeDark = saved === "dark" || (!saved && prefersDark);

    // Explicitly toggle class to ensure consistency
    document.documentElement.classList.toggle("dark", shouldBeDark);
    setIsDarkMode(shouldBeDark);
  }, []);


  const toggleTheme = () => {
    setIsDarkMode(prev => {
      const next = !prev;
      document.documentElement.classList.toggle("dark", next);
      localStorage.setItem("theme", next ? "dark" : "light");
      return next;
    });
  };

  /* ───────────────── POST PAYMENT ───────────────── */

  const handlePaymentSuccess = useCallback(async () => {
    try {
      const updatedUser = await authService.getCurrentUser();
      setUser(updatedUser);

      const redirectPath = localStorage.getItem("payment_redirect_path");

      localStorage.removeItem("auth_intent");
      localStorage.removeItem("selected_plan");
      localStorage.removeItem("payment_redirect_path");

      if (redirectPath && redirectPath !== "/confirm-payment") {
        console.log(`[POST-PAYMENT] Contextual redirect to: ${redirectPath}`);
        navigate(redirectPath, { replace: true });
        return;
      }

      if (updatedUser?.role === "recruiter") {
        navigate("/recruiter", { replace: true });
        return;
      }

      if (!updatedUser?.isOnboarded) {
        navigate("/candidate/onboarding", { replace: true });
      } else {
        navigate("/candidate", { replace: true });
      }
    } catch (err) {
      console.error("[POST-PAYMENT]", err);
    }
  }, [navigate]);

  /* ───────────────── GLOBAL PAYMENT WATCHER ───────────────── */

  const handleGlobalPaymentVerification = useCallback(async (orderId: string) => {
    try {
      console.log("[GlobalPayment] Verifying order:", orderId);
      const { auth } = await import("./firebase");
      const idToken = auth.currentUser ? await auth.currentUser.getIdToken() : null;
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/payments/status/${orderId}`, {
        headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
      });
      const data = await response.json();

      if (data.status === "success" && (data.payment_status === "SUCCESS" || data.payment_status === "PAID")) {
        console.log("[GlobalPayment] Verification logic success. Activating premium_student...");
        const selectedPlanId = localStorage.getItem("selected_plan") || "student";
        const plan = (selectedPlanId === "recruiter" ? "premium" : "premium_student") as "premium" | "student" | "premium_student";

        // Subscription is now activated server-side: backend verifies payment then writes to Firestore
        await authService.updateSubscription(orderId, plan);

        // Clean up URL parameters to avoid re-triggering
        const newUrl = window.location.pathname + window.location.hash;
        window.history.replaceState({}, document.title, newUrl);

        await handlePaymentSuccess();
      }
    } catch (err) {
      console.error("[GlobalPayment] Verification failed:", err);
    }
  }, [handlePaymentSuccess]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get("order_id");
    if (orderId) {
      handleGlobalPaymentVerification(orderId);
    }
  }, [handleGlobalPaymentVerification]);

  /* ───────────────── AUTH HYDRATION ───────────────── */

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async firebaseUser => {
      console.log("[App] Auth state changed. User:", firebaseUser?.email || "null");

      if (!firebaseUser) {
        const sessionUid = localStorage.getItem("asterix_session_uid") || sessionStorage.getItem("asterix_session_uid");
        if (!sessionUid) {
          setUser(null);
        }
        setIsLoading(false);
        return;
      }

      try {
        const fullUser = await authService.getCurrentUser();
        setUser(fullUser);

        if (fullUser) {
          const path = window.location.pathname;
          const isNewSignup = sessionStorage.getItem('is_new_signup') === 'true';

          if (path === '/verify-email' && !fullUser.emailVerified) {
            // Stay
          } else if (isNewSignup && !fullUser.emailVerified) {
            // Force newly signed up users to verify email before onboarding
            navigate("/verify-email", { replace: true });
          } else if (!fullUser.isOnboarded && fullUser.role === 'candidate' && path !== '/candidate/onboarding') {
            navigate("/candidate/onboarding", { replace: true });
          }
        }
      } catch (error) {
        console.error('[❌ App] Error hydrating user:', error);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    });

    return unsub;
  }, [navigate]);

  /* ───────────────── POST SIGNUP / ONBOARDING / VERIFICATION ───────────────── */

  const handlePostSignup = useCallback((authUser: AuthUser, isNewSignup = false) => {
    setUser(authUser);
    const intent = localStorage.getItem("auth_intent");

    if (isNewSignup && !authUser.emailVerified) {
      navigate("/verify-email", { replace: true });
      return;
    }

    if (authUser.role === "candidate" && !authUser.isOnboarded) {
      navigate("/candidate/onboarding", { replace: true });
      return;
    }

    if (authUser.role === "admin") {
      navigate("/admin", { replace: true });
      return;
    }

    if (authUser.role === "recruiter") {
      localStorage.removeItem("auth_intent");
      navigate("/recruiter", { replace: true });
      return;
    }

    if (intent === "buy_plan") {
      navigate("/confirm-payment", { replace: true });
      return;
    }

    navigate("/candidate", { replace: true });
  }, [navigate]);

  const handleOnboardingSuccess = useCallback(async () => {
    const updatedUser = await authService.getCurrentUser();
    setUser(updatedUser);
    navigate("/candidate", { replace: true });
  }, [navigate]);

  const handleVerificationSuccess = useCallback(async () => {
    sessionStorage.removeItem('is_new_signup');
    const updatedUser = await authService.getCurrentUser();
    setUser(updatedUser);
    if (updatedUser) {
      handlePostSignup(updatedUser);
    }
  }, [handlePostSignup]);

  const handleLogout = async () => {
    await authService.logout();
    setUser(null);
    localStorage.removeItem("auth_intent");
    localStorage.removeItem("selected_plan");
    navigate("/", { replace: true });
  };

  /* ───────────────── LOADER ───────────────── */

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-white dark:bg-background-dark">
        <DotLottieReact
          src="https://lottie.host/7547a75b-5cbb-4088-8b15-8ba7276661b9/GS0Osb9TSY.lottie"
          loop
          autoplay
          style={{ width: 150, height: 150 }}
        />
      </div>
    );
  }

  /* ───────────────── ROUTE GUARDS (MOVED ABOVE App) ───────────────── */

  /* ───────────────── ROUTES ───────────────── */

  return (
    <div className="min-h-screen bg-white dark:bg-background-dark text-black dark:text-gray-100">
      <Routes>

        {/* PUBLIC - Redirect to dashboard if logged in */}
        <Route
          path="/"
          element={
            <PublicRoute user={user} isLoading={isLoading}>
              <LandingPage onToggleTheme={toggleTheme} isDarkMode={isDarkMode} />
            </PublicRoute>
          }
        />

        <Route
          path="/signup"
          element={
            <PublicRoute user={user} isLoading={isLoading}>
              <SignupPage onSignupSuccess={handlePostSignup} />
            </PublicRoute>
          }
        />

        <Route path="/verify-email" element={<VerifyEmailPage onVerified={handleVerificationSuccess} />} />

        {/* PAYMENT */}
        <Route
          path="/confirm-payment"
          element={
            <RequireAuth user={user}>
              <ConfirmPaymentPage
                onPaymentSuccess={handlePaymentSuccess}
                onToggleTheme={toggleTheme}
                isDarkMode={isDarkMode}
              />
            </RequireAuth>
          }
        />

        {/* CANDIDATE */}
        <Route
          path="/candidate/onboarding"
          element={
            <RequireCandidate user={user}>
              <CandidateOnboarding
                onOnboardingSuccess={handleOnboardingSuccess}
                onToggleTheme={toggleTheme}
                isDarkMode={isDarkMode}
              />
            </RequireCandidate>
          }
        />

        <Route
          path="/candidate"
          element={
            <RequireCandidate user={user}>
              <CandidateDashboard onToggleTheme={toggleTheme} isDarkMode={isDarkMode} />
            </RequireCandidate>
          }
        />

        <Route path="/candidate/jobs" element={<JobsPage onToggleTheme={toggleTheme} isDarkMode={isDarkMode} />} />
        <Route path="/candidate/campus" element={<RequireCandidate user={user}><CampusConnectPage onToggleTheme={toggleTheme} isDarkMode={isDarkMode} /></RequireCandidate>} />
        <Route path="/candidate/test" element={<RequireCandidate user={user}><CampusConnectTestPage onToggleTheme={toggleTheme} isDarkMode={isDarkMode} /></RequireCandidate>} />
        <Route path="/candidate/profile" element={<RequireCandidate user={user}><ProfilePage onToggleTheme={toggleTheme} isDarkMode={isDarkMode} /></RequireCandidate>} />
        <Route path="/candidate/applications" element={<RequireCandidate user={user}><ApplicationsPage onToggleTheme={toggleTheme} isDarkMode={isDarkMode} /></RequireCandidate>} />
        <Route path="/candidate/settings" element={<RequireCandidate user={user}><SettingsPage role="candidate" onToggleTheme={toggleTheme} isDarkMode={isDarkMode} onLogout={handleLogout} /></RequireCandidate>} />

        {/* RECRUITER */}
        <Route path="/recruiter" element={<RequireRecruiter user={user}><RecruiterDashboard onToggleTheme={toggleTheme} isDarkMode={isDarkMode} isPremium={user?.isPremium ?? false} /></RequireRecruiter>} />
        <Route path="/recruiter/talent" element={<RequireRecruiter user={user}><TalentPipelinePage onToggleTheme={toggleTheme} isDarkMode={isDarkMode} /></RequireRecruiter>} />
        <Route path="/recruiter/reports" element={<RequireRecruiter user={user}><RecruiterReportsPage onToggleTheme={toggleTheme} isDarkMode={isDarkMode} /></RequireRecruiter>} />
        <Route path="/recruiter/settings" element={<RequireRecruiter user={user}><SettingsPage role="recruiter" onToggleTheme={toggleTheme} isDarkMode={isDarkMode} onLogout={handleLogout} /></RequireRecruiter>} />
        <Route path="/post-job" element={<RequireRecruiter user={user}><PostJobPage onToggleTheme={toggleTheme} isDarkMode={isDarkMode} isPremium={user?.isPremium ?? false} /></RequireRecruiter>} />

        {/* ADMIN */}
        <Route path="/admin" element={<RequireAdmin user={user}><AdminPortal onToggleTheme={toggleTheme} isDarkMode={isDarkMode} /></RequireAdmin>} />

        {/* SHARED */}
        <Route path="/job/:id" element={<JobDetailsPage onToggleTheme={toggleTheme} isDarkMode={isDarkMode} />} />

        {/* PUBLIC STATIC */}
        <Route path="/about" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />

        {/* FALLBACK */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>


      <Analytics />
      <SpeedInsights />
      <AsterixAssistant />
    </div>
  );
};

export default App;