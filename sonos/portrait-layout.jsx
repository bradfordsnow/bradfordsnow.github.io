// portrait-layout.jsx — Vertical Now-Playing layout for portrait orientations.

function PortraitLayout({
  width, height, vinyl, paused, shazam,
  volume, speakerOpen,
  playerVolumes = {}, onPlayerVolumeChange, onMasterVolumeChange,
  rooms = [], players = [], roomsActive, activeGroupId,
  onPause, onSkipBack, onSkipForward,
  onSpeakerClick, onCloseSpeaker, onSpeakerActivity,
  onSwitchGroup, onAddPlayer, onRemovePlayer,
  compact = false, lines = 3, track = {},
}) {
  const s = compact ? 0.5 : 1;
  const sideMargin    = compact ? 22 : 60;
  const diReserve     = compact ? 56 : 0;
  const minSideMargin = compact ? 90 : 170;
  const artSize = Math.min(
    width - sideMargin * 2,
    height - diReserve - minSideMargin * 2
  );
  const showSpine = !vinyl || (vinyl && shazam);

  return (
    <div style={{
      width, height, background: '#000', position: 'relative',
      display: 'flex', flexDirection: 'column',
      fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
      color: '#fff',
    }}>
      {compact && <div style={{ height: diReserve, flexShrink: 0 }} />}

      {/* Click-outside overlay — closes the speaker panel */}
      {speakerOpen && (
        <div
          style={{ position: 'absolute', inset: 0, zIndex: 19 }}
          onPointerDown={onCloseSpeaker}
        />
      )}

      {/* TOP MARGIN — metadata centered */}
      <div style={{
        flex: 1, minHeight: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: `0 ${sideMargin}px`,
      }}>
        {showSpine && <MetadataBar scale={s} shazam={shazam} lines={lines} track={track} />}
      </div>

      {/* COVER */}
      <div style={{
        flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
      }}>
        {vinyl
          ? <VinylMode width={artSize} height={artSize} paused={paused} />
          : <AlbumArt size={artSize} url={track?.artworkUrl} />}

        {speakerOpen && (
          <SpeakerPanel
            rooms={rooms} players={players} activeGroupId={activeGroupId}
            onSwitchGroup={onSwitchGroup} onAddPlayer={onAddPlayer} onRemovePlayer={onRemovePlayer}
            volume={volume} playerVolumes={playerVolumes}
            onMasterVolumeChange={onMasterVolumeChange}
            onPlayerVolumeChange={onPlayerVolumeChange}
            onActivity={onSpeakerActivity}
            anchorBottom={20 * s} anchorRight={20 * s} />
        )}
      </div>

      {/* BOTTOM MARGIN — controls */}
      <div style={{
        flex: 1, minHeight: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', zIndex: 20,
      }}>
        <HorizontalControls
          vinyl={vinyl} paused={paused}
          onPause={onPause} onSkipBack={onSkipBack} onSkipForward={onSkipForward}
          onSpeakerClick={onSpeakerClick}
          speakerOpen={speakerOpen}
          scale={s}
        />
      </div>
    </div>
  );
}

// ─── Horizontal controls dock ─────────────────────────────────────────────
// Manages its own active/dim state — no active/onWake props needed.
// Speaker button is fully independent.
function HorizontalControls({
  vinyl, paused, onPause, onSkipBack, onSkipForward,
  onSpeakerClick, speakerOpen = false, scale = 1,
}) {
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

  const getColor = (id) => {
    if (!active) return 'rgba(255,255,255,0.22)';
    if (lastPressed === id) return '#fff';
    return 'rgba(255,255,255,0.5)';
  };

  return (
    <div
      onPointerDown={wake}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: vinyl ? 120 * scale : 64 * scale,
      }}
    >
      {/* Playback */}
      {!vinyl && (
        <div style={{
          display: 'flex', flexDirection: 'row', alignItems: 'center',
          gap: 18 * scale,
        }}>
          <ControlButton
            onClick={() => handlePress('back', onSkipBack)}
            label="Previous track" size={40 * scale} color={getColor('back')}
          >
            <IconSkipBack size={22 * scale} />
          </ControlButton>
          <ControlButton
            onClick={() => handlePress('pause', onPause)}
            size={56 * scale} label={paused ? 'Play' : 'Pause'} color={getColor('pause')}
          >
            {paused ? <IconPlay size={28 * scale} /> : <IconPause size={26 * scale} />}
          </ControlButton>
          <ControlButton
            onClick={() => handlePress('forward', onSkipForward)}
            label="Next track" size={40 * scale} color={getColor('forward')}
          >
            <IconSkipForward size={22 * scale} />
          </ControlButton>
        </div>
      )}

      {/* Speaker button — independent, never wakes playback controls */}
      <button
        onClick={onSpeakerClick}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label="Speakers"
        style={{
          width: 44 * scale, height: 44 * scale,
          border: 'none', background: 'transparent', padding: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          color: speakerOpen ? '#fff' : 'rgba(255,255,255,0.35)',
          transition: 'color .18s',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <IconSpeaker size={24 * scale} />
      </button>
    </div>
  );
}

window.PortraitLayout = PortraitLayout;
