/**
 * Stand-in mark drawn from the Brookfield Subdivision logo — sun over the
 * treeline and water, inside the rounded green frame.
 *
 * Replace the body of this component with an <Image src="/brookfield-logo.png">
 * once the official artwork is in public/.
 */
export function Logo({ className }: { className?: string }) {
  const rays = Array.from({ length: 12 }, (_, index) => index * 30);

  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label="Brookfield Subdivision"
    >
      <defs>
        <radialGradient id="bf-sun" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f4801f" />
          <stop offset="55%" stopColor="#fdc300" />
          <stop offset="100%" stopColor="#ffdb52" />
        </radialGradient>
      </defs>

      <rect
        x="1.75"
        y="1.75"
        width="60.5"
        height="60.5"
        rx="13"
        fill="none"
        stroke="#8cc63f"
        strokeWidth="2.5"
      />

      {rays.map((angle) => (
        <line
          key={angle}
          x1="32"
          y1="12.5"
          x2="32"
          y2="7.5"
          stroke="#f0e6b8"
          strokeWidth="3.4"
          strokeLinecap="round"
          transform={`rotate(${angle} 32 27)`}
        />
      ))}

      <circle cx="32" cy="27" r="12.75" fill="#f8f0c8" />
      <circle cx="32" cy="27" r="9.5" fill="url(#bf-sun)" />

      {/* Treeline: a lighter mound behind, the main bush in front. */}
      <path
        d="M6 47c0-5.5 3.8-9.8 8.6-9.8 1.7-3.9 7.3-5.2 10.6-1.6 3.6-1.4 7.3 1.3 7.3 5.2V47Z"
        fill="#7cb342"
      />
      <path
        d="M19 47c0-7.4 5.6-13 12.4-13 5.9 0 10.9 4.2 12.1 9.8 3.2-.4 5.8 1.9 5.8 4.9V47Z"
        fill="#3f8b32"
      />

      {/* Water. */}
      <g fill="none" strokeLinecap="round">
        <path
          d="M4 49.5c4.7-3 9.3-3 14 0s9.3 3 14 0 9.3-3 14 0 9.3 3 14 0"
          stroke="#29abe2"
          strokeWidth="2.2"
        />
        <path
          d="M4 54c4.7-3 9.3-3 14 0s9.3 3 14 0 9.3-3 14 0 9.3 3 14 0"
          stroke="#9fd8f2"
          strokeWidth="2.2"
        />
        <path
          d="M4 58c4.7-3 9.3-3 14 0s9.3 3 14 0 9.3-3 14 0 9.3 3 14 0"
          stroke="#29abe2"
          strokeWidth="1.8"
        />
      </g>
    </svg>
  );
}
