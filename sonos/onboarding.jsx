// onboarding.jsx — First-time WiFi + Sonos system discovery flow.
//
// Real iOS implementation notes:
//   Discovery: SSDP multicast to 239.255.255.250:1900
//              ST: urn:schemas-upnp-org:device:ZonePlayer:1
//   Each response gives a player IP; hit /status on port 1400 to confirm.
//   Store discovered household ID + player IPs in UserDefaults.
//   For cloud features (remote control): OAuth 2.0 via Sonos developer portal.
//
// This prototype simulates discovery with a timed animation.

const SETUP_KEY = 'sonos_setup_v1';

// ─── Step components ───────────────────────────────────────────────────────

function WelcomeStep({ onNext }) {
  return (
    <OnboardingShell>
      <div style={{ marginBottom: 48 }}>
        <SonosWordmark />
      </div>
      <h1 style={{
        fontFamily: '"Cormorant Garamond", serif',
        fontSize: 52, fontWeight: 400, letterSpacing: '-0.01em',
        color: '#fff', margin: '0 0 16px',
        lineHeight: 1.05,
      }}>
        Now Playing
      </h1>
      <p style={{
        fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
        fontSize: 16, fontWeight: 400, lineHeight: 1.6,
        color: 'rgba(255,255,255,0.52)',
        margin: '0 0 56px', maxWidth: 340,
      }}>
        A minimal display for your Sonos system. Connect once and it stays in sync automatically.
      </p>
      <OnboardingButton onClick={onNext}>
        Connect to Sonos
      </OnboardingButton>
      <p style={{
        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
        fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.28)',
        marginTop: 28,
      }}>
        Requires same Wi-Fi network
      </p>
    </OnboardingShell>
  );
}

function NetworkStep({ onNext, onBack }) {
  return (
    <OnboardingShell>
      <BackButton onClick={onBack} />
      <StepLabel>Step 1 of 2</StepLabel>
      <h2 style={stepHeading}>Check your network</h2>
      <p style={stepBody}>
        Make sure this device is on the same Wi-Fi network as your Sonos speakers.
        The app uses your local network to find and control them directly.
      </p>
      <NetworkDiagram />
      <OnboardingButton onClick={onNext} style={{ marginTop: 48 }}>
        I'm on the same network
      </OnboardingButton>
    </OnboardingShell>
  );
}

function ScanningStep({ progress, systemName }) {
  const done = progress >= 100;
  return (
    <OnboardingShell>
      <StepLabel>Step 2 of 2</StepLabel>
      <h2 style={stepHeading}>{done ? 'System found' : 'Searching...'}</h2>
      <p style={stepBody}>
        {done
          ? `Found "${systemName}" on your network.`
          : 'Looking for Sonos speakers on your local network.'}
      </p>
      <ScanRing progress={progress} done={done} />
    </OnboardingShell>
  );
}

function FoundStep({ rooms, systemName, onDone }) {
  const [selected, setSelected] = React.useState(
    () => new Set(rooms.filter(r => r.on).map(r => r.id))
  );
  const toggle = (id) => setSelected(s => {
    const n = new Set(s);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  return (
    <OnboardingShell>
      <StepLabel>Step 2 of 2</StepLabel>
      <h2 style={stepHeading}>Choose your rooms</h2>
      <p style={stepBody}>
        Select the rooms to show in your player. You can change this later.
      </p>
      <div style={{ width: '100%', maxWidth: 380, margin: '32px 0 0' }}>
        {rooms.map((room, i) => (
          <RoomRow
            key={room.id}
            room={room}
            checked={selected.has(room.id)}
            onToggle={() => toggle(room.id)}
            first={i === 0}
          />
        ))}
      </div>
      <OnboardingButton
        onClick={onDone}
        disabled={selected.size === 0}
        style={{ marginTop: 40 }}
      >
        Start listening
      </OnboardingButton>
    </OnboardingShell>
  );
}

function NotFoundStep({ onRetry, onManual }) {
  return (
    <OnboardingShell>
      <h2 style={{ ...stepHeading, color: 'rgba(255,255,255,0.9)' }}>
        No system found
      </h2>
      <p style={stepBody}>
        Make sure your Sonos speakers are powered on and connected to the same Wi-Fi network as this device.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 48, width: '100%', maxWidth: 340 }}>
        <OnboardingButton onClick={onRetry}>Try again</OnboardingButton>
        <button onClick={onManual} style={{
          background: 'transparent',
          border: '0.5px solid rgba(255,255,255,0.2)',
          borderRadius: 12, padding: '14px 28px',
          fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
          fontSize: 15, fontWeight: 500,
          color: 'rgba(255,255,255,0.6)',
          cursor: 'pointer',
        }}>
          Enter IP manually
        </button>
      </div>
    </OnboardingShell>
  );
}

function ManualStep({ onConnect, onBack }) {
  const [ip, setIp] = React.useState('');
  const valid = /^\d{1,3}(\.\d{1,3}){3}$/.test(ip.trim());
  return (
    <OnboardingShell>
      <BackButton onClick={onBack} />
      <h2 style={stepHeading}>Enter speaker IP</h2>
      <p style={stepBody}>
        Find the IP address of any Sonos speaker in the Sonos app under Settings &gt; System &gt; About My System.
      </p>
      <input
        type="text"
        placeholder="192.168.1.xx"
        value={ip}
        onChange={e => setIp(e.target.value)}
        style={{
          marginTop: 32,
          width: '100%', maxWidth: 340,
          background: 'rgba(255,255,255,0.06)',
          border: '0.5px solid rgba(255,255,255,0.18)',
          borderRadius: 10, padding: '14px 18px',
          fontFamily: '"JetBrains Mono", ui-monospace, monospace',
          fontSize: 16, letterSpacing: '0.08em',
          color: '#fff', outline: 'none',
        }}
      />
      <OnboardingButton
        onClick={() => onConnect(ip.trim())}
        disabled={!valid}
        style={{ marginTop: 24 }}
      >
        Connect
      </OnboardingButton>
    </OnboardingShell>
  );
}

// ─── Main flow ─────────────────────────────────────────────────────────────

function OnboardingFlow({ onComplete }) {
  const [step, setStep] = React.useState('welcome');
  const [scanProgress, setScanProgress] = React.useState(0);
  const [found, setFound] = React.useState(false);
  const systemName = 'Bradford\'s Home';
  const rooms = [
    { id: 'living',  name: 'Living Room', model: 'Era 300',  on: true  },
    { id: 'kitchen', name: 'Kitchen',     model: 'Sonos One', on: true  },
    { id: 'study',   name: 'Study',       model: 'Sonos One', on: false },
    { id: 'patio',   name: 'Patio',       model: 'Move',      on: false },
    { id: 'bed',     name: 'Bedroom',     model: 'Roam',      on: false },
  ];

  const startScan = () => {
    const url = SonosAPI.getAuthUrl();
    // Show URL in a prompt so it's visible/copyable on any device (no dev tools needed)
    const go = window.confirm(
      'About to redirect to Sonos login.\n\n' +
      'Auth URL:\n' + url + '\n\n' +
      'OK = continue to Sonos   Cancel = stay here'
    );
    if (go) window.location.href = url;
  };

  const finish = () => {
    localStorage.setItem(SETUP_KEY, '1');
    onComplete();
  };

  if (step === 'welcome')  return <WelcomeStep onNext={() => setStep('network')} />;
  if (step === 'network')  return <NetworkStep onNext={startScan} onBack={() => setStep('welcome')} />;
  if (step === 'scanning') return <ScanningStep progress={scanProgress} systemName={systemName} />;
  if (step === 'found')    return <FoundStep rooms={rooms} systemName={systemName} onDone={finish} />;
  if (step === 'notfound') return <NotFoundStep onRetry={startScan} onManual={() => setStep('manual')} />;
  if (step === 'manual')   return <ManualStep onConnect={finish} onBack={() => setStep('notfound')} />;
  return null;
}

// ─── UI primitives ─────────────────────────────────────────────────────────

function OnboardingShell({ children }) {
  return (
    <div style={{
      minHeight: '100vh', width: '100%',
      background: '#08080a',
      backgroundImage: 'radial-gradient(ellipse at 50% 20%, #111116 0%, #06060a 70%)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '60px 32px',
      fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
      color: '#fff',
      position: 'relative',
    }}>
      {children}
    </div>
  );
}

function OnboardingButton({ children, onClick, disabled, style }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%', maxWidth: 340,
        padding: '15px 28px',
        background: disabled ? 'rgba(255,255,255,0.08)' : '#fff',
        color: disabled ? 'rgba(255,255,255,0.3)' : '#000',
        border: 'none', borderRadius: 12,
        fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
        fontSize: 15, fontWeight: 600,
        cursor: disabled ? 'default' : 'pointer',
        transition: 'background .15s, color .15s, transform .1s',
        ...style,
      }}
      onMouseDown={e => !disabled && (e.currentTarget.style.transform = 'scale(0.98)')}
      onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
      onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
    >
      {children}
    </button>
  );
}

function BackButton({ onClick }) {
  return (
    <button onClick={onClick} style={{
      position: 'absolute', top: 40, left: 32,
      background: 'transparent', border: 'none',
      color: 'rgba(255,255,255,0.5)',
      fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
      fontSize: 14, fontWeight: 500,
      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
    }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M19 12H5M12 5l-7 7 7 7" />
      </svg>
      Back
    </button>
  );
}

function StepLabel({ children }) {
  return (
    <div style={{
      fontFamily: '"JetBrains Mono", ui-monospace, monospace',
      fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase',
      color: 'rgba(255,255,255,0.35)',
      marginBottom: 20,
    }}>
      {children}
    </div>
  );
}

function RoomRow({ room, checked, onToggle, first }) {
  return (
    <button onClick={onToggle} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      width: '100%', padding: '14px 0',
      background: 'transparent', border: 'none',
      borderTop: first ? 'none' : '0.5px solid rgba(255,255,255,0.07)',
      color: '#fff', cursor: 'pointer', textAlign: 'left',
    }}>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ fontSize: 15, fontWeight: 500 }}>{room.name}</span>
        <span style={{
          fontFamily: '"JetBrains Mono", ui-monospace, monospace',
          fontSize: 10, letterSpacing: '0.12em',
          color: 'rgba(255,255,255,0.35)',
        }}>
          {room.model}
        </span>
      </span>
      <span style={{
        width: 22, height: 22, borderRadius: '50%',
        background: checked ? '#fff' : 'transparent',
        border: checked ? 'none' : '1.5px solid rgba(255,255,255,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, transition: 'background .15s',
      }}>
        {checked && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round">
            <path d="M5 13l4 4L19 7" />
          </svg>
        )}
      </span>
    </button>
  );
}

function ScanRing({ progress, done }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const dash = circ * (progress / 100);
  return (
    <div style={{
      marginTop: 48,
      position: 'relative', width: 140, height: 140,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <svg width="140" height="140" style={{ position: 'absolute', transform: 'rotate(-90deg)' }}>
        <circle cx="70" cy="70" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
        <circle
          cx="70" cy="70" r={r} fill="none"
          stroke={done ? '#3ecf6a' : 'rgba(255,255,255,0.7)'}
          strokeWidth="2"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray .12s ease, stroke .4s' }}
        />
      </svg>
      <div style={{
        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
        fontSize: done ? 13 : 22,
        fontWeight: 400, letterSpacing: done ? '0.1em' : '0.02em',
        color: done ? '#3ecf6a' : '#fff',
        transition: 'font-size .2s, color .4s',
      }}>
        {done ? 'FOUND' : `${Math.floor(progress)}%`}
      </div>
    </div>
  );
}

function NetworkDiagram() {
  return (
    <div style={{
      marginTop: 40,
      display: 'flex', alignItems: 'center', gap: 0,
      color: 'rgba(255,255,255,0.5)',
    }}>
      {[
        { label: 'Router', icon: RouterIcon },
        { label: null },
        { label: 'Speakers', icon: SpeakerNetIcon },
        { label: null },
        { label: 'This device', icon: DeviceIcon },
      ].map((item, i) =>
        item.label === null ? (
          <div key={i} style={{
            flex: 1, height: 1,
            background: 'rgba(255,255,255,0.15)',
            margin: '0 4px',
          }} />
        ) : (
          <div key={i} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
          }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14,
              background: 'rgba(255,255,255,0.06)',
              border: '0.5px solid rgba(255,255,255,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <item.icon />
            </div>
            <span style={{
              fontFamily: '"JetBrains Mono", ui-monospace, monospace',
              fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.35)',
              whiteSpace: 'nowrap',
            }}>
              {item.label}
            </span>
          </div>
        )
      )}
    </div>
  );
}

function SonosWordmark() {
  return (
    <div style={{
      fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
      fontSize: 13, fontWeight: 600, letterSpacing: '0.32em',
      textTransform: 'uppercase',
      color: 'rgba(255,255,255,0.45)',
    }}>
      Sonos
    </div>
  );
}

// Inline mini SVG icons for the network diagram
function RouterIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" strokeLinecap="round">
      <rect x="2" y="14" width="20" height="7" rx="2" />
      <path d="M6 14V10a6 6 0 0 1 12 0v4" />
      <circle cx="12" cy="17.5" r="1" fill="rgba(255,255,255,0.6)" stroke="none" />
    </svg>
  );
}
function SpeakerNetIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" strokeLinecap="round">
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <circle cx="12" cy="14" r="3" />
      <circle cx="12" cy="7" r="1" fill="rgba(255,255,255,0.6)" stroke="none" />
    </svg>
  );
}
function DeviceIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" strokeLinecap="round">
      <rect x="5" y="2" width="14" height="20" rx="2" />
      <circle cx="12" cy="17" r="1" fill="rgba(255,255,255,0.6)" stroke="none" />
    </svg>
  );
}

// Shared styles
const stepHeading = {
  fontFamily: '"Cormorant Garamond", serif',
  fontSize: 40, fontWeight: 400, letterSpacing: '-0.01em',
  color: '#fff', margin: '0 0 14px', lineHeight: 1.1,
  textAlign: 'center',
};
const stepBody = {
  fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
  fontSize: 15, fontWeight: 400, lineHeight: 1.65,
  color: 'rgba(255,255,255,0.5)',
  margin: 0, maxWidth: 340, textAlign: 'center',
};

window.OnboardingFlow = OnboardingFlow;
window.SETUP_KEY = SETUP_KEY;
