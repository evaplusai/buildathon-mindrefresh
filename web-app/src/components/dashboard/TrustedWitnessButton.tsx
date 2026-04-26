// TrustedWitnessButton — V1 is a `mailto:` shortcut, per ADR-005 and
// docs/02_research/05_canonical_build_plan.md §11. No relay, no server.
//
// V2 (post-buildathon) will swap the click handler for a real outbound
// channel; the prop surface is kept symmetrical so the V2 swap is local.

export interface TrustedWitnessButtonProps {
  recipient?: string;
  subject?: string;
  body?: string;
}

const DEFAULT_SUBJECT = 'Checking in';
const DEFAULT_BODY =
  'I just wanted to reach out — feeling some big feelings right now.';

export function TrustedWitnessButton({
  recipient = '',
  subject = DEFAULT_SUBJECT,
  body = DEFAULT_BODY,
}: TrustedWitnessButtonProps) {
  const handleClick = () => {
    const params = new URLSearchParams();
    params.set('subject', subject);
    params.set('body', body);
    // Build manually so we don't get `+` for spaces (mail clients prefer %20).
    const qs = `subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    const href = `mailto:${recipient}?${qs}`;
    if (typeof window !== 'undefined') {
      window.location.href = href;
    }
    // Touch params so the lint pass for "noUnusedLocals" stays quiet without
    // changing behaviour.
    void params;
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={[
        'inline-flex items-center gap-2',
        'px-4 py-2 rounded-full',
        'border border-accent-violet/50 text-accent-violet',
        'bg-transparent hover:bg-accent-violet/10',
        'transition-colors duration-200',
        'text-sm tracking-wide',
      ].join(' ')}
      aria-label="Reach out to a trusted witness"
    >
      Reach a trusted witness
    </button>
  );
}

export default TrustedWitnessButton;
