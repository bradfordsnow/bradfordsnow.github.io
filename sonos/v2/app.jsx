// app.jsx (v2) — Sonos Player.
// Changes from v1:
//   • Clock font size 2× (24 → 48)
//   • TimeRemaining font size 2× (18 → 36) and color 25% lighter (0.22 → 0.28)
//   • controlW widened to 160 to accommodate 2× icons
//   • TWEAK_DEFAULTS.spineLines = 3 (shows new 2-zone spine by default)

const { useState, useEffect, useRef, useCallback } = React;

function _isLocalUrl(url) {
  return Boolean(url && /^http:\/\/(127\.|192\.168\.|10\.\d+\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(url));
}

function _resolveCdnUrl(url) {
  if (!url) return null;
  if (/^x-sonos-https?:\/\//i.test(url))
    return _resolveCdnUrl(url.replace(/^x-sonos-https?:\/\//i, 'https://'));
  if (_isLocalUrl(url)) {
    try {
      const u = new URL(url).searchParams.get('u');
      if (u) return _resolveCdnUrl(decodeURIComponent(u));
    } catch {}
    return null;
  }
  if (url.startsWith('http://')) {
    const upgraded = 'https://' + url.slice(7);
    if (!_isLocalUrl(upgraded)) return upgraded;
    return null;
  }
  if (url.startsWith('https://')) return url;
  return null;
}

async function _fetchItunesArt(artist, song) {
  if (!artist && !song) return null;
  try {
    const q = encodeURIComponent([artist, song].filter(Boolean).join(' '));
    const res = await fetch(
      `https://itunes.apple.com/search?term=${q}&media=music&entity=song&limit=5&country=us`
    );
    if (!res.ok) return null;
    const { results = [] } = await res.json();
    const sl = song?.toLowerCase() || '';
    const al = artist?.toLowerCase() || '';
    const hit =
      results.find(r =>
        r.trackName?.toLowerCase() === sl &&
        r.artistName?.toLowerCase().includes(al)
      ) ||
      results.find(r => r.trackName?.toLowerCase() === sl) ||
      results[0];
    if (!hit?.artworkUrl100) return null;
    return hit.artworkUrl100.replace('100x100bb', '1200x1200bb');
  } catch {
    return null;
  }
}

// ─── Weather (Open-Meteo, free, no auth, CORS-enabled) ────────────────────
// Uses device GPS when available; falls back to Pasadena, CA.
// Cached coords so we don't re-prompt on every 30-min refresh.
let _weatherCoords = null; // null = untried, false = denied/unavailable

async function _getCoords() {
  if (_weatherCoords === false) return null;  // already denied this session
  if (_weatherCoords) return _weatherCoords;
  if (!navigator.geolocation) { _weatherCoords = false; return null; }
  try {
    const pos = await new Promise((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        timeout: 6000, maximumAge: 600000,
      })
    );
    _weatherCoords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
    return _weatherCoords;
  } catch {
    _weatherCoords = false; // denied or timed out — skip for rest of session
    return null;
  }
}

async function _fetchWeather() {
  try {
    const coords = await _getCoords();
    if (!coords) return null;
    const { lat, lon } = coords;
    const r = await fetch(
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
      '&current=temperature_2m' +
      '&daily=temperature_2m_max,temperature_2m_min' +
      '&temperature_unit=fahrenheit&forecast_days=1' +
      '&timezone=auto'
    );
    if (!r.ok) return null;
    const d = await r.json();
    return {
      current: Math.round(d.current.temperature_2m),
      lo:      Math.round(d.daily.temperature_2m_min[0]),
      hi:      Math.round(d.daily.temperature_2m_max[0]),
    };
  } catch { return null; }
}

// v2: default spineLines = 1 (one-line: artist · song · album)
const TWEAK_DEFAULTS = {
  device:      'ipad',
  orientation: 'landscape',
  vinyl:       false,
  shazam:      false,
  spineLines:  1,
};

function useSonos() {
  const [data, setData] = useState({
    loading:       true,
    error:         null,
    householdId:   null,
    groups:        [],
    players:       [],
    activeGroupId: null,
    playing:       false,
    track:         null,
    positionSecs:  0,
    volume:        40,
    vinyl:         false,
    playerVolumes: {},
  });

  const householdRef          = useRef(null);
  const selectedGroupRef      = useRef(null);
  const volumeDebounce        = useRef(null);
  const playerVolumeDebounces = useRef({});
  const artCacheRef           = useRef({});

  const poll = useCallback(async () => {
    try {
      if (!householdRef.current) {
        const { households } = await SonosAPI.getHouseholds();
        householdRef.current = households?.[0]?.id;
      }
      if (!householdRef.current) return;

      const { groups, players, active, playback, meta, vol } =
        await SonosAPI.fetchState(householdRef.current, selectedGroupRef.current);

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

      const artCandidates = [
        rawTrack?.imageUrl,
        item?.imageUrl,
        meta?.container?.imageUrl,
      ].map(_resolveCdnUrl);
      let resolvedArtUrl = artCandidates.find(Boolean) || '';

      if (!resolvedArtUrl && rawTrack?.name) {
        const artist = rawTrack.artist?.name || '';
        const song   = rawTrack.name;
        const cKey   = artist + '\x00' + song;
        const cached = artCacheRef.current[cKey];

        if (cached && cached !== 'loading' && cached !== 'none') {
          resolvedArtUrl = cached;
        } else if (!cached) {
          artCacheRef.current[cKey] = 'loading';
          _fetchItunesArt(artist, song).then(url => {
            artCacheRef.current[cKey] = url || 'none';
            if (url) {
              setData(d => {
                if (!d.track) return d;
                const dKey = (d.track.artist || '') + '\x00' + (d.track.song || '');
                if (dKey !== cKey || d.track.artworkUrl) return d;
                return { ...d, track: { ...d.track, artworkUrl: url } };
              });
            }
          }).catch(() => { artCacheRef.current[cKey] = 'none'; });
        }
      }

      if (rawTrack?.name) {
        const rawYear = rawTrack?.releaseDate || rawTrack?.year ||
                        rawTrack?.album?.year  || rawTrack?.album?.releaseDate || '';
        const year = rawYear ? (String(rawYear).match(/\d{4}/) || [''])[0] : '';
        track = {
          artist:      rawTrack.artist?.name || meta?.container?.name || '',
          song:        rawTrack.name,
          album:       rawTrack.album?.name || '',
          year,
          artworkUrl:  resolvedArtUrl,
          durationSecs:(rawTrack.durationMillis || 0) / 1000,
        };
      } else if (meta?.container?.name) {
        track = {
          artist:      meta.container.name,
          song:        meta.streamInfo || '',
          album:       '',
          year:        '',
          artworkUrl:  _resolveCdnUrl(meta.container.imageUrl) || '',
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

      const itunesKey = (rawTrack?.artist?.name || '') + '\x00' + (rawTrack?.name || '');
      window._sonosArtDebug = {
        trackRaw:     rawTrack?.imageUrl        || null,
        itemRaw:      item?.imageUrl            || null,
        containerRaw: meta?.container?.imageUrl || null,
        candidates:   artCandidates,
        sonosResolved:artCandidates.find(Boolean) || null,
        itunesStatus: artCacheRef.current[itunesKey] || 'not tried',
        resolved:     resolvedArtUrl            || null,
        vinylActive:  playing && (!track || !track.artworkUrl),
        song:         rawTrack?.name            || null,
        ts:           new Date().toISOString(),
      };
      console.log('[Sonos v2] artwork:', window._sonosArtDebug);

      // Vinyl/record-player only for actual line-in sources.
      // Sonos line-in container IDs start with x-rincon-stream: (analog)
      // or x-sonos-htastream: (TV/HDMI ARC).
      const containerId = meta?.container?.id || '';
      const isLineIn = /^x-rincon-stream:|^x-sonos-htastream:/i.test(containerId);

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
        vinyl:         playing && isLineIn,
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
    switchGroup: (groupId) => {
      selectedGroupRef.current = groupId;
      poll();
    },
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

function Root() {
  const [phase, setPhase] = useState('checking');
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code   = params.get('code');
    const state  = params.get('state');

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

    const hash = new URLSearchParams(window.location.hash.slice(1));
    const implicitToken = hash.get('access_token');
    if (implicitToken) {
      const expiresIn = parseInt(hash.get('expires_in') || '3600', 10);
      SonosAPI._saveTokens({ access_token: implicitToken, refresh_token: null, expires_in: expiresIn });
      window.history.replaceState({}, '', window.location.pathname);
      localStorage.setItem(SETUP_KEY, '1');
      setPhase('ready');
      return;
    }

    if (code) {
      setPhase('exchanging');
      SonosAPI.exchangeCode(code, state)
        .then(() => {
          window.history.replaceState({}, '', window.location.pathname);
          localStorage.setItem(SETUP_KEY, '1');
          const returnUrl = localStorage.getItem('sonos_auth_return');
          if (returnUrl) {
            localStorage.removeItem('sonos_auth_return');
            window.location.replace(returnUrl);
            return;
          }
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
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#08080a', color: '#fff', padding: 40, textAlign: 'center', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>
      <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 32 }}>Connection failed</div>
      <h1 style={{ fontFamily: '"Cormorant Garamond", serif', fontSize: 42, fontWeight: 400, margin: '0 0 16px' }}>Token error</h1>
      <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', maxWidth: 480, lineHeight: 1.65, margin: '0 0 24px' }}>Sonos authorized OK but the token exchange failed.</p>
      <div style={{ background: 'rgba(255,60,60,0.08)', border: '0.5px solid rgba(255,60,60,0.25)', borderRadius: 10, padding: '14px 20px', maxWidth: 520, fontFamily: '"JetBrains Mono", monospace', fontSize: 12, color: 'rgba(255,120,120,0.9)', lineHeight: 1.6, marginBottom: 40, wordBreak: 'break-all', textAlign: 'left' }}>
        {message || 'Unknown error'}
      </div>
      <button onClick={onRetry} style={{ background: '#fff', color: '#000', border: 'none', borderRadius: 12, padding: '14px 36px', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>Try again</button>
    </div>
  );
}

function Splash({ label = '' }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#08080a', color: 'rgba(255,255,255,0.35)', fontFamily: '"JetBrains Mono", monospace', fontSize: 11, letterSpacing: '0.28em', textTransform: 'uppercase' }}>
      {label}
    </div>
  );
}

function UnconfiguredScreen() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#08080a', color: '#fff', padding: 40, textAlign: 'center', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>
      <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 32 }}>Sonos</div>
      <h1 style={{ fontFamily: '"Cormorant Garamond", serif', fontSize: 42, fontWeight: 400, margin: '0 0 16px' }}>Setup needed</h1>
      <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', maxWidth: 420, lineHeight: 1.65, margin: '0 0 40px' }}>Add your Sonos developer credentials to <code>sonos-config.js</code>.</p>
    </div>
  );
}

const IS_REAL_DEVICE = /iPad|iPhone|iPod|Android/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const { data, actions, poll, refreshPlayerVolumes } = useSonos();

  const [speakerOpen,      setSpeakerOpen]      = useState(false);
  const [favoritesOpen,    setFavoritesOpen]    = useState(false);
  const [favoritesList,    setFavoritesList]    = useState([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [playlistsList,    setPlaylistsList]    = useState([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(false);
  const speakerTimer = useRef(null);

  const resetSpeakerTimer = () => {
    clearTimeout(speakerTimer.current);
    speakerTimer.current = setTimeout(() => setSpeakerOpen(false), 15000);
  };

  useEffect(() => { if (speakerOpen) resetSpeakerTimer(); }, [speakerOpen]);

  const onSpeakerClick    = () => { setSpeakerOpen(v => !v); setFavoritesOpen(false); };
  const onCloseSpeaker    = () => { setSpeakerOpen(false); };
  const onSpeakerActivity = () => { resetSpeakerTimer(); };

  const fetchFavorites = useCallback(async () => {
    if (!data.householdId) return;
    setFavoritesLoading(true);
    try {
      const res  = await SonosAPI.getFavorites(data.householdId);
      const list = (res.favorites || res.items || []).map(f => ({
        id:          f.id,
        name:        f.name        || '',
        description: f.description || '',
        imageUrl:    _resolveCdnUrl(f.imageUrl) || null,
        type:        f.resource?.type || f.type  || null,
        service:     f.service?.name  || null,
      }));
      setFavoritesList(list);
    } catch (err) {
      console.warn('Favorites fetch error:', err.message);
    } finally {
      setFavoritesLoading(false);
    }
  }, [data.householdId]);

  const fetchPlaylists = useCallback(async () => {
    if (!data.householdId) return;
    setPlaylistsLoading(true);
    try {
      const res  = await SonosAPI.getPlaylists(data.householdId);
      const list = (res.playlists || []).map(p => ({
        id:         p.id,
        name:       p.name       || '',
        imageUrl:   _resolveCdnUrl(p.imageUrl) || null,
        type:       'playlist',
        trackCount: p.trackCount || null,
        service:    null,
      }));
      setPlaylistsList(list);
    } catch (err) {
      console.warn('Playlists fetch error:', err.message);
    } finally {
      setPlaylistsLoading(false);
    }
  }, [data.householdId]);

  const onFavoritesClick = () => {
    const next = !favoritesOpen;
    setFavoritesOpen(next);
    if (next) { setSpeakerOpen(false); fetchFavorites(); fetchPlaylists(); }
  };
  const onCloseFavorites = () => setFavoritesOpen(false);
  const onPlayFavorite   = (fav) => {
    if (data.activeGroupId) {
      SonosAPI.loadFavorite(data.activeGroupId, fav.id)
        .then(() => setTimeout(() => poll(), 1500))
        .catch(err => console.warn('loadFavorite error:', err.message));
    }
    setFavoritesOpen(false);
  };
  const onPlayPlaylist = (pl) => {
    if (data.activeGroupId) {
      SonosAPI.loadPlaylist(data.activeGroupId, pl.id)
        .then(() => setTimeout(() => poll(), 1500))
        .catch(err => console.warn('loadPlaylist error:', err.message));
    }
    setFavoritesOpen(false);
  };

  useEffect(() => {
    if (speakerOpen) {
      const activeGroup = data.groups.find(g => g.active);
      if (activeGroup?.playerIds?.length) refreshPlayerVolumes(activeGroup.playerIds);
    }
  }, [speakerOpen]);

  const vinyl = t.vinyl || data.vinyl;
  const activeGroup = data.groups.find(g => g.active);
  const roomsActive = activeGroup?.playerIds?.length || 0;

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
      const activeGroup = data.groups.find(g => g.active);
      if (!activeGroup?.playerIds) return;
      const vols = activeGroup.playerIds
        .map(pid => data.playerVolumes[pid])
        .filter(pv => typeof pv === 'number');
      const oldMaster = vols.length > 0
        ? Math.round(vols.reduce((a, b) => a + b, 0) / vols.length)
        : 0;
      activeGroup.playerIds.forEach(pid => {
        const pVol = data.playerVolumes[pid];
        if (typeof pVol === 'number') {
          const newVol = oldMaster > 0
            ? Math.min(100, Math.max(0, Math.round(pVol * v / oldMaster)))
            : v;
          actions.setPlayerVol(pid, newVol);
        }
      });
    },
    onPlayerVolumeChange: (id, v) => { actions.setPlayerVol(id, v); },
    onSwitchGroup:        (id) => { actions.switchGroup(id); },
    onAddPlayer:          (id) => { actions.addToGroup(id); },
    onRemovePlayer:       (id) => { actions.removeFromGroup(id); },
    typeScale, lines: t.spineLines,
    favoritesOpen,
    favoritesList, favoritesLoading,
    playlistsList, playlistsLoading,
    onFavoritesClick, onCloseFavorites, onPlayFavorite, onPlayPlaylist,
  };

  let inner;
  if (IS_REAL_DEVICE) {
    inner = realOrientation === 'portrait'
      ? <PortraitLayout width={realW} height={realH} compact={false} {...layoutProps} />
      : <LandscapeLayout width={realW} height={realH} {...layoutProps} />;
  } else if (t.device === 'tv') {
    inner = <AppleTVLayout width={dw} height={dh} {...layoutProps} />;
  } else if (effectiveOrientation === 'portrait') {
    inner = <PortraitLayout width={dw} height={dh} compact={t.device === 'iphone'} {...layoutProps} />;
  } else {
    inner = <LandscapeLayout width={dw} height={dh} {...layoutProps} />;
  }

  let framed;
  if (IS_REAL_DEVICE) {
    framed = inner;
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

      <TweaksPanel title="Sonos Player v2">
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
        <TweakToggle label="Force vinyl mode" value={t.vinyl} onChange={v => setTweak('vinyl', v)} />
        <TweakToggle label="Identify via Shazam" value={t.shazam} onChange={v => setTweak('shazam', v)} />
        <TweakSection label="Account" />
        <TweakButton label="Sign out" onClick={() => { SonosAPI.logout(); window.location.reload(); }} />
      </TweaksPanel>
    </div>
  );
}

function frameSize(device, orientation) {
  if (device === 'tv') return { w: 1968, h: 1188 };
  if (device === 'iphone') return orientation === 'portrait' ? { w: 454, h: 936 } : { w: 936, h: 454 };
  return orientation === 'portrait' ? { w: 1124, h: 1500 } : { w: 1500, h: 1124 };
}
function displaySize(device, orientation) {
  if (device === 'tv') return { w: 1920, h: 1080 };
  if (device === 'iphone') return orientation === 'portrait' ? { w: 414, h: 896 } : { w: 896, h: 414 };
  return orientation === 'portrait' ? { w: 1024, h: 1400 } : { w: 1400, h: 1024 };
}
function deviceTypeScale(device) {
  if (device === 'tv')     return 1.4;
  if (device === 'iphone') return 0.5;
  return 1.0;
}

// ─── Clock widget — date / time / weather stacked ────────────────────────
// Font: Plus Jakarta Sans — original v1 clock font, weight 500.
// Date: "Wed Dec 24" above. Time: large center. Weather: lo°  N°  hi° below.
const _DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const _MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const _JF     = '"Plus Jakarta Sans", system-ui, sans-serif';

function Clock({ scale = 1, sideW = 0 }) {
  const [time,    setTime]    = useState(new Date());
  const [weather, setWeather] = useState(null);

  // Scale clock content to fit the right column.
  // Two-line layout: widest element is "00" (minutes) at 90px PJS weight-500
  // + 0.1em LS ≈ 135px natural width. Subtract 20px padding.
  const cs = sideW > 0 ? Math.min(scale, (sideW - 20) / 135) : scale;

  // Minute-accurate clock sync
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

  // Weather — fetch once then every 30 min
  useEffect(() => {
    _fetchWeather().then(w => { if (w) setWeather(w); });
    const id = setInterval(() => {
      _fetchWeather().then(w => { if (w) setWeather(w); });
    }, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const h    = time.getHours();
  const m    = time.getMinutes();
  const hr12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const dayStr  = _DAYS[time.getDay()];
  const dateStr = `${_MONTHS[time.getMonth()]} ${time.getDate()}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 * cs }}>

      {/* Date — stacked: WED (small) above MAY 27 (larger) */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 * cs }}>
        <div style={{
          fontFamily: _JF, fontSize: 16 * cs, fontWeight: 500,
          letterSpacing: '0.28em', textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.62)', whiteSpace: 'nowrap',
        }}>{dayStr}</div>
        <div style={{
          fontFamily: _JF, fontSize: 26 * cs, fontWeight: 500,
          letterSpacing: '0.28em', textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.62)', whiteSpace: 'nowrap',
        }}>{dateStr}</div>
      </div>

      {/* Time — two-line: hour / minutes, no separator */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 0, fontFamily: _JF, fontWeight: 500, lineHeight: 0.9,
      }}>
        <div style={{
          fontSize: 90 * cs, letterSpacing: '0.1em', color: '#fff',
        }}>{hr12}</div>
        <div style={{
          fontSize: 90 * cs, letterSpacing: '0.1em', color: '#fff',
        }}>{String(m).padStart(2, '0')}</div>
      </div>

      {/* Weather: 58°  72°  85° — lo/hi pulled tight to current */}
      {weather && (
        <div style={{
          display: 'flex', alignItems: 'baseline', gap: 6 * cs,
          fontFamily: _JF, marginTop: 10 * cs,
        }}>
          <span style={{
            fontSize: 19 * cs, fontWeight: 500, letterSpacing: '0.08em',
            color: 'rgba(255,255,255,0.42)', whiteSpace: 'nowrap', lineHeight: 1,
          }}>{weather.lo}°</span>
          <span style={{
            fontSize: 40 * cs, fontWeight: 500, letterSpacing: 0,
            color: 'rgba(255,255,255,0.82)', whiteSpace: 'nowrap', lineHeight: 1,
          }}>{weather.current}°</span>
          <span style={{
            fontSize: 19 * cs, fontWeight: 500, letterSpacing: '0.08em',
            color: 'rgba(255,255,255,0.42)', whiteSpace: 'nowrap', lineHeight: 1,
          }}>{weather.hi}°</span>
        </div>
      )}
    </div>
  );
}

// ─── TimeRemaining — v2: font size doubled (18 → 36), color 25% lighter ──
function TimeRemaining({ positionSecs = 0, durationSecs = 0, playing = false, scale = 1 }) {
  const [pos, setPos] = useState(positionSecs);

  useEffect(() => { setPos(positionSecs); }, [positionSecs]);

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
      fontFamily: _JF,
      fontSize: 28 * scale,
      fontWeight: 500,
      color: 'rgba(255,255,255,0.28)',  // v2: lifted from 0.22 (25% lighter)
      letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap',
    }}>
      {m}:{String(s).padStart(2, '0')}
    </div>
  );
}

// ─── Landscape layout — v2: controlW widened to 160 ──────────────────────
function LandscapeLayout({
  width, height, vinyl, paused, shazam,
  volume, speakerOpen,
  playerVolumes = {}, onPlayerVolumeChange, onMasterVolumeChange,
  rooms = [], players = [], roomsActive, activeGroupId,
  onPause, onSkipBack, onSkipForward,
  onSpeakerClick, onCloseSpeaker, onSpeakerActivity,
  onSwitchGroup, onAddPlayer, onRemovePlayer,
  typeScale = 1, lines = 3, track = {},
  positionSecs = 0,
  favoritesOpen = false,
  favoritesList = [], favoritesLoading = false,
  playlistsList = [], playlistsLoading = false,
  onFavoritesClick, onCloseFavorites, onPlayFavorite, onPlayPlaylist,
}) {
  const artSize = height;
  const controlW = 160 * typeScale;  // v2: widened from 84 to fit 2× icons
  const sideW = Math.floor((width - artSize) / 2);  // actual right-column pixel width
  const showSpine = !vinyl || (vinyl && shazam);

  return (
    <div style={{
      width, height, background: '#000', position: 'relative',
      display: 'flex', alignItems: 'stretch',
      fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
    }}>
      {(speakerOpen || favoritesOpen) && (
        <div
          style={{ position: 'absolute', inset: 0, zIndex: 19 }}
          onPointerDown={() => { onCloseSpeaker?.(); onCloseFavorites?.(); }}
        />
      )}

      <div style={{ flex: 1, height: '100%', background: '#000', display: 'flex', alignItems: 'stretch', justifyContent: 'center' }}>
        {showSpine && <Spine shazam={vinyl && shazam} scale={typeScale} lines={lines} track={track} />}
      </div>

      <div style={{ width: artSize, height: '100%', position: 'relative', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
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

        {favoritesOpen && (
          <FavoritesPanel
            favorites={favoritesList}  favoritesLoading={favoritesLoading}
            playlists={playlistsList}  playlistsLoading={playlistsLoading}
            onPlayFavorite={onPlayFavorite} onPlayPlaylist={onPlayPlaylist}
            anchorBottom={40 * typeScale} anchorRight={30 * typeScale} />
        )}
      </div>

      <div style={{ flex: 1, height: '100%', background: '#000', display: 'flex', alignItems: 'stretch', justifyContent: 'center', position: 'relative', zIndex: 20 }}>
        <Controls width={controlW} vinyl={vinyl} paused={paused}
                  onPause={onPause} onSkipBack={onSkipBack} onSkipForward={onSkipForward}
                  onSpeakerClick={onSpeakerClick} speakerOpen={speakerOpen}
                  onFavoritesClick={onFavoritesClick} favoritesOpen={favoritesOpen}
                  scale={typeScale} />

        <div style={{ position: 'absolute', top: 28 * typeScale, left: 0, right: 0, display: 'flex', justifyContent: 'center', overflow: 'hidden' }}>
          <Clock scale={typeScale} sideW={sideW} />
        </div>

        <div style={{ position: 'absolute', bottom: 12 * typeScale, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
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

function AppleTVLayout({
  width, height, vinyl, paused, shazam, typeScale = 1, lines = 3, track = {},
  positionSecs = 0,
}) {
  const artSize = height;
  const showSpine = !vinyl || (vinyl && shazam);
  return (
    <div style={{ width, height, background: '#000', position: 'relative', display: 'flex', alignItems: 'stretch', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>
      <div style={{ flex: 1, height: '100%', background: '#000', display: 'flex', alignItems: 'stretch', justifyContent: 'center' }}>
        {showSpine && <Spine shazam={vinyl && shazam} scale={typeScale} lines={lines} track={track} />}
      </div>
      <div style={{ width: artSize, height: '100%', position: 'relative', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
        {vinyl
          ? <VinylMode width={artSize} height={artSize} paused={paused} />
          : <AlbumArt size={artSize} url={track?.artworkUrl} />}
      </div>
      <div style={{ flex: 1, height: '100%', background: '#000', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 48, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
          <Clock scale={typeScale} />
        </div>
        <div style={{ position: 'absolute', bottom: 48, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
          <TimeRemaining positionSecs={positionSecs} durationSecs={track?.durationSecs || 0} playing={!paused} scale={typeScale} />
        </div>
      </div>
    </div>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  render() {
    if (this.state.err) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#08080a', color: '#fff', padding: 40, textAlign: 'center', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>
          <div style={{ fontSize: 11, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: 24 }}>Render error</div>
          <div style={{ background: 'rgba(255,50,50,0.08)', border: '0.5px solid rgba(255,80,80,0.3)', borderRadius: 10, padding: '16px 20px', maxWidth: 540, fontFamily: '"JetBrains Mono", monospace', fontSize: 12, color: 'rgba(255,130,130,0.9)', lineHeight: 1.65, wordBreak: 'break-all', textAlign: 'left' }}>
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
