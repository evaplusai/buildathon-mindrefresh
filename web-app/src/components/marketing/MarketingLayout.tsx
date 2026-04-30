import { useEffect, type ReactNode } from 'react';
import '../../styles/marketing-tokens.css';

interface MarketingLayoutProps {
  children: ReactNode;
}

/**
 * MarketingLayout — the wrapper for the marketing surface.
 *
 * V2 NOTE: As of Sprint A (dashboard-v2), the Google Fonts <link> tags
 * for Source Serif 4 + Source Sans 3 ship via `index.html` so both the
 * marketing and dashboard routes share the same font stack at the same
 * cost. This wrapper no longer injects fonts at runtime — that path
 * was redundant and produced duplicate <link> tags.
 *
 * What this still does:
 *   - imports `marketing-tokens.css` (the cream/green palette)
 *   - overrides the `body` baseline (slate-900 + JetBrains Mono from
 *     `index.css`) while marketing is mounted, restored on unmount
 *
 * Per ADR-013 (amended Sprint A): font loading is now global via
 * index.html; isolation invariant relaxed.
 */
export default function MarketingLayout({ children }: MarketingLayoutProps) {
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
