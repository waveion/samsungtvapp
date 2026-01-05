import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ShakaPlayer from '../components/ShakaPlayer';
import { createSseConnection } from '../services/api';
import { useEpgInfinite } from '../services/epgManifestQueries';
import { getDeviceIdentifier } from '../utils/fingerprint';
import FingerprintOverlay from '../components/FingerprintOverlay';
import ScrollMessageOverlay from '../components/ScrollMessageOverlay';
import ForceMessageOverlay from '../components/ForceMessageOverlay';
import { buildCryptoGuardLicenseUrl } from '../utils/drm';
import CommonDialog from '../components/CommonDialog';
import { isAssetPlayableViaDRM, ensureEntitlementsForUser } from '../services/drmhelper';
import './PlayerPage.css';
// Import your banner image
import bannerImage from '../assets/banner.jpg';

// Keep Player and Live in sync: reuse Live's persistence key for last-used channel
const LIVE_PERSIST_KEY = 'live_screen_state_v1';

const updateLivePersistLastChannel = (channelId) => {
  if (!channelId) return;
  try {
    const raw = sessionStorage.getItem(LIVE_PERSIST_KEY);
    let parsed = null;
    if (raw) {
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = null;
      }
    }
    const next = {
      categoryName: parsed?.categoryName || 'All',
      languageName: parsed?.languageName || 'All',
      lastChannelId: channelId,
    };
    sessionStorage.setItem(LIVE_PERSIST_KEY, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
};

const PlayerPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [showPlayer, setShowPlayer] = useState(false);
  const [channelInfo, setChannelInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showSubDialog, setShowSubDialog] = useState(false);
  const [subDialogMessage, setSubDialogMessage] = useState('');
  const [allChannels, setAllChannels] = useState([]);
  const [currentChannelIndex, setCurrentChannelIndex] = useState(0);
  const [playerMeta, setPlayerMeta] = useState({});
  const [playerFingerprints, setPlayerFingerprints] = useState([]);
  const [playerScrollRules, setPlayerScrollRules] = useState([]);
  const [playerForceRules, setPlayerForceRules] = useState([]);
  const popGuardRef = useRef(true);
  // Prevent multiple rapid BACK presses from triggering repeated navigations
  const isClosingRef = useRef(false);
  const fromScreen = location.state?.fromScreen || null;
  const GENRE_LAST_FOCUSED_ID_KEY = 'genre:lastFocusedChannelId';
  const GENRE_LAST_FOCUSED_INDEX_KEY = 'genre:lastFocusedChannel';
  const GENRE_LAST_FOCUSED_FROM_PLAYER_FLAG_KEY = 'genre:lastFocusedFromPlayer';
  const {
    data: epgPagesData,
    isLoading: isEpgLoading,
  } = useEpgInfinite(
    { pageSize: 50 },
    {
      // Reuse the same infinite EPG cache as Genre/Live so channel lookup is consistent
      refetchInterval: 30000,
      refetchOnWindowFocus: false,
    }
  );

  const epgData = React.useMemo(() => {
    try {
      const pages = epgPagesData?.pages || [];
      const list = [];
      pages.forEach((p) => {
        if (Array.isArray(p)) list.push(...p);
        else if (p && Array.isArray(p.items)) list.push(...p.items);
      });
      return list;
    } catch {
      return [];
    }
  }, [epgPagesData]);
  const [controlsOnly, setControlsOnly] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams(location.search);
      const channelId = params.get('channelId');
      const channelTitle = params.get('title') || 'Live Channel';

      if (!channelId) {
        if (window.history.length > 1) {
          navigate(-1);
        } else {
          navigate('/', { replace: true });
        }
        return;
      }

      if (isEpgLoading) {
        return; // wait for epg
      }

      try {
        const decodedChannelId = decodeURIComponent(channelId);
        const decodedChannelTitle = decodeURIComponent(channelTitle);

        const fromScreen = location.state?.fromScreen;

        // When launched from the Genre screen, immediately persist this
        // channel as the last-focused Genre channel so that returning to
        // Genre can always restore focus by ChannelID, even if the user
        // does not zap between channels inside the Player.
        if (fromScreen === 'genre' && decodedChannelId) {
          try {
            sessionStorage.setItem(GENRE_LAST_FOCUSED_ID_KEY, String(decodedChannelId));
            const originList = Array.isArray(location.state?.channelList)
              ? location.state.channelList
              : [];
            const idxInGenre = originList.findIndex(
              (ch) => String(ch?.id ?? '') === String(decodedChannelId)
            );
            if (idxInGenre >= 0) {
              sessionStorage.setItem(GENRE_LAST_FOCUSED_INDEX_KEY, String(idxInGenre));
            }
            // Mark that this focus hint came from Player so Genre won't
            // immediately overwrite it on first render while EPG is loading.
            sessionStorage.setItem(GENRE_LAST_FOCUSED_FROM_PLAYER_FLAG_KEY, '1');
          } catch {
            // ignore storage errors
          }
        }

        // Only update Live's persisted last channel when the Player was
        // launched from the Live/EPG screen (not from Genre).
        if (fromScreen === 'live') {
          updateLivePersistLastChannel(decodedChannelId);
        }

        const list = epgData || [];
        if (!cancelled) setAllChannels(list);

        const channelData = list.find(item => item.content?.ChannelID === decodedChannelId);
        const channelIndex = list.findIndex(item => item.content?.ChannelID === decodedChannelId) || 0;
        if (!cancelled) setCurrentChannelIndex(channelIndex);

        if (channelData) {
          const videoUrl = channelData.content?.streamUrl || 
                           channelData.content?.videoUrl || 
                           channelData.content?.url ||
                           channelData.streamUrl ||
                           channelData.videoUrl ||
                           channelData.url;

          if (videoUrl) {
            let drmConfig = null;
            try {
              const drmTypeRaw = channelData?.content?.drmType || channelData?.drmType || channelData?.content?.DRMType || channelData?.content?.DRM;
              const drmType = (drmTypeRaw || '').toString().toLowerCase();

              // Subscription gate for cryptoguard DRM
              if (drmType === 'cryptoguard') {
                try {
                  const epgAssetOrContentId = channelData?.content?.assetId || channelData?.content?.KeyId || channelData?.content?.keyId || '';
                  // First, try quick check from stored entitlements
                  let allowed = isAssetPlayableViaDRM({ assetId: String(epgAssetOrContentId), contentId: String(epgAssetOrContentId) });
                  if (!allowed) {
                    // Ensure entitlements are loaded then re-check
                    const userRaw = sessionStorage.getItem('user') || localStorage.getItem('user');
                    let customerNumber = '';
                    try { 
                      const parsed = userRaw ? JSON.parse(userRaw) : {};
                      customerNumber = parsed?.data?.customerNumber || parsed?.customerNumber || '';
                    } catch {}
                    await ensureEntitlementsForUser({ customerNumber });
                    allowed = isAssetPlayableViaDRM({ assetId: String(epgAssetOrContentId), contentId: String(epgAssetOrContentId) });
                  }
                  if (!allowed) {
                    if (!cancelled) {
                      // Keep player mounted in controls-only mode so DPAD works
                      setControlsOnly(true);
                      setShowPlayer(true);
                      setSubDialogMessage('This channel is not subscribed to your package.');
                      setShowSubDialog(true);
                      setLoading(false);
                    }
                    // Do NOT return: continue to set channel info so overlays/DPAD are available
                  } else {
                    // Ensure dialog is closed and controls-only disabled on entitled channels
                    if (!cancelled) {
                      setControlsOnly(false);
                      setShowSubDialog(false);
                    }
                  }
                } catch {}
              }
              if (drmType === 'cryptoguard') {
                const user = (() => { try { return JSON.parse(sessionStorage.getItem('user') || localStorage.getItem('user') || '{}'); } catch { return {}; } })();
                // For DRM, always send the same unique id/macaddr that was used at login (stored in user.credentials.macId)
                const uniqueIdPref = user?.credentials?.macId || user?.data?.macId || '';
                const contentId = channelData?.content?.assetId || channelData?.content?.KeyId || channelData?.content?.keyId || '';
                let licenseUrl = buildCryptoGuardLicenseUrl({
                  baseUrl: 'https://drm.panmetroconvergence.com:4443/',
                  contentUrl: videoUrl,
                  contentId,
                  username: user?.data?.username || user?.credentials?.username || '',
                  password: user?.credentials?.password || '',
                  uniqueDeviceId: uniqueIdPref,
                  deviceTypeName: 'Android TV',
                });
                try {
                  const origin = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : '';
                  if (origin.startsWith('http')) {
                    const u = new URL(licenseUrl);
                    const proxy = new URL(origin);
                    // Use /drm/cryptoguard proxy for DRM license (now points to panmetro DRM port 4443)
                    // /drm/panmetro is for login (port 3443), not license
                    const prefix = '/drm/cryptoguard';
                    proxy.pathname = prefix + (u.pathname || '/');
                    if (!proxy.pathname.endsWith('/')) proxy.pathname += '/';
                    proxy.search = u.search;
                    licenseUrl = proxy.toString();
                  }
                } catch {}
                drmConfig = { keySystem: 'com.widevine.alpha', licenseUrl };
              } else if (drmType === 'sigma' || drmType === 'widevine') {
                let licenseUrl = channelData?.content?.licenseUrl || 'https://license-staging.sigmadrm.com/license/verify/widevine';
                try {
                  if (/license-staging\.sigmadrm\.com/.test(licenseUrl)) {
                    const u = new URL(licenseUrl);
                    const proxy = new URL(window.location.origin);
                    proxy.pathname = '/drm/sigma' + (u.pathname || '/');
                    if (!proxy.pathname.endsWith('/')) proxy.pathname += '/';
                    proxy.search = u.search;
                    licenseUrl = proxy.toString();
                  }
                } catch {}
                drmConfig = { keySystem: 'com.widevine.alpha', licenseUrl };
              }
            } catch {}

            const now = Date.now();
            const allPrograms = channelData?.tv?.programme || 
                                channelData?.programme || 
                                channelData?.content?.tv?.programme ||
                                channelData?.content?.programme || [];
            const parseEPGTime = (timeStr) => {
              if (!timeStr) return 0;
              const match = timeStr.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s*([+-]\d{4})$/);
              if (match) {
                const [, year, month, day, hour, minute, second, timezone] = match;
                const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}${timezone}`);
                return date.getTime();
              }
              return 0;
            };
            const sortedPrograms = [...allPrograms].sort((a, b) => {
              const aStart = parseEPGTime(a._start);
              const bStart = parseEPGTime(b._start);
              return aStart - bStart;
            });
            // Compute upcoming/current; handle case when EPG day doesn't include "now"
            const upcomingProgram = sortedPrograms.find(p => parseEPGTime(p._start) > now);
            let currentProgram = sortedPrograms.find(p => {
              const startTime = parseEPGTime(p._start);
              const endTime = parseEPGTime(p._stop);
              return startTime <= now && endTime > now;
            });
            // Fallbacks when nothing matches "now": pick last started, else first item
            if (!currentProgram) {
              let lastStarted = null;
              for (let i = 0; i < sortedPrograms.length; i++) {
                const s = parseEPGTime(sortedPrograms[i]._start);
                if (s && s <= now) {
                  lastStarted = sortedPrograms[i];
                } else {
                  break;
                }
              }
              currentProgram = lastStarted || sortedPrograms[0] || null;
            }
            const currentProgramTitle = currentProgram?.title || '';
            const nextIndexBase = sortedPrograms.findIndex(p => p === currentProgram);
            const nextFromCurrent = nextIndexBase >= 0 ? sortedPrograms[nextIndexBase + 1] : null;
            const nextProgramTitle = (upcomingProgram?.title || nextFromCurrent?.title) || '';

            let bannerText = "";
            let showBanner = true;
            let bannerImageUrl = bannerImage;

            if (!cancelled) {
              setChannelInfo({
                id: decodedChannelId,
                title: decodedChannelTitle,
                videoUrl: videoUrl,
                drm: drmConfig,
                channelData: channelData.content,
                channelNumber: channelData.content?.channelNo || channelData.content?.channelNumber || '',
                channelLogo: channelData.content?.thumbnailUrl || channelData.content?.ChannelLogo || channelData.content?.channelLogo || channelData.content?.logo || '',
                bgGradient: channelData.content?.bgGradient,
                nextProgram: nextProgramTitle,
                currentProgram: currentProgramTitle,
                programStartTime: currentProgram?._start || currentProgram?.start || null,
                programEndTime: currentProgram?._stop || currentProgram?.stop || null,
                bannerText: bannerText,
                showBanner: showBanner,
                bannerImage: bannerImageUrl
              });
              setShowPlayer(true);
            }
          } else {
            if (!cancelled) setError(`No video stream available for ${decodedChannelTitle}. Please try another channel.`);
          }
        } else {
          if (!cancelled) setError(`Channel \"${decodedChannelTitle}\" not found. Please check the channel list.`);
        }
      } catch (err) {
        if (!cancelled) setError('Failed to load channel data. Please check your connection and try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [location.search, isEpgLoading, epgData, navigate]);

  // Player-specific SSE subscription tied to current channel
  useEffect(() => {
    let sseConn = null;
    (async () => {
      try {
        const params = new URLSearchParams(location.search);
        const rawChannelId = params.get('channelId');
        const decodedChannelId = rawChannelId ? decodeURIComponent(rawChannelId) : '';
        let region = '1';
        
        try {
          const userRaw = sessionStorage.getItem('user') || localStorage.getItem('user');
          if (userRaw) {
            const u = JSON.parse(userRaw);
            const regionCode = u?.data?.regionCode || '';
            if (regionCode) {
              const regionNum = parseInt(regionCode, 10);
              region = isNaN(regionNum) ? '1' : String(regionNum);
            }
          }
        } catch {}
        
        let mac = await getDeviceIdentifier().catch(() => null);
        if (!mac) {
          try {
            const storedMac = localStorage.getItem('caastv_unique_id');
            mac = storedMac || '0C:85:C8:81:46:1D';
          } catch {
            mac = '0C:85:C8:81:46:1D';
          }
        }
        
        const sseLiveChannel = (channelInfo && (channelInfo.channelNumber || channelInfo.channelNo) && channelInfo.title)
          ? `${channelInfo.channelNumber || channelInfo.channelNo}:${channelInfo.title}`
          : decodedChannelId;
        // PLAYER scope: only send liveChannel + meta (no package/user)
        const query = {
          region: region,
          appVersion: 'caastv_1.0.26',
          macId: mac,
          ...(sseLiveChannel ? { liveChannel: sseLiveChannel } : {})
        };
        sseConn = createSseConnection('/app/combined-sse', {
          query,
          onMessage: (payload) => {
            try {
              if (!payload || typeof payload !== 'object') return;
              const bannerText = payload?.banner?.text ?? payload?.bannerText ?? '';
              const showBanner = Boolean(payload?.banner?.enabled ?? payload?.showBanner ?? false);
              const nextProgram = payload?.epg?.nextProgram ?? payload?.nextProgram ?? '';
              const currentProgram = payload?.epg?.currentProgram ?? payload?.currentProgram ?? '';
              setPlayerMeta((prev) => ({ ...prev, bannerText, showBanner, nextProgram, currentProgram }));

              const currentId = String(sseLiveChannel || '').trim();
              const extractTargets = (rule) => {
                try {
                  const single = rule?.channelId || rule?.ChannelID || rule?.channel || rule?.liveChannel || rule?.LiveChannel;
                  const list = rule?.channelIds || rule?.channels || rule?.liveChannels || rule?.channelIdList || rule?.liveChannelIds || rule?.channelList;
                  const fromSingle = single ? [String(single)] : [];
                  let fromList = [];
                  if (Array.isArray(list)) fromList = list.map((v) => String(v));
                  else if (typeof list === 'string') fromList = list.split(/[;,\s]+/).map((v) => v.trim()).filter(Boolean);
                  const all = [...fromSingle, ...fromList];
                  return Array.from(new Set(all));
                } catch { return []; }
              };
              const matchesChannel = (rule) => {
                try {
                  const scope = (
                    rule?.scope ||
                    rule?.targetScope ||
                    rule?.fingerprintScope ||
                    rule?.messageScope ||
                    rule?.scrollScope ||
                    ''
                  ).toString().toLowerCase();
                  if (scope && scope !== 'player') return false;
                  const targets = extractTargets(rule).map((t) => String(t || '').trim());
                  if (targets.length > 0) {
                    // Accept exact match or ID-prefix match before ':' in the target string
                    const ok = targets.some((t) => {
                      if (!t) return false;
                      if (t === currentId) return true;
                      const colon = t.indexOf(':');
                      if (colon > 0) {
                        const idPart = t.slice(0, colon).trim();
                        if (idPart && idPart === currentId) return true;
                      }
                      return false;
                    });
                    return ok;
                  }
                  return true;
                } catch { return false; }
              };

              if (Array.isArray(payload.fingerprints)) {
                const fps = payload.fingerprints.filter((fp) => fp && (fp.enabled !== false && fp.enabled !== 0) && matchesChannel(fp));
                setPlayerFingerprints(fps);
              }
              if (Array.isArray(payload.scrollMessages)) {
                const sms = payload.scrollMessages.map((sm) => ({
                  ...sm,
                  enabled: sm?.enabled ?? sm?.e ?? true,
                  message: (sm?.message ?? sm?.m ?? '').toString(),
                })).filter((sm) => sm && sm.enabled && sm.message.trim() && matchesChannel(sm));
                setPlayerScrollRules(sms);
              }
              if (Array.isArray(payload.forceMessages)) {
                const fms = payload.forceMessages.map((fm) => ({
                  ...fm,
                  enabled: fm?.enabled ?? fm?.e ?? true,
                  message: fm?.message ?? fm?.m,
                  messageTitle: fm?.messageTitle ?? fm?.t ?? fm?.title,
                })).filter((fm) => fm && fm.enabled && (String(fm.messageTitle || fm.message || '').trim()) && matchesChannel(fm));
                setPlayerForceRules(fms);
              }
            } catch {}
          },
          onError: () => {},
        });
      } catch {}
    })();

    return () => {
      try { sseConn && sseConn.close && sseConn.close(); } catch {}
    };
  }, [location.search, channelInfo]);

  const handleClosePlayer = () => {
    // Ignore duplicate close requests while we are already navigating away
    if (isClosingRef.current) {
      return;
    }
    isClosingRef.current = true;
    // Prefer returning to the originating screen (live / genre) when known
    popGuardRef.current = false; // allow this navigation to proceed without re-pushing guard
    if (fromScreen === 'live') {
      navigate('/live', { replace: true });
      return;
    }
    if (fromScreen === 'genre') {
      navigate('/genre', { replace: true });
      return;
    }

    // Otherwise, use browser history to go back to the previous page
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      // Fallback to home if no history
      navigate('/', { replace: true });
    }
  };

  const handleChannelChange = (newChannelIndex) => {
    // Hide any subscription dialog while navigating
    setShowSubDialog(false);
    setControlsOnly(false);
    
    if (allChannels.length > 0 && newChannelIndex >= 0 && newChannelIndex < allChannels.length) {
      const newChannel = allChannels[newChannelIndex];
      const newChannelId = newChannel.content?.ChannelID || newChannel.channelId;
      const newChannelTitle = newChannel.content?.ChannelName || newChannel.content?.title || 'Live Channel';

      // Keep Live's last-used channel in sync with in-player zapping
      // only when the Player session originated from the Live screen.
      if (newChannelId && location.state?.fromScreen === 'live') {
        updateLivePersistLastChannel(String(newChannelId));
      }
      // Keep Genre's last-focused channel in sync with in-player zapping
      // so when returning from Player, Genre can focus this channel row.
      if (newChannelId && location.state?.fromScreen === 'genre') {
        try {
          sessionStorage.setItem(GENRE_LAST_FOCUSED_ID_KEY, String(newChannelId));
          // Also persist the index within the original Genre filtered list so that
          // the first render after returning from Player already has the correct
          // focused index, avoiding a brief flash of the previous channel.
          const originList = Array.isArray(location.state?.channelList)
            ? location.state.channelList
            : [];
          const idxInGenre = originList.findIndex(
            (ch) => String(ch?.id ?? '') === String(newChannelId)
          );
          if (idxInGenre >= 0) {
            sessionStorage.setItem(GENRE_LAST_FOCUSED_INDEX_KEY, String(idxInGenre));
          }
          // Mark that this ID came from the player so Genre won't immediately overwrite it
          // on first render; Genre will clear this flag after successfully restoring focus.
          sessionStorage.setItem(GENRE_LAST_FOCUSED_FROM_PLAYER_FLAG_KEY, '1');
        } catch {
          // ignore storage errors
        }
      }

      // Update URL to reflect new channel
      const newUrl = `/player?channelId=${encodeURIComponent(newChannelId)}&title=${encodeURIComponent(newChannelTitle)}`;
      // Preserve navigation source (fromScreen) when zapping between channels
      navigate(newUrl, { replace: true, state: location.state });
      
      // Update current channel index
      setCurrentChannelIndex(newChannelIndex);
    }
  };

  if (loading) {
    return (
      <div className="player-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading channel...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="player-page">
        <div className="error-container">
          <p>{error}</p>
          <button onClick={() => {
            if (window.history.length > 1) {
              navigate(-1);
            } else {
              navigate('/', { replace: true });
            }
          }} className="retry-button">Go Back</button>
        </div>
      </div>
    );
  }

  // Allow rendering the subscription dialog even if player is blocked
  if (!showPlayer && !showSubDialog) {
    return null;
  }

  return (
    <div className="player-page">
      {showPlayer && channelInfo && (
        <ShakaPlayer
          videoUrl={channelInfo.videoUrl}
          channelId={channelInfo.id}
          drm={channelInfo.drm}
          channelTitle={channelInfo.title}
          channelNumber={channelInfo.channelNumber}
          channelLogo={channelInfo.channelLogo}
          bgGradient={channelInfo.bgGradient}
          programmes={channelInfo.channelData?.tv?.programme || []}
          nextProgram={playerMeta.nextProgram ?? channelInfo.nextProgram}
          currentProgram={playerMeta.currentProgram ?? channelInfo.currentProgram}
          onClose={handleClosePlayer}
          // Custom Banner
          showBanner={(playerMeta.showBanner ?? channelInfo.showBanner) === true}
          bannerText={playerMeta.bannerText ?? channelInfo.bannerText}
          bannerImage={channelInfo.bannerImage}
          // Dynamic program meta for overlay
          programStartTime={channelInfo.programStartTime}
          programEndTime={channelInfo.programEndTime}
          // Channel Navigation Props
          onChannelChange={handleChannelChange}
          currentChannelIndex={currentChannelIndex}
          totalChannels={allChannels.length}
          channelList={allChannels}
          controlsOnly={controlsOnly}
        />
      )}
      {/* Player-scoped overlays */}
      {Array.isArray(playerFingerprints) && playerFingerprints.map((fp) => (
        <FingerprintOverlay key={fp._id || fp.id || JSON.stringify(fp)} rule={fp} />
      ))}
      {Array.isArray(playerScrollRules) && playerScrollRules.map((sm, idx) => (
        <ScrollMessageOverlay key={sm._id || sm.id || JSON.stringify(sm)} rule={sm} stackIndex={idx} />
      ))}
      {Array.isArray(playerForceRules) && playerForceRules.map((fm) => (
        <ForceMessageOverlay key={fm._id || fm.id || JSON.stringify(fm)} rule={fm} onClose={() => {}} />
      ))}
      <CommonDialog
        showDialog={showSubDialog}
        title="Subscription required"
        message={subDialogMessage}
        passive={true}
        onDismiss={() => {
          setShowSubDialog(false);
          if (window.history.length > 1) {
            navigate(-1);
          } else {
            navigate('/', { replace: true });
          }
        }}
      />
    </div>
  );
};

export default PlayerPage;  