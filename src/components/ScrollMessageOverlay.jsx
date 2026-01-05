import React, { useEffect, useMemo, useRef, useState } from 'react';
import { parseHexColorWithAlpha, getDeviceIdentifier } from '../utils/fingerprint';
import './ScrollMessageOverlay.css';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export default function ScrollMessageOverlay({ rule, stackIndex = 0 }) {
  const containerRef = useRef(null);
  const textRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [durationSec, setDurationSec] = useState(-1);
  const [renderText, setRenderText] = useState('');

  const message = (rule?.message ?? '').toString();
  const enabled = rule?.enabled !== false && rule?.enabled !== 0 && !!message.trim();

  const fontColor = useMemo(() => parseHexColorWithAlpha(rule?.fontColorHex || '#ffffff', rule?.fontTransparency ?? '0'), [rule]);
  const bgColor = useMemo(() => parseHexColorWithAlpha(rule?.backgroundColorHex || '#000000', rule?.backgroundTransparency ?? '.5'), [rule]);
  const fontSize = useMemo(() => {
    const n = parseInt(String(rule?.fontSizeDp ?? '22'), 10);
    return Number.isFinite(n) ? clamp(n, 12, 60) : 22;
  }, [rule]);

  const positionMode = (rule?.positionMode || 'RANDOM').toString().toUpperCase();
  const rawX = parseFloat(rule?.posXPercent ?? '0');
  const rawY = parseFloat(rule?.posYPercent ?? '0.9');
  const normX = Number.isFinite(rawX) ? (rawX > 1 ? rawX / 100 : rawX) : 0;
  const normY = Number.isFinite(rawY) ? (rawY > 1 ? rawY / 100 : rawY) : 0.9;
  const posXPercent = clamp(normX, 0, 0.95);
  const posYPercent = clamp(normY, 0, 0.95);

  useEffect(() => {
    if (!enabled) { setVisible(false); return; }
    let cancelled = false;
    // life: if provided use it; else infinite (-1)
    const durRaw = rule?.durationSec;
    const parsed = parseInt(String(durRaw), 10);
    const life = Number.isFinite(parsed) ? parsed : -1;
    setDurationSec(life);
    setVisible(true);
    const hideTimer = (life === -1) ? null : setTimeout(() => { if (!cancelled) setVisible(false); }, Math.max(1, life) * 1000);
    return () => { cancelled = true; if (hideTimer) clearTimeout(hideTimer); };
  }, [enabled, rule?.durationSec]);

  // Placeholder replacement similar to Android implementation
  useEffect(() => {
    let cancelled = false;
    async function buildText() {
      try {
        const id = await getDeviceIdentifier().catch(() => '');
        let username = '';
        try { const u = JSON.parse(sessionStorage.getItem('user') || '{}'); username = u?.username || ''; } catch {}
        let packageString = '';
        try {
          const pkgStored = localStorage.getItem('package');
          if (pkgStored) {
            // Try parse JSON structures similar to Android code
            try {
              const obj = JSON.parse(pkgStored);
              const results = obj?.results || obj?.packages || [];
              if (Array.isArray(results) && results.length) {
                packageString = results.map((r) => r?.serviceName || r?.name).filter(Boolean).join(',');
                if (packageString) packageString = packageString.charAt(0).toUpperCase() + packageString.slice(1);
              }
            } catch {
              packageString = pkgStored;
            }
          }
        } catch {}
        const replaced = message
          .replace(/\$\$@User/gi, ` ${username} `)
          .replace(/\$\$@Mac/gi, ` ${id} `)
          .replace(/\$\$@Package/gi, ` ${packageString} `);
        if (!cancelled) setRenderText(replaced);
      } catch {
        if (!cancelled) setRenderText(message);
      }
    }
    buildText();
    return () => { cancelled = true; };
  }, [message]);

  // Compute animation duration from content width and scrollSpeed 1..15 (1 slow, 15 fast)
  const animationSeconds = useMemo(() => {
    try {
      const textWidth = textRef.current ? textRef.current.scrollWidth : Math.max(800, (renderText || message).length * (fontSize * 0.6));
      const distance = textWidth + 48; // move exactly one item width + gap
      const speedRaw = parseFloat(String(rule?.scrollSpeed));
      if (Number.isFinite(speedRaw) && speedRaw >= 1 && speedRaw <= 15) {
        // Map 1..15 (slow..fast) to pixels/sec range
        const MIN_PX_S = 40;   // very slow
        const MAX_PX_S = 320;  // very fast
        const scale = (speedRaw - 1) / 14; // 0..1
        const pxPerSec = MIN_PX_S + scale * (MAX_PX_S - MIN_PX_S);
        return Math.max(1, Math.ceil(distance / pxPerSec));
      }
      // Fallback constant speed
      const pxPerSec = 80;
      return Math.max(3, Math.ceil(distance / pxPerSec));
    } catch {
      return 15;
    }
  }, [renderText, message, fontSize, rule?.scrollSpeed]);

  const translateDistancePx = useMemo(() => {
    try {
      const textWidth = textRef.current ? textRef.current.scrollWidth : Math.max(800, (renderText || message).length * (fontSize * 0.6));
      return textWidth + 48; // one item width + gap
    } catch {
      return 1000;
    }
  }, [renderText, message, fontSize]);

  if (!visible || !enabled) return null;

  const containerStyle = {
    position: 'fixed',
    left: '0px',
    right: '0px',
    top: 'auto',
    bottom: '0px',
    width: '100%',
    backgroundColor: bgColor,
    zIndex: 2147483647,
    overflow: 'hidden',
    pointerEvents: 'none',
  };

  const textStyle = {
    color: fontColor,
    fontSize: `${fontSize}px`,
    whiteSpace: 'nowrap',
    animationDuration: `${animationSeconds}s`,
    ...(rule?.fontFamily ? { fontFamily: String(rule.fontFamily) } : {}),
  };

  return (
    <div ref={containerRef} className="scroll-overlay-container" style={containerStyle} aria-hidden={!visible}>
      <div className="scroll-overlay-track" style={{ animationDuration: `${animationSeconds}s`, ['--caa-distance'] : `-${translateDistancePx}px` }}>
        <div ref={textRef} className="scroll-overlay-item" style={textStyle}>{renderText || message}</div>
        <div className="scroll-overlay-item" style={textStyle}>{renderText || message}</div>
      </div>
    </div>
  );
}


