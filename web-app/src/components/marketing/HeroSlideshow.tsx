import { useState, useEffect } from 'react';
import { marketingCopy } from '../../data/marketing-copy';

const SLIDE_INTERVAL_MS = 4500;

export default function HeroSlideshow() {
  const { slides } = marketingCopy.heroMockup;
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % slides.length);
    }, SLIDE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [slides.length]);

  function goTo(n: number) {
    setCurrent(n);
  }

  return (
    <div
      className="w-full rounded-[18px] overflow-hidden relative bg-[#1a1208] shadow-[0_20px_50px_-20px_rgba(23,52,4,0.3)]"
      style={{ aspectRatio: '4/5' }}
    >
      {slides.map((slide, idx) => (
        <div
          key={slide.img}
          className="absolute inset-0 transition-opacity duration-[1400ms] ease-in-out"
          style={{ opacity: idx === current ? 1 : 0 }}
          aria-hidden={idx !== current}
        >
          <img
            src={slide.img}
            alt={slide.alt}
            width={1200}
            height={1500}
            // Slides auto-rotate every 4.5s — they all need to be ready
            // before their turn, so eager-load all three. Slide 0 also
            // gets fetchPriority="high" since it's above the fold.
            loading="eager"
            fetchPriority={idx === 0 ? 'high' : 'auto'}
            decoding={idx === 0 ? 'sync' : 'async'}
            className="w-full h-full object-cover block [image-rendering:auto] [image-rendering:high-quality]"
          />
          {/* Bottom gradient for text legibility */}
          <div
            className="absolute left-0 right-0 bottom-0 h-[55%] pointer-events-none"
            style={{
              background:
                'linear-gradient(to top, rgba(15,10,6,0.85) 0%, rgba(15,10,6,0.5) 40%, rgba(15,10,6,0) 100%)',
            }}
            aria-hidden="true"
          />
          {/* Slide overlay text */}
          <div className="absolute left-7 right-7 bottom-[70px] z-[2]">
            <p
              className="font-serif text-[30px] leading-[1.15] tracking-[-0.5px] text-[#FBF9F2] font-medium max-w-[90%]"
              style={{ textShadow: '0 2px 12px rgba(0,0,0,0.5)' }}
            >
              {slide.titleA}
              <em className="italic text-[#C9E090] font-medium">{slide.titleEm}</em>
              {slide.titleB}
            </p>
          </div>
          {/* Caption bar */}
          <div className="absolute left-7 bottom-7 z-[2] flex items-center gap-2 px-[14px] py-2 rounded-full bg-[rgba(15,10,6,0.55)] border border-[rgba(251,249,242,0.18)] backdrop-blur-[10px]">
            <span
              className="w-[6px] h-[6px] rounded-full bg-[#C9E090] animate-pulse shrink-0"
              aria-hidden="true"
            />
            <span className="font-mono text-[10.5px] tracking-[0.8px] text-[#E8DFC7]">
              {slide.caption}
            </span>
          </div>
        </div>
      ))}

      {/* Dot controls */}
      <div className="absolute right-7 bottom-7 z-[3] flex gap-[6px]">
        {slides.map((_, idx) => (
          <button
            key={idx}
            onClick={() => goTo(idx)}
            aria-label={`Slide ${idx + 1}`}
            className="w-[22px] h-1 rounded-full border-none p-0 cursor-pointer transition-colors duration-300"
            style={{
              background: idx === current ? '#FBF9F2' : 'rgba(251,249,242,0.35)',
            }}
          />
        ))}
      </div>
    </div>
  );
}
