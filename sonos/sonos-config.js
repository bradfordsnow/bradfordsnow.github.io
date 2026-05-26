// ─── Sonos developer credentials ──────────────────────────────────────────
// Register your app at developer.sonos.com → Create Integration
// Set the redirect URI there to exactly: https://bradfordsnow.com/sonos/
//
const SONOS_CONFIG = {
  clientId:     '12bee4d2-e225-4209-86f3-98e28f69ddOb',           // paste Client Key from developer.sonos.com
  clientSecret: '0d05afba-adcb-4932-8c20-db4594b4c047',           // paste Client Secret from developer.sonos.com
  redirectUri:  'https://bradfordsnow.com/sonos/',
  scope:        '',                                               // try without scope first; add 'playback-control-all' if Sonos requires it
};
