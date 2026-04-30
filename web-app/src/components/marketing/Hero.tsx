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

/** Inline SVG icons for the "Private by design" vertical steps */
const STEP_ICONS = [
  // 1. Signals sensed — wavy lines
  <svg key="1" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 18c3 0 3-4 6-4s3 4 6 4 3-4 6-4 3 4 6 4 3-4 6-4 3 4 6 4"/>
    <path d="M6 26c3 0 3-4 6-4s3 4 6 4 3-4 6-4 3 4 6 4 3-4 6-4 3 4 6 4"/>
    <path d="M6 34c3 0 3-4 6-4s3 4 6 4 3-4 6-4 3 4 6 4 3-4 6-4 3 4 6 4"/>
  </svg>,
  // 2. Patterns recognized — neural graph
  <svg key="2" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="24" cy="14" r="3"/>
    <circle cx="13" cy="33" r="3"/>
    <circle cx="24" cy="33" r="3"/>
    <circle cx="35" cy="33" r="3"/>
    <path d="M24 17v6M22 23l-9 7M24 23v7M26 23l9 7"/>
  </svg>,
  // 3. State shift detected — person with alert
  <svg key="3" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="22" cy="17" r="5"/>
    <path d="M12 36c0-5 4.5-9 10-9s10 4 10 9"/>
    <circle cx="34" cy="30" r="5.5"/>
    <path d="M34 27.5v3M34 33v.6"/>
  </svg>,
  // 4. Support delivered — leaf/nature
  <svg key="4" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 36c0-12 9-22 26-23-1 17-11 26-23 26-1 0-2 0-3-1z"/>
    <path d="M11 37c5-7 13-12 22-15"/>
  </svg>,
];

export default function Hero() {
  const { eyebrow, titleA, titleEm, subhead, primaryCta, secondaryCta, proofText, privacyPill } =
    marketingCopy.hero;
  const { eyebrow: stepsEyebrow, steps } = marketingCopy.heroSteps;

  return (
    <section className="pt-[72px] pb-6">
      <div className="max-w-[1200px] mx-auto px-8">
        {/* 2-column hero grid */}
        <div className="grid gap-12 mb-14" style={{ gridTemplateColumns: '0.62fr 1fr' }}>
          {/* Left — headline + CTA */}
          <div>
            {/* Eyebrow pill */}
            <div className="inline-flex items-center gap-[10px] font-mono text-[11px] tracking-[2px] uppercase text-marketing-green-800 bg-marketing-green-50 border border-marketing-green-200 px-4 py-2 rounded-full mb-6 font-semibold">
              <span className="w-[7px] h-[7px] rounded-full bg-marketing-green-600 shrink-0" aria-hidden="true" />
              {eyebrow}
            </div>

            {/* H1 */}
            <h1 className="font-serif text-[64px] leading-[1.04] tracking-[-1.8px] text-marketing-green-900 font-medium mb-7 max-w-[460px]">
              {titleA}
              <em className="italic font-medium text-marketing-green-600">{titleEm}</em>
            </h1>

            {/* Subhead */}
            <p className="text-[19px] text-marketing-inkSoft mb-4 leading-[1.55] max-w-[460px]">
              {subhead}
            </p>

            {/* CTA row */}
            <div className="flex gap-[14px] items-center flex-wrap mt-8 mb-9">
              <WaitlistCta
                label={primaryCta}
                className="bg-marketing-green-800 text-marketing-cream px-7 py-4 rounded-full text-[15px] font-semibold border-none cursor-pointer shadow-[0_8px_20px_-8px_rgba(23,52,4,0.4)] hover:bg-marketing-green-900 hover:-translate-y-px hover:shadow-[0_12px_24px_-8px_rgba(23,52,4,0.5)] transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
              />
              <a
                href="#how"
                className="text-marketing-green-800 px-6 py-4 text-[15px] font-medium border border-marketing-line rounded-full bg-marketing-cream hover:border-marketing-green-600 hover:text-marketing-green-900 transition-colors"
              >
                {secondaryCta}
              </a>
            </div>

            {/* Social proof */}
            <div className="flex items-center gap-[14px]">
              <div className="flex">
                {(['JL', 'MR', 'TK', 'SV', 'AC'] as const).map((initials, i) => {
                  const gradients = [
                    'from-[#C0DD97] to-[#639922]',
                    'from-[#EAF3DE] to-[#97C459]',
                    'from-[#97C459] to-[#3B6D11]',
                    'from-[#C8A878] to-[#8E6E3F]',
                    'from-[#639922] to-[#173404]',
                  ];
                  const textColors = [
                    'text-marketing-green-900',
                    'text-marketing-green-900',
                    'text-marketing-cream',
                    'text-marketing-cream',
                    'text-marketing-cream',
                  ];
                  return (
                    <div
                      key={initials}
                      className={`w-9 h-9 rounded-full border-2 border-marketing-cream ${i > 0 ? '-ml-[10px]' : ''} bg-gradient-to-br ${gradients[i]} flex items-center justify-center font-semibold ${textColors[i]} text-[13px]`}
                      aria-hidden="true"
                    >
                      {initials}
                    </div>
                  );
                })}
              </div>
              <div className="text-sm text-marketing-inkSoft leading-[1.4]">
                {proofText}
              </div>
            </div>

            {/* Privacy pill */}
            <div className="inline-flex items-center gap-[10px] mt-6 px-4 py-[10px] bg-marketing-green-50 border border-marketing-green-200 rounded-full text-[13px] text-marketing-green-900 leading-[1.4] max-w-[480px]">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="w-4 h-4 text-marketing-green-700 shrink-0"
              >
                <rect x="5" y="11" width="14" height="9" rx="2"/>
                <path d="M8 11V8a4 4 0 0 1 8 0v3"/>
              </svg>
              <span>{privacyPill}</span>
            </div>
          </div>

          {/* Right — room image + "Private by design" steps */}
          <div className="grid gap-7 items-stretch" style={{ gridTemplateColumns: '2.05fr 1fr' }}>
            {/* Room image */}
            <div
              className="w-full rounded-[22px] overflow-hidden shadow-[0_30px_60px_-25px_rgba(23,52,4,0.4),0_8px_24px_-8px_rgba(23,52,4,0.12)] bg-marketing-cream2"
              style={{ aspectRatio: '554 / 844' }}
            >
              <img
                src="/marketing/room-notices-v4.png"
                alt="The room notices first — MindRefresh sensor reading breath rhythm, micro-motion, and environmental sensing"
                width={554}
                height={844}
                loading="eager"
                fetchPriority="high"
                decoding="sync"
                className="w-full h-full object-cover block [image-rendering:auto] [image-rendering:high-quality]"
              />
            </div>

            {/* "Private by design" vertical panel */}
            <aside
              className="flex flex-col py-8"
              aria-label="How it works"
            >
              <div className="font-mono text-[11px] tracking-[2.5px] text-marketing-green-700 mb-7 shrink-0 uppercase">
                {stepsEyebrow}
              </div>
              <ol className="list-none p-0 m-0 flex-1 flex flex-col justify-between gap-[14px]">
                {steps.map((step, idx) => (
                  <>
                    <li key={step.num} className="grid gap-4 items-center" style={{ gridTemplateColumns: '56px 1fr' }}>
                      <div
                        className="w-14 h-14 rounded-full bg-marketing-cream2 border border-marketing-line flex items-center justify-center text-marketing-green-800 shrink-0"
                        aria-hidden="true"
                      >
                        <span className="w-7 h-7">{STEP_ICONS[idx]}</span>
                      </div>
                      <div>
                        <h4 className="font-serif text-[17px] leading-[1.25] text-marketing-green-900 font-medium m-0 tracking-[-0.2px] whitespace-nowrap">
                          <span className="text-marketing-inkSoft font-normal mr-[2px]">{step.num}</span>
                          {step.title}
                        </h4>
                        <p className="text-[13px] leading-[1.55] text-marketing-inkSoft mt-[6px]">
                          {step.body}
                        </p>
                      </div>
                    </li>
                    {/* Down-arrow connector between steps */}
                    {idx < steps.length - 1 && (
                      <li key={`connector-${idx}`} className="relative w-14 h-6 shrink-0" aria-hidden="true">
                        <span className="absolute top-0 left-[27.5px] w-0 border-l-[1.5px] border-dashed border-marketing-green-300 h-4 block" />
                        <span className="absolute top-[24px] left-[22px] text-marketing-green-600 text-[12px] leading-none">↓</span>
                      </li>
                    )}
                  </>
                ))}
              </ol>
            </aside>
          </div>
        </div>
      </div>
    </section>
  );
}
