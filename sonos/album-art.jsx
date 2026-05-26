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

  const labelSize = Math.max(9, Math.floor(size * 0.013));

  return (
    <div style={{
      width: size, height: size, flexShrink: 0,
      background: '#000', overflow: 'hidden',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {src ? (
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
      ) : (
        /* Visible debug — shows URL we tried (or "no URL") so we can diagnose
           without opening dev tools. Remove once artwork is confirmed working. */
        <div style={{
          padding: `0 ${Math.round(size * 0.04)}px`,
          textAlign: 'center',
          fontFamily: '"JetBrains Mono", ui-monospace, monospace',
          fontSize: labelSize,
          color: 'rgba(255,255,255,0.2)',
          lineHeight: 1.65,
          wordBreak: 'break-all',
          userSelect: 'text',
        }}>
          {url ? url : 'No artwork URL from API'}
        </div>
      )}
    </div>
  );
}

window.AlbumArt = AlbumArt;
