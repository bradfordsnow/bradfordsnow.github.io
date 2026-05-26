// album-art.jsx — Shows real artwork from the Sonos API, falls back to placeholder.

function AlbumArt({ size = 1024, url = '' }) {
  const { useState } = React;
  const [failed, setFailed] = useState(false);

  if (!url || failed) return <div style={{ width: size, height: size, flexShrink: 0, background: '#000' }} />;

  return (
    <div style={{
      position: 'relative', width: size, height: size, flexShrink: 0,
      boxShadow: '0 30px 90px rgba(0,0,0,.7), 0 0 0 .5px rgba(255,255,255,.04) inset',
      overflow: 'hidden', background: '#111',
    }}>
      <img
        src={url}
        alt="Album art"
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        onError={() => { console.warn('[AlbumArt] failed to load:', url); setFailed(true); }}
        onLoad={() => setFailed(false)}
      />
    </div>
  );
}

window.AlbumArt = AlbumArt;
