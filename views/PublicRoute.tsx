import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AuthUser } from '../authService';

interface PublicRouteProps {
  children: ReactNode;
  user: AuthUser | null;
  isLoading: boolean;
}

const PublicRoute = ({ children, user, isLoading }: PublicRouteProps) => {
  const location = useLocation();

  // Show loading state while auth is being hydrated
  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  // No user logged in - allow access to public pages
  if (!user) {
    console.log('[🛡️ PublicRoute] ✅ No user, allowing access to:', location.pathname);
    return <>{children}</>;
  }

  // User is logged in - check payment flow
  const intent = localStorage.getItem('auth_intent');

  // CRITICAL: If buy_plan intent, only allow on /signup page during form submission
  // Once navigated away from /signup, other guards will handle routing
  if (intent === 'buy_plan' && location.pathname === '/signup') {
    console.log('[🛡️ PublicRoute] ✅ User in payment signup flow, allowing access');
    return <>{children}</>;
  }

  // User is logged in but NOT in payment flow - redirect to appropriate destination
  console.log('[🛡️ PublicRoute] ❌ User logged in, redirecting:', {
    role: user.role,
    isOnboarded: user.isOnboarded,
  });

  if (user.role === 'recruiter') {
    console.log('[🛡️ PublicRoute] → Redirecting recruiter to /recruiter');
    return <Navigate to="/recruiter" replace />;
  }

  // Candidate
  if (user.isOnboarded) {
    console.log('[🛡️ PublicRoute] → Redirecting onboarded candidate to /candidate');
    return <Navigate to="/candidate" replace />;
  }

  console.log('[🛡️ PublicRoute] → Redirecting new candidate to /candidate/onboarding');
  return <Navigate to="/candidate/onboarding" replace />;
};

export default PublicRoute;