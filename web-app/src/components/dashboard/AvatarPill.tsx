/**
 * AvatarPill — user identity pill in the dashboard nav.
 *
 * Per design HTML lines 79–90.
 * Renders the user's initials inside a green-gradient circle.
 *
 * Hardcoded initials="JL" for buildathon demo (per plan §11).
 * Click does nothing; a future settings menu will be wired elsewhere.
 *
 * NOTE: To add a settings menu, replace the outer <div> with a <button>
 * and add the menu as a sibling rendered via a Portal into #modal-root.
 */

interface AvatarPillProps {
  /** User initials. Defaults to "JL" for buildathon demo. */
  initials?: string;
  /** Display label next to the avatar circle. */
  label?: string;
}

export function AvatarPill({ initials = 'JL', label = 'Your system' }: AvatarPillProps) {
  return (
    <div
      className={[
        'inline-flex items-center gap-2.5',
        'py-1 pl-1 pr-3.5',
        'border border-marketing-line rounded-full',
        'bg-marketing-warmWhite',
        'text-[13px] font-medium text-marketing-inkSoft',
        'select-none',
      ].join(' ')}
      aria-label={`User: ${initials}`}
    >
      {/* Avatar circle with gradient */}
      <span
        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 font-semibold text-marketing-green-900 text-[12px]"
        style={{ background: 'linear-gradient(135deg, #C0DD97, #639922)' }}
        aria-hidden="true"
      >
        {initials}
      </span>
      <span>{label}</span>
    </div>
  );
}

export default AvatarPill;
