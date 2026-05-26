// controls.jsx — Right control strip + vertical volume slider.
//
// Volume fires on pointerDown (not click) so it opens immediately on first touch.
// The vertical volume slider lives in the right column of the layout (see app.jsx),
// spanning from the skip-back button down to just above the time remaining display.

function fmt(s) {
  s = Math.max(0, Math.floor(s));
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

function Controls({ width, vinyl, paused, active, onWake,
                    onPause, onSkipBack, onSkipForward,
                    volume, onVolumeClick, volumeOpen,
                    onSpeakerClick, speakerOpen, roomsActive,
                    scale = 1 }) {
  const VolumeIcon = volume < 33 ? IconVolumeLow : volume > 66 ? IconVolumeHigh : IconVolume;

  return (
    <div onPointerDown={onWake} style={{
      width, height: '100%', position: 'relative',
      background: '#000',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center',
      opacity: active ? 1 : 0.22,
      transition: 'opacity .9s cubic-bezier(.3,.7,.4,1)',
    }}>

      {/* Top third — Volume, biased ~20% toward center */}
      <div style={{
        flex: 1,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'flex-end',
        paddingBottom: 80 * scale,
        gap: 8 * scale,
      }}>
        {/* Fire on pointerDown so first touch opens immediately, stopPropagation
            prevents the parent onPointerDown (onWake) from double-calling */}
        <ControlButton
          label="Volume"
          size={53 * scale}
          onPointerDown={(e) => { e.stopPropagation(); onVolumeClick(); onWake(); }}
        >
          <VolumeIcon size={31 * scale} />
        </ControlButton>
        <div style={{
          fontFamily: '"JetBrains Mono", ui-monospace, monospace',
          fontSize: 9 * scale, letterSpacing: '0.18em',
          color: 'rgba(255,255,255,0.5)',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {String(volume).padStart(2, '0')}
        </div>
      </div>

      {/* Middle — Playback */}
      <div style={{
        flex: 1,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 18 * scale,
      }}>
        {!vinyl && (
          <>
            <ControlButton onClick={onSkipBack} label="Previous track" size={48 * scale}>
              <span style={{ opacity: 0.78 }}><IconSkipBack size={26 * scale} /></span>
            </ControlButton>
            <ControlButton onClick={onPause} primary size={53 * scale} label={paused ? 'Play' : 'Pause'} accent>
              {paused ? <IconPlay size={34 * scale} /> : <IconPause size={31 * scale} />}
            </ControlButton>
            <ControlButton onClick={onSkipForward} label="Next track" size={48 * scale}>
              <span style={{ opacity: 0.78 }}><IconSkipForward size={26 * scale} /></span>
            </ControlButton>
          </>
        )}
      </div>

      {/* Bottom third — Speakers, biased ~20% toward center */}
      <div style={{
        flex: 1,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'flex-start',
        paddingTop: 80 * scale,
        gap: 8 * scale,
      }}>
        <ControlButton onClick={onSpeakerClick} label="Speakers" size={53 * scale}>
          <IconSpeaker size={29 * scale} />
        </ControlButton>
        <div style={{
          fontFamily: '"JetBrains Mono", ui-monospace, monospace',
          fontSize: 9 * scale, letterSpacing: '0.18em',
          color: 'rgba(255,255,255,0.5)',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {roomsActive} ON
        </div>
      </div>
    </div>
  );
}

// ControlButton — fires scale animation on pointer events (works on touch + mouse).
// Accepts an optional onPointerDown for immediate-fire actions (volume button).
function ControlButton({ children, onClick, onPointerDown: forwardPD,
                         size = 44, primary = false, label, accent = false }) {
  const w = primary ? size * 1.4 : size;
  return (
    <button
      onClick={onClick}
      aria-label={label}
      style={{
        width: w, height: w, borderRadius: '50%',
        border: primary ? '1px solid rgba(255,255,255,0.18)' : 'none',
        background: primary ? 'rgba(255,255,255,0.06)' : 'transparent',
        color: accent ? '#fff' : 'rgba(255,255,255,0.95)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', padding: 0,
        transition: 'background .15s, transform .1s',
        WebkitTapHighlightColor: 'transparent',
      }}
      onPointerDown={(e) => {
        e.currentTarget.style.transform = 'scale(0.94)';
        if (forwardPD) forwardPD(e);
      }}
      onPointerUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
      onPointerLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
    >
      {children}
    </button>
  );
}

// ─── Vertical volume slider ────────────────────────────────────────────────
// Positioned absolutely in the right column (app.jsx), spanning from just
// above the skip-back button down to just above the time remaining display.
// Uses pointer capture so dragging works anywhere on the track.
function VerticalVolumeSlider({ volume, onChange, scale = 1 }) {
  const { useRef } = React;
  const trackRef = useRef(null);

  const calc = (e) => {
    const rect = trackRef.current.getBoundingClientRect();
    const y = (e.clientY - rect.top) / rect.height;
    // top = 100, bottom = 0
    onChange(Math.round(Math.max(0, Math.min(1, 1 - y)) * 100));
  };

  const VolumeIcon = volume < 33 ? IconVolumeLow : volume > 66 ? IconVolumeHigh : IconVolume;

  return (
    <div style={{
      position: 'absolute',
      // Align with skip-back button (~38% down) → time remaining (~bottom 56px)
      top: '38%',
      bottom: 56 * scale,
      left: 0, right: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center',
      zIndex: 20,
      animation: 'panelIn .18s cubic-bezier(.2,.7,.3,1)',
    }}>

      {/* Value label at top */}
      <div style={{
        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
        fontSize: 10 * scale, letterSpacing: '0.18em',
        color: 'rgba(255,255,255,0.45)',
        marginBottom: 10 * scale,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {String(volume).padStart(2, '0')}
      </div>

      {/* Interactive track area */}
      <div
        ref={trackRef}
        style={{
          flex: 1,
          width: 48 * scale, // wide hit area
          position: 'relative',
          display: 'flex', justifyContent: 'center',
          cursor: 'ns-resize',
          touchAction: 'none', // prevent scroll interference on iPad
        }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          calc(e);
        }}
        onPointerMove={(e) => { if (e.buttons) calc(e); }}
      >
        {/* Track line */}
        <div style={{
          position: 'absolute',
          top: 0, bottom: 0,
          width: 2 * scale,
          background: 'rgba(255,255,255,0.12)',
          borderRadius: 999,
        }}>
          {/* Fill */}
          <div style={{
            position: 'absolute',
            bottom: 0, left: 0, right: 0,
            height: `${volume}%`,
            background: 'rgba(255,255,255,0.75)',
            borderRadius: 999,
          }} />
          {/* Thumb */}
          <div style={{
            position: 'absolute',
            bottom: `${volume}%`,
            left: '50%',
            transform: 'translate(-50%, 50%)',
            width: 13 * scale, height: 13 * scale,
            borderRadius: '50%',
            background: '#fff',
            boxShadow: '0 2px 8px rgba(0,0,0,0.6)',
          }} />
        </div>

        {/* Volume icon — vertically centered on the track */}
        <div style={{
          position: 'absolute',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          background: '#000',
          borderRadius: '50%',
          width: 30 * scale, height: 30 * scale,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <VolumeIcon size={18 * scale} />
        </div>
      </div>
    </div>
  );
}

// ─── Speaker / room selector ───────────────────────────────────────────────
function SpeakerPanel({ rooms, onToggle, anchorRight, anchorBottom }) {
  return (
    <div style={{
      position: 'absolute', bottom: anchorBottom, right: anchorRight,
      width: 300, padding: '16px 0 10px',
      background: 'rgba(10,10,12,0.78)',
      backdropFilter: 'blur(40px) saturate(160%)',
      WebkitBackdropFilter: 'blur(40px) saturate(160%)',
      border: '0.5px solid rgba(255,255,255,0.14)',
      borderRadius: 14,
      boxShadow: '0 30px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset',
      color: '#fff', zIndex: 20,
      animation: 'panelIn .22s cubic-bezier(.2,.7,.3,1)',
    }}>
      <div style={{
        padding: '0 18px 12px',
        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
        fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.5)',
        borderBottom: '0.5px solid rgba(255,255,255,0.08)',
      }}>
        Speakers
      </div>
      <div style={{ padding: '8px 0' }}>
        {rooms.map((room) => (
          <button key={room.id} onClick={() => onToggle(room.id)} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            width: '100%', padding: '10px 18px',
            background: 'transparent', border: 'none', color: '#fff',
            cursor: 'pointer', textAlign: 'left',
            fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
            fontSize: 13.5, fontWeight: 500,
            WebkitTapHighlightColor: 'transparent',
          }}>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ color: room.on ? '#fff' : 'rgba(255,255,255,0.62)' }}>
                {room.name}
              </span>
              <span style={{
                fontSize: 10, letterSpacing: '0.08em',
                color: 'rgba(255,255,255,0.32)',
                fontFamily: '"JetBrains Mono", ui-monospace, monospace',
              }}>
                {room.deviceCount} {room.deviceCount === 1 ? 'speaker' : 'speakers'}
              </span>
            </span>
            <span style={{
              width: 36, height: 22, borderRadius: 999,
              background: room.on ? '#3ecf6a' : 'rgba(255,255,255,0.18)',
              position: 'relative', transition: 'background .18s',
              flexShrink: 0,
            }}>
              <span style={{
                position: 'absolute', top: 2, left: room.on ? 16 : 2,
                width: 18, height: 18, borderRadius: '50%',
                background: '#fff', transition: 'left .18s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
              }} />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Horizontal volume panel (used over album art) ────────────────────────
function VolumePanel({ volume, onChange, anchorRight, anchorTop }) {
  return (
    <div style={{
      position: 'absolute', top: anchorTop, right: anchorRight,
      width: 320, padding: '14px 18px',
      background: 'rgba(10,10,12,0.82)',
      backdropFilter: 'blur(40px) saturate(160%)',
      WebkitBackdropFilter: 'blur(40px) saturate(160%)',
      border: '0.5px solid rgba(255,255,255,0.14)',
      borderRadius: 14,
      boxShadow: '0 30px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset',
      color: '#fff', zIndex: 20,
      display: 'flex', alignItems: 'center', gap: 14,
      animation: 'panelIn .22s cubic-bezier(.2,.7,.3,1)',
    }}>
      <span style={{ opacity: 0.55, display: 'flex' }}><IconVolumeLow size={18} /></span>
      <div style={{
        flex: 1, position: 'relative', height: 4,
        background: 'rgba(255,255,255,0.12)', borderRadius: 999,
      }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, height: '100%',
          width: `${volume}%`, background: '#fff', borderRadius: 999,
        }} />
        <div style={{
          position: 'absolute', left: `${volume}%`, top: '50%',
          width: 14, height: 14, borderRadius: '50%',
          background: '#fff', transform: 'translate(-50%, -50%)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
        }} />
        <input type="range" min="0" max="100" value={volume}
               onChange={(e) => onChange(Number(e.target.value))}
               style={{
                 position: 'absolute', inset: -8, width: 'calc(100% + 16px)',
                 opacity: 0, cursor: 'pointer',
               }} />
      </div>
      <span style={{ opacity: 0.85, display: 'flex' }}><IconVolumeHigh size={18} /></span>
      <div style={{
        marginLeft: 4, minWidth: 24, textAlign: 'right',
        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
        fontSize: 11, letterSpacing: '0.05em',
        color: 'rgba(255,255,255,0.75)', fontVariantNumeric: 'tabular-nums',
      }}>
        {volume}
      </div>
    </div>
  );
}

Object.assign(window, { Controls, ControlButton, VolumePanel, VerticalVolumeSlider, SpeakerPanel, fmt });
