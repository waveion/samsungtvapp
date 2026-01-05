import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { createSseConnection } from '../services/api';
import { refreshUserPackagesAndChannels, fetchServiceLiveChannels } from '../services/drmhelper';
import { getDeviceIdentifier } from '../utils/fingerprint';
import ScrollMessageOverlay from './ScrollMessageOverlay';
import ForceMessageOverlay from './ForceMessageOverlay';
import FingerprintOverlay from './FingerprintOverlay';
import CommonDialog from './CommonDialog';
import './PushOverlay.css';
import { performFullLogout } from '../utils/logout';

export default function PushOverlay() {
  const [queue, setQueue] = useState([]);
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState(null);
  const [scrollRules, setScrollRules] = useState([]);
  const [forceRules, setForceRules] = useState([]);
  const [globalFingerprints, setGlobalFingerprints] = useState([]);
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const seenIdsRef = useRef(new Set());
  const lastTextRef = useRef({ text: '', ts: 0 });
  const lastScrollRulesRef = useRef([]);
  const location = useLocation();
  const navigate = useNavigate();
  const isPlayerRoute = (location?.pathname || '').startsWith('/player') || (location?.pathname || '').startsWith('/tv-player');
  const refreshInFlightRef = useRef(false);
  const lastRefreshTsRef = useRef(0);

  // Pseudo MAC id keys (mirror PanmetroLoginScreen)
  const DEVICE_PSEUDO_MAC_KEY = 'device_pseudo_mac';
  const DEVICE_PSEUDO_MAC_COLON_KEY = 'device_pseudo_mac_colon';
  const STATIC_MAC = 'A42280B923AA9FFA';

  const getPseudoMacIdForSse = () => {
    if (typeof window === 'undefined') return STATIC_MAC;
    try {
      const withColons = localStorage.getItem(DEVICE_PSEUDO_MAC_COLON_KEY);
      if (withColons && withColons.trim()) {
        return withColons.trim();
      }
      const normalized = localStorage.getItem(DEVICE_PSEUDO_MAC_KEY);
      if (normalized && normalized.trim()) {
        return normalized.trim();
      }
    } catch {
      // ignore storage errors and fall through
    }
    return STATIC_MAC;
  };

  // Persist updated channels map back to storage
  const persistChannelsMap = (map) => {
    try { sessionStorage.setItem('userPkgChannels', JSON.stringify(map)); } catch {}
    try { localStorage.setItem('userPkgChannels', JSON.stringify(map)); } catch {}
  };

  // Narrow refresh for a single package (serviceId)
  const refreshSinglePackage = async (serviceId) => {
    if (!serviceId) return;
    try {
      const res = await fetchServiceLiveChannels(String(serviceId));
      const items = Array.isArray(res?.results) ? res.results : [];
      const assetIds = items.map(x => String(x?.['asset-id'] ?? x?.assetId ?? '')).filter(Boolean);
      const contentIds = items.map(x => String(x?.['content-id'] ?? x?.contentId ?? '')).filter(Boolean);

      const raw = sessionStorage.getItem('userPkgChannels') || localStorage.getItem('userPkgChannels');
      const map = raw ? JSON.parse(raw) : {};
      map[String(serviceId)] = { assetIds, contentIds };
      persistChannelsMap(map);
    } catch (e) {
    }
  };

  useEffect(() => {
    // Global SSE for push-like events
    // Re-evaluate when route changes so that newly logged-in users
    // get updated package/user values from storage.
    let sse = null;
    (async () => {
      let region = '1'; // Default to '1' to match working API format
      // Derive package & user dynamically from stored data (dev and prod).
      // Start undefined so they are omitted if we cannot resolve them.
      let packageValue = undefined;
      let userValue = undefined;
      
      try {
        const userRaw = sessionStorage.getItem('user') || localStorage.getItem('user');
        if (userRaw) {
          const u = JSON.parse(userRaw);
          // Extract region - convert '01' to '1', 'DEV' to '1'
          const regionCode = u?.data?.regionCode || '';
          if (regionCode) {
            // Remove leading zeros and convert to number then back to string
            const regionNum = parseInt(regionCode, 10);
            region = isNaN(regionNum) ? '1' : String(regionNum);
          }

          // Build user identifier as "userId:username" when available (e.g. "944:PM11272")
          // Use the userId coming from login check; fall back to customerNumber only if needed.
          const userId =
            u?.data?.userId ||
            u?.userId ||
            u?.data?.customerNumber ||
            u?.customerNumber ||
            null;
          const username =
            u?.data?.username ||
            u?.username ||
            null;

          if (userId && username) {
            userValue = `${userId}:${username}`;
          } else if (username) {
            userValue = username;
          } else if (userId) {
            userValue = String(userId);
          } else {
            // Leave undefined so backend can apply its own default/global behaviour
            userValue = undefined;
          }
        }
      } catch {}
      
      // Get package from userPkgIds if available, otherwise use default
      try {
        const pkgIdsRaw = sessionStorage.getItem('userPkgIds') || localStorage.getItem('userPkgIds');
        if (pkgIdsRaw) {
          const pkgIds = JSON.parse(pkgIdsRaw);
          if (Array.isArray(pkgIds) && pkgIds.length > 0) {
            // Use first package ID only when present
            packageValue = pkgIds[0];
          }
        }
      } catch {}
      
      // Get MAC ID - use pseudo MAC from Panmetro login (with colons) or STATIC_MAC fallback
      const mac = getPseudoMacIdForSse();

      const query = {
        package: packageValue,
        user: userValue,
        region: region,
        appVersion: 'caastv_1.0.26',
        macId: mac,
      };

      // Debug: log global SSE request before connecting
      try {
        console.log('[SSE][PUSH_OVERLAY] Building GLOBAL SSE request', {
          path: '/app/combined-sse',
          query,
        });
      } catch {}

      sse = createSseConnection('/app/combined-sse', {
        query,
        onMessage: (payload) => {
        const obj = typeof payload === 'string' ? null : payload;
        if (!obj || typeof obj !== 'object') return;

        // Combined response shape: arrays like fingerprints, scrollMessages, forceMessages
        const hasCombinedArrays = Array.isArray(obj.fingerprints) || Array.isArray(obj.scrollMessages) || Array.isArray(obj.forceMessages);
        if (hasCombinedArrays) {
          // Respect settings toggles if provided
          const globalEnabled = obj?.settings?.globalFingerprintEnabled !== false;
          const playerEnabled = obj?.settings?.playerFingerprintEnabled !== false;
          const isFullUpdate = typeof obj.type === 'string' ? obj.type.toLowerCase().includes('full_data_update') : (obj.message === 'Data updated');

          // 1) Fingerprints (GLOBAL): show global-scoped fingerprints at app level
          if (Array.isArray(obj.fingerprints)) {
            try {
              const fpsEnabled = obj.fingerprints.filter((fp) => fp && (fp.enabled !== false && fp.enabled !== 0));
              // If settings toggle exists, obey it
              const fps = (globalEnabled !== false) ? fpsEnabled : [];
              setGlobalFingerprints(fps);
            } catch {
              setGlobalFingerprints([]);
            }
          }

          // 2) Scroll messages as marquee overlays (normalize short keys)
          if (Array.isArray(obj.scrollMessages)) {
            const normalized = obj.scrollMessages.map((sm) => {
              try {
                const enabled = sm?.enabled ?? sm?.e ?? true;
                const message = (sm?.message ?? sm?.m ?? '').toString();
                return {
                  ...sm,
                  _id: sm?._id ?? sm?.id,
                  id: sm?.id ?? sm?._id,
                  enabled,
                  message,
                  updatedAt: sm?.updatedAt ?? sm?.u,
                  intervalSec: sm?.intervalSec ?? sm?.is,
                  durationSec: sm?.durationSec ?? sm?.ds,
                  repeatCount: sm?.repeatCount ?? sm?.rc,
                };
              } catch { return sm; }
            });
            // Helper to detect player-scoped or channel-targeted rules (these should be handled by PlayerPage only)
            const isPlayerScopedOrTargeted = (rule) => {
              try {
                const scope = (rule?.scope || rule?.targetScope || rule?.scrollScope || rule?.messageScope || '').toString().toLowerCase();
                if (scope === 'player') return true;
                const single = rule?.channelId || rule?.ChannelID || rule?.channel || rule?.liveChannel || rule?.LiveChannel;
                const list = rule?.channelIds || rule?.channels || rule?.liveChannels || rule?.channelIdList || rule?.liveChannelIds || rule?.channelList;
                if (single) return true;
                if (Array.isArray(list) && list.length > 0) return true;
                if (typeof list === 'string' && list.trim()) return true;
                return false;
              } catch { return false; }
            };
            const activeScroll = normalized
              .filter((sm) => sm && (sm.enabled !== false && sm.enabled !== 0) && (sm.message || '').toString().trim())
              .filter((sm) => !isPlayerScopedOrTargeted(sm));
            setScrollRules(activeScroll);
            lastScrollRulesRef.current = activeScroll;
          } else {
            // If omitted, do not change current state (no-op); relies on explicit empty array to clear
          }

          // 3) Force messages - normalize keys and keep active
          if (Array.isArray(obj.forceMessages)) {
            const normalizedFM = obj.forceMessages.map((fm) => ({
              ...fm,
              _id: fm?._id ?? fm?.id,
              id: fm?.id ?? fm?._id,
              enabled: fm?.enabled ?? fm?.e ?? true,
              updatedAt: fm?.updatedAt ?? fm?.u,
              messageTitle: fm?.messageTitle ?? fm?.t ?? fm?.title,
              message: fm?.message ?? fm?.m,
              duration: fm?.duration ?? fm?.d,
              forcePush: fm?.forcePush ?? fm?.fp,
              messageBackgroundColorHex: fm?.messageBackgroundColorHex ?? fm?.bgHex,
              messageBackgroundTransparency: fm?.messageBackgroundTransparency ?? fm?.bgT,
              messageFontColorHex: fm?.messageFontColorHex ?? fm?.mfHex,
              messageFontTransparency: fm?.messageFontTransparency ?? fm?.mfT,
              messageFontSizeDp: fm?.messageFontSizeDp ?? fm?.mfSize,
              titleFontColorHex: fm?.titleFontColorHex ?? fm?.tfHex,
              titleFontTransparency: fm?.titleFontTransparency ?? fm?.tfT,
              titleFontSizeDp: fm?.titleFontSizeDp ?? fm?.tfSize,
              messageScope: (fm?.messageScope || '').toString().toUpperCase(),
            }));
            // Show only GLOBAL scope here; PLAYER-scoped force messages are handled by player
            const activeFM = normalizedFM
              .filter((fm) => fm && (fm.enabled !== false && fm.enabled !== 0) && ((fm.messageTitle || fm.message || '').toString().trim()))
              .filter((fm) => (fm.messageScope || 'GLOBAL') === 'GLOBAL');
            setForceRules(activeFM);
          }

          // 4) Check for user blocks - if user is blocked, show dialog and logout
          if (Array.isArray(obj.userBlocks)) {
            try {
              // Get current user's username
              const userRaw = sessionStorage.getItem('user') || localStorage.getItem('user');
              if (userRaw) {
                const u = JSON.parse(userRaw);
                const currentUsername = u?.data?.username || u?.data?.customerNumber || u?.username || '';
                
                // Check if current user is in the blocked list
                const isBlocked = obj.userBlocks.some((block) => {
                  const blockUsername = block?.username || '';
                  const isBlockedFlag = block?.isBlocked === 1 || block?.isBlocked === true;
                  return isBlockedFlag && (
                    blockUsername === currentUsername ||
                    blockUsername === u?.data?.customerNumber ||
                    blockUsername === u?.data?.userId
                  );
                });
                
                if (isBlocked) {
                  setShowBlockDialog(true);
                }
              }
            } catch (err) {
              // Silently handle errors
            }
          }

          // 4.a) Entitlement updates - userUpdates: refresh all active services for this user
          if (Array.isArray(obj.userUpdates) && obj.userUpdates.length > 0) {
            const now = Date.now();
            if (!refreshInFlightRef.current && (now - lastRefreshTsRef.current > 5000)) {
              refreshInFlightRef.current = true;
              lastRefreshTsRef.current = now;
              try {
                const userRaw = sessionStorage.getItem('user') || localStorage.getItem('user');
                const u = userRaw ? JSON.parse(userRaw) : {};
                const customerNumber = u?.data?.customerNumber || u?.customerNumber || '';
                if (customerNumber) {
                  refreshUserPackagesAndChannels({ customerNumber }).catch(() => {});
                }
              } catch (e) {
              } finally {
                refreshInFlightRef.current = false;
              }
            }
          }

          // 4.b) Entitlement updates - packageUpdates: refresh specific package service-ids
          if (Array.isArray(obj.packageUpdates) && obj.packageUpdates.length > 0) {
            try {
              const ids = obj.packageUpdates
                .map((p) => String(p?.packageID || p?.serviceId || p?.id || '').trim())
                .filter(Boolean);
              const unique = Array.from(new Set(ids));
              if (unique.length > 0) {
                // refresh in parallel but limit fanout
                unique.slice(0, 5).forEach((sid) => { refreshSinglePackage(sid); });
                // If many, schedule the rest
                if (unique.length > 5) {
                  setTimeout(() => unique.slice(5).forEach((sid) => { refreshSinglePackage(sid); }), 1000);
                }
              }
            } catch (e) {}
          }

          // We handled combined payload; stop here
          return;
        }

        // Handle off/delete operations
        const op = (obj.op || '').toString().toLowerCase();
        const nestedEnabled = obj.payload?.enabled;
        const disabled = (
          obj.enabled === false || obj.active === false ||
          obj.enabled === 0 || obj.active === 0 || obj.toggle === false ||
          obj.status === 'off' || nestedEnabled === false || nestedEnabled === 0
        );
        if (op === 'delete' || disabled || obj.message === '' || obj.payload?.message === '') {
          setQueue([]);
          setCurrent(null);
          setVisible(false);
          setScrollRules([]);
          setForceRules([]);
          lastScrollRulesRef.current = [];
          if (obj.id) seenIdsRef.current.delete(obj.id);
          lastTextRef.current = { text: '', ts: 0 };
          return;
        }

        // Only allow specific types; drop handshakes like "connected"
        const typeRaw = (obj.type || obj.event || '').toString().toLowerCase();
        const isScroll = typeRaw === 'scroll_message' || typeRaw === 'scroll';
        const isFingerprint = typeRaw === 'fingerprint' || typeRaw === 'finger_print';
        if (!(isScroll || isFingerprint)) return;

        // Extract text per type
        let text = '';
        if (isScroll) {
          text = (obj.payload?.message ?? obj.message ?? '').toString();
        } else if (isFingerprint) {
          const name = (obj.payload?.fingerprintName ?? 'Fingerprint').toString();
          text = name;
        }

        if (typeof text === 'string' && text.trim()) {
          const trimmed = text.trim();
          const now = Date.now();
          if ((current && current.text === trimmed) || (lastTextRef.current.text === trimmed && (now - lastTextRef.current.ts) < 30000)) {
            return;
          }
          setQueue((q) => [...q, { id: now, text: trimmed }]);
        }
        },
        onError: () => {},
      });
    })();
    return () => { try { sse && sse.close && sse.close(); } catch {} };
  }, [location.pathname]);

  // Display messages one by one
  useEffect(() => {
    if (!visible && queue.length > 0) {
      const next = queue[0];
      setCurrent(next);
      lastTextRef.current = { text: next.text, ts: Date.now() };
      setVisible(true);
      const t = setTimeout(() => {
        setVisible(false);
        setQueue((q) => q.slice(1));
      }, 8000);
      return () => clearTimeout(t);
    }
  }, [queue, visible]);

  // Handle user block logout
  const handleBlockLogout = () => {
    performFullLogout();
    setShowBlockDialog(false);
    // Navigate to login page
    navigate('/panmetro-login', { replace: true });
  };

  // Auto-logout after 5 seconds when block dialog is shown
  useEffect(() => {
    if (showBlockDialog) {
      const timer = setTimeout(() => {
        handleBlockLogout();
      }, 5000); // 5 seconds
      return () => clearTimeout(timer);
    }
  }, [showBlockDialog]);

  return (
    <>
      {/* Marquee scroll messages (global scope) */}
      {Array.isArray(scrollRules) && scrollRules.map((sm, idx) => (
        <ScrollMessageOverlay key={sm._id || sm.id || JSON.stringify(sm)} rule={sm} stackIndex={idx} />
      ))}

      {/* Force message modal overlays (GLOBAL scope – visible over the whole app, including player) */}
      {Array.isArray(forceRules) && forceRules.map((fm) => (
        <ForceMessageOverlay key={fm._id || fm.id || JSON.stringify(fm)} rule={fm} onClose={() => {}} />
      ))}

      {/* Global fingerprints overlay (renders over entire app, including player) */}
      {Array.isArray(globalFingerprints) && globalFingerprints.map((fp) => (
        <FingerprintOverlay key={fp._id || fp.id || JSON.stringify(fp)} rule={fp} />
      ))}

      {/* Bottom push toast for scroll/force titles */}
      {current ? (
        <div className={`push-overlay ${visible ? 'show' : ''}`}>
          <div className="push-content" role="status" aria-live="polite">
            {current.text}
          </div>
        </div>
      ) : null}

      {/* User block dialog - auto logout after 5 seconds */}
      <CommonDialog
        showDialog={showBlockDialog}
        title="Account Blocked"
        message="Logging out, please contact your operator"
        isErrorAdded={true}
        borderColor="#e61414"
      />
    </>
  );
}


