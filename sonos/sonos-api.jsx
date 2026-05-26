// sonos-api.jsx — Sonos Control API client + OAuth helpers.
//
// Uses Authorization Code flow. clientId + clientSecret come from
// sonos-config.js which must be loaded first.
//
// All tokens are stored in localStorage under TOKEN_KEY.

const SONOS_OAUTH  = 'https://api.sonos.com/login/v3/oauth';
const SONOS_TOKEN  = 'https://api.sonos.com/login/v3/oauth/access';
const SONOS_BASE   = 'https://api.ws.sonos.com/control/api/v1';
const TOKEN_KEY    = 'sonos_tokens_v2';
const STATE_KEY    = 'sonos_oauth_state';

const SonosAPI = {

  // ── OAuth ──────────────────────────────────────────────────────────────

  isConfigured() {
    return !!(SONOS_CONFIG.clientId && SONOS_CONFIG.clientSecret);
  },

  isAuthenticated() {
    return !!this._tokens()?.access_token;
  },

  getAuthUrl() {
    const state = Math.random().toString(36).slice(2);
    localStorage.setItem(STATE_KEY, state);
    const p = new URLSearchParams({
      client_id:     SONOS_CONFIG.clientId,
      response_type: 'code',
      redirect_uri:  SONOS_CONFIG.redirectUri,
      state,
    });
    if (SONOS_CONFIG.scope) p.set('scope', SONOS_CONFIG.scope);
    return `${SONOS_OAUTH}?${p}`;
  },

  async exchangeCode(code, returnedState) {
    const expected = localStorage.getItem(STATE_KEY);
    if (expected && returnedState && returnedState !== expected) {
      throw new Error('OAuth state mismatch — possible CSRF');
    }
    localStorage.removeItem(STATE_KEY);
    const data = await this._tokenRequest({
      grant_type:   'authorization_code',
      code,
      redirect_uri: SONOS_CONFIG.redirectUri,
    });
    this._saveTokens(data);
  },

  async _refresh() {
    const t = this._tokens();
    if (!t?.refresh_token) throw new Error('No refresh token');
    const data = await this._tokenRequest({
      grant_type:    'refresh_token',
      refresh_token: t.refresh_token,
    });
    this._saveTokens(data);
  },

  async _tokenRequest(body) {
    const endpoint = SONOS_CONFIG.tokenProxy
      ? `${SONOS_CONFIG.tokenProxy}/token`
      : SONOS_TOKEN;
    const creds = btoa(`${SONOS_CONFIG.clientId}:${SONOS_CONFIG.clientSecret}`);
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${creds}`,
        'Content-Type':  'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(body),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`Token ${res.status}: ${errBody}`);
    }
    return res.json();
  },

  _saveTokens(data) {
    localStorage.setItem(TOKEN_KEY, JSON.stringify({
      access_token:  data.access_token,
      refresh_token: data.refresh_token,
      expires_at:    Date.now() + (data.expires_in - 60) * 1000,
    }));
  },

  _tokens() {
    try { return JSON.parse(localStorage.getItem(TOKEN_KEY)); }
    catch { return null; }
  },

  async _token() {
    const t = this._tokens();
    if (!t) return null;
    if (Date.now() > t.expires_at) {
      await this._refresh();
      return this._tokens()?.access_token;
    }
    return t.access_token;
  },

  logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(window.SETUP_KEY || 'sonos_setup_v1');
  },

  // ── HTTP helpers ───────────────────────────────────────────────────────

  _apiBase() {
    return SONOS_CONFIG.tokenProxy || SONOS_BASE;
  },

  async _get(path) {
    const token = await this._token();
    const res = await fetch(`${this._apiBase()}${path}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (res.status === 401) { await this._refresh(); return this._get(path); }
    if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
    return res.json();
  },

  async _post(path, body = {}) {
    const token = await this._token();
    const res = await fetch(`${this._apiBase()}${path}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify(body),
    });
    if (res.status === 401) { await this._refresh(); return this._post(path, body); }
    if (!res.ok) throw new Error(`POST ${path} → ${res.status}`);
    return res.status === 204 ? {} : res.json();
  },

  // ── Households & groups ────────────────────────────────────────────────

  getHouseholds() { return this._get('/households'); },
  getGroups(householdId) { return this._get(`/households/${householdId}/groups`); },

  // ── Playback ───────────────────────────────────────────────────────────

  getPlayback(groupId)         { return this._get(`/groups/${groupId}/playback`); },
  getPlaybackMetadata(groupId) { return this._get(`/groups/${groupId}/playbackMetadata`); },
  play(groupId)                { return this._post(`/groups/${groupId}/playback/play`); },
  pause(groupId)               { return this._post(`/groups/${groupId}/playback/pause`); },
  nextTrack(groupId)           { return this._post(`/groups/${groupId}/playback/skipToNextTrack`); },
  prevTrack(groupId)           { return this._post(`/groups/${groupId}/playback/skipToPreviousTrack`); },

  // ── Volume ─────────────────────────────────────────────────────────────

  getVolume(groupId)             { return this._get(`/groups/${groupId}/playback/volume`); },
  setVolume(groupId, volume)     { return this._post(`/groups/${groupId}/playback/volume`, { volume }); },
  getPlayerVolume(playerId)      { return this._get(`/players/${playerId}/playerVolume`); },
  setPlayerVolume(playerId, vol) { return this._post(`/players/${playerId}/playerVolume`, { volume: vol }); },

  // ── Group membership ───────────────────────────────────────────────────
  modifyGroupMembers(groupId, playerIdsToAdd = [], playerIdsToRemove = []) {
    return this._post(`/groups/${groupId}/groups/modifyGroupMembers`,
      { playerIdsToAdd, playerIdsToRemove });
  },

  // ── Compound fetch — returns everything the UI needs in one shot ───────
  // preferredGroupId: keep showing this group even if something else is playing
  async fetchState(householdId, preferredGroupId = null) {
    const { groups, players } = await this.getGroups(householdId);

    const active =
      (preferredGroupId && groups.find(g => g.id === preferredGroupId)) ||
      groups.find(g => g.playbackState === 'PLAYBACK_STATE_PLAYING')    ||
      groups.find(g => g.playbackState === 'PLAYBACK_STATE_PAUSED')     ||
      groups[0];

    if (!active) return { groups: [], players: players || [], active: null, playback: null, meta: null, vol: null };

    const [playback, meta, vol] = await Promise.all([
      this.getPlayback(active.id).catch(() => null),
      this.getPlaybackMetadata(active.id).catch(() => null),
      this.getVolume(active.id).catch(() => null),
    ]);

    return { groups, players: players || [], active, playback, meta, vol };
  },
};

window.SonosAPI = SonosAPI;
