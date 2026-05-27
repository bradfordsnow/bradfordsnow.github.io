// spine.jsx (v2) — Left spine column.
//
// lines=1 (compact): unchanged from v1 — one rotated row reading bottom→top.
//
// lines=3 (spacious): NEW two-zone layout:
//   SONG (large)              — outer edge (left in landscape)
//   ARTIST  ·  ALBUM  YEAR   — inner edge (closer to cover), all on one line
//
// All font sizes and ResizeObserver guard unchanged from v1.

function Spine({ shazam, scale = 1, lines = 3, track = {} }) {
  const { useRef, useEffect, useState } = React;
  const baseWidth = lines === 3 ? 187 : 77;
  const containerRef = useRef(null);
  const [availH, setAvailH] = useState(1024);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setAvailH(el.offsetHeight);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setAvailH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={containerRef} style={{
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
          ? <SpineThreeLines scale={scale} track={track} maxW={availH} />
          : <SpineOneLine    scale={scale} track={track} maxW={availH} />}
      </div>

      {shazam && <ShazamMark scale={scale} />}
    </div>
  );
}

// ─── v2 three-line: song outer, artist+album inner ─────────────────────────
function SpineThreeLines({ scale, track = {}, maxW = 0 }) {
  const songMaxW = maxW > 0 ? Math.max(80, maxW - Math.round(80 * scale)) : undefined;
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', gap: 44 * scale,
      lineHeight: 1, whiteSpace: 'nowrap',
    }}>
      {/* Zone 1 — outer edge (left in landscape): Song, large */}
      <Song size={49 * scale} name={track.song} maxWidth={songMaxW} />

      {/* Zone 2 — inner edge (closer to album cover): Artist · Album · Year, one line */}
      <ArtistAlbumLine scale={scale} track={track} />
    </div>
  );
}

// Artist · Album · Year all inline, used in the inner zone of v2 spine
function ArtistAlbumLine({ scale, track = {} }) {
  const hasArtist = !!track.artist;
  const hasAlbum  = !!track.album;
  const hasYear   = !!track.year;
  if (!hasArtist && !hasAlbum) return null;

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'baseline',
      gap: 18 * scale, lineHeight: 1,
    }}>
      {hasArtist && (
        <span style={{
          fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
          fontSize: 40 * scale, fontWeight: 500, letterSpacing: '0.28em',
          textTransform: 'uppercase', color: 'rgba(255,255,255,0.82)',
          whiteSpace: 'nowrap',
        }}>{track.artist}</span>
      )}
      {hasArtist && hasAlbum && (
        <span style={{ color: 'rgba(255,255,255,0.22)', fontSize: 16 * scale }}>·</span>
      )}
      {hasAlbum && (
        <span style={{
          fontFamily: '"Cormorant Garamond", serif',
          fontSize: 48 * scale, fontStyle: 'italic', fontWeight: 400,
          color: 'rgba(255,255,255,0.52)', whiteSpace: 'nowrap',
        }}>{track.album}</span>
      )}
      {hasYear && (
        <span style={{
          fontFamily: '"JetBrains Mono", ui-monospace, monospace',
          fontSize: 13 * scale, letterSpacing: '0.32em',
          color: 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap',
        }}>{track.year}</span>
      )}
    </div>
  );
}

// ─── v1 one-line layout (unchanged) ───────────────────────────────────────
function SpineOneLine({ scale, track = {}, maxW = 0 }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'row', alignItems: 'baseline',
      gap: 34 * scale, lineHeight: 1,
      ...(maxW > 0 ? { maxWidth: maxW } : {}),
    }}>
      <span style={{
        flexShrink: 0, whiteSpace: 'nowrap',
        fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
        fontSize: 16 * scale, fontWeight: 500, letterSpacing: '0.28em',
        textTransform: 'uppercase', color: 'rgba(255,255,255,0.82)',
      }}>{track.artist || 'Now Playing'}</span>

      {track.song && (
        <span style={{
          flex: '1 1 0', minWidth: 0,
          overflow: 'hidden', textOverflow: 'ellipsis',
          whiteSpace: 'nowrap', paddingBottom: '0.15em',
          fontFamily: '"Cormorant Garamond", serif',
          fontSize: 48 * scale, fontWeight: 500, letterSpacing: '-0.005em',
          color: '#fff',
        }}>{track.song}</span>
      )}

      {track.album && (
        <span style={{
          flexShrink: 0, whiteSpace: 'nowrap',
          fontFamily: '"Cormorant Garamond", serif',
          fontSize: 24 * scale, fontStyle: 'italic', fontWeight: 400,
          color: 'rgba(255,255,255,0.52)',
        }}>{track.album}{track.year ? ` - ${track.year}` : ''}</span>
      )}
    </div>
  );
}

// ─── Typographic atoms (unchanged) ────────────────────────────────────────
function Song({ size, name, maxWidth }) {
  if (!name) return null;
  return (
    <span style={{
      fontFamily: '"Cormorant Garamond", serif',
      fontSize: size, fontWeight: 500, letterSpacing: '-0.005em',
      color: '#fff',
      ...(maxWidth != null ? {
        display: 'block',
        width: 'fit-content',
        maxWidth,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        paddingBottom: '0.15em',
      } : {}),
    }}>{name}</span>
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

// ─── MetadataBar — portrait mode (unchanged from v1) ──────────────────────
function MetadataBar({ scale = 1, shazam, lines = 3, track = {} }) {
  if (lines === 1) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'row', alignItems: 'baseline',
        gap: 34 * scale, whiteSpace: 'nowrap',
        lineHeight: 1,
      }}>
        <span style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif', fontSize: 16 * scale, fontWeight: 500, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.82)' }}>{track.artist || 'Now Playing'}</span>
        {track.song && <span style={{ flex: '1 1 0', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingBottom: '0.15em', fontFamily: '"Cormorant Garamond", serif', fontSize: 48 * scale, fontWeight: 500, letterSpacing: '-0.005em', color: '#fff' }}>{track.song}</span>}
        {track.album && <span style={{ flexShrink: 0, whiteSpace: 'nowrap', fontFamily: '"Cormorant Garamond", serif', fontSize: 24 * scale, fontStyle: 'italic', fontWeight: 400, color: 'rgba(255,255,255,0.52)' }}>{track.album}</span>}
        {track.year && <span style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontSize: 12 * scale, letterSpacing: '0.28em', color: 'rgba(255,255,255,0.35)' }}>{track.year}</span>}
        {shazam && <PortraitShazamBadge scale={scale} />}
      </div>
    );
  }
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 14 * scale, lineHeight: 1, textAlign: 'center',
    }}>
      <span style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif', fontSize: 22 * scale, fontWeight: 500, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.82)' }}>{track.artist || 'Now Playing'}</span>
      {track.song && <span style={{ fontFamily: '"Cormorant Garamond", serif', fontSize: 82 * scale, fontWeight: 500, letterSpacing: '-0.005em', color: '#fff' }}>{track.song}</span>}
      {(track.album || track.year) && (
        <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 17 * scale, lineHeight: 1 }}>
          {track.album && <span style={{ fontFamily: '"Cormorant Garamond", serif', fontSize: 26 * scale, fontStyle: 'italic', fontWeight: 400, color: 'rgba(255,255,255,0.52)' }}>{track.album}</span>}
          {track.album && track.year && <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 17 * scale }}>{' - '}</span>}
          {track.year && <span style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontSize: 14 * scale, letterSpacing: '0.32em', color: 'rgba(255,255,255,0.4)' }}>{track.year}</span>}
        </span>
      )}
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
        <path d="M16 8.5a5 5 0 0 1 0 7" stroke="rgba(255,255,255,0.45)" strokeWidth="1.4" strokeLinecap="round" fill="none" />
        <path d="M18.6 6a8.5 8.5 0 0 1 0 12" stroke="rgba(255,255,255,0.32)" strokeWidth="1.2" strokeLinecap="round" fill="none" />
      </svg>
      Shazam
    </span>
  );
}

Object.assign(window, { Spine, MetadataBar });
