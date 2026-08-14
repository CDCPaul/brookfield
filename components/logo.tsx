/**
 * The BrookSide Bounce mark: sun over the treeline, a pickleball, and the
 * brook, inside the rounded green frame.
 *
 * Drawn rather than loaded so it stays sharp at any size and needs no asset.
 * Swap the body for an <Image src="/brookside-bounce.png"> if the original
 * artwork is added to public/.
 */
export function Logo({ className }: { className?: string }) {
  const rays = [-70, -45, -20, 5, 30];

  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label="BrookSide Bounce"
    >
      <defs>
        <radialGradient id="bsb-sun" cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#ffe27a" />
          <stop offset="60%" stopColor="#fbc02d" />
          <stop offset="100%" stopColor="#f39c12" />
        </radialGradient>
        <radialGradient id="bsb-ball" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#f4e04d" />
          <stop offset="100%" stopColor="#d4b81a" />
        </radialGradient>
        <clipPath id="bsb-frame">
          <rect x="3" y="3" width="58" height="58" rx="15" />
        </clipPath>
      </defs>

      <g clipPath="url(#bsb-frame)">
        <rect x="3" y="3" width="58" height="58" fill="#fdfdf7" />

        {/* Sun */}
        <g stroke="#f5b120" strokeWidth="2.6" strokeLinecap="round">
          {rays.map((angle) => (
            <line
              key={angle}
              x1="24"
              y1="13"
              x2="24"
              y2="8"
              transform={`rotate(${angle} 24 24)`}
            />
          ))}
        </g>
        <circle cx="24" cy="24" r="8.5" fill="url(#bsb-sun)" />

        {/* Treeline */}
        <path
          d="M4 44c0-6.2 4.6-11.2 10.3-11.2 1.6-4 6.4-6.8 11.9-6.8 6.9 0 12.5 4.6 12.5 10.3V44Z"
          fill="#2f7d32"
        />
        <path
          d="M30 44c0-5.4 4-9.8 9-9.8s9 4.4 9 9.8H30Z"
          fill="#4f9e3f"
        />

        {/* Pickleball */}
        <circle cx="44" cy="33" r="10.5" fill="url(#bsb-ball)" />
        {[
          [41, 29],
          [47, 30],
          [40.5, 35],
          [46.5, 36],
          [43.5, 39.5],
        ].map(([cx, cy]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.35" fill="#b39a10" />
        ))}

        {/* The brook */}
        <path
          d="M0 47c8-4 14 4 22 0s14-4 22 0 14 0 20-3v20H0Z"
          fill="#ffffff"
        />
        <g fill="none" strokeLinecap="round">
          <path
            d="M0 47c8-4 14 4 22 0s14-4 22 0 14 0 20-3"
            stroke="#2f9fd0"
            strokeWidth="2.4"
          />
          <path
            d="M0 52c8-4 14 4 22 0s14-4 22 0 14 0 20-3"
            stroke="#9fd8f2"
            strokeWidth="2.2"
          />
          <path
            d="M0 57c8-4 14 4 22 0s14-4 22 0 14 0 20-3"
            stroke="#2f9fd0"
            strokeWidth="2"
          />
        </g>
      </g>

      <rect
        x="3"
        y="3"
        width="58"
        height="58"
        rx="15"
        fill="none"
        stroke="#3f8b32"
        strokeWidth="3"
      />
    </svg>
  );
}
