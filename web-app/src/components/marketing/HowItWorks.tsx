import { marketingCopy } from '../../data/marketing-copy';

/** Inline SVG icons for the horizontal 4-step flow */
const FLOW_ICONS = [
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
  // 4. Support delivered — leaf
  <svg key="4" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 36c0-12 9-22 26-23-1 17-11 26-23 26-1 0-2 0-3-1z"/>
    <path d="M11 37c5-7 13-12 22-15"/>
  </svg>,
];

/** Dashed arrow SVG between flow steps (verbatim from design HTML lines 635–639) */
function FlowArrow() {
  return (
    <div className="flex items-center justify-center" style={{ height: '84px' }} aria-hidden="true">
      <svg
        viewBox="0 0 56 14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ width: '56px', height: '14px' }}
      >
        <path d="M2 7 h44" strokeDasharray="2 4"/>
        <path d="M44 3 l6 4 -6 4"/>
      </svg>
    </div>
  );
}

export default function HowItWorks() {
  const { titleA, titleEm, lead, steps, flowTitleA, flowTitleEm, flowSteps } = marketingCopy.how;

  return (
    <section
      id="setup"
      className="py-[120px] bg-marketing-cream2 border-t border-marketing-lineSoft border-b scroll-mt-24"
    >
      <div className="max-w-[1400px] mx-auto px-8">
        <h2 className="font-serif text-[56px] leading-[1.05] tracking-[-1.4px] text-marketing-green-900 font-medium text-center max-w-[880px] mx-auto mb-6">
          {titleA}
          <em className="italic text-marketing-green-600">{titleEm}</em>
        </h2>
        <p className="text-[18px] text-marketing-inkSoft max-w-none mx-auto mb-8 leading-[1.6] text-center">
          {lead}
        </p>

        {/* 3-step grid */}
        <div
          className="grid max-w-[1320px] mx-auto rounded-[16px] overflow-hidden border border-marketing-line"
          style={{
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '1px',
            background: 'rgba(39,80,10,0.12)',
          }}
        >
          {steps.map((step) => (
            <div
              key={step.num}
              className="bg-marketing-warmWhite px-8 py-10 pb-9 flex flex-col gap-3"
            >
              <div className="flex items-baseline gap-3">
                <span className="font-serif text-[28px] text-marketing-green-600 font-medium leading-[1.25] italic shrink-0">
                  {step.num}
                </span>
                <h3 className="font-serif text-[22px] text-marketing-green-900 font-medium tracking-[-0.2px] leading-[1.25] m-0">
                  {step.title}
                </h3>
              </div>
              <p className="text-[15px] text-marketing-inkSoft leading-[1.65]">{step.body}</p>
              <div className="pt-1 flex items-center gap-[10px] font-mono text-[11px] text-marketing-inkMuted tracking-[0.5px]">
                {step.iconRow}
              </div>
            </div>
          ))}
        </div>

        {/* Horizontal 4-step detection flow */}
        <div className="max-w-[1320px] mx-auto mt-24 pt-4">
          <h3 className="font-serif text-[28px] leading-[1.2] text-marketing-green-900 font-medium tracking-[-0.4px] text-center mb-10">
            {flowTitleA}
            <em className="italic text-marketing-green-600">{flowTitleEm}</em>
            , in seconds.
          </h3>

          {/* 4 steps with dashed arrows between */}
          <div
            className="grid items-start gap-[18px]"
            style={{ gridTemplateColumns: '1fr auto 1fr auto 1fr auto 1fr' }}
          >
            {flowSteps.map((fStep, idx) => (
              <>
                <div
                  key={fStep.num}
                  className="flex flex-col items-center text-center px-2"
                >
                  <div
                    className="w-[84px] h-[84px] rounded-full bg-marketing-warmWhite border border-marketing-line flex items-center justify-center text-marketing-green-800 mb-[22px] shadow-[0_4px_14px_-6px_rgba(23,52,4,0.15)]"
                    aria-hidden="true"
                  >
                    <span className="w-10 h-10">{FLOW_ICONS[idx]}</span>
                  </div>
                  <h4 className="font-serif text-[19px] leading-[1.25] text-marketing-green-900 font-medium m-0 mb-[10px] tracking-[-0.3px]">
                    <span className="text-marketing-inkSoft font-normal mr-1">{fStep.num}</span>
                    {fStep.title}
                  </h4>
                  <p className="text-[14px] leading-[1.55] text-marketing-inkSoft m-0 max-w-[240px]">
                    {fStep.body}
                  </p>
                </div>
                {idx < flowSteps.length - 1 && <FlowArrow key={`arrow-${idx}`} />}
              </>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
