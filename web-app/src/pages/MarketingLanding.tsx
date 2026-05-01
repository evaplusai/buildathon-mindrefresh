import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import MarketingLayout from '../components/marketing/MarketingLayout';
import Banner from '../components/marketing/Banner';
import MarketingNav from '../components/marketing/MarketingNav';
import Hero from '../components/marketing/Hero';
import ManifestoBand from '../components/marketing/ManifestoBand';
import HeroMockup from '../components/marketing/HeroMockup';
import StatsBand from '../components/marketing/StatsBand';
import ProblemSection from '../components/marketing/ProblemSection';
import HowItWorks from '../components/marketing/HowItWorks';
import LiveDemo from '../components/marketing/LiveDemo';
import VsWearables from '../components/marketing/VsWearables';
import Testimonials from '../components/marketing/Testimonials';
import IsntList from '../components/marketing/IsntList';
import FinalCta from '../components/marketing/FinalCta';
import MarketingFooter from '../components/marketing/MarketingFooter';
import WaitlistModal from '../components/marketing/WaitlistModal';
import { WaitlistProvider } from '../components/marketing/waitlistContext';
import type { WaitlistSource } from '../services/waitlist';
import { useCallback, useState } from 'react';

/**
 * MarketingLanding — the public root route ("/").
 *
 * ADR-012 §Forwarding rules (option B): if the URL carries ?source= or
 * ?dev=, forward transparently to /dashboard with the same search string
 * so that demo links from before the route restructure continue to work.
 */
export default function MarketingLanding() {
  const navigate = useNavigate();
  const { search } = useLocation();
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [waitlistSource, setWaitlistSource] = useState<WaitlistSource>('other');
  const openWaitlist = useCallback((source: WaitlistSource) => {
    setWaitlistSource(source);
    setWaitlistOpen(true);
  }, []);
  const closeWaitlist = useCallback(() => setWaitlistOpen(false), []);

  useEffect(() => {
    const prev = document.title;
    document.title = 'MindRefresh — Catch the crash before it catches you.';
    return () => {
      document.title = prev;
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(search);
    if (params.has('source') || params.has('dev')) {
      navigate(`/dashboard${search}`, { replace: true });
    }
  }, [search, navigate]);

  return (
    <MarketingLayout>
      <WaitlistProvider open={openWaitlist}>
        <Banner />
        <MarketingNav />
        <Hero />
        <ManifestoBand />
        <HeroMockup />
        <StatsBand />
        <ProblemSection />
        <HowItWorks />
        <LiveDemo />
        <VsWearables />
        <Testimonials />
        <IsntList />
        <FinalCta />
        <MarketingFooter />
        <WaitlistModal
          isOpen={waitlistOpen}
          source={waitlistSource}
          onClose={closeWaitlist}
          onSuccess={() => {
            setWaitlistOpen(false);
            navigate('/dashboard');
          }}
        />
      </WaitlistProvider>
    </MarketingLayout>
  );
}
