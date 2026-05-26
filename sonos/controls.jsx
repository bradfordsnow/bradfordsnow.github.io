// controls.jsx — Right control strip (playback + speaker button).
// Volume is now entirely inside SpeakerPanel: per-speaker sliders + master footer.

function fmt(s) {
  s = Math.max(0, Math.floor(s));
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

// ─── Landscape right-strip ────────────────────────────────────────────────
// Three vertical zones: spacer (clock sits above, absolutely) · playback · speaker
function Controls({ width, vinyl, paused, active, onWake,
                    onPause, onSkipBack, onSkipForward,
                    onSpeakerClick, roomsActive,
                    scale = 1 }) {
  return (
    <div onPointerDown={onWake} style={{
      width, height: '100%',
      background: '#000',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center',
      opacity: active ? 1 : 0.22,
      transition: 'opacity .9s cubic-bezier(.3,.7,.4,1)',
    }}>

      {/* Top spacer — clock lives here via absolute positioning in parent */}
      <div style={{ flex: 1.4 }} />

      {/* Center — playback buttons */}
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

      {/* Bottom — speaker button, pulled toward bottom edge */}
      <div style={{
        flex: 1.4,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'flex-end',
        paddingBottom: 44 * scale,
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

// ─── ControlButton ────────────────────────────────────────────────────────
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

// ─── Speaker / group panel ─────────────────────────────────────────────────
// Sections:
//   Sources      — other groups currently playing/paused, tap to switch focus
//   This group   — players in the active group: name · toggle · per-speaker volume
//   Add speakers — players not in the active group
//   Master       — group-wide volume slider pinned to the bottom
function SpeakerPanel({
  rooms = [], players = [], activeGroupId,
  onSwitchGroup, onAddPlayer, onRemovePlayer,
  playerVolumes = {}, volume = 50,
  onPlayerVolumeChange, onMasterVolumeChange,
  anchorRight, anchorBottom,
}) {
  const activeGroup     = rooms.find(g => g.active);
  const activePlayerIds = new Set(activeGroup?.playerIds || []);
  const otherGroups     = rooms.filter(g => !g.active);

  // Always alphabetical — never jumps around
  const sorted     = [...players].sort((a, b) => a.name.localeCompare(b.name));
  const inGroup    = sorted.filter(p => activePlayerIds.has(p.id));
  const notInGroup = sorted.filter(p => !activePlayerIds.has(p.id));

  const LABEL = {
    padding: '10px 18px 6px',
    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
    fontSize: 9, letterSpacing: '0.28em', textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.35)',
  };
  const HR = { margin: '2px 18px', borderTop: '0.5px solid rgba(255,255,255,0.08)' };

  return (
    <div style={{
      position: 'absolute', bottom: anchorBottom, right: anchorRight,
      width: 290,
      maxHeight: '74vh', overflowY: 'auto',
      background: 'rgba(10,10,12,0.93)',
      backdropFilter: 'blur(40px) saturate(160%)',
      WebkitBackdropFilter: 'blur(40px) saturate(160%)',
      border: '0.5px solid rgba(255,255,255,0.14)',
      borderRadius: 14,
      boxShadow: '0 30px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset',
      color: '#fff', zIndex: 20,
      animation: 'panelIn .22s cubic-bezier(.2,.7,.3,1)',
    }}>

      {/* Other sources — tap to switch active group */}
      {otherGroups.length > 0 && (
        <>
          <div style={LABEL}>Sources</div>
          {otherGroups.map(g => (
            <SourceRow key={g.id} group={g} onClick={() => onSwitchGroup?.(g.id)} />
          ))}
          <div style={HR} />
        </>
      )}

      {/* Speakers in the active group */}
      <div style={LABEL}>This group</div>
      {inGroup.length === 0
        ? <div style={{ padding: '4px 18px 10px', fontSize: 12, color: 'rgba(255,255,255,0.28)' }}>
            No speakers
          </div>
        : inGroup.map(p => (
            <SpeakerRow
              key={p.id}
              player={p}
              inGroup
              onToggle={() => onRemovePlayer?.(p.id)}
              volume={playerVolumes[p.id]}
              onVolumeChange={(v) => onPlayerVolumeChange?.(p.id, v)}
            />
          ))
      }

      {/* Speakers available to add */}
      {notInGroup.length > 0 && (
        <>
          <div style={HR} />
          <div style={LABEL}>Add speakers</div>
          {notInGroup.map(p => (
            <SpeakerRow
              key={p.id}
              player={p}
              inGroup={false}
              onToggle={() => onAddPlayer?.(p.id)}
            />
          ))}
        </>
      )}

      {/* ── Master volume footer ─────────────────────────────────────────── */}
      <div style={{ borderTop: '0.5px solid rgba(255,255,255,0.1)', margin: '6px 0 0' }} />
      <div style={{ padding: '10px 18px 16px' }}>
        <div style={{ ...LABEL, padding: '0 0 10px' }}>Master</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ opacity: 0.4, display: 'flex', flexShrink: 0 }}>
            <IconVolumeLow size={14} />
          </span>
          <div style={{
            flex: 1, position: 'relative', height: 3,
            background: 'rgba(255,255,255,0.12)', borderRadius: 999,
          }}>
            <div style={{
              position: 'absolute', left: 0, top: 0, height: '100%',
              width: `${volume}%`, background: 'rgba(255,255,255,0.8)', borderRadius: 999,
            }} />
            <div style={{
              position: 'absolute', left: `${volume}%`, top: '50%',
              width: 13, height: 13, borderRadius: '50%',
              background: '#fff', transform: 'translate(-50%, -50%)',
              boxShadow: '0 1px 5px rgba(0,0,0,0.5)',
            }} />
            <input type="range" min="0" max="100" value={volume}
                   onChange={(e) => onMasterVolumeChange?.(Number(e.target.value))}
                   style={{
                     position: 'absolute', inset: -8, width: 'calc(100% + 16px)',
                     opacity: 0, cursor: 'pointer',
                   }} />
          </div>
          <span style={{ opacity: 0.65, display: 'flex', flexShrink: 0 }}>
            <IconVolumeHigh size={14} />
          </span>
          <div style={{
            minWidth: 22, textAlign: 'right',
            fontFamily: '"JetBrains Mono", ui-monospace, monospace',
            fontSize: 10, letterSpacing: '0.06em',
            color: 'rgba(255,255,255,0.5)', fontVariantNumeric: 'tabular-nums',
          }}>
            {volume}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SourceRow ────────────────────────────────────────────────────────────
function SourceRow({ group, onClick }) {
  const playing = group.playbackState === 'PLAYBACK_STATE_PLAYING';
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      width: '100%', padding: '8px 18px',
      background: 'transparent', border: 'none', color: '#fff',
      cursor: 'pointer', textAlign: 'left',
      fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
      WebkitTapHighlightColor: 'transparent',
    }}>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 13, fontWeight: 500 }}>{group.name}</span>
        <span style={{
          fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase',
          fontFamily: '"JetBrains Mono", ui-monospace, monospace',
          color: playing ? 'rgba(62,207,106,0.85)' : 'rgba(255,255,255,0.3)',
        }}>
          {playing ? '▶ playing' : '⏸ paused'}
        </span>
      </span>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
           stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" strokeLinecap="round">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </button>
  );
}

// ─── SpeakerRow ───────────────────────────────────────────────────────────
// For speakers IN the group: name · toggle · volume slider
// For speakers NOT in the group: name · toggle (no slider)
function SpeakerRow({ player, inGroup, onToggle, volume, onVolumeChange }) {
  return (
    <div style={{
      padding: '7px 18px 4px',
      fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
    }}>
      {/* Name + toggle row */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: inGroup ? 6 : 3,
      }}>
        <span style={{
          fontSize: 13, fontWeight: 500,
          color: inGroup ? '#fff' : 'rgba(255,255,255,0.45)',
        }}>
          {player.name}
        </span>
        <button onClick={onToggle} style={{
          background: 'transparent', border: 'none', padding: 0,
          cursor: 'pointer', flexShrink: 0, WebkitTapHighlightColor: 'transparent',
        }}>
          <span style={{
            display: 'block',
            width: 34, height: 20, borderRadius: 999,
            background: inGroup ? '#3ecf6a' : 'rgba(255,255,255,0.15)',
            position: 'relative', transition: 'background .18s',
          }}>
            <span style={{
              position: 'absolute', top: 2, left: inGroup ? 14 : 2,
              width: 16, height: 16, borderRadius: '50%',
              background: '#fff', transition: 'left .18s',
              boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
            }} />
          </span>
        </button>
      </div>

      {/* Per-speaker volume slider — only when in group */}
      {inGroup && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 5 }}>
          <div style={{
            flex: 1, position: 'relative', height: 2,
            background: 'rgba(255,255,255,0.1)', borderRadius: 999,
          }}>
            <div style={{
              position: 'absolute', left: 0, top: 0, height: '100%',
              width: `${volume ?? 50}%`,
              background: 'rgba(255,255,255,0.55)', borderRadius: 999,
            }} />
            <div style={{
              position: 'absolute', left: `${volume ?? 50}%`, top: '50%',
              width: 11, height: 11, borderRadius: '50%',
              background: '#fff', transform: 'translate(-50%, -50%)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
            }} />
            <input
              type="range" min="0" max="100"
              value={volume ?? 50}
              onChange={(e) => onVolumeChange?.(Number(e.target.value))}
              style={{
                position: 'absolute', inset: -6, width: 'calc(100% + 12px)',
                opacity: 0, cursor: 'pointer',
              }}
            />
          </div>
          <div style={{
            minWidth: 20, textAlign: 'right',
            fontFamily: '"JetBrains Mono", ui-monospace, monospace',
            fontSize: 9, letterSpacing: '0.1em',
            color: 'rgba(255,255,255,0.38)', fontVariantNumeric: 'tabular-nums',
          }}>
            {volume ?? '--'}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── VolumePanel — kept for compatibility (no longer shown by default) ─────
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

// ─── VerticalVolumeSlider — kept for reference (unused) ───────────────────
function VerticalVolumeSlider({ volume, onChange, scale = 1 }) {
  const trackRef = React.useRef(null);
  const calc = (e) => {
    const rect = trackRef.current.getBoundingClientRect();
    const y = (e.clientY - rect.top) / rect.height;
    onChange(Math.round(Math.max(0, Math.min(1, 1 - y)) * 100));
  };
  const VolumeIcon = volume < 33 ? IconVolumeLow : volume > 66 ? IconVolumeHigh : IconVolume;
  return (
    <div style={{
      position: 'absolute', top: '38%', bottom: 56 * scale, left: 0, right: 0,
      display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 20,
      animation: 'panelIn .18s cubic-bezier(.2,.7,.3,1)',
    }}>
      <div style={{
        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
        fontSize: 10 * scale, letterSpacing: '0.18em',
        color: 'rgba(255,255,255,0.45)', marginBottom: 10 * scale,
        fontVariantNumeric: 'tabular-nums',
      }}>{String(volume).padStart(2, '0')}</div>
      <div ref={trackRef} style={{
        flex: 1, width: 48 * scale, position: 'relative',
        display: 'flex', justifyContent: 'center',
        cursor: 'ns-resize', touchAction: 'none',
      }}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); calc(e); }}
        onPointerMove={(e) => { if (e.buttons) calc(e); }}
      >
        <div style={{
          position: 'absolute', top: 0, bottom: 0,
          width: 2 * scale, background: 'rgba(255,255,255,0.12)', borderRadius: 999,
        }}>
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            height: `${volume}%`, background: 'rgba(255,255,255,0.75)', borderRadius: 999,
          }} />
          <div style={{
            position: 'absolute', bottom: `${volume}%`, left: '50%',
            transform: 'translate(-50%, 50%)',
            width: 13 * scale, height: 13 * scale, borderRadius: '50%',
            background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.6)',
          }} />
        </div>
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          background: '#000', borderRadius: '50%',
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

Object.assign(window, { Controls, ControlButton, VolumePanel, VerticalVolumeSlider, SpeakerPanel, SourceRow, SpeakerRow, fmt });
