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

export default function Banner() {
  const { eyebrow, ctaLabel } = marketingCopy.banner;
  return (
    <div className="bg-marketing-green-900 text-marketing-green-50 text-center px-6 py-3 text-sm font-normal">
      {eyebrow}
      <WaitlistCta
        label={ctaLabel}
        className="text-marketing-green-100 underline underline-offset-[3px] font-medium hover:text-marketing-cream cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
      />
    </div>
  );
}
