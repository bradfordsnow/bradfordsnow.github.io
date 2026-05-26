// portrait-layout.jsx — Vertical Now-Playing layout for portrait orientations.

function PortraitLayout({
  width, height, vinyl, paused, shazam,
  volume, speakerOpen,
  playerVolumes = {}, onPlayerVolumeChange, onMasterVolumeChange,
  rooms = [], players = [], roomsActive, activeGroupId,
  controlsActive, onWake,
  onPause, onSkipBack, onSkipForward,
  onSpeakerClick, onCloseSpeaker, onSpeakerActivity,
  onSwitchGroup, onAddPlayer, onRemovePlayer,
  compact = false, lines = 3, track = {},
}) {
  const s = compact ? 0.5 : 1;
  const sideMargin = compact ? 22 : 60;
  const diReserve = compact ? 56 : 0;
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
          active={controlsActive} onWake={onWake}
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
function HorizontalControls({
  vinyl, paused, active, onWake,
  onPause, onSkipBack, onSkipForward,
  onSpeakerClick, speakerOpen = false, scale = 1,
}) {
  const { useState } = React;
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onPointerDown={onWake}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: vinyl ? 120 * scale : 64 * scale,
        opacity: (active || hovered || speakerOpen) ? 1 : 0.22,
        transition: 'opacity .4s cubic-bezier(.3,.7,.4,1)',
      }}
    >
      {/* Playback */}
      {!vinyl && (
        <div style={{
          display: 'flex', flexDirection: 'row', alignItems: 'center',
          gap: 18 * scale,
        }}>
          <ControlButton onClick={onSkipBack} label="Previous track" size={40 * scale}>
            <span style={{ opacity: 0.78 }}><IconSkipBack size={22 * scale} /></span>
          </ControlButton>
          <ControlButton onClick={onPause} primary label={paused ? 'Play' : 'Pause'}>
            {paused ? <IconPlay size={28 * scale} /> : <IconPause size={26 * scale} />}
          </ControlButton>
          <ControlButton onClick={onSkipForward} label="Next track" size={40 * scale}>
            <span style={{ opacity: 0.78 }}><IconSkipForward size={22 * scale} /></span>
          </ControlButton>
        </div>
      )}

      {/* Speaker button — no circle ever, just gray or white */}
      <button
        onClick={onSpeakerClick}
        aria-label="Speakers"
        style={{
          width: 44 * scale, height: 44 * scale,
          border: 'none', background: 'transparent', padding: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          color: speakerOpen ? '#fff' : 'rgba(255,255,255,0.6)',
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
