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

// Returns true for private-network HTTP URLs that won't load on an HTTPS page
// (mixed-content block + Private Network Access restrictions in modern browsers)
function _isLocalUrl(url) {
  return Boolean(url && /^http:\/\/(127\.|192\.168\.|10\.\d+\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(url));
}

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
    groups:        [],   // all groups: { id, name, playerIds, playbackState, active }
    players:       [],   // all individual players: { id, name }
    activeGroupId: null,
    playing:       false,
    track:         null,
    positionSecs:  0,
    volume:        40,
    vinyl:         false,
    playerVolumes: {},
  });

  const householdRef          = useRef(null);
  const selectedGroupRef      = useRef(null);  // locked group — survives pause/stop
  const volumeDebounce        = useRef(null);
  const playerVolumeDebounces = useRef({});

  const poll = useCallback(async () => {
    try {
      if (!householdRef.current) {
        const { households } = await SonosAPI.getHouseholds();
        householdRef.current = households?.[0]?.id;
      }
      if (!householdRef.current) return;

      const { groups, players, active, playback, meta, vol } =
        await SonosAPI.fetchState(householdRef.current, selectedGroupRef.current);

      // Lock in selection on first load
      if (!selectedGroupRef.current && active) selectedGroupRef.current = active.id;

      if (!active) {
        setData(d => ({ ...d, loading: false, groups: [], players: [], playing: false }));
        return;
      }

      const playing  = playback?.playbackState === 'PLAYBACK_STATE_PLAYING';
      const posSecs  = (playback?.positionMillis || 0) / 1000;

      const item     = meta?.currentItem;
      const rawTrack = item?.track;
      let track = null;

      // Sonos often returns local-device URLs (http://192.168.x.x:1400/getaa...)
      // for per-track artwork. These can't load on an HTTPS page (mixed-content /
      // Private Network Access block). Skip them; container.imageUrl usually has
      // the real CDN URL (Spotify, Apple Music, etc.).
      const artCandidates = [
        rawTrack?.imageUrl,
        item?.imageUrl,
        meta?.container?.imageUrl,
      ];
      const resolvedArtUrl = artCandidates.find(u => u && !_isLocalUrl(u)) || '';

      if (rawTrack?.name) {
        track = {
          artist:      rawTrack.artist?.name || meta?.container?.name || '',
          song:        rawTrack.name,
          album:       rawTrack.album?.name || '',
          year:        '',
          artworkUrl:  resolvedArtUrl,
          durationSecs:(rawTrack.durationMillis || 0) / 1000,
        };
      } else if (meta?.container?.name) {
        const cArt = meta.container.imageUrl;
        track = {
          artist:      meta.container.name,
          song:        meta.streamInfo || '',
          album:       '',
          year:        '',
          artworkUrl:  _isLocalUrl(cArt) ? '' : (cArt || ''),
          durationSecs:0,
        };
      }

      const mappedGroups = groups.map(g => ({
        id:            g.id,
        name:          g.name,
        playerIds:     g.playerIds || [],
        playbackState: g.playbackState,
        active:        g.id === active.id,
      }));

      const mappedPlayers = (players || []).map(p => ({ id: p.id, name: p.name }));

      console.log('[Sonos] artwork:', {
        track:     rawTrack?.imageUrl        || '—',
        item:      item?.imageUrl            || '—',
        container: meta?.container?.imageUrl || '—',
        resolved:  track?.artworkUrl         || 'NONE (all local or missing)',
      });

      setData(d => ({
        ...d,
        loading:       false,
        error:         null,
        householdId:   householdRef.current,
        groups:        mappedGroups,
        players:       mappedPlayers,
        activeGroupId: active.id,
        playing,
        track,
        positionSecs:  posSecs,
        volume:        vol?.volume ?? d.volume,
        vinyl:         playing && !track,
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

  // Fetch current volumes for all players in a group (called when speaker panel opens)
  const refreshPlayerVolumes = useCallback(async (playerIds) => {
    if (!playerIds?.length) return;
    const vols = {};
    await Promise.all(playerIds.map(async (id) => {
      try {
        const res = await SonosAPI.getPlayerVolume(id);
        if (typeof res.volume === 'number') vols[id] = res.volume;
      } catch {}
    }));
    setData(d => ({ ...d, playerVolumes: { ...d.playerVolumes, ...vols } }));
  }, []);

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
    // Switch which group the UI is showing + controlling
    switchGroup: (groupId) => {
      selectedGroupRef.current = groupId;
      poll();
    },
    // Add/remove individual players from the active group
    addToGroup: (playerId) => {
      setData(d => {
        if (d.activeGroupId) SonosAPI.modifyGroupMembers(d.activeGroupId, [playerId], []);
        return d;
      });
    },
    removeFromGroup: (playerId) => {
      setData(d => {
        if (d.activeGroupId) SonosAPI.modifyGroupMembers(d.activeGroupId, [], [playerId]);
        return d;
      });
    },
    setPlayerVol: (playerId, vol) => {
      setData(d => ({ ...d, playerVolumes: { ...d.playerVolumes, [playerId]: vol } }));
      if (playerVolumeDebounces.current[playerId]) clearTimeout(playerVolumeDebounces.current[playerId]);
      playerVolumeDebounces.current[playerId] = setTimeout(() => {
        SonosAPI.setPlayerVolume(playerId, vol);
      }, 400);
    },
  };

  return { data, actions, poll, refreshPlayerVolumes };
}

// ─── Root — auth gate + OAuth callback handler ────────────────────────────
function Root() {
  const [phase, setPhase] = useState('checking');
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code   = params.get('code');
    const state  = params.get('state');

    // ?logout in URL wipes tokens and starts fresh
    if (params.has('logout')) {
      SonosAPI.logout();
      window.history.replaceState({}, '', window.location.pathname);
      setPhase('onboarding');
      return;
    }

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
const IS_REAL_DEVICE = /iPad|iPhone|iPod|Android/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPadOS 13+

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const { data, actions, refreshPlayerVolumes } = useSonos();

  const [speakerOpen, setSpeakerOpen] = useState(false);

  const speakerTimer = useRef(null);

  const resetSpeakerTimer = () => {
    clearTimeout(speakerTimer.current);
    speakerTimer.current = setTimeout(() => setSpeakerOpen(false), 15000);
  };

  useEffect(() => { if (speakerOpen) resetSpeakerTimer(); }, [speakerOpen]);

  const onSpeakerClick    = () => { setSpeakerOpen(v => !v); };
  const onCloseSpeaker    = () => { setSpeakerOpen(false); };
  const onSpeakerActivity = () => { resetSpeakerTimer(); };

  // Fetch per-player volumes whenever the speaker panel opens
  useEffect(() => {
    if (speakerOpen) {
      const activeGroup = data.groups.find(g => g.active);
      if (activeGroup?.playerIds?.length) {
        refreshPlayerVolumes(activeGroup.playerIds);
      }
    }
  }, [speakerOpen]);

  // Effective vinyl mode: API says nothing playing → show vinyl
  const vinyl = t.vinyl || data.vinyl;

  const activeGroup  = data.groups.find(g => g.active);
  const roomsActive  = activeGroup?.playerIds?.length || 0;

  const effectiveOrientation = t.device === 'tv' ? 'landscape' : t.orientation;
  const { w: fw, h: fh } = frameSize(t.device, effectiveOrientation);
  const { w: dw, h: dh } = displaySize(t.device, effectiveOrientation);
  const typeScale = IS_REAL_DEVICE ? 1.0 : deviceTypeScale(t.device);

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

  // On a real device: fill the viewport directly, no frame
  const realW = window.innerWidth;
  const realH = window.innerHeight;
  const realOrientation = realW > realH ? 'landscape' : 'portrait';

  const layoutProps = {
    vinyl, paused: !data.playing, shazam: t.shazam,
    volume: data.volume, speakerOpen,
    playerVolumes: data.playerVolumes,
    rooms: data.groups, players: data.players, roomsActive,
    activeGroupId: data.activeGroupId,
    track: data.track || {},
    positionSecs: data.positionSecs,
    onPause:       actions.togglePlay,
    onSkipBack:    actions.skipPrev,
    onSkipForward: actions.skipNext,
    onSpeakerClick,
    onCloseSpeaker,
    onSpeakerActivity,
    onMasterVolumeChange: (v) => {
      const oldMaster = data.volume;
      const activeGroup = data.groups.find(g => g.active);
      if (activeGroup?.playerIds) {
        activeGroup.playerIds.forEach(pid => {
          const pVol = data.playerVolumes[pid];
          if (typeof pVol === 'number') {
            const newVol = oldMaster > 0
              ? Math.min(100, Math.max(0, Math.round(pVol * v / oldMaster)))
              : v;
            actions.setPlayerVol(pid, newVol);
          }
        });
      }
      actions.setVolume(v);
    },
    onPlayerVolumeChange: (id, v) => { actions.setPlayerVol(id, v); },
    onSwitchGroup:        (id) => { actions.switchGroup(id); },
    onAddPlayer:          (id) => { actions.addToGroup(id); },
    onRemovePlayer:       (id) => { actions.removeFromGroup(id); },
    typeScale, lines: t.spineLines,
  };

  let inner;
  if (IS_REAL_DEVICE) {
    inner = realOrientation === 'portrait'
      ? <PortraitLayout width={realW} height={realH} compact={false} {...layoutProps} />
      : <LandscapeLayout width={realW} height={realH} {...layoutProps} />;
  } else if (t.device === 'tv') {
    inner = <AppleTVLayout width={dw} height={dh} {...layoutProps} />;
  } else if (effectiveOrientation === 'portrait') {
    inner = <PortraitLayout width={dw} height={dh}
              compact={t.device === 'iphone'} {...layoutProps} />;
  } else {
    inner = <LandscapeLayout width={dw} height={dh} {...layoutProps} />;
  }

  let framed;
  if (IS_REAL_DEVICE) {
    framed = inner; // no frame on real devices
  } else if (t.device === 'tv') {
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
      {data.error && (
        <div style={{
          position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(200,40,40,0.85)', borderRadius: 8,
          padding: '8px 14px', zIndex: 9999, maxWidth: '90vw',
          fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
          color: '#fff', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
          backdropFilter: 'blur(8px)',
        }}>
          API error: {data.error}
        </div>
      )}
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
  volume, speakerOpen,
  playerVolumes = {}, onPlayerVolumeChange, onMasterVolumeChange,
  rooms = [], players = [], roomsActive, activeGroupId,
  onPause, onSkipBack, onSkipForward,
  onSpeakerClick, onCloseSpeaker, onSpeakerActivity,
  onSwitchGroup, onAddPlayer, onRemovePlayer,
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
      {/* Click-outside overlay — closes speaker panel on any click outside it */}
      {speakerOpen && (
        <div
          style={{ position: 'absolute', inset: 0, zIndex: 19 }}
          onPointerDown={onCloseSpeaker}
        />
      )}

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

        {speakerOpen && (
          <SpeakerPanel
            rooms={rooms} players={players} activeGroupId={activeGroupId}
            onSwitchGroup={onSwitchGroup} onAddPlayer={onAddPlayer} onRemovePlayer={onRemovePlayer}
            volume={volume} playerVolumes={playerVolumes}
            onMasterVolumeChange={onMasterVolumeChange} onPlayerVolumeChange={onPlayerVolumeChange}
            onActivity={onSpeakerActivity}
            anchorBottom={40 * typeScale} anchorRight={30 * typeScale} />
        )}
      </div>

      {/* Right — controls + clock + time remaining (zIndex 20 keeps it above overlay) */}
      <div style={{
        flex: 1, height: '100%', background: '#000',
        display: 'flex', alignItems: 'stretch', justifyContent: 'center',
        position: 'relative', zIndex: 20,
      }}>
        <Controls width={controlW} vinyl={vinyl} paused={paused}
                  onPause={onPause} onSkipBack={onSkipBack} onSkipForward={onSkipForward}
                  onSpeakerClick={onSpeakerClick} speakerOpen={speakerOpen}
                  scale={typeScale} />

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
