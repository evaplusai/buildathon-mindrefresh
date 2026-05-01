/**
 * LearnPatterns — section below the green ManifestoBand showing the
 * "The room notices first" infographic on the left and a vertical
 * "Privacy by design" pillar list on the right.
 */

import type { ReactNode } from 'react';

interface PrivacyItem {
  icon: ReactNode;
  title: string;
  body: string;
}

// Inline stroked SVG icons — match the line-art aesthetic used elsewhere.
const Shield = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3 4 6v6c0 4.5 3.4 8.4 8 9 4.6-.6 8-4.5 8-9V6l-8-3z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);
const EyeOff = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 3l18 18" />
    <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
    <path d="M16.7 16.7A9.5 9.5 0 0 1 12 18c-5 0-9-6-9-6a17 17 0 0 1 4.2-4.7" />
    <path d="M9.7 5.2A9.5 9.5 0 0 1 12 5c5 0 9 6 9 6a17 17 0 0 1-2.4 3" />
  </svg>
);
const Lock = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);
const Leaf = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 19c0-8 7-13 15-13 0 8-5 14-13 14-1 0-2-.3-2-1z" />
    <path d="M5 19c4-3 7-7 9-12" />
  </svg>
);

const PRIVACY_ITEMS: PrivacyItem[] = [
  { icon: Shield, title: 'All data stays in your home.', body: 'No cloud. No servers.' },
  { icon: EyeOff, title: 'No camera. No microphone.', body: 'Only Wi-Fi signals are used.' },
  { icon: Lock, title: 'You own your data.', body: 'Your nervous system, your privacy.' },
  { icon: Leaf, title: 'Local-Only Mode available.', body: 'Maximum privacy when you need it.' },
];

export default function LearnPatterns() {
  return (
    <section
      className="bg-marketing-cream py-16 border-b border-marketing-lineSoft"
      aria-label="The room notices first — sensor explainer"
    >
      <div className="max-w-[1200px] mx-auto px-8">
        {/* Single unified panel containing image + sidebar so the two read
            as one composition framed by a shared border + shadow. */}
        <div className="bg-marketing-cream border border-marketing-line rounded-[22px] shadow-[0_30px_60px_-30px_rgba(23,52,4,0.18)] overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] items-stretch">
            {/* Infographic flush to the panel edge — no separate border or
                shadow; the parent panel provides the framing. */}
            <figure className="m-0">
              <img
                src="/marketing/room-notices-first.png"
                alt="The room notices first — Wi-Fi signals bend around your body, the sensor reads the changes in your breath, pulse, and stillness. Local processing only; nothing leaves the room."
                loading="lazy"
                decoding="async"
                className="w-full h-auto block"
              />
            </figure>

            {/* Privacy by design — vertical sidebar matching the image
                height. Slightly warmer background + a divider line make
                it feel like a companion panel inside the same card. */}
            <aside
              aria-labelledby="privacy-by-design-heading"
              className="flex flex-col p-8 bg-marketing-warmWhite border-t border-marketing-line lg:border-t-0 lg:border-l"
            >
              <h3
                id="privacy-by-design-heading"
                className="font-mono text-[15px] tracking-[2px] uppercase text-marketing-green-700 font-semibold mb-7"
              >
                Privacy by design
              </h3>

              <ul className="flex-1 flex flex-col justify-around gap-6 m-0 p-0 list-none">
                {PRIVACY_ITEMS.map((item) => (
                  <li key={item.title} className="flex gap-4 items-start">
                    <div className="w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-full bg-marketing-green-50 text-marketing-green-700">
                      <span className="w-[22px] h-[22px] block">{item.icon}</span>
                    </div>
                    <div className="flex flex-col gap-1.5 pt-0.5">
                      <p className="font-serif text-[17px] leading-[1.3] text-marketing-green-900 font-medium m-0">
                        {item.title}
                      </p>
                      <p className="text-[14px] leading-[1.5] text-marketing-inkSoft m-0">
                        {item.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        </div>
      </div>
    </section>
  );
}
