import { marketingCopy } from '../../data/marketing-copy';

export default function ManifestoBand() {
  const { headline } = marketingCopy.manifesto;

  // The headline from copy: "Learn your patterns before they become burnout."
  // Split at "before" to apply italic emphasis per the design HTML.
  const emWord = 'before';
  const emIndex = headline.indexOf(emWord);
  const before = headline.slice(0, emIndex);
  const after = headline.slice(emIndex + emWord.length);

  return (
    <section className="bg-marketing-green-800 py-10 border-b border-marketing-green-900">
      <div className="max-w-[1200px] mx-auto px-8">
        <h2 className="font-serif text-[38px] leading-[1.15] tracking-[-0.8px] text-marketing-cream font-medium m-0 max-w-[880px] text-balance">
          {before}
          <em className="italic text-marketing-green-200 font-medium">{emWord}</em>
          {after}
        </h2>
      </div>
    </section>
  );
}
