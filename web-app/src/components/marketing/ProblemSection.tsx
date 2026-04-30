import { marketingCopy } from '../../data/marketing-copy';

export default function ProblemSection() {
  const { eyebrow, titleA, titleEm, lead, cards, callout } = marketingCopy.problem;

  return (
    <section id="problem" className="py-[120px] bg-marketing-cream">
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

        {/* Problem cards */}
        <div className="grid gap-12 max-w-[1080px] mx-auto" style={{ gridTemplateColumns: '1fr 1fr' }}>
          {cards.map((card) => (
            <div
              key={card.tag}
              className="bg-marketing-warmWhite border border-marketing-line rounded-[18px] px-9 py-10"
            >
              <div className="font-mono text-[10px] tracking-[1.5px] uppercase text-marketing-rose mb-4">
                {card.tag}
              </div>
              <h3 className="font-serif text-[28px] text-marketing-green-900 mb-4 font-medium leading-[1.2] tracking-[-0.3px]">
                {card.titleA}
                <em className="italic text-marketing-green-600">{card.titleEm}</em>
              </h3>
              <p className="text-[15.5px] text-marketing-inkSoft leading-[1.7] mb-6">
                {card.body}
              </p>
              <div className="pt-5 border-t border-marketing-line font-mono text-[12px] text-marketing-inkMuted tracking-[0.3px]">
                <strong className="text-marketing-green-900 font-bold text-[14px]">
                  {/* Bold prefix from stat (e.g. "8–12 minutes" or "Reactive") */}
                  {card.stat.split(' — ')[0]}
                </strong>
                {card.stat.includes(' — ') && ` — ${card.stat.split(' — ')[1]}`}
              </div>
            </div>
          ))}
        </div>

        {/* "You don't need another graph" callout */}
        <div className="mt-14 -mb-8 max-w-[1200px] mx-auto text-center px-4 pt-6">
          <p className="font-serif text-[38px] text-marketing-green-900 leading-[1.2] font-normal tracking-[-0.6px] whitespace-nowrap m-0">
            {callout.textA}
            <em className="italic text-marketing-green-600">{callout.textEm}</em>
            {' '}in the first place.
          </p>
          <small className="block mt-[10px] font-sans text-[14px] text-marketing-inkMuted not-italic">
            {callout.sub}
          </small>
        </div>
      </div>
    </section>
  );
}
