// ─── Sonos developer credentials ──────────────────────────────────────────
// Register your app at developer.sonos.com → Create Integration
// Set the redirect URI there to exactly: https://bradfordsnow.com/sonos/
//
const SONOS_CONFIG = {
  clientId:     '12bee4d2-e225-4209-86f3-98e28f69dd0b',
  clientSecret: '0d05afba-adcb-4932-8c20-db4594b4c047',
  redirectUri:  'https://bradfordsnow.com/sonos/',
  scope:        'playback-control-all',
  tokenProxy:   'https://sonos-token.bradfordsnow.workers.dev',
};
