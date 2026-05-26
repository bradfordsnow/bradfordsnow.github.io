// album-art.jsx — Album artwork. Always shows black background.
// Image is hidden via CSS until it fully loads (prevents alt-text / broken
// image display). Tries a hi-res upscaled URL first; falls back to the
// original URL on error; shows pure black if both fail.

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

  const [src,    setSrc]    = useState('');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!url) { setSrc(''); setVisible(false); return; }
    const hi = _hiRes(url);
    setSrc(hi || url);
    setVisible(false);
  }, [url]);

  const handleError = () => {
    const original = url;
    if (src !== original && original) {
      // hi-res failed — retry with original URL
      setSrc(original);
    } else {
      // both failed — show nothing
      setSrc('');
    }
    setVisible(false);
  };

  return (
    <div style={{
      width: size, height: size, flexShrink: 0,
      background: '#000',
      boxShadow: visible ? '0 30px 90px rgba(0,0,0,.7), 0 0 0 .5px rgba(255,255,255,.04) inset' : 'none',
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
            // hidden until loaded — prevents alt-text box and broken-image icon
            opacity: visible ? 1 : 0,
          }}
          onLoad={()  => setVisible(true)}
          onError={handleError}
        />
      )}
    </div>
  );
}

window.AlbumArt = AlbumArt;
