import { Navigate, useLocation } from 'react-router-dom';
import MarketingLanding from './MarketingLanding';

/**
 * MarketingRoot — mounts at `/`.
 *
 * Per ADR-012 Resolution B: if the URL carries `?source` or `?dev` query
 * params (legacy demo-URL patterns), forward transparently to
 * `/dashboard` preserving the search string, using `replace` so the back
 * button does not return the visitor to `/`.
 *
 * All other visitors see the marketing landing page.
 */
export default function MarketingRoot() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);

  if (params.has('source') || params.has('dev')) {
    return <Navigate to={`/dashboard${location.search}`} replace />;
  }

  return <MarketingLanding />;
}
