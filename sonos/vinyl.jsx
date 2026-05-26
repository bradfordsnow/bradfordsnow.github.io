// vinyl.jsx — Vinyl-mode visual.
// In this mode the iPad has been "taken over" by the turntable: there is no
// album art, no spine, no playback controls — just a passive indication
// that vinyl is playing. The spinning record IS the visual.

function VinylRecord({ size = 1024, paused }) {
  const recordSize = size;
  const labelSize = recordSize * 0.32;
  // Realistic LP spindle hole — ~2% of disc diameter.
  const spindleSize = recordSize * 0.016;

  return (
    <div style={{
      position: 'relative', width: size, height: size,
      background: '#000',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
    }}>
      {/* Vinyl record */}
      <div style={{
        position: 'relative', width: recordSize, height: recordSize,
        borderRadius: '50%',
        background: 'radial-gradient(circle at 30% 30%, #1c1c1c 0%, #060606 55%, #020202 100%)',
        boxShadow: '0 40px 120px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.04) inset',
        animation: paused ? 'none' : 'spin 4s linear infinite',
      }}>
        {/* Concentric grooves — many thin rings */}
        <svg width="100%" height="100%" viewBox="0 0 100 100"
             style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {Array.from({ length: 70 }, (_, i) => {
            const r = 17 + i * 0.46;
            return (
              <circle key={i} cx="50" cy="50" r={r}
                      fill="none" stroke="rgba(255,255,255,0.028)"
                      strokeWidth="0.07" />
            );
          })}
          {/* Brighter highlight rings for the light-catch effect */}
          {[20, 27, 35, 42].map((r) => (
            <circle key={r} cx="50" cy="50" r={r}
                    fill="none" stroke="rgba(255,255,255,0.06)"
                    strokeWidth="0.12" />
          ))}
        </svg>

        {/* Specular shimmer — rotates with the record */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: 'conic-gradient(from 45deg, transparent 0deg, rgba(255,255,255,0.05) 20deg, transparent 60deg, transparent 220deg, rgba(255,255,255,0.04) 250deg, transparent 290deg)',
          pointerEvents: 'none',
        }} />

        {/* Record label — intentionally blank. Sonos has no way to read what
            label or pressing is actually on the platter, so we don't pretend
            to. Just a solid color disc with a spindle hole, like an
            unlabeled test pressing. */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          width: labelSize, height: labelSize,
          transform: 'translate(-50%, -50%)',
          borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 30%, #2a1a10 0%, #1a0e08 45%, #120804 100%)',
          boxShadow: '0 0 0 1px rgba(0,0,0,0.6), 0 0 0 2px rgba(255,255,255,0.04)',
        }}>
          {/* Spindle hole */}
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            width: spindleSize, height: spindleSize,
            transform: 'translate(-50%, -50%)',
            borderRadius: '50%',
            background: '#000',
            boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.18), 0 0 0 1px rgba(0,0,0,0.5)',
          }} />
        </div>
      </div>

      {/* Tonearm — stylized silhouette, upper right */}
      <Tonearm size={size} paused={paused} />
    </div>
  );
}

function Tonearm({ size, paused }) {
  const pivotX = size * 0.86;
  const pivotY = size * 0.14;
  const angle = paused ? -8 : 22;

  return (
    <svg width={size} height={size}
         style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <defs>
        <linearGradient id="armBrush" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#3a3a3a" />
          <stop offset="0.5" stopColor="#9a9a9a" />
          <stop offset="1" stopColor="#1a1a1a" />
        </linearGradient>
      </defs>

      {/* Pivot base */}
      <circle cx={pivotX} cy={pivotY} r={size * 0.05}
              fill="#0a0a0a" stroke="#222" strokeWidth="1" />
      <circle cx={pivotX} cy={pivotY} r={size * 0.038}
              fill="#1a1a1a" />
      <circle cx={pivotX} cy={pivotY} r={size * 0.018}
              fill="#0a0a0a" stroke="#444" strokeWidth="0.5" />

      <g transform={`rotate(${angle} ${pivotX} ${pivotY})`}
         style={{ transition: 'transform 0.6s cubic-bezier(.4,.2,.2,1)' }}>
        {/* Counterweight stub */}
        <rect x={pivotX + size * 0.04} y={pivotY - size * 0.012}
              width={size * 0.06} height={size * 0.024} rx="2"
              fill="#2a2a2a" stroke="#444" strokeWidth="0.4" />

        {/* Main arm */}
        <path d={`
          M ${pivotX - 4} ${pivotY - size * 0.006}
          L ${pivotX - size * 0.42} ${pivotY + size * 0.18}
          L ${pivotX - size * 0.43} ${pivotY + size * 0.196}
          L ${pivotX - 4} ${pivotY + size * 0.006}
          Z
        `} fill="url(#armBrush)" />

        {/* Cartridge / headshell */}
        <rect x={pivotX - size * 0.47} y={pivotY + size * 0.18}
              width={size * 0.05} height={size * 0.022} rx="2"
              transform={`rotate(28 ${pivotX - size * 0.445} ${pivotY + size * 0.19})`}
              fill="#0a0a0a" stroke="#333" strokeWidth="0.5" />
        <circle cx={pivotX - size * 0.448} cy={pivotY + size * 0.21}
                r="2.5" fill="#c9a96e" opacity="0.6" />
      </g>
    </svg>
  );
}

// VinylMode — full passive screen. The Sonos system can't identify the
// physical record, so the iPad shows just the spinning record — no label,
// no metadata. (Unless paired with audio identification — see app.jsx.)
function VinylMode({ width, height, paused }) {
  const recordSize = Math.min(width, height) * 0.92;

  return (
    <div style={{
      width, height, background: '#000',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative',
    }}>
      <VinylRecord size={recordSize} paused={paused} />
    </div>
  );
}

Object.assign(window, { VinylRecord, VinylMode });
