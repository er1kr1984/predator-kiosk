import { useEffect, useRef, useCallback } from 'react';
import jsQR from 'jsqr';

const REQUESTED_FORMATS = [
  'qr_code', 'code_128', 'code_39', 'code_93', 'codabar',
  'data_matrix', 'ean_13', 'ean_8', 'itf', 'pdf417', 'upc_a', 'upc_e', 'aztec',
];

// How often to attempt a decode (ms). 66ms = ~15 attempts/sec.
const SCAN_INTERVAL_MS = 66;

async function initBarcodeDetector() {
  if (!('BarcodeDetector' in window)) return null;
  try {
    const supported = await window.BarcodeDetector.getSupportedFormats();
    const formats = REQUESTED_FORMATS.filter((f) => supported.includes(f));
    if (formats.length === 0) return null;
    const detector = new window.BarcodeDetector({ formats });
    console.log('[Scanner] Native BarcodeDetector —', formats.join(', '));
    return detector;
  } catch {
    return null;
  }
}

export function useQRScanner({ cameraType, active, onDetected }) {
  const videoRef    = useRef(null);
  const canvasRef   = useRef(null);
  const streamRef   = useRef(null);
  const detectorRef = useRef(null);
  const rafRef      = useRef(null);
  const intervalRef = useRef(null);
  // AXIS-only lock — prevents stacking slow network fetches
  const axisLockRef = useRef(false);
  const lastCodeRef = useRef('');
  const lastTimeRef = useRef(0);

  useEffect(() => {
    initBarcodeDetector().then((d) => { detectorRef.current = d; });
  }, []);

  const handleCode = useCallback((value) => {
    if (!value || !active) return;
    const now = Date.now();
    if (value === lastCodeRef.current && now - lastTimeRef.current < 3000) return;
    lastCodeRef.current = value;
    lastTimeRef.current = now;
    onDetected(value);
  }, [active, onDetected]);

  /**
   * Decode one source (full frame).
   * Uses native BarcodeDetector when available (hardware-accelerated, multi-format),
   * falls back to jsQR (QR only) with both normal and inverted attempts.
   */
  const scanSource = useCallback(async (source) => {
    if (!active) return;
    try {
      const w = source.videoWidth ?? source.naturalWidth ?? source.width;
      const h = source.videoHeight ?? source.naturalHeight ?? source.height;
      if (!w || !h) return;

      // ── Native BarcodeDetector (multi-format, hardware-accelerated) ──────
      if (detectorRef.current) {
        const bitmap = await createImageBitmap(source);
        const codes  = await detectorRef.current.detect(bitmap);
        bitmap.close();
        if (codes.length > 0) handleCode(codes[0].rawValue);
        return;
      }

      // ── jsQR fallback — QR only ───────────────────────────────────────────
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width  = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(source, 0, 0);
      const imageData = ctx.getImageData(0, 0, w, h);
      // attemptBoth handles dark-on-light and light-on-dark QR codes
      const result = jsQR(imageData.data, w, h, { inversionAttempts: 'attemptBoth' });
      if (result?.data) handleCode(result.data);
    } catch {
      // No code in frame — normal, ignore
    }
  }, [active, handleCode]);

  // ── Webcam: request 720p + good frame rate ────────────────────────────────
  useEffect(() => {
    if (cameraType !== 'webcam') return;
    let cancelled = false;
    navigator.mediaDevices.getUserMedia({
      video: {
        width:     { ideal: 1280 },
        height:    { ideal: 720 },
        frameRate: { ideal: 30, min: 15 },
        facingMode: { ideal: 'environment' },
      },
    }).then((stream) => {
      if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    }).catch((err) => console.warn('[Scanner] Webcam unavailable:', err));

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [cameraType]);

  // ── Webcam scan loop — rAF throttled to SCAN_INTERVAL_MS ─────────────────
  // BarcodeDetector is fast (~5-20ms) so concurrent calls are fine; we don't
  // use a lock here — multiple in-flight decodes on different frames is OK.
  useEffect(() => {
    if (cameraType !== 'webcam' || !active) return;
    let lastScan = 0;

    const loop = (ts) => {
      rafRef.current = requestAnimationFrame(loop);
      if (ts - lastScan < SCAN_INTERVAL_MS) return;
      lastScan = ts;
      const video = videoRef.current;
      if (video?.readyState === HTMLMediaElement.HAVE_ENOUGH_DATA) {
        scanSource(video); // intentionally not awaited — fire and forget
      }
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [cameraType, active, scanSource]);

  // ── AXIS snapshot polling ─────────────────────────────────────────────────
  useEffect(() => {
    if (cameraType !== 'axis' || !active) return;

    intervalRef.current = setInterval(async () => {
      if (axisLockRef.current) return;
      axisLockRef.current = true;
      try {
        const res = await fetch('/api/camera/snapshot', { cache: 'no-store' });
        if (!res.ok) return;
        const url = URL.createObjectURL(await res.blob());
        const img = new Image();
        img.onload = () => {
          const canvas = canvasRef.current;
          if (canvas) { canvas.width = img.width; canvas.height = img.height; }
          scanSource(img).finally(() => { URL.revokeObjectURL(url); axisLockRef.current = false; });
        };
        img.onerror = () => { URL.revokeObjectURL(url); axisLockRef.current = false; };
        img.src = url;
      } catch {
        axisLockRef.current = false;
      }
    }, 200);

    return () => clearInterval(intervalRef.current);
  }, [cameraType, active, scanSource]);

  return { videoRef, canvasRef };
}
