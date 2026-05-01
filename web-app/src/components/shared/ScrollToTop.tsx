/**
 * ScrollToTop — placed inside <BrowserRouter>, scrolls the window to the
 * top on every pathname change. React Router's default is to preserve the
 * previous scroll position; for routes that present a fresh page (e.g.
 * Marketing → Dashboard via the Login email gate) that produced a jarring
 * "loaded mid-page" effect.
 */

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname]);
  return null;
}
