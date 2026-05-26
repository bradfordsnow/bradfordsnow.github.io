// album-art.jsx — Shows real artwork from the Sonos API, falls back to placeholder.

function AlbumArt({ size = 1024, url = '' }) {
  if (url) {
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
        />
      </div>
    );
  }
  // Placeholder when no art available
  return (
    <div style={{
      position: 'relative', width: size, height: size, flexShrink: 0,
      background: '#1a1a1e',
      boxShadow: '0 30px 90px rgba(0,0,0,.7), 0 0 0 .5px rgba(255,255,255,.04) inset',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <svg width={size * 0.18} height={size * 0.18} viewBox="0 0 24 24"
           fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" strokeLinecap="round">
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="3" />
        <line x1="12" y1="2" x2="12" y2="5" />
        <line x1="12" y1="19" x2="12" y2="22" />
      </svg>
    </div>
  );
}

window.AlbumArt = AlbumArt;
