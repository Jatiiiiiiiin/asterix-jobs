import React, { useEffect, useState, ReactNode } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";

import { auth } from "./firebase";
import { authService, AuthUser } from "./authService";

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
import './App.css';

/* Components */
import AIChatOverlay from "./components/AIChatOverlay";
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
      } catch (error) {
        console.error('[❌ App] Error hydrating user:', error);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    });

    return unsub;
  }, []);

  /* ───────────────── POST SIGNUP ───────────────── */

  const handlePostSignup = (authUser: AuthUser) => {
    setUser(authUser);

    const intent = localStorage.getItem("auth_intent");

    if (authUser.role === "recruiter") {
      localStorage.removeItem("auth_intent");
      navigate("/recruiter", { replace: true });
      return;
    }

    if (intent === "buy_plan") {
      navigate("/confirm-payment", { replace: true });
      return;
    }

    if (!authUser.isOnboarded) {
      navigate("/candidate/onboarding", { replace: true });
    } else {
      navigate("/candidate", { replace: true });
    }
  };

  /* ───────────────── POST PAYMENT ───────────────── */

  const handlePaymentSuccess = async () => {
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
  };

  /* ───────────────── POST ONBOARDING ───────────────── */

  const handleOnboardingSuccess = async () => {
    const updatedUser = await authService.getCurrentUser();
    setUser(updatedUser);
    navigate("/candidate", { replace: true });
  };

  /* ───────────────── POST VERIFICATION ───────────────── */

  const handleVerificationSuccess = async () => {
    const updatedUser = await authService.getCurrentUser();
    setUser(updatedUser);
    if (updatedUser) {
      handlePostSignup(updatedUser);
    }
  };

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
    if (user.role !== "candidate") return <Navigate to="/signup" replace />;
    return <>{children}</>;
  };

  const RequireRecruiter = ({ children }: { children: ReactNode }) => {
    if (!user) return <Navigate to="/signup" replace />;
    if (user.role !== "recruiter") return <Navigate to="/signup" replace />;
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

        {/* SHARED */}
        <Route path="/job/:id" element={<JobDetailsPage onToggleTheme={toggleTheme} isDarkMode={isDarkMode} />} />

        {/* FALLBACK */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <AIChatOverlay />
    </div>
  );
};

export default App;