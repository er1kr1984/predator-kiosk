import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPublicConfig, getAssetByTag, checkoutAsset, checkinAsset, uploadAssetImage, getUserCheckouts } from '../api.js';
import { useQRScanner } from '../hooks/useQRScanner.js';
import KioskTour from '../components/KioskTour.jsx';
import { useTheme } from '../ThemeContext.jsx';
const version = __APP_VERSION__;

function CogIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 5a7 7 0 100 14A7 7 0 0012 5z" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M21 12.79A9 9 0 1111.21 3a7 7 0 109.79 9.79z" />
    </svg>
  );
}

const STATES = {
  SCANNING: 'SCANNING',
  DURATION: 'DURATION',
  PROCESSING: 'PROCESSING',
  SUCCESS: 'SUCCESS',
  ERROR: 'ERROR',
};

function playBeep(success = true) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = success ? 880 : 280;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (success ? 0.25 : 0.45));
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + (success ? 0.25 : 0.45));
  } catch {}
}

function overdueInfo(expectedCheckin) {
  if (!expectedCheckin) return null;
  const days = Math.floor((Date.now() - new Date(expectedCheckin).getTime()) / 86400000);
  return days > 0 ? days : null;
}

function addHours(hours) {
  const d = new Date();
  d.setHours(d.getHours() + hours);
  return d.toISOString().split('T')[0];
}

function formatDate(isoString) {
  if (!isoString) return '—';
  return new Date(isoString).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
}

export default function KioskPage() {
  const navigate = useNavigate();
  const user = JSON.parse(sessionStorage.getItem('kioskUser') || '{}');
  const isAdmin = sessionStorage.getItem('kioskIsAdmin') === 'true';

  const [config, setConfig] = useState(null);
  const [state, setState] = useState(STATES.SCANNING);
  const [basket, setBasket] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState('');
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [customDate, setCustomDate] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [results, setResults] = useState([]);
  const [manualTag, setManualTag] = useState('');
  const [countdown, setCountdown] = useState(10);
  const countdownRef = useRef(null);
  const [showTour, setShowTour] = useState(() => !localStorage.getItem('kioskTourDone'));
  const [note, setNote] = useState('');
  const [userCheckouts, setUserCheckouts] = useState([]);
  const [imageUploading, setImageUploading] = useState({});
  const [imageMsg, setImageMsg] = useState({});
  const [idleSecondsLeft, setIdleSecondsLeft] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const settingsRef = useRef(null);
  const idleTimerRef = useRef(null);
  const idleCountdownRef = useRef(null);
  const { theme, toggleTheme } = useTheme();
  const IDLE_TIMEOUT = 300;
  const IDLE_WARN_AT = 10;

  useEffect(() => {
    getPublicConfig().then((cfg) => {
      setConfig(cfg);
      const def = (cfg.durationPresets || []).find((p) => p.default) || cfg.durationPresets?.[cfg.durationPresets.length - 1];
      setSelectedPreset(def || null);
    });
  }, []);

  useEffect(() => {
    if (!user.id) return;
    getUserCheckouts(user.id)
      .then((data) => setUserCheckouts(data?.rows || []))
      .catch(() => {});
  }, [user.id]);

  const resetToScanning = useCallback(() => {
    setState(STATES.SCANNING);
    setBasket([]);
    setManualTag('');
    setUseCustom(false);
    setScanMsg('');
    setResults([]);
    setNote('');
    clearInterval(countdownRef.current);
    if (user.id) {
      getUserCheckouts(user.id)
        .then((data) => setUserCheckouts(data?.rows || []))
        .catch(() => {});
    }
  }, [user.id]);

  useEffect(() => {
    if (state === STATES.SUCCESS) {
      setCountdown(10);
      countdownRef.current = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) { clearInterval(countdownRef.current); resetToScanning(); return 0; }
          return c - 1;
        });
      }, 1000);
    }
    return () => clearInterval(countdownRef.current);
  }, [state, resetToScanning]);

  const resetIdleTimer = useCallback(() => {
    setIdleSecondsLeft(null);
    clearTimeout(idleTimerRef.current);
    clearInterval(idleCountdownRef.current);

    idleTimerRef.current = setTimeout(() => {
      setIdleSecondsLeft(IDLE_WARN_AT);
      idleCountdownRef.current = setInterval(() => {
        setIdleSecondsLeft((s) => {
          if (s <= 1) {
            clearInterval(idleCountdownRef.current);
            sessionStorage.removeItem('kioskUser');
            navigate('/');
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    }, (IDLE_TIMEOUT - IDLE_WARN_AT) * 1000);
  }, [navigate]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (settingsRef.current && !settingsRef.current.contains(e.target)) {
        setShowSettings(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((e) => window.addEventListener(e, resetIdleTimer, { passive: true }));
    resetIdleTimer();
    return () => {
      events.forEach((e) => window.removeEventListener(e, resetIdleTimer));
      clearTimeout(idleTimerRef.current);
      clearInterval(idleCountdownRef.current);
    };
  }, [resetIdleTimer]);

  const processTag = useCallback(
    async (tag) => {
      if (state !== STATES.SCANNING || scanning) return;

      const tagLower = tag.toLowerCase();
      const alreadyIn = basket.some(
        (b) => b.asset.asset_tag?.toLowerCase() === tagLower ||
               String(b.asset.id) === tagLower ||
               tag.includes(`/ht/${b.asset.asset_tag}`) ||
               tag.includes(`/hardware/${b.asset.id}`)
      );
      if (alreadyIn) {
        playBeep(false);
        setScanMsg('Already in basket');
        setTimeout(() => setScanMsg(''), 2000);
        return;
      }

      setScanning(true);
      setScanMsg('Looking up asset...');
      try {
        const asset = await getAssetByTag(tag);
        if (!asset || !asset.id) {
          setScanMsg('Asset not found');
          setTimeout(() => setScanMsg(''), 3000);
          return;
        }
        const isCheckedOut = !!asset.assigned_to;
        const isAvailable = asset.status_label?.status_meta === 'deployable';
        const action = isCheckedOut ? 'checkin' : 'checkout';

        if (!isAvailable && !isCheckedOut) {
          playBeep(false);
          setScanMsg(`"${asset.name}" is not available`);
          setTimeout(() => setScanMsg(''), 4000);
          return;
        }

        playBeep(true);
        setBasket((b) => [...b, { asset, action }]);
        setScanMsg(isCheckedOut
          ? `Return: ${asset.name} (checked out to ${asset.assigned_to?.name || 'unknown'})`
          : `Added: ${asset.name}`);
        setTimeout(() => setScanMsg(''), 2500);
      } catch (e) {
        playBeep(false);
        setScanMsg(e.response?.data?.error || 'Lookup failed');
        setTimeout(() => setScanMsg(''), 3000);
      } finally {
        setScanning(false);
      }
    },
    [state, scanning, basket, user.id]
  );

  const { videoRef, canvasRef } = useQRScanner({
    cameraType: config?.cameraType || 'webcam',
    active: state === STATES.SCANNING && !scanning,
    onDetected: processTag,
  });

  const removeFromBasket = (index) => setBasket((b) => b.filter((_, i) => i !== index));

  const handleImageUpload = async (index, assetId, file) => {
    setImageUploading((u) => ({ ...u, [index]: true }));
    setImageMsg((m) => ({ ...m, [index]: '' }));
    try {
      await uploadAssetImage(assetId, file);
      setImageMsg((m) => ({ ...m, [index]: 'ok' }));
    } catch (e) {
      setImageMsg((m) => ({ ...m, [index]: e.response?.data?.error || 'Upload failed' }));
    } finally {
      setImageUploading((u) => ({ ...u, [index]: false }));
    }
  };

  const dueDate = useCustom ? customDate : (selectedPreset ? addHours(selectedPreset.hours) : null);

  async function handleCheckoutAll() {
    setState(STATES.PROCESSING);
    const checkouts = basket.filter((b) => b.action === 'checkout');
    const checkins = basket.filter((b) => b.action === 'checkin');

    const settled = await Promise.allSettled([
      ...checkouts.map((b) => checkoutAsset(b.asset.id, user.id, dueDate, b.asset, user.name, note).then(() => ({ name: b.asset.name, action: 'checkout', ok: true }))),
      ...checkins.map((b) => checkinAsset(b.asset.id, b.asset, user.name, note).then(() => ({ name: b.asset.name, action: 'checkin', ok: true }))),
    ]);

    setResults(settled.map((s, i) => ({
      name: basket[i]?.asset.name,
      action: basket[i]?.action,
      ok: s.status === 'fulfilled',
      error: s.reason?.response?.data?.error || s.reason?.message,
    })));
    setState(STATES.SUCCESS);
  }

  const checkoutCount = basket.filter((b) => b.action === 'checkout').length;
  const checkinCount = basket.filter((b) => b.action === 'checkin').length;
  const presets = config?.durationPresets || [];

  return (
    <div className="h-screen bg-slate-100 dark:bg-[#2a2a2a] flex flex-col overflow-hidden transition-colors">
      {/* Header — stays dark in both modes */}
      <header className="bg-[#1e1e1e] px-3 sm:px-5 py-2 flex items-center justify-between flex-shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
          <span className="brand-badge flex-shrink-0">E2E</span>
          <span className="text-white text-sm font-lubalin font-semibold hidden sm:inline">Storeroom Kiosk</span>
          <span className="text-slate-500 text-xs hidden sm:inline flex-shrink-0">v{version}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => setShowTour(true)}
            className="bg-[#363636] hover:bg-[#484848] text-slate-400 hover:text-white w-7 h-7 rounded-md text-xs font-bold transition-colors flex items-center justify-center"
            title="Help"
          >
            ?
          </button>
          <button
            onClick={() => { sessionStorage.removeItem('kioskUser'); sessionStorage.removeItem('kioskIsAdmin'); navigate('/'); }}
            className="bg-[#363636] hover:bg-[#484848] text-slate-300 hover:text-white px-2.5 py-1 rounded-md text-xs transition-colors"
          >
            Sign Out
          </button>

          {/* Settings cog */}
          <div className="relative" ref={settingsRef}>
            <button
              onClick={() => setShowSettings(v => !v)}
              className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${showSettings ? 'bg-[#484848] text-white' : 'bg-[#363636] hover:bg-[#484848] text-slate-400 hover:text-white'}`}
              title="Settings"
            >
              <CogIcon />
            </button>

            {showSettings && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-[#1a1a1a] border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                {/* User info */}
                <div className="px-4 py-3 border-b border-slate-700">
                  <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-1">Signed in as</p>
                  <p className="text-white font-semibold truncate">{user.name || user.username}</p>
                </div>
                {/* Theme */}
                <div className="px-4 py-3 border-b border-slate-700">
                  <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-2">Theme</p>
                  <button
                    onClick={toggleTheme}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-[#2a2a2a] hover:bg-[#363636] text-slate-300 hover:text-white transition-colors text-sm font-medium"
                  >
                    {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
                    {theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
                  </button>
                </div>
                {/* Admin */}
                {isAdmin && (
                  <div className="px-4 py-3">
                    <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-2">Administration</p>
                    <button
                      onClick={() => { setShowSettings(false); navigate('/admin'); }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-[#2a2a2a] hover:bg-[#363636] text-slate-300 hover:text-white transition-colors text-sm font-medium"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                      </svg>
                      Admin Settings
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Idle warning banner */}
      {idleSecondsLeft !== null && (
        <div className="bg-amber-500 text-white text-center py-3 text-lg font-semibold flex-shrink-0">
          Signing out in {idleSecondsLeft}s due to inactivity —{' '}
          <button onClick={resetIdleTimer} className="underline font-bold hover:text-amber-100">
            Stay signed in
          </button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
        {/* Camera panel */}
        <div id="tour-camera" className="w-full md:w-3/5 h-52 sm:h-64 md:h-auto flex-shrink-0 md:flex-shrink bg-black flex flex-col items-center justify-center relative">
          {config?.cameraType === 'webcam' ? (
            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
          ) : (
            <img src="/api/camera/stream" alt="Camera feed" className="w-full h-full object-cover" />
          )}
          <canvas ref={canvasRef} className="hidden" />

          {/* Scan target box */}
          {state === STATES.SCANNING && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className={`relative w-48 h-48 sm:w-56 sm:h-56 md:w-72 md:h-72 transition-colors ${scanning ? 'text-brand' : 'text-slate-400'}`}>
                <span className="absolute top-0 left-0 w-7 h-7 border-t-4 border-l-4 rounded-tl-lg border-current" />
                <span className="absolute top-0 right-0 w-7 h-7 border-t-4 border-r-4 rounded-tr-lg border-current" />
                <span className="absolute bottom-0 left-0 w-7 h-7 border-b-4 border-l-4 rounded-bl-lg border-current" />
                <span className="absolute bottom-0 right-0 w-7 h-7 border-b-4 border-r-4 rounded-br-lg border-current" />
                {scanning && (
                  <span className="absolute inset-0 rounded-lg border-2 border-brand animate-ping opacity-40" />
                )}
              </div>
            </div>
          )}

          {/* Scan feedback */}
          {scanMsg && (
            <div className="absolute top-2 left-2 right-2 flex justify-center">
              <div className={`px-4 py-2 rounded-xl text-sm sm:text-base font-semibold shadow-lg text-center ${
                scanMsg.startsWith('Added') || scanMsg.startsWith('Return') ? 'bg-green-600 text-white' :
                scanMsg === 'Already in basket' ? 'bg-amber-500 text-white' :
                'bg-red-600 text-white'
              }`}>
                {scanMsg}
              </div>
            </div>
          )}

          {/* Manual tag input */}
          <div id="tour-manual-input" className="absolute bottom-2 left-2 right-2">
            <form
              onSubmit={(e) => { e.preventDefault(); if (manualTag.trim()) { processTag(manualTag.trim()); setManualTag(''); } }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={manualTag}
                onChange={(e) => setManualTag(e.target.value)}
                placeholder="Type asset tag..."
                style={{ caretColor: '#F5B700' }}
                className="flex-1 bg-black/60 text-white placeholder-slate-500 border border-slate-600 rounded-xl px-3 py-2 text-base focus:outline-none focus:border-brand transition-colors"
                disabled={state !== STATES.SCANNING}
              />
              <button
                type="submit"
                disabled={!manualTag.trim() || state !== STATES.SCANNING}
                className="bg-brand hover:bg-brand-dark disabled:opacity-50 text-slate-900 px-4 py-2 rounded-xl text-base font-bold transition-colors"
              >
                Add
              </button>
            </form>
          </div>
        </div>

        {/* Right panel */}
        <div id="tour-basket-panel" className="flex-1 min-h-0 w-full md:w-2/5 bg-white dark:bg-[#232323] flex flex-col overflow-hidden transition-colors">

          {/* SCANNING — basket view */}
          {state === STATES.SCANNING && (
            <>
              <div className="flex-1 overflow-y-auto p-3 sm:p-6 flex flex-col gap-3">
                <h2 className="text-2xl font-lubalin font-bold text-slate-800 dark:text-white flex items-center justify-between">
                  Basket
                  {basket.length > 0 && (
                    <span className="bg-brand text-slate-900 text-base font-bold px-3 py-1 rounded-full">
                      {basket.length}
                    </span>
                  )}
                </h2>

                {basket.length === 0 ? (
                  <div className="flex-1 flex flex-col">
                    <div className="flex flex-col items-center justify-center text-center py-8">
                      <div className="text-5xl mb-4">🛒</div>
                      <p className="text-slate-400 dark:text-slate-500 text-xl">Scan items to add them to your basket</p>
                    </div>
                    {userCheckouts.length > 0 && (
                      <div className="mt-2">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-sm font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                            Your current checkouts
                          </h3>
                          {userCheckouts.some((a) => !basket.some((b) => b.asset.id === a.id)) && (
                            <button
                              onClick={() => {
                                const toAdd = userCheckouts.filter((a) => !basket.some((b) => b.asset.id === a.id));
                                playBeep(true);
                                setBasket((prev) => [...prev, ...toAdd.map((asset) => ({ asset, action: 'checkin' }))]);
                              }}
                              className="text-sm font-semibold px-3 py-1 rounded-lg bg-green-600 hover:bg-green-700 text-white transition-colors"
                            >
                              Return All
                            </button>
                          )}
                        </div>
                        <div className="flex flex-col gap-2">
                          {userCheckouts.map((asset) => {
                            const days = overdueInfo(asset.expected_checkin);
                            const inBasket = basket.some((b) => b.asset.id === asset.id);
                            return (
                              <div key={asset.id} className="flex items-center gap-3 bg-slate-50 dark:bg-[#2f2f2f] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{asset.name}</p>
                                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                    <span className="text-xs text-slate-400 dark:text-slate-500">{asset.asset_tag}</span>
                                    {asset.expected_checkin && (
                                      <span className="text-xs text-slate-400 dark:text-slate-500">
                                        Due {formatDate(asset.expected_checkin)}
                                      </span>
                                    )}
                                    {days && (
                                      <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400">
                                        {days}d overdue
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <button
                                  disabled={inBasket}
                                  onClick={() => {
                                    if (inBasket) return;
                                    playBeep(true);
                                    setBasket((b) => [...b, { asset, action: 'checkin' }]);
                                  }}
                                  className="flex-shrink-0 text-sm font-semibold px-3 py-1.5 rounded-lg border-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed border-green-500 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20"
                                >
                                  {inBasket ? 'Added' : 'Return'}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  basket.map((item, i) => (
                    <div key={i} className="flex items-start gap-2 sm:gap-3 bg-slate-50 dark:bg-[#2f2f2f] border border-slate-200 dark:border-slate-700 rounded-xl p-3 sm:p-4 transition-colors">
                      {/* Product image */}
                      {item.asset.image ? (
                        <img
                          src={item.asset.image}
                          alt={item.asset.name}
                          className="w-14 h-14 sm:w-20 sm:h-20 object-contain rounded-lg bg-white dark:bg-[#1e1e1e] border border-slate-200 dark:border-slate-700 flex-shrink-0"
                        />
                      ) : (
                        <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-lg bg-slate-200 dark:bg-[#363636] border border-slate-200 dark:border-slate-700 flex-shrink-0 flex items-center justify-center text-slate-400 text-2xl sm:text-3xl">
                          📦
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-lg font-semibold text-slate-800 dark:text-white leading-tight">{item.asset.name}</p>
                        {item.asset.model?.name && (
                          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">{item.asset.model.name}</p>
                        )}
                        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                          <span className="text-slate-500 dark:text-slate-400 text-sm">
                            <span className="font-medium text-slate-600 dark:text-slate-300">Tag:</span> {item.asset.asset_tag}
                          </span>
                          {item.asset.serial && (
                            <span className="text-slate-500 dark:text-slate-400 text-sm">
                              <span className="font-medium text-slate-600 dark:text-slate-300">S/N:</span> {item.asset.serial}
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            item.action === 'checkin'
                              ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400'
                              : 'bg-brand-light/40 dark:bg-brand-light/20 text-slate-700 dark:text-brand'
                          }`}>
                            {item.action === 'checkin' ? 'Return' : 'Check Out'}
                          </span>
                          {item.action === 'checkin' && item.asset.assigned_to?.name && (
                            <span className="text-xs text-slate-400 dark:text-slate-500">
                              checked out to <span className="font-semibold text-slate-600 dark:text-slate-400">{item.asset.assigned_to.name}</span>
                            </span>
                          )}
                          {item.action === 'checkin' && (() => {
                            const days = overdueInfo(item.asset.expected_checkin);
                            return days ? (
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400">
                                {days}d overdue
                              </span>
                            ) : null;
                          })()}
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <label className={`cursor-pointer text-sm px-3 py-1 rounded-lg border transition-colors ${
                            imageUploading[i]
                              ? 'border-slate-200 dark:border-slate-700 text-slate-300 dark:text-slate-600'
                              : 'border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-brand hover:text-brand'
                          }`}>
                            {imageUploading[i] ? 'Uploading...' : 'Add photo'}
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              className="hidden"
                              disabled={imageUploading[i]}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleImageUpload(i, item.asset.id, file);
                                e.target.value = '';
                              }}
                            />
                          </label>
                          {imageMsg[i] === 'ok' && (
                            <span className="text-green-600 dark:text-green-500 text-sm font-semibold">Uploaded</span>
                          )}
                          {imageMsg[i] && imageMsg[i] !== 'ok' && (
                            <span className="text-red-500 dark:text-red-400 text-sm">{imageMsg[i]}</span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => removeFromBasket(i)}
                        className="text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 text-2xl font-bold leading-none transition-colors flex-shrink-0"
                        title="Remove"
                      >
                        ×
                      </button>
                    </div>
                  ))
                )}
              </div>

              {basket.length > 0 && (
                <div className="p-3 sm:p-6 border-t border-slate-200 dark:border-slate-700 flex flex-col gap-2 sm:gap-3">
                  <div className="text-slate-400 dark:text-slate-500 text-sm text-center">
                    {checkoutCount > 0 && <span>{checkoutCount} to check out</span>}
                    {checkoutCount > 0 && checkinCount > 0 && <span> · </span>}
                    {checkinCount > 0 && <span>{checkinCount} to return</span>}
                  </div>
                  <button
                    onClick={() => checkoutCount > 0 ? setState(STATES.DURATION) : handleCheckoutAll()}
                    className="w-full bg-brand hover:bg-brand-dark text-slate-900 text-2xl font-bold py-5 rounded-2xl transition-colors"
                  >
                    {checkoutCount > 0 ? 'Choose Duration' : 'Return All'}
                  </button>
                  <button
                    onClick={resetToScanning}
                    className="w-full border border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 py-3 rounded-2xl text-lg transition-colors"
                  >
                    Clear Basket
                  </button>
                </div>
              )}
            </>
          )}

          {/* DURATION */}
          {state === STATES.DURATION && (
            <div className="flex-1 flex flex-col p-4 sm:p-8 gap-3 sm:gap-5 overflow-y-auto">
              <h2 className="text-2xl sm:text-3xl font-lubalin font-bold text-slate-800 dark:text-white">How long do you need them?</h2>
              <p className="text-slate-500 dark:text-slate-400 text-base">Applies to all {checkoutCount} item{checkoutCount !== 1 ? 's' : ''} being checked out.</p>

              <div className="grid grid-cols-2 gap-3">
                {presets.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => { setSelectedPreset(preset); setUseCustom(false); }}
                    className={`py-5 rounded-2xl text-xl font-semibold border-2 transition-colors ${
                      !useCustom && selectedPreset?.label === preset.label
                        ? 'bg-brand border-brand text-slate-900'
                        : 'bg-white dark:bg-[#2f2f2f] border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-brand'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
                <button
                  onClick={() => setUseCustom(true)}
                  className={`py-5 rounded-2xl text-xl font-semibold border-2 transition-colors col-span-2 ${
                    useCustom
                      ? 'bg-brand border-brand text-slate-900'
                      : 'bg-white dark:bg-[#2f2f2f] border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-brand'
                  }`}
                >
                  Custom Date
                </button>
              </div>

              {useCustom && (
                <input
                  type="date"
                  value={customDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setCustomDate(e.target.value)}
                  style={{ caretColor: '#F5B700', colorScheme: 'light dark' }}
                  className="w-full bg-white dark:bg-[#2f2f2f] border-2 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white rounded-xl px-4 py-4 text-xl focus:outline-none focus:border-brand transition-colors"
                />
              )}

              {dueDate && (
                <div className="bg-brand-light/30 dark:bg-[#2f2f2f] border border-brand-light dark:border-slate-700 rounded-xl px-5 py-3 text-slate-700 dark:text-slate-300 text-lg text-center">
                  Return by: <span className="font-bold text-slate-900 dark:text-brand">{formatDate(dueDate)}</span>
                </div>
              )}

              <div className="flex flex-col gap-1">
                <label className="text-slate-600 dark:text-slate-400 font-semibold text-base">
                  Note <span className="text-slate-400 dark:text-slate-600 font-normal">(optional)</span>
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Reason, location, project..."
                  rows={2}
                  style={{ caretColor: '#F5B700' }}
                  className="bg-white dark:bg-[#2f2f2f] border-2 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-brand resize-none transition-colors"
                />
              </div>

              <div className="flex gap-3 mt-auto">
                <button
                  onClick={() => setState(STATES.SCANNING)}
                  className="flex-1 border border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 py-4 rounded-2xl text-xl transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleCheckoutAll}
                  disabled={useCustom ? !customDate : !selectedPreset}
                  className="flex-1 bg-brand hover:bg-brand-dark disabled:opacity-50 text-slate-900 py-4 rounded-2xl text-xl font-bold transition-colors"
                >
                  Check Out All
                </button>
              </div>
            </div>
          )}

          {/* PROCESSING */}
          {state === STATES.PROCESSING && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="text-6xl mb-6 animate-spin">⚙️</div>
              <h2 className="text-3xl font-lubalin font-bold text-slate-600 dark:text-slate-300">Processing {basket.length} item{basket.length !== 1 ? 's' : ''}...</h2>
            </div>
          )}

          {/* SUCCESS */}
          {state === STATES.SUCCESS && (
            <div className="flex-1 flex flex-col p-4 sm:p-8 gap-3 sm:gap-4 overflow-y-auto">
              <div className="text-center">
                <div className="text-6xl mb-3">✅</div>
                <h2 className="text-3xl font-lubalin font-bold text-green-600 dark:text-green-400">Done!</h2>
                {dueDate && checkoutCount > 0 && (
                  <p className="text-slate-500 dark:text-slate-400 text-lg mt-1">Return by {formatDate(dueDate)}</p>
                )}
              </div>

              <div className="flex flex-col gap-2 flex-1 overflow-y-auto">
                {results.map((r, i) => (
                  <div key={i} className={`flex items-center gap-3 rounded-xl px-4 py-3 ${r.ok ? 'bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800'}`}>
                    <span className="text-xl">{r.ok ? '✓' : '✗'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 dark:text-white truncate">{r.name}</p>
                      {!r.ok && <p className="text-red-600 dark:text-red-400 text-sm">{r.error}</p>}
                    </div>
                    <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${r.action === 'checkin' ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400' : 'bg-brand-light/40 dark:bg-brand-light/20 text-slate-700 dark:text-brand'}`}>
                      {r.action === 'checkin' ? 'Returned' : 'Out'}
                    </span>
                  </div>
                ))}
              </div>

              <p className="text-slate-400 dark:text-slate-600 text-center">Returning in {countdown}s...</p>
              <button
                onClick={resetToScanning}
                className="w-full bg-brand hover:bg-brand-dark text-slate-900 py-5 rounded-2xl text-2xl font-bold transition-colors"
              >
                Scan More
              </button>
            </div>
          )}
        </div>
      </div>

      {showTour && (
        <KioskTour
          onDone={() => {
            localStorage.setItem('kioskTourDone', '1');
            setShowTour(false);
          }}
        />
      )}
    </div>
  );
}
