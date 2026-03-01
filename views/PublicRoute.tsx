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
    return <>{children}</>;
  }

  // User is logged in - check payment flow
  const intent = localStorage.getItem('auth_intent');

  // CRITICAL: If buy_plan intent, only allow on /signup page during form submission
  // Once navigated away from /signup, other guards will handle routing
  if (intent === 'buy_plan' && location.pathname === '/signup') {
    return <>{children}</>;
  }



  if (user.role === 'admin') {
    return <Navigate to="/admin" replace />;
  }

  if (user.role === 'recruiter') {
    return <Navigate to="/recruiter" replace />;
  }

  // Candidate
  if (user.isOnboarded) {
    return <Navigate to="/candidate" replace />;
  }

  return <Navigate to="/candidate/onboarding" replace />;
};

export default PublicRoute;