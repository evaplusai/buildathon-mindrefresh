import { useEffect, type ReactNode } from 'react';
import '../../styles/marketing-tokens.css';

const FONT_DATA_ATTR = 'data-marketing-font';

interface MarketingLayoutProps {
  children: ReactNode;
}

/**
 * MarketingLayout — the single gateway for the marketing surface.
 *
 * On mount: idempotently appends three <link> tags to document.head:
 *   1. <link rel="preconnect" href="https://fonts.googleapis.com">
 *   2. <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
 *   3. <link rel="stylesheet" href="…Google Fonts URL…">
 *
 * Idempotency: each tag carries data-marketing-font="true"; if a tag with
 * that attribute already exists the append is skipped.
 *
 * On unmount: removes all <link> elements carrying that data attribute so
 * the dashboard route never pays the font-fetch cost.
 *
 * Per ADR-013: this is the ONLY place marketing-tokens.css is imported
 * and the ONLY place the Google Fonts links are injected.
 */
export default function MarketingLayout({ children }: MarketingLayoutProps) {
  useEffect(() => {
    // Skip if already present (idempotency guard).
    if (document.querySelector(`link[${FONT_DATA_ATTR}]`)) {
      return;
    }

    const preconnect1 = document.createElement('link');
    preconnect1.rel = 'preconnect';
    preconnect1.href = 'https://fonts.googleapis.com';
    preconnect1.setAttribute(FONT_DATA_ATTR, 'true');

    const preconnect2 = document.createElement('link');
    preconnect2.rel = 'preconnect';
    preconnect2.href = 'https://fonts.gstatic.com';
    preconnect2.crossOrigin = 'anonymous';
    preconnect2.setAttribute(FONT_DATA_ATTR, 'true');

    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href =
      'https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,500;0,8..60,600;1,8..60,400;1,8..60,500&family=Source+Sans+3:wght@400;500;600;700&display=swap';
    stylesheet.setAttribute(FONT_DATA_ATTR, 'true');

    document.head.appendChild(preconnect1);
    document.head.appendChild(preconnect2);
    document.head.appendChild(stylesheet);

    return () => {
      document
        .querySelectorAll(`link[${FONT_DATA_ATTR}]`)
        .forEach((el) => el.remove());
    };
  }, []);

  // Override the dashboard's body baseline (slate-900 + JetBrains Mono from
  // index.css) so the cream/serif marketing surface has a clean canvas —
  // no dark rubber-band on macOS, no monospace inheritance leaks.
  useEffect(() => {
    const { body, documentElement } = document;
    const prev = {
      bodyBg: body.style.backgroundColor,
      bodyColor: body.style.color,
      bodyFont: body.style.fontFamily,
      htmlBg: documentElement.style.backgroundColor,
    };
    body.style.backgroundColor = '#FBF9F2'; // marketing.cream
    body.style.color = '#1A2310'; // marketing.ink
    body.style.fontFamily =
      '"Source Sans 3", -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif';
    documentElement.style.backgroundColor = '#FBF9F2';
    return () => {
      body.style.backgroundColor = prev.bodyBg;
      body.style.color = prev.bodyColor;
      body.style.fontFamily = prev.bodyFont;
      documentElement.style.backgroundColor = prev.htmlBg;
    };
  }, []);

  return (
    <div className="font-sans bg-marketing-cream text-marketing-ink min-h-screen">
      {children}
    </div>
  );
}
