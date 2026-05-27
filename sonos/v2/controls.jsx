// controls.jsx (v2) — Right control strip.
// Changes from v1:
//   • All playback icons 2× larger
//   • Inactive gray lifted from 0.22 → 0.28
//   • Speaker inactive gray lifted from 0.35 → 0.44

function fmt(s) {
  s = Math.max(0, Math.floor(s));
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

function Controls({ width, vinyl, paused, onPause, onSkipBack, onSkipForward,
                    onSpeakerClick, speakerOpen = false, scale = 1 }) {
  const { useState, useRef } = React;
  const [active,      setActive]      = useState(false);
  const [lastPressed, setLastPressed] = useState(null);
  const activeTimer = useRef(null);
  const pressTimer  = useRef(null);

  const wake = () => {
    setActive(true);
    clearTimeout(activeTimer.current);
    activeTimer.current = setTimeout(() => setActive(false), 10000);
  };

  const handlePress = (id, action) => {
    action?.();
    wake();
    setLastPressed(id);
    clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(() => setLastPressed(null), 5000);
  };

  // v2: inactive lifted from 0.22 → 0.28
  const getColor = (id) => {
    if (!active) return 'rgba(255,255,255,0.28)';
    if (lastPressed === id) return '#fff';
    return 'rgba(255,255,255,0.55)';
  };

  return (
    <div
      onPointerDown={wake}
      style={{
        width, height: '100%', background: '#000',
        position: 'relative',
      }}
    >
      {/* Playback icons — slightly above center */}
      <div style={{
        position: 'absolute',
        top: '43%', left: '50%',
        transform: 'translate(-50%, -50%)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center',
        gap: 28 * scale,
      }}>
        {!vinyl && (
          <>
            {/* v2: hitbox 80, icon 52 (≈2× original 26) */}
            <ControlButton
              onClick={() => handlePress('back', onSkipBack)}
              label="Previous track" size={80 * scale} color={getColor('back')}
            >
              <IconSkipBack size={52 * scale} />
            </ControlButton>
            {/* v2: hitbox 120, icon 68/62 (≈2× original 34/31) */}
            <ControlButton
              onClick={() => handlePress('pause', onPause)}
              size={120 * scale} label={paused ? 'Play' : 'Pause'} color={getColor('pause')}
            >
              {paused ? <IconPlay size={68 * scale} /> : <IconPause size={62 * scale} />}
            </ControlButton>
            <ControlButton
              onClick={() => handlePress('forward', onSkipForward)}
              label="Next track" size={80 * scale} color={getColor('forward')}
            >
              <IconSkipForward size={52 * scale} />
            </ControlButton>
          </>
        )}
      </div>

      {/* Speaker — midway between playback center and the bottom countdown */}
      <div style={{
        position: 'absolute',
        top: '80%', left: '50%',
        transform: 'translate(-50%, -50%)',
      }}>
        <button
          onClick={onSpeakerClick}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label="Speakers"
          style={{
            width: 72 * scale, height: 72 * scale,
            border: 'none', background: 'transparent', padding: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            // v2: inactive lifted from 0.35 → 0.44
            color: speakerOpen ? '#fff' : 'rgba(255,255,255,0.44)',
            transition: 'color .18s',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <IconSpeaker size={58 * scale} />
        </button>
      </div>
    </div>
  );
}

function ControlButton({ children, onClick, size = 44, label, color = 'rgba(255,255,255,0.5)' }) {
  const { useState } = React;
  const [pressed, setPressed] = useState(false);

  return (
    <button
      onClick={onClick}
      aria-label={label}
      style={{
        width: size, height: size,
        border: 'none', background: 'transparent', padding: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
        color,
        transform: pressed ? 'scale(0.85)' : 'scale(1)',
        opacity:   pressed ? 0.7 : 1,
        transition: pressed
          ? 'transform .1s'
          : 'transform .18s, color .4s, opacity .18s',
        WebkitTapHighlightColor: 'transparent',
      }}
      onPointerDown={() => setPressed(true)}
      onPointerUp={()   => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
    >
      {children}
    </button>
  );
}

// ─── Speaker / group panel (unchanged from v1) ────────────────────────────
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

  const allGroups = [...rooms].sort((a, b) => a.name.localeCompare(b.name));
  const sorted    = [...players].sort((a, b) => a.name.localeCompare(b.name));

  const activeSpeakers = sorted.filter(p => activePlayerIds.has(p.id));
  const masterVol = activeSpeakers.length > 0
    ? Math.round(
        activeSpeakers.reduce((sum, p) => sum + (playerVolumes[p.id] ?? 50), 0)
        / activeSpeakers.length
      )
    : 50;

  const LABEL = {
    padding: '10px 12px 6px',
    fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
    fontSize: 9, letterSpacing: '0.28em', textTransform: 'uppercase',
    fontWeight: 500,
    color: 'rgba(255,255,255,0.35)',
    textAlign: 'center',
  };

  return (
    <div
      data-speaker-panel=""
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        position: 'absolute', bottom: anchorBottom, right: anchorRight,
        width: 360,
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
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={LABEL}>Source</div>
          {allGroups.length === 0
            ? <div style={{ padding: '4px 12px 10px', fontSize: 12, color: 'rgba(255,255,255,0.28)' }}>No sources</div>
            : allGroups.map(g => (
                <GroupRow
                  key={g.id} group={g} isActive={g.active}
                  onSelect={() => { onSwitchGroup?.(g.id); onActivity?.(); }}
                />
              ))
          }
        </div>
        <div style={{
          width: '0.5px', background: 'rgba(255,255,255,0.1)',
          flexShrink: 0, margin: '10px 0',
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={LABEL}>Speakers</div>
          {sorted.length === 0
            ? <div style={{ padding: '4px 12px 10px', fontSize: 12, color: 'rgba(255,255,255,0.28)' }}>No speakers</div>
            : sorted.map(p => {
                const isIn = activePlayerIds.has(p.id);
                return (
                  <SpeakerRow
                    key={p.id} player={p} inGroup={isIn}
                    onToggle={() => {
                      isIn ? onRemovePlayer?.(p.id) : onAddPlayer?.(p.id);
                      onActivity?.();
                    }}
                    volume={playerVolumes[p.id]}
                    onVolumeChange={(v) => { onPlayerVolumeChange?.(p.id, v); onActivity?.(); }}
                    compact
                  />
                );
              })
          }
        </div>
      </div>
      <div style={{ borderTop: '0.5px solid rgba(255,255,255,0.1)', margin: '6px 0 0' }} />
      <div style={{ padding: '8px 16px 14px' }}>
        <div style={{ ...LABEL, padding: '0 0 8px', textAlign: 'left' }}>Master Volume</div>
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
              width: `${masterVol}%`, background: 'rgba(255,255,255,0.8)', borderRadius: 999,
            }} />
            <div style={{
              position: 'absolute', left: `${masterVol}%`, top: '50%',
              width: 13, height: 13, borderRadius: '50%',
              background: '#fff', transform: 'translate(-50%, -50%)',
              boxShadow: '0 1px 5px rgba(0,0,0,0.5)',
            }} />
            <input type="range" min="0" max="100" value={masterVol}
                   onChange={(e) => { onMasterVolumeChange?.(Number(e.target.value)); onActivity?.(); }}
                   style={{
                     position: 'absolute', inset: -8, width: 'calc(100% + 16px)',
                     opacity: 0, cursor: 'pointer',
                   }} />
          </div>
          <span style={{ opacity: 0.65, display: 'flex', flexShrink: 0 }}>
            <IconVolumeHigh size={14} />
          </span>
        </div>
      </div>
    </div>
  );
}

function GroupRow({ group, isActive, onSelect }) {
  const playing = group.playbackState === 'PLAYBACK_STATE_PLAYING';
  return (
    <button
      onClick={isActive ? undefined : onSelect}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        width: '100%', padding: '7px 12px',
        background: 'transparent', border: 'none', color: '#fff',
        cursor: isActive ? 'default' : 'pointer', textAlign: 'left',
        fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0, marginRight: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{group.name}</span>
        <span style={{ fontSize: 8, letterSpacing: '0.1em', textTransform: 'uppercase',
          fontFamily: '"JetBrains Mono", ui-monospace, monospace',
          color: playing ? 'rgba(62,207,106,0.85)' : 'rgba(255,255,255,0.3)' }}>
          {playing ? 'playing' : 'paused'}
        </span>
      </span>
      <span style={{
        display: 'block', flexShrink: 0,
        width: 30, height: 18, borderRadius: 999,
        background: isActive ? '#3ecf6a' : 'rgba(255,255,255,0.15)',
        position: 'relative', transition: 'background .18s',
      }}>
        <span style={{
          position: 'absolute', top: 2, left: isActive ? 12 : 2,
          width: 14, height: 14, borderRadius: '50%',
          background: '#fff', transition: 'left .18s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
        }} />
      </span>
    </button>
  );
}

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
        <span style={{ fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase',
          fontFamily: '"JetBrains Mono", ui-monospace, monospace',
          color: playing ? 'rgba(62,207,106,0.85)' : 'rgba(255,255,255,0.3)' }}>
          {playing ? 'playing' : 'paused'}
        </span>
      </span>
    </button>
  );
}

function SpeakerRow({ player, inGroup, onToggle, volume, onVolumeChange, compact = false }) {
  const px = compact ? 12 : 18;
  return (
    <div style={{ padding: `6px ${px}px 4px`, fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: inGroup ? 5 : 2 }}>
        <span style={{
          fontSize: 12, fontWeight: 500,
          color: inGroup ? '#fff' : 'rgba(255,255,255,0.45)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          flex: 1, marginRight: 6,
        }}>
          {player.name}
        </span>
        <button onClick={onToggle} style={{ background: 'transparent', border: 'none', padding: 0, flexShrink: 0, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
          <span style={{
            display: 'block', width: 30, height: 18, borderRadius: 999,
            background: inGroup ? '#3ecf6a' : 'rgba(255,255,255,0.15)',
            position: 'relative', transition: 'background .18s',
          }}>
            <span style={{
              position: 'absolute', top: 2, left: inGroup ? 12 : 2,
              width: 14, height: 14, borderRadius: '50%',
              background: '#fff', transition: 'left .18s',
              boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
            }} />
          </span>
        </button>
      </div>
      {inGroup && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 4 }}>
          <div style={{ flex: 1, position: 'relative', height: 2, background: 'rgba(255,255,255,0.1)', borderRadius: 999 }}>
            <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${volume ?? 50}%`, background: 'rgba(255,255,255,0.55)', borderRadius: 999 }} />
            <div style={{ position: 'absolute', left: `${volume ?? 50}%`, top: '50%', width: 11, height: 11, borderRadius: '50%', background: '#fff', transform: 'translate(-50%, -50%)', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }} />
            <input type="range" min="0" max="100" value={volume ?? 50}
              onChange={(e) => onVolumeChange?.(Number(e.target.value))}
              style={{ position: 'absolute', inset: -6, width: 'calc(100% + 12px)', opacity: 0, cursor: 'pointer' }} />
          </div>
          <div style={{ minWidth: 18, textAlign: 'right', fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontSize: 9, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.38)', fontVariantNumeric: 'tabular-nums' }}>
            {volume ?? '--'}
          </div>
        </div>
      )}
    </div>
  );
}

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
      <div style={{ flex: 1, position: 'relative', height: 4, background: 'rgba(255,255,255,0.12)', borderRadius: 999 }}>
        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${volume}%`, background: '#fff', borderRadius: 999 }} />
        <input type="range" min="0" max="100" value={volume}
               onChange={(e) => onChange(Number(e.target.value))}
               style={{ position: 'absolute', inset: -8, width: 'calc(100% + 16px)', opacity: 0, cursor: 'pointer' }} />
      </div>
      <span style={{ opacity: 0.85, display: 'flex' }}><IconVolumeHigh size={18} /></span>
    </div>
  );
}

function VerticalVolumeSlider({ volume, onChange, scale = 1 }) { return null; }

Object.assign(window, { Controls, ControlButton, VolumePanel, VerticalVolumeSlider,
                         SpeakerPanel, SourceRow, GroupRow, SpeakerRow, fmt });
