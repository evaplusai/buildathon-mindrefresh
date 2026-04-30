import Logo from '../shared/Logo';
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

export default function FinalCta() {
  const { titleA, titleEm, titleB, body, ctaLabel, checks } = marketingCopy.finalCta;

  return (
    <section id="cta" className="py-[120px] bg-marketing-green-50 text-center">
      <div className="max-w-[1200px] mx-auto px-8">
        {/* Logo mark — larger version matching design (80×80) */}
        <div className="w-20 h-20 mx-auto mb-8">
          <Logo size={80} />
        </div>

        <h2 className="font-serif text-[64px] leading-[1.05] text-marketing-green-900 font-medium tracking-[-1.5px] mb-6 max-w-[820px] mx-auto">
          {titleA}
          <em className="italic text-marketing-green-600">{titleEm}</em>
          {titleB}
        </h2>

        <p className="text-[18px] text-marketing-inkSoft mb-9 max-w-[540px] mx-auto leading-[1.55]">
          {body}
        </p>

        <WaitlistCta
          label={ctaLabel}
          className="inline-block bg-marketing-green-800 text-marketing-cream px-9 py-[18px] rounded-full text-[16px] font-semibold border-none cursor-pointer shadow-[0_8px_20px_-8px_rgba(23,52,4,0.4)] hover:bg-marketing-green-900 hover:-translate-y-px transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
        />

        {/* Checks row */}
        <div className="flex justify-center gap-8 mt-8 flex-wrap text-[14px] text-marketing-inkSoft">
          {checks.map((check) => (
            <div key={check} className="flex items-center gap-2">
              <span className="text-marketing-green-600 font-bold" aria-hidden="true">✓</span>
              {check}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
