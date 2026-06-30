/**
 * ZeroSeal stamp-seal marks.
 *
 * The product is a *seal*, so the signature visual is a pressed/embossed
 * wax stamp built on the existing broken-heptagon brand mark. Two variants:
 *
 *  - <StampSeal />     the full embossed seal (hero signature element)
 *  - <SealCheck />     a compact seal-ring with a checkmark (verified statements)
 *
 * Both are pure SVG, currentColor-aware, and decorative by default.
 */

const HEPTAGON_STROKES = [
  "M35.44 11.66 L47.48 17.45",
  "M49.62 20.14 L53.03 35.04",
  "M52.26 38.39 L42.74 50.33",
  "M39.64 51.82 L24.36 51.82",
  "M21.26 50.33 L11.74 38.39",
  "M10.98 35.04 L14.38 20.14",
  "M16.52 17.45 L28.56 11.66",
];

export function StampSeal({
  size = 132,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      role="img"
      aria-label="ZeroSeal verified seal"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id="zs-wax" cx="38%" cy="32%" r="78%">
          <stop offset="0%" stopColor="#fff3a8" />
          <stop offset="46%" stopColor="#e7ba00" />
          <stop offset="100%" stopColor="#8a6d00" />
        </radialGradient>
        <linearGradient id="zs-emboss" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.55)" />
          <stop offset="100%" stopColor="rgba(20,19,15,0.28)" />
        </linearGradient>
      </defs>

      {/* pressed wax disc */}
      <circle cx="32" cy="32" r="30" fill="url(#zs-wax)" />
      <circle
        cx="32"
        cy="32"
        r="30"
        fill="none"
        stroke="url(#zs-emboss)"
        strokeWidth="1.4"
      />
      {/* engraved inner ring */}
      <circle
        cx="32"
        cy="32"
        r="23.5"
        fill="none"
        stroke="#5a4600"
        strokeWidth="1"
        opacity="0.55"
      />

      {/* broken-heptagon engraving */}
      <g
        stroke="#3a2e00"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.85"
      >
        {HEPTAGON_STROKES.map((d) => (
          <path d={d} key={d} />
        ))}
      </g>

      {/* central emblem (the Z-cut disc from the brand mark) */}
      <path
        fill="#2c2200"
        fillRule="evenodd"
        d="M18.8 32 a13.2 13.2 0 1 0 26.4 0 a13.2 13.2 0 1 0 -26.4 0 Z M25.4 26.2 L38.6 26.2 L38.6 29.3 L29.36 34.7 L38.6 34.7 L38.6 37.8 L25.4 37.8 L25.4 34.7 L34.64 29.3 L25.4 29.3 Z"
      />
      {/* highlight on the emblem for the embossed feel */}
      <path
        d="M22 26 a13 13 0 0 1 11-7"
        fill="none"
        stroke="rgba(255,243,168,0.6)"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Compact verified mark: a seal ring with a clean checkmark inside.
 * Used for the three hero trust statements. No crossed circles.
 */
export function SealCheck({
  size = 22,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id="zs-check-wax" cx="38%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#fff3a8" />
          <stop offset="55%" stopColor="#e7ba00" />
          <stop offset="100%" stopColor="#a9850a" />
        </radialGradient>
      </defs>
      <circle cx="12" cy="12" r="11" fill="url(#zs-check-wax)" />
      <circle
        cx="12"
        cy="12"
        r="11"
        fill="none"
        stroke="rgba(20,19,15,0.22)"
        strokeWidth="1"
      />
      <circle
        cx="12"
        cy="12"
        r="8.2"
        fill="none"
        stroke="#5a4600"
        strokeWidth="0.9"
        opacity="0.5"
      />
      <path
        d="M8 12.3 l2.6 2.6 L16 9.4"
        fill="none"
        stroke="#2c2200"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
