// album-art.jsx — Album artwork. Always shows black background.
// Uses a native Image() preloader outside React so onload fires reliably
// even for browser-cached images (React's synthetic onLoad can miss those).
// Tries hi-res upscaled URL first; falls back to original on error;
// shows pure black if both fail.

function _hiRes(url) {
  if (!url) return url;
  return url
    .replace(/size=x\d+_y\d+/gi, 'size=x1000_y1000')
    .replace(/\/\d+x\d+(bb)?\.(jpg|png|webp)/gi,
             (m, bb, ext) => `/1000x1000${bb || ''}.${ext}`)
    .replace(/_\d+x\d+(bb)?\.(jpg|png|webp)/gi,
             (m, bb, ext) => `_1000x1000${bb || ''}.${ext}`);
}

function AlbumArt({ size = 1024, url = '' }) {
  const { useState, useEffect } = React;

  const [activeSrc, setActiveSrc] = useState('');
  const [loaded,    setLoaded]    = useState(false);

  useEffect(() => {
    if (!url) { setActiveSrc(''); setLoaded(false); return; }

    const hi = _hiRes(url);
    const firstSrc    = (hi && hi !== url) ? hi : url;
    const fallbackSrc = (hi && hi !== url) ? url : null;

    setLoaded(false);
    let cancelled = false;

    const tryLoad = (src, fallback) => {
      const img = new Image();
      img.onload  = () => {
        if (!cancelled) { setActiveSrc(src); setLoaded(true); }
      };
      img.onerror = () => {
        if (!cancelled) {
          if (fallback) {
            tryLoad(fallback, null);
          } else {
            console.warn('[AlbumArt] both URLs failed:', src);
            setActiveSrc('');
            setLoaded(false);
          }
        }
      };
      img.src = src;
    };

    tryLoad(firstSrc, fallbackSrc);
    return () => { cancelled = true; };
  }, [url]);

  return (
    <div style={{
      width: size, height: size, flexShrink: 0,
      background: '#000',
      boxShadow: loaded
        ? '0 30px 90px rgba(0,0,0,.7), 0 0 0 .5px rgba(255,255,255,.04) inset'
        : 'none',
      overflow: 'hidden',
    }}>
      {loaded && activeSrc && (
        <img
          src={activeSrc}
          alt=""
          style={{
            width: '100%', height: '100%',
            objectFit: 'cover', display: 'block',
          }}
        />
      )}
    </div>
  );
}

window.AlbumArt = AlbumArt;
