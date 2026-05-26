// album-art.jsx — Album artwork.
// Renders <img> directly — no onLoad visibility gate (that was the bug:
// React's synthetic onLoad never fired for cached images, keeping opacity at 0
// forever). Now the image just appears as soon as the browser has it.
// Tries hi-res URL first; falls back to original on error; shows black if both fail.

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

  const [src, setSrc] = useState('');

  useEffect(() => {
    if (!url) { setSrc(''); return; }
    const hi = _hiRes(url);
    setSrc((hi && hi !== url) ? hi : url);
  }, [url]);

  const handleError = () => {
    // hi-res failed — retry with original URL
    if (src !== url && url) {
      console.warn('[AlbumArt] hi-res failed, trying original:', url);
      setSrc(url);
    } else {
      // both failed — show black
      console.warn('[AlbumArt] both URLs failed for:', url);
      setSrc('');
    }
  };

  return (
    <div style={{
      width: size, height: size, flexShrink: 0,
      background: '#000',
      overflow: 'hidden',
    }}>
      {src && (
        <img
          key={src}
          src={src}
          alt=""
          style={{
            width: '100%', height: '100%',
            objectFit: 'cover', display: 'block',
          }}
          onError={handleError}
        />
      )}
    </div>
  );
}

window.AlbumArt = AlbumArt;
