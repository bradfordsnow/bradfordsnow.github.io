// portrait-layout.jsx — Vertical Now-Playing layout for portrait
// orientations on iPad and iPhone.
//
// Vertical composition: top margin · cover · bottom margin. Metadata is
// centered inside the top margin, controls are clustered together
// (justify-center, not space-between) in the bottom margin.

function PortraitLayout({
  width, height, vinyl, paused, shazam,
  volume, speakerOpen,
  playerVolumes = {}, onPlayerVolumeChange, onMasterVolumeChange,
  rooms = [], players = [], roomsActive, activeGroupId,
  controlsActive, onWake,
  onPause, onSkipBack, onSkipForward,
  onSpeakerClick, onSwitchGroup, onAddPlayer, onRemovePlayer,
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
          : <AlbumArt size={artSize} />}

        {speakerOpen && (
          <SpeakerPanel
            rooms={rooms} players={players} activeGroupId={activeGroupId}
            onSwitchGroup={onSwitchGroup} onAddPlayer={onAddPlayer} onRemovePlayer={onRemovePlayer}
            volume={volume} playerVolumes={playerVolumes}
            onMasterVolumeChange={onMasterVolumeChange}
            onPlayerVolumeChange={onPlayerVolumeChange}
            anchorBottom={20 * s} anchorRight={20 * s} />
        )}
      </div>

      {/* BOTTOM MARGIN — controls clustered together, centered */}
      <div style={{
        flex: 1, minHeight: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <HorizontalControls
          vinyl={vinyl} paused={paused}
          active={controlsActive} onWake={onWake}
          onPause={onPause} onSkipBack={onSkipBack} onSkipForward={onSkipForward}
          onSpeakerClick={onSpeakerClick}
          roomsActive={roomsActive}
          scale={s}
        />
      </div>
    </div>
  );
}

// ─── Horizontal controls dock (portrait analogue of the right strip) ──────
// Playback buttons + speaker button clustered together.
// Volume is now inside the SpeakerPanel — no standalone volume button.
function HorizontalControls({
  vinyl, paused, active, onWake,
  onPause, onSkipBack, onSkipForward,
  onSpeakerClick, roomsActive, scale = 1,
}) {
  return (
    <div onPointerDown={onWake} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: vinyl ? 120 * scale : 64 * scale,
      opacity: active ? 1 : 0.22,
      transition: 'opacity .9s cubic-bezier(.3,.7,.4,1)',
    }}>

      {/* Playback */}
      {!vinyl && (
        <div style={{
          display: 'flex', flexDirection: 'row', alignItems: 'center',
          gap: 18 * scale,
        }}>
          <ControlButton onClick={onSkipBack} label="Previous track" size={40 * scale}>
            <span style={{ opacity: 0.78 }}><IconSkipBack size={22 * scale} /></span>
          </ControlButton>
          <ControlButton onClick={onPause} primary label={paused ? 'Play' : 'Pause'} accent>
            {paused ? <IconPlay size={28 * scale} /> : <IconPause size={26 * scale} />}
          </ControlButton>
          <ControlButton onClick={onSkipForward} label="Next track" size={40 * scale}>
            <span style={{ opacity: 0.78 }}><IconSkipForward size={22 * scale} /></span>
          </ControlButton>
        </div>
      )}

      {/* Speakers */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 * scale }}>
        <ControlButton onClick={onSpeakerClick} label="Speakers" size={44 * scale}>
          <IconSpeaker size={24 * scale} />
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

window.PortraitLayout = PortraitLayout;
