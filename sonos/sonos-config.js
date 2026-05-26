// ─── Sonos developer credentials ──────────────────────────────────────────
// Register your app at developer.sonos.com → Create Integration
// Set the redirect URI there to exactly: https://bradfordsnow.com/sonos/
//
const SONOS_CONFIG = {
  clientId:     '',           // paste Client Key from developer.sonos.com
  clientSecret: '',           // paste Client Secret from developer.sonos.com
  redirectUri:  'https://bradfordsnow.com/sonos/',
  scope:        'playback-control-all',
};
