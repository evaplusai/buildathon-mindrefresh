/**
 * DemoModeToggle — nav pill that activates/deactivates the scripted 44s demo arc.
 *
 * Per design HTML lines 64–78.
 * Renders a pulsing dot + label ("DEMO MODE" / "DEMO PLAYING") with state classes.
 * Click does nothing beyond calling onToggle; the parent manages the demo state.
 */

interface DemoModeToggleProps {
  active: boolean;
  onToggle: () => void;
}

export function DemoModeToggle({ active, onToggle }: DemoModeToggleProps) {
  return (
    <button
      onClick={onToggle}
      aria-pressed={active}
      aria-label={active ? 'Stop demo mode' : 'Start demo mode'}
      className={[
        'inline-flex items-center gap-2',
        'px-[14px] py-[7px] pl-[11px]',
        'rounded-full',
        'font-mono text-[11px] tracking-[1.2px] font-semibold',
        'transition-all duration-200 cursor-pointer',
        active
          ? 'bg-marketing-green-800 text-marketing-cream'
          : 'bg-marketing-ink text-marketing-cream hover:bg-[#2a3322]',
      ].join(' ')}
    >
      <span
        className={[
          'w-[7px] h-[7px] rounded-full transition-colors duration-200',
          active
            ? 'bg-marketing-green-100 animate-pulse'
            : 'bg-marketing-green-300',
        ].join(' ')}
        aria-hidden="true"
      />
      <span>{active ? 'DEMO PLAYING' : 'DEMO MODE'}</span>
    </button>
  );
}

export default DemoModeToggle;
