import { Link } from 'react-router-dom';
import { marketingCopy } from '../../data/marketing-copy';

export default function LiveDemo() {
  const { eyebrow, titleA, titleEm, body, bullets, card } = marketingCopy.demo;

  return (
    <section className="py-[120px] bg-marketing-cream">
      <div className="max-w-[1200px] mx-auto px-8">
        <div
          className="grid gap-20 items-center max-w-[1100px] mx-auto"
          style={{ gridTemplateColumns: '1.1fr 1fr' }}
        >
          {/* Left: content */}
          <div className="demo-content">
            <span className="block font-mono text-[11px] tracking-[2px] uppercase text-marketing-green-600 mb-5">
              {eyebrow}
            </span>
            <h2 className="font-serif text-[44px] leading-[1.05] tracking-[-1.4px] text-marketing-green-900 font-medium text-left max-w-[540px] m-0 mb-5">
              {titleA}
              <em className="italic text-marketing-green-600">{titleEm}</em>
            </h2>
            {body.map((paragraph, i) => (
              <p key={i} className="text-[18px] text-marketing-inkSoft leading-[1.6] text-left mb-[18px] max-w-[480px]">
                {paragraph}
              </p>
            ))}
            <ul className="list-none p-0 mt-8 grid gap-[14px]">
              {bullets.map((bullet) => (
                <li
                  key={bullet.titleA}
                  className="flex gap-[14px] items-start text-[15px] text-marketing-inkSoft leading-[1.55]"
                >
                  <span
                    className="flex-none w-2 h-2 mt-2 rounded-full bg-marketing-green-300"
                    aria-hidden="true"
                  />
                  <span>
                    <strong className="text-marketing-green-900 font-semibold block mb-[2px]">
                      {bullet.titleA}
                    </strong>
                    {bullet.bodyA}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Right: demo card */}
          <div className="bg-marketing-warmWhite border border-marketing-line rounded-[18px] p-2 shadow-[0_30px_60px_-30px_rgba(23,52,4,0.3)]">
            {/* Dark inner card */}
            <div className="bg-marketing-green-900 rounded-[14px] p-7 text-marketing-green-50 relative overflow-hidden">
              {/* Card header */}
              <div className="flex justify-between items-center mb-[22px] pb-4 border-b border-[rgba(234,243,222,0.12)]">
                <div className="flex items-center gap-[10px] font-mono text-[11px] text-marketing-green-100 tracking-[0.5px]">
                  {/* Pulsing live dot with keyframe animation */}
                  <span
                    className="w-2 h-2 rounded-full bg-marketing-green-200"
                    style={{
                      animation: 'live 1.8s ease-out infinite',
                    }}
                    aria-hidden="true"
                  />
                  {/* Inline keyframes via style tag in the component */}
                  <style>{`
                    @keyframes live {
                      0% { box-shadow: 0 0 0 0 rgba(151,196,89,0.6); }
                      70% { box-shadow: 0 0 0 8px rgba(151,196,89,0); }
                      100% { box-shadow: 0 0 0 0 rgba(151,196,89,0); }
                    }
                  `}</style>
                  {' '}LIVE · STATE DETECTION
                </div>
                <div className="font-mono text-[11px] text-[rgba(234,243,222,0.5)]">14:42 · TUE</div>
              </div>

              {/* Alert row */}
              <div className="flex items-center gap-[10px] px-[14px] py-[10px] bg-[rgba(201,122,107,0.18)] border-l-[3px] border-marketing-rose rounded-[6px] mb-[22px] text-[13px] text-marketing-cream">
                <span className="font-mono text-[10px] px-[7px] py-[3px] bg-marketing-rose text-marketing-cream rounded font-bold tracking-[0.5px]">
                  {card.tagLabel}
                </span>
                {card.tagText}
              </div>

              {/* Message */}
              <p className="font-serif text-[22px] leading-[1.4] text-marketing-cream font-normal mb-6 tracking-[-0.2px]">
                {card.messageA}
                <em className="italic text-marketing-green-100">{card.messageEm}</em>
              </p>

              {/* Practice card */}
              <div className="p-[18px] bg-[rgba(234,243,222,0.06)] border border-[rgba(234,243,222,0.12)] rounded-[10px]">
                <div className="flex justify-between items-start mb-[14px] gap-3">
                  <div>
                    <div className="font-serif text-[16px] text-marketing-green-100 italic font-medium">
                      {card.practiceName}
                    </div>
                    <div className="font-mono text-[10px] text-[rgba(234,243,222,0.55)] tracking-[0.5px] uppercase">
                      {card.practiceMeta}
                    </div>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="h-1 bg-[rgba(234,243,222,0.1)] rounded-full overflow-hidden mb-[14px]">
                  <div className="w-[35%] h-full bg-marketing-green-200 rounded-full" />
                </div>
                {/* Begin → button — only in-app navigation from marketing surface */}
                <Link
                  to="/dashboard?source=recorded"
                  className="block w-full py-[11px] bg-marketing-green-50 text-marketing-green-900 text-center rounded-[8px] text-[13px] font-semibold no-underline"
                >
                  {card.ctaLabel}
                </Link>
              </div>
            </div>

            {/* Footer info */}
            <div className="mt-4 pl-1 flex gap-[6px] items-center font-mono text-[11px] text-marketing-inkMuted tracking-[0.3px]">
              <span aria-hidden="true">●</span>
              <span>{card.footerInfo}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
