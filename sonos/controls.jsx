// controls.jsx — Right control strip (playback + speaker button).
// Volume is entirely inside SpeakerPanel: per-speaker sliders + master footer.

function fmt(s) {
  s = Math.max(0, Math.floor(s));
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

// ─── Landscape right-strip ────────────────────────────────────────────────
function Controls({ width, vinyl, paused, active, onWake,
                    onPause, onSkipBack, onSkipForward,
                    onSpeakerClick, speakerOpen = false,
                    scale = 1 }) {
  const { useState } = React;
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onPointerDown={onWake}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width, height: '100%',
        background: '#000',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center',
        opacity: (active || hovered || speakerOpen) ? 1 : 0.22,
        transition: 'opacity .4s cubic-bezier(.3,.7,.4,1)',
      }}
    >
      {/* Top spacer */}
      <div style={{ flex: 1.4 }} />

      {/* Center — playback */}
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
            <ControlButton onClick={onPause} primary size={53 * scale} label={paused ? 'Play' : 'Pause'}>
              {paused ? <IconPlay size={34 * scale} /> : <IconPause size={31 * scale} />}
            </ControlButton>
            <ControlButton onClick={onSkipForward} label="Next track" size={48 * scale}>
              <span style={{ opacity: 0.78 }}><IconSkipForward size={26 * scale} /></span>
            </ControlButton>
          </>
        )}
      </div>

      {/* Bottom — speaker button: no circle ever, just gray or white */}
      <div style={{
        flex: 1.4,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'flex-end',
        paddingBottom: 90 * scale,
      }}>
        <button
          onClick={onSpeakerClick}
          aria-label="Speakers"
          style={{
            width: 53 * scale, height: 53 * scale,
            border: 'none', background: 'transparent', padding: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            color: speakerOpen ? '#fff' : 'rgba(255,255,255,0.6)',
            transition: 'color .18s',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <IconSpeaker size={29 * scale} />
        </button>
      </div>
    </div>
  );
}

// ─── ControlButton ────────────────────────────────────────────────────────
// primary=true  → no border/circle, just the icon (play/pause)
// active=true   → always white (used for speaker button when panel is open)
// hover brightens to full white; press scales down with opacity flash
function ControlButton({ children, onClick, onPointerDown: forwardPD,
                         size = 44, primary = false, active = false, label }) {
  const { useState } = React;
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const w = primary ? size * 1.4 : size;

  return (
    <button
      onClick={onClick}
      aria-label={label}
      style={{
        width: w, height: w, borderRadius: '50%',
        border: 'none',
        background: (hovered && !primary && !active) ? 'rgba(255,255,255,0.08)' : 'transparent',
        color: (hovered || pressed || active) ? '#fff' : 'rgba(255,255,255,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', padding: 0,
        transform: pressed ? 'scale(0.85)' : 'scale(1)',
        opacity: pressed ? 0.65 : 1,
        transition: pressed ? 'none' : 'transform .15s, opacity .15s, color .12s, background .12s',
        WebkitTapHighlightColor: 'transparent',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onPointerDown={(e) => {
        setPressed(true);
        if (forwardPD) forwardPD(e);
      }}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
    >
      {children}
    </button>
  );
}

// ─── Speaker / group panel ─────────────────────────────────────────────────
function SpeakerPanel({
  rooms = [], players = [], activeGroupId,
  onSwitchGroup, onAddPlayer, onRemovePlayer,
  playerVolumes = {}, volume = 50,
  onPlayerVolumeChange, onMasterVolumeChange,
  onActivity,
  anchorRight, anchorBottom,
}) {
  const activeGroup     = rooms.find(g => g.active);
  const activePlayerIds = new Set(activeGroup?.playerIds || []);

  // All groups alphabetically (active + inactive)
  const allGroups  = [...rooms].sort((a, b) => a.name.localeCompare(b.name));
  const sorted     = [...players].sort((a, b) => a.name.localeCompare(b.name));
  const inGroup    = sorted.filter(p => activePlayerIds.has(p.id));
  const notInGroup = sorted.filter(p => !activePlayerIds.has(p.id));

  const LABEL = {
    padding: '10px 18px 6px',
    fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
    fontSize: 9, letterSpacing: '0.28em', textTransform: 'uppercase',
    fontWeight: 500,
    color: 'rgba(255,255,255,0.35)',
    textAlign: 'center',
    textDecoration: 'underline',
    textDecorationColor: 'rgba(255,255,255,0.18)',
    textUnderlineOffset: '4px',
  };
  const HR = { margin: '2px 18px', borderTop: '0.5px solid rgba(255,255,255,0.08)' };

  return (
    <div
      data-speaker-panel=""
      onPointerDown={(e) => e.stopPropagation()}
      style={{
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
      }}
    >
      {/* All groups as radio-style toggles */}
      {allGroups.length > 0 && (
        <>
          <div style={LABEL}>Source</div>
          {allGroups.map(g => (
            <GroupRow
              key={g.id}
              group={g}
              isActive={g.active}
              onSelect={() => { onSwitchGroup?.(g.id); onActivity?.(); }}
            />
          ))}
          <div style={HR} />
        </>
      )}

      {/* All speakers — toggle = in group (green) or available (gray) */}
      <div style={LABEL}>Speakers</div>
      {sorted.length === 0
        ? <div style={{ padding: '4px 18px 10px', fontSize: 12, color: 'rgba(255,255,255,0.28)' }}>
            No speakers found
          </div>
        : sorted.map(p => {
            const isIn = activePlayerIds.has(p.id);
            return (
              <SpeakerRow
                key={p.id}
                player={p}
                inGroup={isIn}
                onToggle={() => {
                  isIn ? onRemovePlayer?.(p.id) : onAddPlayer?.(p.id);
                  onActivity?.();
                }}
                volume={playerVolumes[p.id]}
                onVolumeChange={(v) => { onPlayerVolumeChange?.(p.id, v); onActivity?.(); }}
              />
            );
          })
      }

      {/* Master volume footer */}
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
                   onChange={(e) => { onMasterVolumeChange?.(Number(e.target.value)); onActivity?.(); }}
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

// ─── GroupRow — radio-style toggle for all groups ─────────────────────────
function GroupRow({ group, isActive, onSelect }) {
  const playing = group.playbackState === 'PLAYBACK_STATE_PLAYING';
  return (
    <button
      onClick={isActive ? undefined : onSelect}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        width: '100%', padding: '8px 18px',
        background: 'transparent', border: 'none', color: '#fff',
        cursor: isActive ? 'default' : 'pointer', textAlign: 'left',
        fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 13, fontWeight: 500 }}>{group.name}</span>
        <span style={{
          fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase',
          fontFamily: '"JetBrains Mono", ui-monospace, monospace',
          color: playing ? 'rgba(62,207,106,0.85)' : 'rgba(255,255,255,0.3)',
        }}>
          {playing ? 'playing' : 'paused'}
        </span>
      </span>
      {/* Toggle pill — green ON when active, gray OFF otherwise */}
      <span style={{
        display: 'block', flexShrink: 0,
        width: 34, height: 20, borderRadius: 999,
        background: isActive ? '#3ecf6a' : 'rgba(255,255,255,0.15)',
        position: 'relative',
        transition: 'background .18s',
      }}>
        <span style={{
          position: 'absolute', top: 2, left: isActive ? 14 : 2,
          width: 16, height: 16, borderRadius: '50%',
          background: '#fff', transition: 'left .18s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
        }} />
      </span>
    </button>
  );
}

// ─── SourceRow — kept for compatibility ──────────────────────────────────
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
          {playing ? 'playing' : 'paused'}
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
function SpeakerRow({ player, inGroup, onToggle, volume, onVolumeChange }) {
  return (
    <div style={{
      padding: '7px 18px 4px',
      fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
    }}>
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

// ─── VolumePanel — kept for compatibility ────────────────────────────────
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
      <div style={{ flex: 1, position: 'relative', height: 4,
                    background: 'rgba(255,255,255,0.12)', borderRadius: 999 }}>
        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%',
                      width: `${volume}%`, background: '#fff', borderRadius: 999 }} />
        <input type="range" min="0" max="100" value={volume}
               onChange={(e) => onChange(Number(e.target.value))}
               style={{ position: 'absolute', inset: -8, width: 'calc(100% + 16px)',
                        opacity: 0, cursor: 'pointer' }} />
      </div>
      <span style={{ opacity: 0.85, display: 'flex' }}><IconVolumeHigh size={18} /></span>
    </div>
  );
}

function VerticalVolumeSlider({ volume, onChange, scale = 1 }) { return null; }

Object.assign(window, { Controls, ControlButton, VolumePanel, VerticalVolumeSlider, SpeakerPanel, SourceRow, GroupRow, SpeakerRow, fmt });
