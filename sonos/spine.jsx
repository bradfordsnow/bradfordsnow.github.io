// spine.jsx — Left spine column.
//
// Two layouts (controlled by `lines` prop):
//
//   lines=1 (compact): one rotated row reading bottom→top:
//     ARTIST · SONG · ALBUM · YEAR     (narrow spine, ~77×scale px)
//
//   lines=3 (spacious): three rotated columns running parallel up the spine:
//     ARTIST          (outer edge)
//     SONG (large)    (middle)
//     ALBUM · YEAR    (inner edge, closer to cover)
//
// All font sizes are 20% larger than the original design.

function Spine({ shazam, scale = 1, lines = 3, track = {} }) {
  const baseWidth = lines === 3 ? 187 : 77;
  return (
    <div style={{
      width: baseWidth * scale, flexShrink: 0,
      height: '100%',
      background: '#000', color: '#fff',
      position: 'relative',
      overflow: 'visible',
    }}>
      <div style={{
        position: 'absolute',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%) rotate(-90deg)',
        transformOrigin: 'center center',
      }}>
        {lines === 3
          ? <SpineThreeLines scale={scale} track={track} />
          : <SpineOneLine scale={scale} track={track} />}
      </div>

      {shazam && <ShazamMark scale={scale} />}
    </div>
  );
}

function SpineOneLine({ scale, track = {} }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'row', alignItems: 'baseline',
      gap: 34 * scale, whiteSpace: 'nowrap',
      lineHeight: 1,
    }}>
      <Artist size={16 * scale} name={track.artist} />
      <Song   size={48 * scale} name={track.song} />
      <Album  size={24 * scale} name={track.album} />
      {track.year && <Year size={12 * scale} name={track.year} />}
    </div>
  );
}

function SpineThreeLines({ scale, track = {} }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', gap: 29 * scale,
      lineHeight: 1, whiteSpace: 'nowrap',
    }}>
      <Artist size={22 * scale} name={track.artist} />
      <Song   size={74 * scale} name={track.song} />
      <AlbumYear scale={scale} track={track} />
    </div>
  );
}

// ─── Typographic atoms ─────────────────────────────────────────────────────
const ARTIST_FALLBACK = 'Now Playing';
const SONG_FALLBACK   = '';

function Artist({ size, name }) {
  return (
    <span style={{
      fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
      fontSize: size, fontWeight: 500, letterSpacing: '0.28em',
      textTransform: 'uppercase',
      color: 'rgba(255,255,255,0.82)',
    }}>{name || ARTIST_FALLBACK}</span>
  );
}
function Song({ size, name }) {
  if (!name) return null;
  return (
    <span style={{
      fontFamily: '"Cormorant Garamond", serif',
      fontSize: size, fontWeight: 500, letterSpacing: '-0.005em',
      color: '#fff',
    }}>{name}</span>
  );
}
function Album({ size, name }) {
  if (!name) return null;
  return (
    <span style={{
      fontFamily: '"Cormorant Garamond", serif',
      fontSize: size, fontStyle: 'italic', fontWeight: 400,
      color: 'rgba(255,255,255,0.52)',
    }}>{name}</span>
  );
}
function Year({ size, name }) {
  if (!name) return null;
  return (
    <span style={{
      fontFamily: '"JetBrains Mono", ui-monospace, monospace',
      fontSize: size, letterSpacing: '0.32em',
      color: 'rgba(255,255,255,0.4)',
    }}>{name}</span>
  );
}
function AlbumYear({ scale, track = {} }) {
  const hasAlbum = !!track.album;
  const hasYear  = !!track.year;
  if (!hasAlbum && !hasYear) return null;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'baseline',
      gap: 17 * scale, lineHeight: 1,
    }}>
      {hasAlbum && <Album size={26 * scale} name={track.album} />}
      {hasAlbum && hasYear && <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 17 * scale }}>·</span>}
      {hasYear  && <Year  size={14 * scale} name={track.year} />}
    </span>
  );
}

function ShazamMark({ scale }) {
  return (
    <div style={{
      position: 'absolute', bottom: 24 * scale, left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 * scale,
    }}>
      <svg width={14 * scale} height={14 * scale} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="2.2" fill="rgba(255,255,255,0.55)" />
        <path d="M16 8.5a5 5 0 0 1 0 7" stroke="rgba(255,255,255,0.45)"
              strokeWidth="1.4" strokeLinecap="round" fill="none" />
        <path d="M18.6 6a8.5 8.5 0 0 1 0 12" stroke="rgba(255,255,255,0.32)"
              strokeWidth="1.2" strokeLinecap="round" fill="none" />
      </svg>
      <div style={{
        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
        fontSize: 7.5 * scale, letterSpacing: '0.32em', textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.36)',
        writingMode: 'vertical-rl', transform: 'rotate(180deg)',
        whiteSpace: 'nowrap',
      }}>
        Shazam
      </div>
    </div>
  );
}

function MetadataBar({ scale = 1, shazam, lines = 3, track = {} }) {
  if (lines === 1) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'row', alignItems: 'baseline',
        gap: 34 * scale, whiteSpace: 'nowrap',
        lineHeight: 1,
      }}>
        <Artist size={16 * scale} name={track.artist} />
        <Song   size={48 * scale} name={track.song} />
        <Album  size={24 * scale} name={track.album} />
        {track.year && <Year size={12 * scale} name={track.year} />}
        {shazam && <PortraitShazamBadge scale={scale} />}
      </div>
    );
  }
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 14 * scale, lineHeight: 1, textAlign: 'center',
    }}>
      <Artist size={22 * scale} name={track.artist} />
      <Song   size={82 * scale} name={track.song} />
      <AlbumYear scale={scale} track={track} />
      {shazam && <PortraitShazamBadge scale={scale} />}
    </div>
  );
}

function PortraitShazamBadge({ scale }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6 * scale,
      fontFamily: '"JetBrains Mono", ui-monospace, monospace',
      fontSize: 8 * scale, letterSpacing: '0.32em', textTransform: 'uppercase',
      color: 'rgba(255,255,255,0.36)',
      marginTop: 4 * scale,
    }}>
      <svg width={12 * scale} height={12 * scale} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="2.2" fill="rgba(255,255,255,0.55)" />
        <path d="M16 8.5a5 5 0 0 1 0 7" stroke="rgba(255,255,255,0.45)"
              strokeWidth="1.4" strokeLinecap="round" fill="none" />
        <path d="M18.6 6a8.5 8.5 0 0 1 0 12" stroke="rgba(255,255,255,0.32)"
              strokeWidth="1.2" strokeLinecap="round" fill="none" />
      </svg>
      Shazam
    </span>
  );
}

Object.assign(window, { Spine, MetadataBar });
