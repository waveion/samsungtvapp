import React, { useEffect, useMemo, useRef, useState } from 'react';
import { makeFingerprintText, parseHexColorWithAlpha } from '../utils/fingerprint';

// React overlay mirroring Kotlin Compose Global/Channel overlays
// Supports RANDOM/FIXED modes, interval/duration, repeatCount, colors & transparency

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export default function FingerprintOverlay({
  rule, // fingerprint object from SSE
  anchorRef, // optional element (e.g., video) to base positioning, else window
}) {
  const [visible, setVisible] = useState(false);
  const [text, setText] = useState('');
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const timerRef = useRef({});

  const fontColor = useMemo(() => parseHexColorWithAlpha(rule?.fontColorHex || '#ffffff', rule?.fontTransparency ?? '.5'), [rule]);
  const bgColor = useMemo(() => parseHexColorWithAlpha(rule?.backgroundColorHex || '#ff0000', rule?.backgroundTransparency ?? '.5'), [rule]);
  const fontSize = useMemo(() => {
    const n = parseInt(String(rule?.fontSizeDp ?? '12'), 10);
    return Number.isFinite(n) ? clamp(n, 8, 60) : 12;
  }, [rule]);

  const intervalSec = useMemo(() => {
    const n = parseInt(String(rule?.intervalSec ?? '5'), 10);
    return Number.isFinite(n) ? clamp(n, 1, 300) : 5;
  }, [rule]);

  const durationMs = useMemo(() => {
    // Support either milliseconds (durationMs) or seconds (duration/durationSec/durationSeconds)
    const msRaw = rule?.durationMs;
    const secRaw = (rule?.duration ?? rule?.durationSec ?? rule?.durationSeconds);
    if (msRaw != null) {
      const msNum = parseInt(String(msRaw), 10);
      if (!Number.isFinite(msNum)) return 60000;
      // Heuristic: some backends send seconds in durationMs; treat small numbers as seconds
      const ms = msNum < 1000 ? msNum * 1000 : msNum;
      return clamp(ms, 500, 300000);
    }
    if (secRaw != null) {
      const sec = parseInt(String(secRaw), 10);
      return Number.isFinite(sec) ? clamp(sec * 1000, 500, 300000) : 60000;
    }
    return 60000;
  }, [rule]);

  const repeatCount = useMemo(() => {
    const n = parseInt(String(rule?.repeatCount ?? '5'), 10);
    if (!Number.isFinite(n)) return 5;
    // Treat 0 or negative values (e.g., -1) as "infinite" repeats
    if (n <= 0) return Infinity;
    return clamp(n, 1, 1000);
  }, [rule]);

  const positionMode = (rule?.positionMode || 'RANDOM').toString().toUpperCase();
  const rawX = parseFloat(rule?.posXPercent ?? '0.5');
  const rawY = parseFloat(rule?.posYPercent ?? '0.5');
  const normX = Number.isFinite(rawX) ? (rawX > 1 ? rawX / 100 : rawX) : 0.5;
  const normY = Number.isFinite(rawY) ? (rawY > 1 ? rawY / 100 : rawY) : 0.5;
  const posXPercent = clamp(normX, 0, 0.9);
  const posYPercent = clamp(normY, 0, 0.9);

  useEffect(() => {
    let cancelled = false;
    const timers = [];

    async function run() {
      const type = (rule?.fingerprintType || 'COVERT').toString().toUpperCase();
      const fpText = type === 'OVERT'
        ? ((rule?.fingerprintName || 'Fingerprint').toString())
        : (await makeFingerprintText({
            method: rule?.method || 'BASE16',
            obfuscationKey: rule?.obfuscationKey || '12',
            textSeed: rule?.textSeed || 'lguid',
          }));
      if (cancelled) return;
      setText(fpText);

      const rect = (() => {
        try { return anchorRef?.current?.getBoundingClientRect?.(); } catch { return null; }
      })();
      const baseW = Math.max(1, Math.floor(rect?.width || window.innerWidth));
      const baseH = Math.max(1, Math.floor(rect?.height || window.innerHeight));

      // Show immediately once
      const showAtPosition = () => {
        let xCoord = 0;
        let yCoord = 0;
        if (positionMode === 'RANDOM') {
          xCoord = Math.floor(24 + Math.random() * Math.max(1, baseW - 48));
          yCoord = Math.floor(48 + Math.random() * Math.max(1, baseH - 96));
        } else {
          xCoord = Math.floor(baseW * posXPercent);
          yCoord = Math.floor(baseH * posYPercent);
        }
        setPos({ x: xCoord, y: yCoord });
        setVisible(true);
      };

      showAtPosition();
      await new Promise((r) => { timers.push(setTimeout(r, durationMs)); });
      setVisible(false);

      if (repeatCount === Infinity) {
        // Infinite loop: keep showing at the configured interval until cancelled
        // eslint-disable-next-line no-constant-condition
        while (true) {
          if (cancelled) break;
          await new Promise((r) => {
            timers.push(setTimeout(r, intervalSec * 1000));
          });
          if (cancelled) break;

          showAtPosition();
          await new Promise((r) => { timers.push(setTimeout(r, durationMs)); });
          setVisible(false);
        }
      } else {
        for (let i = 1; i < repeatCount; i++) {
          if (cancelled) break;
          await new Promise((r) => { 
            timers.push(setTimeout(r, intervalSec * 1000));
          });
          if (cancelled) break;

          showAtPosition();
          await new Promise((r) => { timers.push(setTimeout(r, durationMs)); });
          setVisible(false);
        }
      }
    }

    run();
    return () => {
      cancelled = true;
      timers.forEach((t) => clearTimeout(t));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    rule?.method,
    rule?.obfuscationKey,
    rule?.textSeed,
    rule?.fontColorHex,
    rule?.backgroundColorHex,
    rule?.fontTransparency,
    rule?.backgroundTransparency,
    intervalSec,
    durationMs,
    repeatCount,
    positionMode,
    posXPercent,
    posYPercent,
  ]);

  if (!visible) return null;

  // Position relative to the provided anchor element (e.g., the video) when available
  let anchorLeft = 0;
  let anchorTop = 0;
  try {
    const rect = anchorRef?.current?.getBoundingClientRect?.();
    if (rect) {
      anchorLeft = rect.left;
      anchorTop = rect.top;
    }
  } catch {}

  const style = {
    position: 'fixed',
    left: `${anchorLeft + pos.x}px`,
    top: `${anchorTop + pos.y}px`,
    color: fontColor,
    backgroundColor: bgColor,
    borderRadius: 4,
    padding: '4px 8px',
    fontSize: `${fontSize}px`,
    ...(rule?.fontFamily ? { fontFamily: String(rule.fontFamily) } : {}),
    pointerEvents: 'none',
    zIndex: 10000,
    whiteSpace: 'nowrap',
  };

  return (
    <div style={style} aria-hidden={!visible}>
      {text}    </div>
  );
}


