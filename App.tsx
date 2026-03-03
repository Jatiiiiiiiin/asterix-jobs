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
import './App.css';

/* Components */

import PublicRoute from "./views/PublicRoute";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";



const App: React.FC = () => {
  const navigate = useNavigate();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);


  useEffect(() => {
    const saved = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

    if (saved === "dark" || (!saved && prefersDark)) {
      document.documentElement.classList.add("dark");
      setIsDarkMode(true);
    }
  }, []);

  const toggleTheme = () => {
    setIsDarkMode(prev => {
      const next = !prev;
      document.documentElement.classList.toggle("dark", next);
      localStorage.setItem("theme", next ? "dark" : "light");
      return next;
    });
  };

  /* ───────────────── AUTH HYDRATION ───────────────── */

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async firebaseUser => {
      if (!firebaseUser) {
        setUser(null);
        setIsLoading(false);
        return;
      }

      try {
        const fullUser = await authService.getCurrentUser();
        setUser(fullUser);

        // --- HYDRATION REDIRECTION ---
        // If user is logged in but hasn't completed specific steps, redirect them
        if (fullUser) {
          const path = window.location.pathname;

          if (!fullUser.emailVerified && path !== '/verify-email') {
            console.log("[Auth] Redirecting to verification (hydration)...");
            navigate("/verify-email", { replace: true });
          } else if (fullUser.emailVerified && !fullUser.isOnboarded && fullUser.role === 'candidate' && path !== '/candidate/onboarding') {
            console.log("[Auth] Redirecting to onboarding (hydration)...");
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

  /* ───────────────── POST SIGNUP ───────────────── */

  const handlePostSignup = useCallback((authUser: AuthUser, isNewSignup = false) => {
    setUser(authUser);

    const intent = localStorage.getItem("auth_intent");

    // 1. Verification First
    if (!authUser.emailVerified) {
      console.log("[Auth] Redirecting to verification...");
      navigate("/verify-email", { replace: true });
      return;
    }

    // 2. Onboarding Second (for Candidates)
    if (authUser.role === "candidate" && !authUser.isOnboarded) {
      console.log("[Auth] Redirecting to onboarding...");
      navigate("/candidate/onboarding", { replace: true });
      return;
    }

    // 3. Role-based Dashboards
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

    // Default Dashboard
    navigate("/candidate", { replace: true });
  }, [navigate]);

  /* ───────────────── POST PAYMENT ───────────────── */

  const handlePaymentSuccess = useCallback(async () => {
    try {
      const updatedUser = await authService.getCurrentUser();
      setUser(updatedUser);

      localStorage.removeItem("auth_intent");
      localStorage.removeItem("selected_plan");

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

  /* ───────────────── POST ONBOARDING ───────────────── */

  const handleOnboardingSuccess = useCallback(async () => {
    const updatedUser = await authService.getCurrentUser();
    setUser(updatedUser);
    navigate("/candidate", { replace: true });
  }, [navigate]);

  /* ───────────────── POST VERIFICATION ───────────────── */

  const handleVerificationSuccess = useCallback(async () => {
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

  /* ───────────────── ROUTE GUARDS ───────────────── */

  const RequireAuth = ({ children }: { children: ReactNode }) => {
    if (!user) return <Navigate to="/signup" replace />;
    return <>{children}</>;
  };

  const RequireCandidate = ({ children }: { children: ReactNode }) => {
    if (!user) return <Navigate to="/signup" replace />;
    if (user.role !== "candidate" && user.role !== "admin") return <Navigate to="/signup" replace />;
    return <>{children}</>;
  };

  const RequireRecruiter = ({ children }: { children: ReactNode }) => {
    if (!user) return <Navigate to="/signup" replace />;
    if (user.role !== "recruiter") return <Navigate to="/signup" replace />;
    return <>{children}</>;
  };

  const RequireAdmin = ({ children }: { children: ReactNode }) => {
    if (!user) return <Navigate to="/signup" replace />;
    if (user.role !== "admin") return <Navigate to="/signup" replace />;
    return <>{children}</>;
  };

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
            <RequireAuth>
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
            <RequireCandidate>
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
            <RequireCandidate>
              <CandidateDashboard onToggleTheme={toggleTheme} isDarkMode={isDarkMode} />
            </RequireCandidate>
          }
        />

        <Route path="/candidate/jobs" element={<RequireCandidate><JobsPage onToggleTheme={toggleTheme} isDarkMode={isDarkMode} /></RequireCandidate>} />
        <Route path="/candidate/profile" element={<RequireCandidate><ProfilePage onToggleTheme={toggleTheme} isDarkMode={isDarkMode} /></RequireCandidate>} />
        <Route path="/candidate/applications" element={<RequireCandidate><ApplicationsPage onToggleTheme={toggleTheme} isDarkMode={isDarkMode} /></RequireCandidate>} />
        <Route path="/candidate/settings" element={<RequireCandidate><SettingsPage role="candidate" onToggleTheme={toggleTheme} isDarkMode={isDarkMode} onLogout={handleLogout} /></RequireCandidate>} />

        {/* RECRUITER */}
        <Route path="/recruiter" element={<RequireRecruiter><RecruiterDashboard onToggleTheme={toggleTheme} isDarkMode={isDarkMode} isPremium={user?.isPremium ?? false} /></RequireRecruiter>} />
        <Route path="/recruiter/talent" element={<RequireRecruiter><TalentPipelinePage onToggleTheme={toggleTheme} isDarkMode={isDarkMode} /></RequireRecruiter>} />
        <Route path="/recruiter/reports" element={<RequireRecruiter><RecruiterReportsPage onToggleTheme={toggleTheme} isDarkMode={isDarkMode} /></RequireRecruiter>} />
        <Route path="/recruiter/settings" element={<RequireRecruiter><SettingsPage role="recruiter" onToggleTheme={toggleTheme} isDarkMode={isDarkMode} onLogout={handleLogout} /></RequireRecruiter>} />
        <Route path="/post-job" element={<RequireRecruiter><PostJobPage onToggleTheme={toggleTheme} isDarkMode={isDarkMode} isPremium={user?.isPremium ?? false} /></RequireRecruiter>} />

        {/* ADMIN */}
        <Route path="/admin" element={<RequireAdmin><AdminPortal onToggleTheme={toggleTheme} isDarkMode={isDarkMode} /></RequireAdmin>} />

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
    </div>
  );
};

export default App;