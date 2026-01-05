import React, { useEffect, useState, useCallback } from 'react';
import logo from '../assets/logo.png';
import './SplashScreen.css';
import CommonDialog from './CommonDialog';
import API, { Constants } from '../services/api';
import exitIcon from '../assets/exit_icon.svg';
import { getDeviceIdentifier } from '../utils/fingerprint';

const DEVICE_PSEUDO_MAC_KEY = 'device_pseudo_mac';
const DEVICE_PSEUDO_MAC_COLON_KEY = 'device_pseudo_mac_colon';

// TV QR-login session config
const TV_LOGIN_SESSION_STORAGE_KEY = 'tvLoginSession';

const SplashScreen = () => {
  const [progress, setProgress] = useState(0);
  const [showHealthError, setShowHealthError] = useState(false);

  useEffect(() => {
    let rafId = null;
    const totalDurationMs = 15000; // 15s
    const start = Date.now();

    const tick = () => {
      const elapsed = Date.now() - start;
      const pct = Math.min(1, elapsed / totalDurationMs);
      setProgress(pct * 100);
      if (pct < 1) {
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  // On boot, create a TV login session used for QR-based login on the Panmetro login screen
  useEffect(() => {
    let cancelled = false;

    const createTvLoginSession = async () => {
      try {
        const payload = {
          // For now we use a static device id; this can be swapped to a real device identifier later.
          deviceId: 'TEST-TV-01',
        };

        try {
          console.log('[PANMETRO][TV-LOGIN] Creating TV login session with payload:', payload);
          console.log('[PANMETRO][TV-LOGIN] Using DRM API:', Constants.API_CONFIGS.drm.baseURL);
        } catch {}

        // Use generic API service with DRM endpoint
        const data = await API.requestDrm('/src/api/v1/logincheck', {
          method: 'POST',
          body: JSON.stringify(payload),
        });

        if (!data || cancelled) {
          return;
        }

        try {
          console.log('[PANMETRO][TV-LOGIN] Session API response:', data);
        } catch {}

        // Persist the session so the Panmetro login screen can render a QR code from qrUrl
        try {
          if (typeof window !== 'undefined' && typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem(TV_LOGIN_SESSION_STORAGE_KEY, JSON.stringify(data));
          }
          // Also expose on window for quick access if needed
          if (typeof window !== 'undefined') {
            window.__CAASTV_TV_LOGIN_SESSION = data;
          }
        } catch {
          // ignore storage errors
        }
      } catch (err) {
        try {
          console.log('[PANMETRO][TV-LOGIN] Error while creating TV login session:', err?.message || err);
          console.log('[PANMETRO][TV-LOGIN] Error details:', err);
        } catch {}
      }
    };

    createTvLoginSession();

    return () => {
      cancelled = true;
    };
  }, []);

  // On boot, resolve LG/webOS unique id and exchange it for pseudo MAC from backend
  useEffect(() => {
    let cancelled = false;

    const initPseudoMac = async () => {
      try {
        const lgUniqueId = await getDeviceIdentifier({ allowSynthetic: false }).catch(() => null);
        try {
          console.log('[PANMETRO][SPLASH] LG unique id resolved:', lgUniqueId || null);
        } catch {}
        if (!lgUniqueId || cancelled) return;

        // Call backend to exchange LG unique id (lgudid) for pseudo MAC using generic API service
        const requestBody = { lgudid: lgUniqueId };
        try {
          console.log('[PANMETRO][SPLASH] Calling pseudo-mac API with body:', requestBody);
          console.log('[PANMETRO][SPLASH] Using CMS API:', Constants.API_CONFIGS.cms.baseURL);
        } catch {}
        
        const data = await API.post('/device/pseudo-mac', requestBody).catch((err) => {
          try {
            console.log('[PANMETRO][SPLASH] Pseudo-mac API failed:', err.message);
          } catch {}
          return null;
        });
        try {
          console.log('[PANMETRO][SPLASH] Pseudo-mac API response JSON:', data);
        } catch {}
        const pseudoMacRaw = data && data.pseudo_mac;
        if (!pseudoMacRaw || cancelled) return;

        const pseudoMacColon = String(pseudoMacRaw);
        const pseudoMacNormalized = pseudoMacColon.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

        try {
          if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
            localStorage.setItem(DEVICE_PSEUDO_MAC_KEY, pseudoMacNormalized);
            localStorage.setItem(DEVICE_PSEUDO_MAC_COLON_KEY, pseudoMacColon);
            console.log('[PANMETRO][SPLASH] Stored pseudo MAC values:', {
              DEVICE_PSEUDO_MAC_KEY,
              pseudoMacNormalized,
              DEVICE_PSEUDO_MAC_COLON_KEY,
              pseudoMacColon,
            });
          }
        } catch {
          // ignore storage errors
        }
      } catch {
        // silently ignore errors; app can still proceed with static MAC fallback
        try {
          console.log('[PANMETRO][SPLASH] Error while resolving/storing pseudo MAC');
        } catch {}
      }
    };

    initPseudoMac();

    return () => {
      cancelled = true;
    };
  }, []);

  const checkServerHealth = useCallback(async () => {
    try {
      console.log('[PANMETRO][HEALTH] Checking API health at:', API.baseURL + '/app/health');
      const controller = new AbortController();
      const timer = setTimeout(() => {
        console.log('[PANMETRO][HEALTH] Request timeout after 5s');
        try { controller.abort(); } catch {}
      }, 5000); // 5s timeout
      try {
        const response = await API.request('/app/health', { method: 'GET', signal: controller.signal });
        console.log('[PANMETRO][HEALTH] API health check SUCCESS:', response);
        setShowHealthError(false);
      } finally {
        clearTimeout(timer);
      }
    } catch (err) {
      console.error('[PANMETRO][HEALTH] API health check FAILED:', err.message || err);
      console.error('[PANMETRO][HEALTH] Error details:', {
        name: err.name,
        message: err.message,
        stack: err.stack
      });
      setShowHealthError(true);
    }
  }, []);

  useEffect(() => {
    checkServerHealth();
  }, [checkServerHealth]);

  return (
    <div className="splash-screen">
      <div className="splash-content">
        <img src={logo} alt="WebTV Logo" className="splash-logo" />
      </div>
      <div className="splash-progress">
        <div className="splash-progress-track">
          <div className="splash-progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <CommonDialog
        showDialog={showHealthError}
        title="Service Temporarily Unavailable"
        message="We're working to restore the connection."
        isErrorAdded={true}
        iconSrc={exitIcon}
        borderColor="transparent"
        confirmButtonText="Exit"
        onConfirm={() => {
          try { window.open('', '_self'); window.close(); } catch {}
        }}
        initialFocusOnConfirm={true}
      />
    </div>
  );
};

export default SplashScreen;
