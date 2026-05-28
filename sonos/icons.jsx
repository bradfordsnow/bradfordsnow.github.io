// icons.jsx — SVG icons for the Sonos player.
// All icons are 24x24 viewBox, currentColor-based, 1.5px stroke.

const Icon = ({ size = 24, children, style }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none"
       stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"
       strokeLinejoin="round" style={style}>
    {children}
  </svg>
);

const IconVolume = ({ size }) => (
  <Icon size={size}>
    <path d="M4 10v4h3l4 3.5V6.5L7 10H4z" fill="currentColor" stroke="none" />
    <path d="M15 9.2a4 4 0 0 1 0 5.6" />
    <path d="M17.7 6.5a8 8 0 0 1 0 11" />
  </Icon>
);

const IconVolumeLow = ({ size }) => (
  <Icon size={size}>
    <path d="M4 10v4h3l4 3.5V6.5L7 10H4z" fill="currentColor" stroke="none" />
    <path d="M14.5 9.5a3.5 3.5 0 0 1 0 5" />
  </Icon>
);

const IconVolumeHigh = ({ size }) => (
  <Icon size={size}>
    <path d="M4 10v4h3l4 3.5V6.5L7 10H4z" fill="currentColor" stroke="none" />
    <path d="M14.5 9.2a4 4 0 0 1 0 5.6" />
    <path d="M17.2 6.5a8 8 0 0 1 0 11" />
    <path d="M19.7 4a11.5 11.5 0 0 1 0 16" />
  </Icon>
);

const IconPlay = ({ size }) => (
  <Icon size={size}>
    <path d="M7 4.5v15l13-7.5L7 4.5z" fill="currentColor" stroke="none" />
  </Icon>
);

const IconPause = ({ size }) => (
  <Icon size={size}>
    <rect x="6.5" y="5" width="4" height="14" rx="0.6" fill="currentColor" stroke="none" />
    <rect x="13.5" y="5" width="4" height="14" rx="0.6" fill="currentColor" stroke="none" />
  </Icon>
);

const IconSkipBack = ({ size }) => (
  <Icon size={size}>
    <path d="M18.5 5.5v13L9 12l9.5-6.5z" fill="currentColor" stroke="none" />
    <rect x="5" y="5.5" width="2" height="13" rx="0.4" fill="currentColor" stroke="none" />
  </Icon>
);

const IconSkipForward = ({ size }) => (
  <Icon size={size}>
    <path d="M5.5 5.5v13L15 12 5.5 5.5z" fill="currentColor" stroke="none" />
    <rect x="17" y="5.5" width="2" height="13" rx="0.4" fill="currentColor" stroke="none" />
  </Icon>
);

// Speaker — bookshelf speaker cabinet with woofer + tweeter
const IconSpeaker = ({ size }) => (
  <Icon size={size}>
    <rect x="6.5" y="2" width="11" height="20" rx="2" />
    <circle cx="12" cy="14" r="3" />
    <circle cx="12" cy="7" r="1.5" />
  </Icon>
);

Object.assign(window, {
  Icon, IconVolume, IconVolumeLow, IconVolumeHigh,
  IconPlay, IconPause, IconSkipBack, IconSkipForward, IconSpeaker,
});
