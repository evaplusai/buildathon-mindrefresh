import { Link, useNavigate } from 'react-router-dom';
import Logo from '../shared/Logo';
import { marketingCopy } from '../../data/marketing-copy';
import { getStoredEmail } from '../../services/waitlist';
import { useWaitlist } from './waitlistContext';

/**
 * MarketingNav — top navigation per ADR-013 + ADR-019.
 *
 * - Logo + brand text are wrapped in a <Link to="/"> so clicking the
 *   mark routes home (ADR-019 §A).
 * - The right-hand "Login" CTA gates entry to /dashboard behind an
 *   email capture (source: 'login-gate'). Once an email is stored in
 *   localStorage, subsequent clicks skip the gate and route directly.
 */
export default function MarketingNav() {
  const { brand, links, loginLabel } = marketingCopy.nav;
  const navigate = useNavigate();
  const { open } = useWaitlist();

  const handleLogin = () => {
    if (getStoredEmail()) {
      navigate('/dashboard');
    } else {
      open('login-gate');
    }
  };

  return (
    <nav className="py-5 border-b border-marketing-lineSoft sticky top-0 bg-white/[0.94] backdrop-blur-[12px] z-50">
      <div className="max-w-[1200px] mx-auto px-8 flex justify-between items-center gap-6">
        {/* Logo + brand — clickable, routes to / (ADR-019 §A) */}
        <Link
          to="/"
          aria-label="MindRefresh — home"
          className="flex items-center gap-[10px] font-serif text-[22px] text-marketing-green-900 tracking-[-0.4px] font-medium hover:opacity-80 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-marketing-green-600 rounded"
        >
          <Logo size={28} />
          {brand}
        </Link>

        {/* Nav links — hidden on small screens (mobile handled by design CSS) */}
        <div className="hidden md:flex gap-8 text-sm text-marketing-inkSoft font-medium">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="hover:text-marketing-green-800 transition-colors"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Login CTA → email-gate → /dashboard */}
        <button
          type="button"
          onClick={handleLogin}
          className="bg-marketing-green-800 text-marketing-cream px-[18px] py-[10px] rounded-full text-sm font-medium hover:bg-marketing-green-900 transition-colors cursor-pointer"
        >
          {loginLabel}
        </button>
      </div>
    </nav>
  );
}
