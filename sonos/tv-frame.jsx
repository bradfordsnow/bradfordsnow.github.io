// tv-frame.jsx — Apple TV display frame.
//
// Represents the TV the Apple TV box is plugged into. Inner display is 16:9
// (1920×1080). The outer "TV" frame is just a thin matte bezel + a hint of
// stand below — enough to read as "this is on a TV" without being a literal
// device render.

function TVFrame({ children, scale = 1 }) {
  const innerW = 1920;
  const innerH = 1080;
  const bezel = 24;
  const standH = 36;
  const w = innerW + bezel * 2;
  const h = innerH + bezel * 2 + standH;

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
      {/* Outer TV bezel */}
      <div style={{
        position: 'absolute', top: 0, left: 0,
        width: innerW + bezel * 2,
        height: innerH + bezel * 2,
        background: 'linear-gradient(180deg, #1a1a1c 0%, #0c0c0e 100%)',
        borderRadius: 8,
        boxShadow: `
          0 0 0 1px rgba(255,255,255,0.06),
          0 1px 0 rgba(255,255,255,0.06) inset,
          0 50px 120px rgba(0,0,0,0.5),
          0 100px 200px rgba(0,0,0,0.4)
        `,
      }} />

      {/* Display content area */}
      <div style={{
        position: 'absolute', top: bezel, left: bezel,
        width: innerW, height: innerH,
        background: '#000', overflow: 'hidden',
        borderRadius: 2,
        boxShadow: '0 0 0 1px rgba(0,0,0,0.8)',
      }}>
        {children}
      </div>

      {/* Stand silhouette */}
      <div style={{
        position: 'absolute',
        bottom: 0, left: '50%',
        transform: 'translateX(-50%)',
        width: 240, height: standH,
        background: 'linear-gradient(180deg, #0a0a0c 0%, #050506 100%)',
        clipPath: 'polygon(15% 0%, 85% 0%, 100% 100%, 0% 100%)',
        boxShadow: '0 8px 20px rgba(0,0,0,0.5)',
      }} />
      </div>
    </div>
  );
}

window.TVFrame = TVFrame;
