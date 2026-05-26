// iphone-frame.jsx — iPhone Pro Max-ish bezel, supports portrait or landscape.
//
// Portrait inner display: 414×896.
// Landscape inner display: 896×414.
// Dynamic Island silhouette sits at the top of the short edge in portrait
// and along the LEFT short edge in landscape (left because that's where
// the front cameras live when the phone is on its right side).

function IPhoneFrame({ children, orientation = 'portrait', scale = 1 }) {
  const isPortrait = orientation === 'portrait';
  const w = isPortrait ? 454 : 936;
  const h = isPortrait ? 936 : 454;

  // Dynamic Island position relative to display:
  // - portrait: top center, horizontal pill
  // - landscape: left center, vertical pill
  const diStyle = isPortrait
    ? { top: 14, left: '50%', transform: 'translateX(-50%)',
        width: 122, height: 36, borderRadius: 18 }
    : { left: 14, top: '50%', transform: 'translateY(-50%)',
        width: 36, height: 122, borderRadius: 18 };

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
        {/* Outer titanium-ish bezel */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(140deg, #2c2c2e 0%, #1c1c1e 40%, #101012 100%)',
          borderRadius: 58,
          boxShadow: `
            0 0 0 1px rgba(255,255,255,0.04),
            0 1px 0 rgba(255,255,255,0.08) inset,
            0 -1px 0 rgba(0,0,0,0.5) inset,
            0 30px 90px rgba(0,0,0,0.5),
            0 60px 140px rgba(0,0,0,0.4)
          `,
        }} />

        {/* Inner thin black bezel */}
        <div style={{
          position: 'absolute', inset: 16,
          background: '#000',
          borderRadius: 46,
          overflow: 'hidden',
        }}>
          {/* Display content area */}
          <div style={{
            position: 'absolute', inset: 6,
            background: '#000', overflow: 'hidden',
            borderRadius: 40,
          }}>
            {children}

            {/* Dynamic Island silhouette */}
            <div style={{
              position: 'absolute',
              background: '#000',
              zIndex: 5,
              boxShadow: '0 0 0 1px rgba(255,255,255,0.04) inset',
              ...diStyle,
            }} />
          </div>
        </div>
      </div>
    </div>
  );
}

window.IPhoneFrame = IPhoneFrame;
