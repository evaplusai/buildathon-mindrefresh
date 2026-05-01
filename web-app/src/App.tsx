import { lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import MarketingRoot from './pages/MarketingRoot';
import AppEntry from './pages/AppEntry';
import NotFound from './pages/NotFound';
import ScrollToTop from './components/shared/ScrollToTop';

// Lazy-load the Dashboard so the marketing route does NOT pull in the
// sensing/state/intervention/memory worker stack on first paint.
// Per DDD-05 structural isolation invariant.
const Dashboard = lazy(() => import('./pages/Dashboard'));

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ScrollToTop />
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<MarketingRoot />} />
            <Route path="/_entry" element={<AppEntry />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
        <Toaster theme="dark" />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
