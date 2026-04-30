import HeroSlideshow from './HeroSlideshow';
import { marketingCopy } from '../../data/marketing-copy';

export default function HeroMockup() {
  const {
    badgeLabel,
    headlineA,
    headlineEm,
    headlineB,
    body,
    stats,
  } = marketingCopy.heroMockup;

  return (
    <section className="py-14 pb-20">
      <div className="max-w-[1200px] mx-auto px-8">
        <div
          className="max-w-[1080px] mx-auto bg-marketing-warmWhite border border-marketing-line rounded-[24px] p-12 shadow-[0_30px_60px_-30px_rgba(23,52,4,0.25),0_8px_24px_-8px_rgba(23,52,4,0.08)] relative"
        >
          <div className="grid gap-14 items-center" style={{ gridTemplateColumns: '1fr 1.2fr' }}>
            {/* Left: text content */}
            <div className="flex flex-col gap-6">
              {/* Live badge */}
              <span className="inline-flex items-center gap-2 px-3 py-[6px] bg-marketing-green-50 rounded-full font-mono text-[11px] text-marketing-green-700 tracking-[0.5px] self-start">
                <span className="w-[6px] h-[6px] rounded-full bg-marketing-green-400 animate-pulse" aria-hidden="true" />
                {badgeLabel}
              </span>

              {/* Headline */}
              <h2 className="font-serif text-[32px] leading-[1.2] text-marketing-green-900 font-medium tracking-[-0.5px]">
                {headlineA}
                <em className="italic text-marketing-green-600">{headlineEm}</em>
                {headlineB}
              </h2>

              {/* Body */}
              <p className="text-[15px] text-marketing-inkSoft leading-[1.6]">{body}</p>

              {/* Stats row */}
              <div className="flex gap-8 pt-5 border-t border-marketing-line">
                {stats.map((stat) => (
                  <div key={stat.label} className="flex flex-col gap-[2px]">
                    <span className="font-serif text-[28px] text-marketing-green-900 font-semibold tracking-[-0.5px]">
                      {/* The num from copy is e.g. "8min", "$9", "0" */}
                      {stat.num.includes('min') ? (
                        <>
                          <em className="italic text-marketing-green-600 font-medium">
                            {stat.num.replace('min', '')}
                          </em>
                          min
                        </>
                      ) : stat.num === '0' ? (
                        <><em className="italic text-marketing-green-600 font-medium">0</em></>
                      ) : (
                        stat.num
                      )}
                    </span>
                    <span className="text-[12px] text-marketing-inkMuted">{stat.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: slideshow */}
            <div>
              <HeroSlideshow />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
