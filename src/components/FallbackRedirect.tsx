import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export function FallbackRedirect() {
  const location = useLocation();
  const { user, loading } = useAuth();

  // If still loading auth, show nothing
  if (loading) {
    return null;
  }

  // If not authenticated, redirect to auth
  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // If authenticated, redirect to dashboard
  return <Navigate to="/dashboard" replace />;
}
