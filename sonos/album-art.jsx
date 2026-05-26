// album-art.jsx — Shows real artwork from the Sonos API.
// Tries a hi-res upscaled version first; on load error falls back to the
// original URL. If both fail (or no URL), shows pure black.

// Only rewrites patterns we're confident about.
// Deliberately does NOT touch `width=` or `height=` query params — those
// can be part of signed CDN URLs and modifying them breaks the signature.
function _hiRes(url) {
  if (!url) return url;
  return url
    .replace(/size=x\d+_y\d+/gi, 'size=x1000_y1000')            // Sonos: ?size=x200_y200
    .replace(/\/\d+x\d+(bb)?\.(jpg|png|webp)/gi,                  // path:  /200x200.jpg  or  /200x200bb.jpg
             (_, bb, ext) => `/1000x1000${bb || ''}.${ext}`)
    .replace(/_\d+x\d+(bb)?\.(jpg|png|webp)/gi,                   // path:  _200x200.jpg  or  _200x200bb.jpg
             (_, bb, ext) => `_1000x1000${bb || ''}.${ext}`);
}

function AlbumArt({ size = 1024, url = '' }) {
  const { useState, useEffect } = React;

  // 0 = try hi-res, 1 = try original, 2 = give up (show black)
  const [attempt, setAttempt] = useState(0);

  // Reset when url changes (new track)
  useEffect(() => { setAttempt(0); }, [url]);

  if (!url || attempt >= 2) {
    return <div style={{ width: size, height: size, flexShrink: 0, background: '#000' }} />;
  }

  const hiRes   = _hiRes(url);
  const src     = attempt === 0 ? hiRes : url;
  const sameUrl = hiRes === url;

  const handleError = () => {
    console.warn('[AlbumArt] load failed:', src);
    // If hi-res URL was the same as original there's no point retrying
    setAttempt(prev => (prev === 0 && !sameUrl) ? 1 : 2);
  };

  return (
    <div style={{
      position: 'relative', width: size, height: size, flexShrink: 0,
      boxShadow: '0 30px 90px rgba(0,0,0,.7), 0 0 0 .5px rgba(255,255,255,.04) inset',
      overflow: 'hidden', background: '#111',
    }}>
      <img
        key={src}
        src={src}
        alt="Album art"
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        onError={handleError}
        onLoad={() => setAttempt(prev => prev)} // no-op, just confirming load
      />
    </div>
  );
}

window.AlbumArt = AlbumArt;
