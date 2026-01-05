import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getDeviceIdentifier, parseHexColorWithAlpha } from '../utils/fingerprint';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export default function ForceMessageOverlay({ rule, onClose }) {
  const [visible, setVisible] = useState(false);
  const [renderTitle, setRenderTitle] = useState(String(rule?.messageTitle || ''));
  const [renderMessage, setRenderMessage] = useState(String(rule?.message || ''));
  const okButtonRef = useRef(null);
  const lastActiveRef = useRef(null);

  const enabled = rule?.enabled !== false && rule?.enabled !== 0;
  const forcePush = rule?.forcePush === true;

  const titleColor = useMemo(() => {
    return parseHexColorWithAlpha(rule?.titleFontColorHex || '#ffffff', rule?.titleFontTransparency ?? '.5');
  }, [rule]);

  const messageColor = useMemo(() => {
    return parseHexColorWithAlpha(rule?.messageFontColorHex || '#000000', rule?.messageFontTransparency ?? '.5');
  }, [rule]);

  const bgColor = useMemo(() => {
    return parseHexColorWithAlpha(rule?.messageBackgroundColorHex || '#000000', rule?.messageBackgroundTransparency ?? '.5');
  }, [rule]);

  const titleSize = useMemo(() => {
    const n = parseInt(String(rule?.titleFontSizeDp ?? '20'), 10);
    return Number.isFinite(n) ? clamp(n, 12, 60) : 20;
  }, [rule]);

  const messageSize = useMemo(() => {
    const n = parseInt(String(rule?.messageFontSizeDp ?? '16'), 10);
    return Number.isFinite(n) ? clamp(n, 10, 56) : 16;
  }, [rule]);

  // Build placeholders ($$@User, $$@Mac, $$@Package)
  useEffect(() => {
    let cancelled = false;
    async function buildText() {
      try {
        // Set immediate baseline so UI shows message without waiting for async values
        const baseTitle = (rule?.messageTitle || '').toString();
        const baseMsg = (rule?.message || '').toString();
        if (!cancelled) {
          setRenderTitle(baseTitle);
          setRenderMessage(baseMsg);
        }

        const id = await getDeviceIdentifier().catch(() => '');
        let username = '';
        try {
          const u = JSON.parse(sessionStorage.getItem('user') || localStorage.getItem('user') || '{}');
          username = u?.data?.username || u?.username || '';
        } catch {}
        let packageString = '';
        try {
          const pkgStored = localStorage.getItem('package');
          if (pkgStored) {
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

        const title = (rule?.messageTitle || '').toString()
          .replace(/\$\$@User/gi, ` ${username} `)
          .replace(/\$\$@Mac/gi, ` ${id} `)
          .replace(/\$\$@Package/gi, ` ${packageString} `);
        const msg = (rule?.message || '').toString()
          .replace(/\$\$@User/gi, ` ${username} `)
          .replace(/\$\$@Mac/gi, ` ${id} `)
          .replace(/\$\$@Package/gi, ` ${packageString} `);
        if (!cancelled) {
          setRenderTitle(title);
          setRenderMessage(msg);
        }
      } catch {
        // Keep baseline values already set above
      }
    }
    buildText();
    return () => { cancelled = true; };
  }, [rule?.messageTitle, rule?.message]);

  // Duration behavior
  useEffect(() => {
    if (!enabled) { setVisible(false); return; }
    let cancelled = false;
    // Remember the element that had focus before showing the overlay so we can restore it
    try {
      lastActiveRef.current = document.activeElement;
    } catch {}
    setVisible(true);
    const durRaw = rule?.duration;
    const parsed = parseInt(String(durRaw), 10);
    const lifeSec = Number.isFinite(parsed) ? parsed : -1;
    const timer = (lifeSec === -1) ? null : setTimeout(() => {
      if (!cancelled) {
        setVisible(false);
        onClose && onClose(rule?.updatedAt || rule?.u || '');
      }
    }, Math.max(1, lifeSec) * 1000);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [enabled, rule?.duration, forcePush]);

  // Global navigation-block flag: while this overlay is visible, mark BACK/DPAD as blocked.
  // (Original behaviour – do not change semantics of how force messages block navigation.)
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        window.__CAASTV_FORCE_PUSH_ACTIVE = !!(visible && enabled);
      }
    } catch {}
  }, [visible, enabled]);

  // When a force-push message is visible, block all navigation underneath,
  // including BACK (both keydown and browser/TV popstate).
  useEffect(() => {
    if (!visible || !enabled) return;
    // Remove focus from any underlying element so nothing appears focused behind the overlay
    try {
      if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
      }
    } catch {}
    const handleKey = (e) => {
      try {
        if (forcePush) {
          // Hard force-push: block every key completely.
          e.preventDefault();
          e.stopPropagation();
          return;
        }

        // Soft message with OK button: keep focus locked on OK and allow only
        // the OK/Enter key to activate it. All other navigation keys are blocked
        // until the user dismisses the message.
        const okEl = okButtonRef.current;
        if (okEl && document.activeElement !== okEl) {
          try {
            okEl.focus({ preventScroll: true });
          } catch {
            try { okEl.focus(); } catch {}
          }
        }

        const key = e.key || '';
        const code = typeof e.keyCode === 'number' ? e.keyCode : e.which;
        const isOkKey =
          key === 'Enter' ||
          key === 'OK' ||
          key === 'Accept' ||
          key === ' ' ||
          key === 'Spacebar' ||
          code === 13 ||
          code === 32;
        const isOkFocused = okEl && document.activeElement === okEl;

        if (isOkFocused && isOkKey) {
          // Let the button's default activation happen, but keep the event
          // from bubbling into app-level key handlers.
          e.stopPropagation();
          return;
        }

        // For any other key (including BACK / arrows), completely block navigation
        // and force focus back to the OK button.
        e.preventDefault();
        e.stopPropagation();
      } catch {}
    };
    const handlePopState = (e) => {
      try {
        e.preventDefault?.();
        // Completely swallow this popstate so route-level handlers do not run.
        e.stopImmediatePropagation?.();
        e.stopPropagation?.();
      } catch {}
      // Immediately push a guard state back so the URL/screen does not change
      try { window.history && window.history.pushState && window.history.pushState({ forceOverlayGuard: true }, ''); } catch {}
    };
    // Use capture phase so we intercept before other handlers
    document.addEventListener('keydown', handleKey, true);
    window.addEventListener('popstate', handlePopState);
    return () => {
      document.removeEventListener('keydown', handleKey, true);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [visible, enabled, forcePush]);

  // When a non-force-push message with an OK button is visible, focus the OK button
  useEffect(() => {
    if (!visible || !enabled || forcePush) return;
    try {
      okButtonRef.current && okButtonRef.current.focus({ preventScroll: true });
    } catch {}
  }, [visible, enabled, forcePush]);

  if (!visible || !enabled) return null;

  const backdropStyle = {
    position: 'fixed',
    inset: 0,
    backgroundColor: forcePush ? 'rgba(0,0,0,0.4)' : 'transparent',
    zIndex: 2147483647,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'auto',
  };

  const cardStyle = {
    maxWidth: 640,
    borderRadius: 16,
    backgroundColor: bgColor,
    padding: '24px 32px',
    boxShadow: '0 12px 30px rgba(0,0,0,0.35)',
    color: '#fff',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  };

  const titleStyle = {
    margin: 0,
    marginBottom: 12,
    color: titleColor,
    fontSize: `${titleSize}px`,
    fontWeight: 700,
    textAlign: 'center',
    width: '100%',
  };

  const messageStyle = {
    margin: 0,
    marginBottom: 16,
    whiteSpace: 'pre-wrap',
    color: messageColor,
    fontSize: `${messageSize}px`,
    textAlign: 'center',
    width: '100%',
  };

  const buttonBarStyle = { display: 'flex', justifyContent: 'center', gap: 12 };
  const buttonStyle = {
    padding: '10px 18px',
    borderRadius: 8,
    background: '#272C34',
    color: '#fff',
    border: 'none',
    fontSize: 16,
    cursor: 'pointer',
  };

  const handleOk = () => {
    setVisible(false);
    // Explicitly clear the global navigation-block flag so that, once the
    // user has acknowledged an OK-type force message, all DPAD/BACK handlers
    // in the rest of the app resume normal behaviour.
    try {
      if (typeof window !== 'undefined') {
        window.__CAASTV_FORCE_PUSH_ACTIVE = false;
      }
    } catch {}

    onClose && onClose(rule?.updatedAt || rule?.u || '');
    // After dismissing, restore focus to the element that was active before the overlay,
    // or fall back to a known app container so DPAD continues to work.
    setTimeout(() => {
      try {
        const prev = lastActiveRef.current;
        if (prev && typeof prev.focus === 'function' && document.contains(prev)) {
          prev.focus({ preventScroll: true });
        } else {
          const live = document.querySelector('.live-container');
          if (live && typeof live.focus === 'function') {
            live.focus({ preventScroll: true });
          } else {
            const main = document.querySelector('.main-content');
            main && main.focus && main.focus({ preventScroll: true });
          }
        }
      } catch {}
    }, 0);
  };

  return (
    <div style={backdropStyle} role="dialog" aria-modal={forcePush ? 'true' : 'false'}>
      <div style={cardStyle}>
        {renderTitle ? <h3 style={titleStyle}>{renderTitle}</h3> : null}
        {renderMessage ? <p style={messageStyle}>{renderMessage}</p> : null}
        {!forcePush ? (
          <div style={buttonBarStyle}>
            <button
              style={buttonStyle}
              onClick={handleOk}
              ref={okButtonRef}
            >
              OK
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}


