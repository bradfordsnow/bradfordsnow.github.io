// app.jsx — Sonos Player. Wired to the real Sonos Control API.
//
// Data flow:
//   Root → detects OAuth callback or checks auth → shows Onboarding or App
//   App  → polls SonosAPI.fetchState() every 4s → renders live data
//
// Track info (artist, song, album, artwork) flows down through layout props.
// Controls call SonosAPI directly; local state updates immediately for
// responsiveness, then syncs with the next poll.

const { useState, useEffect, useRef, useCallback } = React;

const TWEAK_DEFAULTS = {
  device:      'ipad',
  orientation: 'landscape',
  vinyl:       false,
  shazam:      false,
  spineLines:  1,
};

// ─── Sonos data hook ───────────────────────────────────────────────────────
function useSonos() {
  const [data, setData] = useState({
    loading:       true,
    error:         null,
    householdId:   null,
    groups:        [],
    activeGroupId: null,
    playing:       false,
    track:         null,   // { artist, song, album, year, artworkUrl, durationSecs }
    positionSecs:  0,
    volume:        40,
    vinyl:         false,
  });

  const householdRef = useRef(null);
  const volumeDebounce = useRef(null);

  const poll = useCallback(async () => {
    try {
      // Fetch household once, cache it
      if (!householdRef.current) {
        const { households } = await SonosAPI.getHouseholds();
        householdRef.current = households?.[0]?.id;
      }
      if (!householdRef.current) return;

      const { groups, active, playback, meta, vol } =
        await SonosAPI.fetchState(householdRef.current);

      if (!active) {
        setData(d => ({ ...d, loading: false, groups: [], playing: false }));
        return;
      }

      const playing = playback?.playbackState === 'PLAYBACK_STATE_PLAYING';
      const posSecs  = (playback?.positionMillis || 0) / 1000;

      // Extract track from metadata (handles streaming + radio differently)
      const item    = meta?.currentItem;
      const rawTrack = item?.track;
      let track = null;

      if (rawTrack?.name) {
        track = {
          artist:     rawTrack.artist?.name || meta?.container?.name || '',
          song:       rawTrack.name,
          album:      rawTrack.album?.name || '',
          year:       '',
          artworkUrl: rawTrack.imageUrl || meta?.container?.imageUrl || '',
          durationSecs: (rawTrack.durationMillis || 0) / 1000,
        };
      } else if (meta?.container?.name) {
        // Radio / line-in — show station as artist
        track = {
          artist:     meta.container.name,
          song:       meta.streamInfo || '',
          album:      '',
          year:       '',
          artworkUrl: meta.container.imageUrl || '',
          durationSecs: 0,
        };
      }

      const mappedGroups = groups.map(g => ({
        id:          g.id,
        name:        g.name,
        deviceCount: g.playerIds?.length || 1,
        on:          g.id === active.id,
      }));

      setData(d => ({
        ...d,
        loading:       false,
        error:         null,
        householdId:   householdRef.current,
        groups:        mappedGroups,
        activeGroupId: active.id,
        playing,
        track,
        positionSecs:  posSecs,
        volume:        vol?.volume ?? d.volume,
        vinyl:         !track,
      }));
    } catch (err) {
      console.warn('Sonos poll error:', err.message);
      setData(d => ({ ...d, loading: false, error: err.message }));
    }
  }, []);

  useEffect(() => {
    poll();
    const id = setInterval(poll, 4000);
    return () => clearInterval(id);
  }, [poll]);

  // Actions — optimistic local update, then API call
  const actions = {
    togglePlay: () => {
      setData(d => {
        const playing = !d.playing;
        if (d.activeGroupId) {
          playing ? SonosAPI.play(d.activeGroupId) : SonosAPI.pause(d.activeGroupId);
        }
        return { ...d, playing };
      });
    },
    skipNext: () => {
      setData(d => { if (d.activeGroupId) SonosAPI.nextTrack(d.activeGroupId); return d; });
    },
    skipPrev: () => {
      setData(d => { if (d.activeGroupId) SonosAPI.prevTrack(d.activeGroupId); return d; });
    },
    setVolume: (v) => {
      setData(d => ({ ...d, volume: v }));
      if (volumeDebounce.current) clearTimeout(volumeDebounce.current);
      volumeDebounce.current = setTimeout(() => {
        setData(d => {
          if (d.activeGroupId) SonosAPI.setVolume(d.activeGroupId, d.volume);
          return d;
        });
      }, 400);
    },
    toggleRoom: (id) => {
      // Visual toggle — full group management is a v2 feature
      setData(d => ({
        ...d,
        groups: d.groups.map(g => g.id === id ? { ...g, on: !g.on } : g),
      }));
    },
  };

  return { data, actions, poll };
}

// ─── Root — auth gate + OAuth callback handler ────────────────────────────
function Root() {
  const [phase, setPhase] = useState('checking');
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code   = params.get('code');
    const state  = params.get('state');

    if (!SonosAPI.isConfigured()) {
      setPhase('unconfigured');
      return;
    }

    // Implicit grant — token in hash fragment (#access_token=...&expires_in=...)
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const implicitToken = hash.get('access_token');
    if (implicitToken) {
      const expiresIn = parseInt(hash.get('expires_in') || '3600', 10);
      SonosAPI._saveTokens({
        access_token:  implicitToken,
        refresh_token: null,
        expires_in:    expiresIn,
      });
      window.history.replaceState({}, '', window.location.pathname);
      localStorage.setItem(SETUP_KEY, '1');
      setPhase('ready');
      return;
    }

    // Authorization code — exchange for token (requires CORS-friendly token endpoint)
    if (code) {
      setPhase('exchanging');
      SonosAPI.exchangeCode(code, state)
        .then(() => {
          window.history.replaceState({}, '', window.location.pathname);
          localStorage.setItem(SETUP_KEY, '1');
          setPhase('ready');
        })
        .catch(err => {
          console.error('OAuth exchange failed:', err);
          window.history.replaceState({}, '', window.location.pathname);
          setAuthError(err.message);
          setPhase('error');
        });
      return;
    }

    if (SonosAPI.isAuthenticated() && localStorage.getItem(SETUP_KEY)) {
      setPhase('ready');
    } else {
      setPhase('onboarding');
    }
  }, []);

  if (phase === 'checking' || phase === 'exchanging') return <Splash label={phase === 'exchanging' ? 'Connecting…' : 'Loading…'} />;
  if (phase === 'unconfigured') return <UnconfiguredScreen />;
  if (phase === 'error')        return <AuthErrorScreen message={authError} onRetry={() => setPhase('onboarding')} />;
  if (phase === 'onboarding')   return <OnboardingFlow onComplete={() => setPhase('ready')} />;
  return <App />;
}

function AuthErrorScreen({ message, onRetry }) {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#08080a', color: '#fff', padding: 40, textAlign: 'center',
      fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
    }}>
      <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.28em',
                    textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)',
                    marginBottom: 32 }}>Connection failed</div>
      <h1 style={{ fontFamily: '"Cormorant Garamond", serif', fontSize: 42,
                   fontWeight: 400, margin: '0 0 16px' }}>Token error</h1>
      <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', maxWidth: 480,
                  lineHeight: 1.65, margin: '0 0 24px' }}>
        Sonos authorized OK but the token exchange failed.
      </p>
      <div style={{
        background: 'rgba(255,60,60,0.08)', border: '0.5px solid rgba(255,60,60,0.25)',
        borderRadius: 10, padding: '14px 20px', maxWidth: 520,
        fontFamily: '"JetBrains Mono", monospace', fontSize: 12,
        color: 'rgba(255,120,120,0.9)', lineHeight: 1.6,
        marginBottom: 40, wordBreak: 'break-all', textAlign: 'left',
      }}>
        {message || 'Unknown error'}
      </div>
      <button onClick={onRetry} style={{
        background: '#fff', color: '#000', border: 'none', borderRadius: 12,
        padding: '14px 36px', fontSize: 15, fontWeight: 600, cursor: 'pointer',
        fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
      }}>
        Try again
      </button>
    </div>
  );
}

// ─── Splash / loading screen ──────────────────────────────────────────────
function Splash({ label = '' }) {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#08080a', color: 'rgba(255,255,255,0.35)',
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: 11, letterSpacing: '0.28em', textTransform: 'uppercase',
    }}>
      {label}
    </div>
  );
}

// ─── Unconfigured — shown when sonos-config.js has empty credentials ──────
function UnconfiguredScreen() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#08080a', color: '#fff', padding: 40, textAlign: 'center',
      fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
    }}>
      <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.28em',
                    textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)',
                    marginBottom: 32 }}>Sonos</div>
      <h1 style={{ fontFamily: '"Cormorant Garamond", serif', fontSize: 42,
                   fontWeight: 400, margin: '0 0 16px' }}>Setup needed</h1>
      <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', maxWidth: 420,
                  lineHeight: 1.65, margin: '0 0 40px' }}>
        Add your Sonos developer credentials to <code>sonos-config.js</code>.<br />
        Get them at <strong>developer.sonos.com</strong> → Create Integration.
      </p>
      <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12,
                    padding: '18px 24px', textAlign: 'left', maxWidth: 420,
                    fontFamily: '"JetBrains Mono", monospace', fontSize: 12,
                    lineHeight: 1.7, color: 'rgba(255,255,255,0.6)',
                    border: '0.5px solid rgba(255,255,255,0.1)' }}>
        <span style={{ color: 'rgba(255,255,255,0.3)' }}>// sonos-config.js</span><br />
        clientId: <span style={{ color: '#3ecf6a' }}>'YOUR_CLIENT_KEY'</span>,<br />
        clientSecret: <span style={{ color: '#3ecf6a' }}>'YOUR_CLIENT_SECRET'</span>,
      </div>
    </div>
  );
}

// ─── Main app ─────────────────────────────────────────────────────────────
function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const { data, actions } = useSonos();

  const [volumeOpen,   setVolumeOpen]   = useState(false);
  const [speakerOpen,  setSpeakerOpen]  = useState(false);
  const [controlsActive, setControlsActive] = useState(false);

  const controlsTimer = useRef(null);
  const volumeTimer   = useRef(null);
  const speakerTimer  = useRef(null);

  const wakeControls = () => {
    setControlsActive(true);
    clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => setControlsActive(false), 10000);
  };
  const resetVolumeTimer  = () => {
    clearTimeout(volumeTimer.current);
    volumeTimer.current = setTimeout(() => setVolumeOpen(false), 10000);
  };
  const resetSpeakerTimer = () => {
    clearTimeout(speakerTimer.current);
    speakerTimer.current = setTimeout(() => setSpeakerOpen(false), 10000);
  };

  useEffect(() => { if (volumeOpen)  resetVolumeTimer();  }, [volumeOpen]);
  useEffect(() => { if (speakerOpen) resetSpeakerTimer(); }, [speakerOpen]);

  const onVolumeClick  = () => { setSpeakerOpen(false); setVolumeOpen(v => !v); };
  const onSpeakerClick = () => { setVolumeOpen(false);  setSpeakerOpen(v => !v); };
  const onVolumeChange = v  => { actions.setVolume(v); resetVolumeTimer(); wakeControls(); };
  const onToggleRoom   = id => { actions.toggleRoom(id); resetSpeakerTimer(); wakeControls(); };

  // Effective vinyl mode: API says nothing playing → show vinyl
  const vinyl = t.vinyl || data.vinyl;

  const roomsActive = data.groups.filter(r => r.on).length;

  const effectiveOrientation = t.device === 'tv' ? 'landscape' : t.orientation;
  const { w: fw, h: fh } = frameSize(t.device, effectiveOrientation);
  const { w: dw, h: dh } = displaySize(t.device, effectiveOrientation);
  const typeScale = deviceTypeScale(t.device);

  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () => {
      const sx = (window.innerWidth  - 60) / fw;
      const sy = (window.innerHeight - 40) / fh;
      setScale(Math.min(1, sx, sy));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [fw, fh]);

  const layoutProps = {
    vinyl, paused: !data.playing, shazam: t.shazam,
    volume: data.volume, volumeOpen, speakerOpen,
    rooms: data.groups, roomsActive,
    controlsActive, onWake: wakeControls,
    track: data.track,
    positionSecs: data.positionSecs,
    onPause:        () => { actions.togglePlay(); wakeControls(); },
    onSkipBack:     () => { actions.skipPrev();   wakeControls(); },
    onSkipForward:  () => { actions.skipNext();   wakeControls(); },
    onVolumeClick:  () => { onVolumeClick(); wakeControls(); },
    onSpeakerClick: () => { onSpeakerClick(); wakeControls(); },
    onVolumeChange, onToggleRoom,
    typeScale, lines: t.spineLines,
  };

  let inner;
  if (t.device === 'tv') {
    inner = <AppleTVLayout width={dw} height={dh} {...layoutProps} />;
  } else if (effectiveOrientation === 'portrait') {
    inner = <PortraitLayout width={dw} height={dh}
              compact={t.device === 'iphone'} {...layoutProps} />;
  } else {
    inner = <LandscapeLayout width={dw} height={dh} {...layoutProps} />;
  }

  let framed;
  if (t.device === 'tv') {
    framed = <TVFrame scale={scale}>{inner}</TVFrame>;
  } else if (t.device === 'iphone') {
    framed = <IPhoneFrame orientation={effectiveOrientation} scale={scale}>{inner}</IPhoneFrame>;
  } else {
    framed = <IPadFrame orientation={effectiveOrientation} scale={scale}>{inner}</IPadFrame>;
  }

  return (
    <div style={{
      minHeight: '100vh', width: '100%',
      background: '#0a0a0c',
      backgroundImage: 'radial-gradient(ellipse at 50% 30%, #14141a 0%, #08080a 60%, #050506 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden', position: 'relative',
    }}>
      {framed}

      <TweaksPanel title="Sonos Player">
        <TweakSection label="Device" />
        <TweakRadio label="Device" value={t.device}
                    options={[
                      { value: 'ipad',   label: 'iPad'  },
                      { value: 'iphone', label: 'Phone' },
                      { value: 'tv',     label: 'TV'    },
                    ]}
                    onChange={v => setTweak('device', v)} />
        {t.device !== 'tv' && (
          <TweakRadio label="Orientation" value={t.orientation}
                      options={[
                        { value: 'landscape', label: 'Landscape' },
                        { value: 'portrait',  label: 'Portrait'  },
                      ]}
                      onChange={v => setTweak('orientation', v)} />
        )}
        <TweakSection label="Spine" />
        <TweakRadio label="Lines" value={t.spineLines}
                    options={[{ value: 1, label: '1' }, { value: 3, label: '3' }]}
                    onChange={v => setTweak('spineLines', v)} />
        <TweakSection label="Source" />
        <TweakToggle label="Force vinyl mode" value={t.vinyl}
                     onChange={v => setTweak('vinyl', v)} />
        <TweakToggle label="Identify via Shazam" value={t.shazam}
                     onChange={v => setTweak('shazam', v)} />
        <TweakSection label="Account" />
        <TweakButton label="Sign out" onClick={() => {
          SonosAPI.logout();
          window.location.reload();
        }} />
      </TweaksPanel>
    </div>
  );
}

// ─── Device sizing helpers ────────────────────────────────────────────────
function frameSize(device, orientation) {
  if (device === 'tv') return { w: 1968, h: 1188 };
  if (device === 'iphone') {
    return orientation === 'portrait' ? { w: 454, h: 936 } : { w: 936, h: 454 };
  }
  return orientation === 'portrait' ? { w: 1124, h: 1500 } : { w: 1500, h: 1124 };
}
function displaySize(device, orientation) {
  if (device === 'tv') return { w: 1920, h: 1080 };
  if (device === 'iphone') {
    return orientation === 'portrait' ? { w: 414, h: 896 } : { w: 896, h: 414 };
  }
  return orientation === 'portrait' ? { w: 1024, h: 1400 } : { w: 1400, h: 1024 };
}
function deviceTypeScale(device) {
  if (device === 'tv')     return 1.4;
  if (device === 'iphone') return 0.5;
  return 1.0;
}

// ─── Live clock ───────────────────────────────────────────────────────────
function Clock({ scale = 1 }) {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const sync = () => {
      const now = new Date();
      setTime(now);
      return 60000 - (now.getSeconds() * 1000 + now.getMilliseconds());
    };
    let id;
    const delay = sync();
    const t = setTimeout(() => { sync(); id = setInterval(sync, 60000); }, delay);
    return () => { clearTimeout(t); if (id) clearInterval(id); };
  }, []);
  const h = time.getHours();
  const m = time.getMinutes();
  const hr12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return (
    <div style={{
      fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
      fontSize: 24 * scale, fontWeight: 500,
      color: '#fff', letterSpacing: '0.1em',
      textTransform: 'uppercase', whiteSpace: 'nowrap',
    }}>
      {hr12}:{String(m).padStart(2, '0')}
    </div>
  );
}

// ─── Time remaining ───────────────────────────────────────────────────────
function TimeRemaining({ positionSecs = 0, durationSecs = 0, playing = false, scale = 1 }) {
  const [pos, setPos] = useState(positionSecs);

  // Sync when server data changes
  useEffect(() => { setPos(positionSecs); }, [positionSecs]);

  // Tick locally when playing
  useEffect(() => {
    if (!playing || durationSecs <= 0) return;
    const id = setInterval(() => setPos(p => Math.min(p + 1, durationSecs)), 1000);
    return () => clearInterval(id);
  }, [playing, durationSecs, positionSecs]);

  const remaining = Math.max(0, Math.round(durationSecs - pos));
  if (durationSecs <= 0) return null;

  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  return (
    <div style={{
      fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
      fontSize: 24 * scale, fontWeight: 500,
      color: 'rgba(255,255,255,0.22)',
      letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap',
    }}>
      -{m}:{String(s).padStart(2, '0')}
    </div>
  );
}

// ─── Landscape layout ─────────────────────────────────────────────────────
function LandscapeLayout({
  width, height, vinyl, paused, shazam,
  volume, volumeOpen, speakerOpen, rooms, roomsActive,
  controlsActive, onWake,
  onPause, onSkipBack, onSkipForward,
  onVolumeClick, onSpeakerClick, onVolumeChange, onToggleRoom,
  typeScale = 1, lines = 1, track = {},
  positionSecs = 0,
}) {
  const artSize = height;
  const controlW = 84 * typeScale;
  const showSpine = !vinyl || (vinyl && shazam);

  return (
    <div style={{
      width, height, background: '#000', position: 'relative',
      display: 'flex', alignItems: 'stretch',
      fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
    }}>
      {/* Left — spine */}
      <div style={{
        flex: 1, height: '100%', background: '#000',
        display: 'flex', alignItems: 'stretch', justifyContent: 'center',
      }}>
        {showSpine && <Spine shazam={vinyl && shazam} scale={typeScale} lines={lines} track={track} />}
      </div>

      {/* Center — album art */}
      <div style={{
        width: artSize, height: '100%', position: 'relative', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#000',
      }}>
        {vinyl
          ? <VinylMode width={artSize} height={artSize} paused={paused} />
          : <AlbumArt size={artSize} url={track?.artworkUrl} />}

        {volumeOpen && (
          <VolumePanel volume={volume} onChange={onVolumeChange}
                       anchorTop={200 * typeScale} anchorRight={20 * typeScale} />
        )}
        {speakerOpen && (
          <SpeakerPanel rooms={rooms} onToggle={onToggleRoom}
                        anchorBottom={40 * typeScale} anchorRight={30 * typeScale} />
        )}
      </div>

      {/* Right — controls + clock + time remaining */}
      <div style={{
        flex: 1, height: '100%', background: '#000',
        display: 'flex', alignItems: 'stretch', justifyContent: 'center',
        position: 'relative',
      }}>
        <Controls width={controlW} vinyl={vinyl} paused={paused}
                  active={controlsActive} onWake={onWake}
                  onPause={onPause} onSkipBack={onSkipBack} onSkipForward={onSkipForward}
                  volume={volume}
                  onVolumeClick={onVolumeClick} volumeOpen={volumeOpen}
                  onSpeakerClick={onSpeakerClick} speakerOpen={speakerOpen}
                  roomsActive={roomsActive} scale={typeScale} />

        <div style={{ position: 'absolute', top: 28 * typeScale, left: 0, right: 0,
                      display: 'flex', justifyContent: 'center' }}>
          <Clock scale={typeScale} />
        </div>

        <div style={{ position: 'absolute', bottom: 28 * typeScale, left: 0, right: 0,
                      display: 'flex', justifyContent: 'center' }}>
          <TimeRemaining
            positionSecs={positionSecs}
            durationSecs={track?.durationSecs || 0}
            playing={!paused}
            scale={typeScale}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Apple TV layout ──────────────────────────────────────────────────────
function AppleTVLayout({
  width, height, vinyl, paused, shazam, typeScale = 1, lines = 1, track = {},
  positionSecs = 0,
}) {
  const artSize = height;
  const showSpine = !vinyl || (vinyl && shazam);
  return (
    <div style={{
      width, height, background: '#000', position: 'relative',
      display: 'flex', alignItems: 'stretch',
      fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
    }}>
      <div style={{ flex: 1, height: '100%', background: '#000',
                    display: 'flex', alignItems: 'stretch', justifyContent: 'center' }}>
        {showSpine && <Spine shazam={vinyl && shazam} scale={typeScale} lines={lines} track={track} />}
      </div>

      <div style={{ width: artSize, height: '100%', position: 'relative', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: '#000' }}>
        {vinyl
          ? <VinylMode width={artSize} height={artSize} paused={paused} />
          : <AlbumArt size={artSize} url={track?.artworkUrl} />}
      </div>

      <div style={{ flex: 1, height: '100%', background: '#000', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 48, left: 0, right: 0,
                      display: 'flex', justifyContent: 'center' }}>
          <Clock scale={typeScale} />
        </div>
        <div style={{ position: 'absolute', bottom: 48, left: 0, right: 0,
                      display: 'flex', justifyContent: 'center' }}>
          <TimeRemaining
            positionSecs={positionSecs}
            durationSecs={track?.durationSecs || 0}
            playing={!paused}
            scale={typeScale}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Error boundary — catches render crashes and shows them on screen ─────
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  render() {
    if (this.state.err) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: '#08080a', color: '#fff', padding: 40, textAlign: 'center',
          fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
        }}>
          <div style={{ fontSize: 11, letterSpacing: '0.28em', textTransform: 'uppercase',
                        color: 'rgba(255,255,255,0.35)', marginBottom: 24 }}>Render error</div>
          <div style={{
            background: 'rgba(255,50,50,0.08)', border: '0.5px solid rgba(255,80,80,0.3)',
            borderRadius: 10, padding: '16px 20px', maxWidth: 540,
            fontFamily: '"JetBrains Mono", monospace', fontSize: 12,
            color: 'rgba(255,130,130,0.9)', lineHeight: 1.65,
            wordBreak: 'break-all', textAlign: 'left',
          }}>
            {this.state.err.message || String(this.state.err)}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary><Root /></ErrorBoundary>
);
