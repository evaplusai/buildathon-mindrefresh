import { marketingCopy } from '../../data/marketing-copy';
import { useWaitlist } from './waitlistContext';

/**
 * Banner — top early-access banner. Per ADR-019 §C, the CTA opens the
 * shared WaitlistModal (source: 'banner') instead of the deprecated
 * VITE_WAITLIST_URL anchor.
 */
export default function Banner() {
  const { eyebrow, ctaLabel } = marketingCopy.banner;
  const { open } = useWaitlist();
  return (
    <div className="bg-marketing-green-900 text-marketing-green-50 text-center px-6 py-3 text-sm font-normal">
      {eyebrow}
      <button
        type="button"
        onClick={() => open('banner')}
        className="text-marketing-green-100 underline underline-offset-[3px] font-medium hover:text-marketing-cream cursor-pointer bg-transparent border-0 p-0"
      >
        {ctaLabel}
      </button>
    </div>
  );
}
