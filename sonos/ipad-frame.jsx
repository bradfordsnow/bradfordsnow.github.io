// ipad-frame.jsx — iPad bezel, supports landscape or portrait.
//
// Landscape: 1500×1124, inner display 1400×1024.
// Portrait:  1124×1500, inner display 1024×1400.
// Camera dot sits on the long top edge in landscape and the long left edge
// in portrait (matches modern iPad orientation behavior).

function IPadFrame({ children, orientation = 'landscape', scale = 1 }) {
  const isPortrait = orientation === 'portrait';
  const w = isPortrait ? 1124 : 1500;
  const h = isPortrait ? 1500 : 1124;

  // Camera dot position — opposite the short edge of the device.
  const camStyle = isPortrait
    ? { top: '50%', left: 18, transform: 'translateY(-50%)' }
    : { top: 18, left: '50%', transform: 'translateX(-50%)' };

  // Wrapper pattern: outer div has the *visual* (scaled) dimensions so flex
  // centering / overflow / page layout all use the correct size. Inner div
  // is natural-size and scaled from top-left so the visual aligns to the
  // outer box exactly.
  return (
    <div style={{
      position: 'relative',
      width: w * scale, height: h * scale,
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0,
        width: w, height: h,
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
      }}>
      {/* Outer aluminum bezel */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(140deg, #2a2a2c 0%, #1a1a1c 40%, #0e0e10 100%)',
        borderRadius: 46,
        boxShadow: `
          0 0 0 1px rgba(255,255,255,0.04),
          0 1px 0 rgba(255,255,255,0.08) inset,
          0 -1px 0 rgba(0,0,0,0.5) inset,
          0 40px 120px rgba(0,0,0,0.5),
          0 80px 160px rgba(0,0,0,0.4)
        `,
      }} />

      {/* Inner thin black bezel ring */}
      <div style={{
        position: 'absolute', inset: 36,
        background: '#000',
        borderRadius: 18,
        boxShadow: `
          0 0 0 1px rgba(0,0,0,0.8),
          0 0 0 2px rgba(255,255,255,0.05),
          0 0 24px rgba(0,0,0,0.6) inset
        `,
        overflow: 'hidden',
      }}>
        {/* Display content area */}
        <div style={{
          position: 'absolute', inset: 14,
          background: '#000', overflow: 'hidden',
          borderRadius: 4,
        }}>
          {children}
        </div>
      </div>

      {/* Front-facing camera dot */}
      <div style={{
        position: 'absolute',
        width: 8, height: 8, borderRadius: '50%',
        background: '#0a0a0a',
        boxShadow: '0 0 0 1px rgba(255,255,255,0.06), 0 0 4px rgba(80,150,200,0.15) inset',
        ...camStyle,
      }} />
      </div>
    </div>
  );
}

window.IPadFrame = IPadFrame;
