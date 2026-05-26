// album-art.jsx — Album artwork.
// Tries hi-res URL first; falls back to original on error; shows black + debug
// text if both fail (or if no URL was given).

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

  // Initialize synchronously so there's no flash of debug text on first render
  const [src, setSrc] = useState(() => {
    if (!url) return '';
    const hi = _hiRes(url);
    return (hi && hi !== url) ? hi : url;
  });

  useEffect(() => {
    if (!url) { setSrc(''); return; }
    const hi = _hiRes(url);
    setSrc((hi && hi !== url) ? hi : url);
  }, [url]);

  const handleError = () => {
    if (src !== url && url) {
      console.warn('[AlbumArt] hi-res failed, trying original:', url);
      setSrc(url);
    } else {
      console.warn('[AlbumArt] load failed:', url || '(no url)');
      setSrc('');
    }
  };

  return (
    <div style={{
      width: size, height: size, flexShrink: 0,
      background: '#000', overflow: 'hidden',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
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
