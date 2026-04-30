import MarketingLogo from './MarketingLogo';
import { marketingCopy } from '../../data/marketing-copy';

function WaitlistCta({ label, className }: { label: string; className: string }) {
  const waitlistUrl = import.meta.env.VITE_WAITLIST_URL as string | undefined;
  if (waitlistUrl) {
    return (
      <a
        href={waitlistUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        {label}
      </a>
    );
  }
  return (
    <button disabled title="Coming soon" className={className}>
      {label}
    </button>
  );
}

export default function MarketingNav() {
  const { brand, links, ctaLabel } = marketingCopy.nav;

  return (
    <nav className="py-5 border-b border-marketing-lineSoft sticky top-0 bg-white/[0.94] backdrop-blur-[12px] z-50">
      <div className="max-w-[1200px] mx-auto px-8 flex justify-between items-center gap-6">
        {/* Logo */}
        <div className="flex items-center gap-[10px] font-serif text-[22px] text-marketing-green-900 tracking-[-0.4px] font-medium">
          <MarketingLogo size={28} />
          {brand}
        </div>

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

        {/* CTA */}
        <WaitlistCta
          label={ctaLabel}
          className="bg-marketing-green-800 text-marketing-cream px-[18px] py-[10px] rounded-full text-sm font-medium hover:bg-marketing-green-900 transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
        />
      </div>
    </nav>
  );
}
