import { useState, useEffect } from 'react';

const STEPS = [
  {
    target: null,
    title: 'Welcome to the Store Room',
    body: "This quick tour will show you how to check out and return equipment. It only takes a minute.",
  },
  {
    target: 'tour-camera',
    title: 'Scan items here',
    body: 'Point the item\'s QR code or barcode at the camera. The kiosk looks it up automatically. You can scan multiple items before checking out.',
  },
  {
    target: 'tour-manual-input',
    title: 'No QR code?',
    body: 'Type the asset tag printed on the item and tap Add. Works the same as scanning.',
  },
  {
    target: 'tour-basket-panel',
    title: 'Your basket',
    body: 'Scanned items appear here. You can mix checkouts and returns in one go — tap the × to remove any mistakes.',
  },
  {
    target: 'tour-basket-panel',
    title: 'Returning items',
    body: "If you already have items checked out, they'll appear at the bottom of this panel. Tap Return or Return All to add them to your basket.",
  },
];

function getRect(id) {
  if (!id) return null;
  const el = document.getElementById(id);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, width: r.width, height: r.height };
}

export default function KioskTour({ onDone }) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState(null);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  useEffect(() => {
    const update = () => setRect(getRect(current.target));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [step, current.target]);

  const next = () => {
    if (!isLast) setStep((s) => s + 1);
    else onDone();
  };

  const PAD = 12;
  const spotX = rect ? rect.x - PAD : 0;
  const spotY = rect ? rect.y - PAD : 0;
  const spotW = rect ? rect.width + PAD * 2 : 0;
  const spotH = rect ? rect.height + PAD * 2 : 0;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9990 }}>
      {/* SVG overlay with spotlight cutout */}
      <svg
        style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: 9991, pointerEvents: 'none' }}
      >
        <defs>
          <mask id="tour-mask">
            <rect width="100%" height="100%" fill="white" />
            {rect && (
              <rect x={spotX} y={spotY} width={spotW} height={spotH} rx="14" fill="black" />
            )}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.75)" mask="url(#tour-mask)" />
      </svg>

      {/* Highlight ring around target element */}
      {rect && (
        <div
          style={{
            position: 'fixed',
            left: spotX,
            top: spotY,
            width: spotW,
            height: spotH,
            border: '2px solid #60a5fa',
            borderRadius: 14,
            zIndex: 9992,
            pointerEvents: 'none',
            boxShadow: '0 0 0 3px rgba(96,165,250,0.35)',
          }}
        />
      )}

      {/* Tooltip card — fixed at bottom center, always reachable on a touchscreen */}
      <div
        style={{
          position: 'fixed',
          bottom: 28,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'min(420px, calc(100vw - 32px))',
          background: 'white',
          borderRadius: 20,
          padding: '20px 24px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.45)',
          zIndex: 9993,
        }}
      >
        {/* Progress dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 14 }}>
          {STEPS.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === step ? 20 : 7,
                height: 7,
                borderRadius: 4,
                background: i === step ? '#2563eb' : '#cbd5e1',
                transition: 'all 0.2s',
              }}
            />
          ))}
        </div>

        <h3 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>
          {current.title}
        </h3>
        <p style={{ fontSize: 15, color: '#475569', lineHeight: 1.6, margin: '0 0 20px' }}>
          {current.body}
        </p>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onDone}
            style={{
              padding: '11px 16px',
              borderRadius: 12,
              border: '2px solid #e2e8f0',
              background: 'white',
              color: '#64748b',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Skip
          </button>
          {step > 0 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              style={{
                padding: '11px 16px',
                borderRadius: 12,
                border: '2px solid #e2e8f0',
                background: 'white',
                color: '#334155',
                fontSize: 15,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Back
            </button>
          )}
          <button
            onClick={next}
            style={{
              flex: 1,
              padding: '11px 0',
              borderRadius: 12,
              border: 'none',
              background: '#2563eb',
              color: 'white',
              fontSize: 15,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {isLast ? "Let's go!" : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
