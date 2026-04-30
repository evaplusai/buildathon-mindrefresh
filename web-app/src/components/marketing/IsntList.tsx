import { marketingCopy } from '../../data/marketing-copy';

export default function IsntList() {
  const { eyebrow, titleA, titleEm, body, items } = marketingCopy.isnt;

  return (
    <section className="py-[120px] bg-marketing-green-900 text-marketing-green-50">
      <div className="max-w-[1200px] mx-auto px-8">
        <span className="block font-mono text-[11px] tracking-[2px] uppercase text-marketing-green-100 mb-5 text-center">
          {eyebrow}
        </span>
        <h2 className="font-serif text-[56px] leading-[1.05] tracking-[-1.4px] text-marketing-cream font-medium text-center max-w-[880px] mx-auto mb-6">
          {titleA}
          <em className="italic text-marketing-green-100">{titleEm}</em>
        </h2>

        {/* Body paragraph */}
        <div className="max-w-[760px] mx-auto text-center mb-0">
          <p className="font-serif text-[22px] leading-[1.55] text-marketing-green-100 font-normal mb-5">
            {body}
          </p>
        </div>

        {/* 3-card disqualifier grid */}
        <div
          className="grid gap-6 mt-14"
          style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}
        >
          {items.map((item) => (
            <div
              key={item.title}
              className="px-6 py-7 rounded-[14px]"
              style={{
                background: 'rgba(234,243,222,0.04)',
                border: '0.5px solid rgba(234,243,222,0.1)',
              }}
            >
              <div className="text-marketing-rose text-[18px] mb-3 font-mono">{item.label}</div>
              <div className="font-serif text-[18px] text-marketing-cream font-medium mb-[6px]">
                {item.title}
              </div>
              <div className="text-[14px] leading-[1.55]" style={{ color: 'rgba(234,243,222,0.7)' }}>
                {item.body}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
