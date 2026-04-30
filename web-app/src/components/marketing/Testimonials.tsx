import { marketingCopy } from '../../data/marketing-copy';

/** Avatar gradient backgrounds matching the design HTML verbatim */
const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #C0DD97, #639922)',
  'linear-gradient(135deg, #97C459, #173404)',
];

export default function Testimonials() {
  const { eyebrow, titleA, titleEm, lead, cards } = marketingCopy.testimonials;

  return (
    <section className="py-[120px] bg-marketing-cream">
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

        <div
          className="grid gap-8 max-w-[1080px] mx-auto"
          style={{ gridTemplateColumns: '1fr 1fr' }}
        >
          {/* Card 1 */}
          <div className="bg-marketing-warmWhite border border-marketing-line rounded-[18px] overflow-hidden">
            {/* Decorative image area — SVG gradient verbatim from design HTML lines 791–807 */}
            <div
              className="relative overflow-hidden"
              style={{ aspectRatio: '16 / 9', background: 'linear-gradient(135deg, #C0DD97 0%, #3B6D11 100%)' }}
            >
              <svg
                viewBox="0 0 400 225"
                preserveAspectRatio="xMidYMid slice"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="ti1" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#C0DD97"/>
                    <stop offset="100%" stopColor="#2F5A0D"/>
                  </linearGradient>
                </defs>
                <rect width="400" height="225" fill="url(#ti1)"/>
                <g opacity="0.35" fill="#173404">
                  <ellipse cx="280" cy="100" rx="38" ry="44"/>
                  <path d="M 220 225 Q 220 165 280 155 Q 340 165 340 225 Z"/>
                </g>
                <g opacity="0.15" stroke="#FBF9F2" strokeWidth="0.5" fill="none">
                  <path d="M 0 80 Q 100 60 200 80 T 400 80"/>
                  <path d="M 0 130 Q 100 110 200 130 T 400 130"/>
                </g>
              </svg>
            </div>
            <div className="px-8 pt-7 pb-8">
              <div className="text-marketing-green-400 text-[14px] tracking-[2px] mb-[14px]">★★★★★</div>
              <p className="font-serif text-[18px] leading-[1.55] text-marketing-green-900 italic mb-6 font-normal">
                &ldquo;{cards[0].quote}&rdquo;
              </p>
              <div className="flex items-center gap-3 pt-[18px] border-t border-marketing-lineSoft">
                <div
                  className="w-10 h-10 rounded-full shrink-0"
                  style={{ background: AVATAR_GRADIENTS[0] }}
                  aria-hidden="true"
                />
                <div>
                  <div className="text-[14px] text-marketing-green-900 font-semibold">{cards[0].name}</div>
                  <div className="text-[13px] text-marketing-inkMuted">{cards[0].meta}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2 */}
          <div className="bg-marketing-warmWhite border border-marketing-line rounded-[18px] overflow-hidden">
            {/* Decorative image area — SVG gradient verbatim from design HTML lines 823–840 */}
            <div
              className="relative overflow-hidden"
              style={{ aspectRatio: '16 / 9', background: 'linear-gradient(135deg, #EAF3DE 0%, #97C459 60%, #2F5A0D 100%)' }}
            >
              <svg
                viewBox="0 0 400 225"
                preserveAspectRatio="xMidYMid slice"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="ti2" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#EAF3DE"/>
                    <stop offset="100%" stopColor="#3B6D11"/>
                  </linearGradient>
                </defs>
                <rect width="400" height="225" fill="url(#ti2)"/>
                <g opacity="0.3" fill="#173404">
                  <ellipse cx="120" cy="105" rx="36" ry="42"/>
                  <path d="M 60 225 Q 60 168 120 158 Q 180 168 180 225 Z"/>
                </g>
                <g opacity="0.18" stroke="#173404" strokeWidth="0.5" fill="none">
                  <circle cx="280" cy="120" r="40"/>
                  <circle cx="280" cy="120" r="60"/>
                  <circle cx="280" cy="120" r="80"/>
                </g>
              </svg>
            </div>
            <div className="px-8 pt-7 pb-8">
              <div className="text-marketing-green-400 text-[14px] tracking-[2px] mb-[14px]">★★★★★</div>
              <p className="font-serif text-[18px] leading-[1.55] text-marketing-green-900 italic mb-6 font-normal">
                &ldquo;{cards[1].quote}&rdquo;
              </p>
              <div className="flex items-center gap-3 pt-[18px] border-t border-marketing-lineSoft">
                <div
                  className="w-10 h-10 rounded-full shrink-0"
                  style={{ background: AVATAR_GRADIENTS[1] }}
                  aria-hidden="true"
                />
                <div>
                  <div className="text-[14px] text-marketing-green-900 font-semibold">{cards[1].name}</div>
                  <div className="text-[13px] text-marketing-inkMuted">{cards[1].meta}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
