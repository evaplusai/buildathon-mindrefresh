import { marketingCopy } from '../../data/marketing-copy';

export default function StatsBand() {
  const stats = marketingCopy.stats;

  return (
    <section className="py-20 bg-marketing-cream2 border-t border-marketing-lineSoft border-b">
      <div className="max-w-[1200px] mx-auto px-8">
        <div className="grid gap-14 text-center" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {stats.map((stat) => {
            // Render the "num" with italic emphasis for non-numeric prefix
            // e.g. "8–12min" → "8–12" italic + "min", "76M" → plain, "$9" → plain
            let numNode: React.ReactNode;
            if (stat.num.endsWith('min')) {
              const digits = stat.num.replace('min', '');
              numNode = (
                <>
                  <em className="italic text-marketing-green-600">{digits}</em>
                  min
                </>
              );
            } else {
              numNode = stat.num;
            }

            return (
              <div key={stat.num}>
                <div className="font-serif text-[64px] text-marketing-green-900 font-medium tracking-[-1.5px] leading-[1] mb-3">
                  {numNode}
                </div>
                <div className="text-[15px] text-marketing-inkSoft leading-[1.5] max-w-[280px] mx-auto">
                  {stat.desc}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
