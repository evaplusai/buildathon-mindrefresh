import Logo from '../shared/Logo';
import { marketingCopy } from '../../data/marketing-copy';

export default function MarketingFooter() {
  const { brand, links, copyright } = marketingCopy.footer;

  return (
    <footer className="py-12 border-t border-marketing-lineSoft text-[13px] text-marketing-inkMuted bg-marketing-cream">
      <div className="max-w-[1200px] mx-auto px-8 flex justify-between items-center flex-wrap gap-4">
        {/* Logo */}
        <div className="flex items-center gap-[10px] font-serif text-[18px] text-marketing-green-900">
          <Logo size={22} />
          {brand}
        </div>

        {/* Links */}
        <div className="flex gap-6">
          {links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="hover:text-marketing-green-800 transition-colors"
              title={
                link.href === '#' && link.label === 'Privacy'
                  ? 'Privacy policy in progress.'
                  : link.href === '#' && link.label === 'Terms'
                  ? 'Terms in progress.'
                  : undefined
              }
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Copyright */}
        <div>{copyright}</div>
      </div>
    </footer>
  );
}
