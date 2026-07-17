import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { getToken, hasValidToken } from '../services/api';

export function ProtectedRoute() {
  const location = useLocation();

  const hadToken = Boolean(getToken());
  if (!hasValidToken()) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}`, authExpired: hadToken }}
      />
    );
  }

  return <Outlet />;
}
