import { marketingCopy } from '../../data/marketing-copy';

export default function VsWearables() {
  const { eyebrow, titleA, titleEm, lead, them, us, pullA, pullEm } = marketingCopy.vs;

  return (
    <section id="why" className="py-[120px] bg-marketing-cream2 border-t border-marketing-lineSoft">
      <div className="max-w-[1200px] mx-auto px-8">
        <span className="block font-mono text-[11px] tracking-[2px] uppercase text-marketing-green-600 mb-5 text-center">
          {eyebrow}
        </span>
        <h2 className="font-serif text-[56px] leading-[1.05] tracking-[-1.4px] text-marketing-green-900 font-medium text-center max-w-[880px] mx-auto mb-6">
          {titleA}
          <em className="italic text-marketing-green-600">{titleEm}</em>
        </h2>
        <p className="text-[18px] text-marketing-inkSoft max-w-[640px] mx-auto mb-16 leading-[1.6] text-center">
          {lead}
        </p>

        {/* 2-column us-vs-them grid */}
        <div
          className="grid max-w-[1080px] mx-auto border border-marketing-line rounded-[18px] overflow-hidden bg-marketing-cream"
          style={{ gridTemplateColumns: '1fr 1fr' }}
        >
          {/* Them column */}
          <div className="px-10 py-11 bg-marketing-cream border-r border-marketing-line">
            <div className="font-mono text-[11px] tracking-[1.5px] uppercase text-marketing-inkMuted mb-[18px]">
              {them.label}
            </div>
            <h3 className="font-serif text-[28px] text-marketing-green-900 mb-[6px] font-medium tracking-[-0.3px]">
              {them.titleA}
              <em className="italic text-marketing-green-600">{them.titleEm}</em>
            </h3>
            <p className="text-[14px] text-marketing-inkMuted mb-6">{them.sub}</p>
            <ul className="list-none p-0">
              {them.bullets.map((bullet) => (
                <li
                  key={bullet}
                  className="flex gap-3 items-start py-[14px] text-[14.5px] leading-[1.55] text-marketing-inkSoft border-b border-marketing-lineSoft last:border-b-0"
                >
                  <span className="text-marketing-inkMuted flex-none w-4" aria-hidden="true">—</span>
                  {bullet}
                </li>
              ))}
            </ul>
          </div>

          {/* Us column */}
          <div className="px-10 py-11 bg-marketing-green-50">
            <div className="font-mono text-[11px] tracking-[1.5px] uppercase text-marketing-green-600 mb-[18px]">
              {us.label}
            </div>
            <h3 className="font-serif text-[28px] text-marketing-green-900 mb-[6px] font-medium tracking-[-0.3px]">
              {us.titleA}
              <em className="italic text-marketing-green-600">{us.titleEm}</em>
            </h3>
            <p className="text-[14px] text-marketing-inkMuted mb-6">{us.sub}</p>
            <ul className="list-none p-0">
              {us.bullets.map((bullet) => (
                <li
                  key={bullet}
                  className="flex gap-3 items-start py-[14px] text-[14.5px] leading-[1.55] text-marketing-ink border-b border-marketing-lineSoft last:border-b-0"
                >
                  <span className="text-marketing-green-600 font-bold flex-none w-4" aria-hidden="true">✓</span>
                  {bullet}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Pull quote */}
        <div className="max-w-[760px] mx-auto mt-14 text-center px-8 py-8">
          <p className="font-serif text-[26px] text-marketing-green-900 leading-[1.4] font-normal">
            {pullA}
            <em className="italic text-marketing-green-600">{pullEm}</em>
          </p>
        </div>
      </div>
    </section>
  );
}
