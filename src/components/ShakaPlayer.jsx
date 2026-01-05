import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import * as shaka from "shaka-player";
import FeatherIcon from "feather-icons-react";
import toast, { Toaster } from "react-hot-toast";
import "./ShakaPlayer.css";
import PlayerOverlay from "./PlayerOverlay";
import CommonDialog from "./CommonDialog";
import errorIconDefault from "../assets/media_error.png";
import FingerprintOverlay from "./FingerprintOverlay";
import ScrollMessageOverlay from "./ScrollMessageOverlay";
import ForceMessageOverlay from "./ForceMessageOverlay";
import { createSseConnection } from "../services/api";
import { getDeviceIdentifier } from "../utils/fingerprint";
import TopOverlay from "./TopOverlay";
import SelectionOverlay from "./SelectionOverlay";
import "./SelectionOverlay.css";
import * as Favorites from "../utils/favorites";

// Lightweight logger so all diagnostics can be filtered by "PlayerLog" in the console
const PlayerLog = {
  info: (...args) => {
    try {
      // eslint-disable-next-line no-console
      console.log("[PlayerLog]", ...args);
    } catch {}
  },
  warn: (...args) => {
    try {
      // eslint-disable-next-line no-console
      console.warn("[PlayerLog]", ...args);
    } catch {}
  },
  error: (...args) => {
    try {
      // eslint-disable-next-line no-console
      console.error("[PlayerLog]", ...args);
    } catch {}
  },
};

const ShakaPlayer = ({
  videoUrl,
  onClose,
  channelTitle,
  channelNumber,
  channelLogo,
  // EPG
  programmes = [],
  bgGradient = null,
  nextProgram,
  currentProgram,
  autoPlay = true,
  className = "",
  embedded = false,
  isFree = true,
  currentProgramTime = "12:30 PM - 01:00 PM",
  timeRemaining = "23m left",
  progressPercentage = 25,
  volume = 80,
  onVolumeChange,
  onFavorite,
  onInfo,
  onRecord,
  onOptions,
  options = [
    { id: "favorite", icon: "heart", label: "Favorite", action: onFavorite },
    { id: "info", icon: "info", label: "Info", action: onInfo },
    { id: "record", icon: "circle", label: "Record", action: onRecord }
  ],
  showVolumeControl = true,
  showOptionsLabel = true,
  programStartTime = null,
  programEndTime = null,
  programDuration = 30,
  // Channel navigation props
  onChannelChange = null,  // Callback for channel changes
  currentChannelIndex = 0, // Current channel index
  totalChannels = 0,       // Total number of channels
  channelList = [],        // Full channel list for numeric search
  muted = false,
  errorIcon = null,
  // DRM config: { keySystem: 'com.widevine.alpha', licenseUrl, headers, withCredentials }
  drm = null,
  channelId = null,
  // When true, do not initialize/load media; keep overlays and DPAD active
  controlsOnly = false,
}) => {
  const videoRef = useRef();
  const shakaPlayerRef = useRef(null);
  const loadStartTsRef = useRef(0);
  const drmFiltersInstalledRef = useRef(false);
  const networkFiltersInstalledRef = useRef(false);
  const manifestBaseRef = useRef(null);
  // Ensure manifest fallback logic only runs once per player lifetime
  const triedManifestFallbackRef = useRef(false);
  const [showErrorDialog, setShowErrorDialog] = useState(false);

  // Map known error codes to a user-facing title, code and message
  const mapErrorDetails = (code, rawMessage) => {
    const c = Number(code);
    switch (c) {
      case 6012:
        return { title: "License error", code: 601, message: "We're unable to play the video." };
      case 614:
        return { title: "Stream Error", code: 614, message: "Streaming failed due to hardware/network limitations." };
      case 1002:
        return { title: "Bad request", code: 1002, message: rawMessage || "The request was invalid." };
      default:
        return { title: "Unknown error", code: code ?? "UNKNOWN", message: rawMessage || "An unknown error occurred" };
    }
  };

  const logShakaError = (err, context = "") => {
    const e = err?.detail || err;
    try {
      // Try to resolve human‑readable category/severity names from Shaka enums
      let categoryName = e?.category;
      let severityName = e?.severity;
      try {
        if (shaka.util && shaka.util.Error) {
          const catEnum = shaka.util.Error.Category || {};
          const sevEnum = shaka.util.Error.Severity || {};
          const catKey = Object.keys(catEnum).find((k) => catEnum[k] === e?.category);
          const sevKey = Object.keys(sevEnum).find((k) => sevEnum[k] === e?.severity);
          if (catKey) categoryName = catKey;
          if (sevKey) severityName = sevKey;
        }
      } catch {}

      // Rough classification so we can quickly see if it looks like network / DRM / content
      let origin = "unknown";
      const cat = String(categoryName || "").toUpperCase();
      if (cat.includes("NETWORK")) origin = "network";
      else if (cat.includes("DRM")) origin = "drm";
      else if (cat.includes("MANIFEST") || cat.includes("STREAMING")) origin = "content";

      const payload = {
        context,
        origin, // high‑level classifier: 'network' | 'drm' | 'content' | 'unknown'
        message: e?.message,
        code: e?.code,
        category: e?.category,
        categoryName,
        severity: e?.severity,
        severityName,
        data: e?.data,
      };
      PlayerLog.error("ShakaError", payload);
    } catch {
      PlayerLog.error("ShakaErrorRaw", err);
    }
  };

  const openErrorDialog = () => {
    PlayerLog.info("ErrorDialog.open", { error });
    setShowErrorDialog(true);
  };
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState("Initializing player...");
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 3; // Maximum retry attempts
  const RETRY_DELAY = 5500; // 5.5 seconds delay before retry
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [currentVolume, setCurrentVolume] = useState(volume);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [dynamicProgress, setDynamicProgress] = useState(progressPercentage);
  const [dynamicTimeRemaining, setDynamicTimeRemaining] = useState(timeRemaining);
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [topOverlayVisible, setTopOverlayVisible] = useState(false);
  const [topFocusToken, setTopFocusToken] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [overlayTimerId, setOverlayTimerId] = useState(null);
  const [lastTopOverlayIndex, setLastTopOverlayIndex] = useState(0); // 0=fav,1=audio
  const [currentChannelId, setCurrentChannelId] = useState(channelId || null);
  // Embedded (preview) overlays
  const [embeddedFingerprints, setEmbeddedFingerprints] = useState([]);
  const [embeddedScrollRules, setEmbeddedScrollRules] = useState([]);
  const [embeddedForceRules, setEmbeddedForceRules] = useState([]);
  // Track selection state
  const [audioOptions, setAudioOptions] = useState([]); // ['en','hi']
  const [textOptions, setTextOptions] = useState([]);  // ['en','Off']
  const [qualityOptions, setQualityOptions] = useState([]); // ['1080p','720p']
  const [selectedAudio, setSelectedAudio] = useState(null);
  const [selectedText, setSelectedText] = useState(null);
  const [selectedQuality, setSelectedQuality] = useState(null);
  const [showAudioSel, setShowAudioSel] = useState(false);
  const [showTextSel, setShowTextSel] = useState(false);
  const [showQualitySel, setShowQualitySel] = useState(false);
  // Numeric channel search (Kotlin-like)
  const [typedDigits, setTypedDigits] = useState("");
  const digitTimerRef = useRef(null);
  const lastDigitsRef = useRef("");
  const DEBOUNCE_MS = 2000;
  const lastPlaybackLogRef = useRef(0);

  // Determine proxy origin for LG/webOS where window.origin may be app:// (not usable for proxy)
  const getProxyOrigin = () => {
    try {
      const envOrigin = (typeof process !== 'undefined' && process.env && process.env.VITE_PROXY_ORIGIN) ? process.env.VITE_PROXY_ORIGIN : null;
      let storedOrigin = null;
      try { storedOrigin = typeof localStorage !== 'undefined' ? localStorage.getItem('PROXY_ORIGIN') : null; } catch {}
      const httpOrigin = (typeof window !== 'undefined' && window.location ? window.location.origin : null);
      // prefer stored/env; if absent and running under http(s), use window origin; otherwise fail closed
      if (storedOrigin && /^https?:\/\//i.test(storedOrigin)) return storedOrigin.replace(/\/$/, '');
      if (envOrigin && /^https?:\/\//i.test(envOrigin)) return envOrigin.replace(/\/$/, '');
      if (httpOrigin && /^https?:\/\//i.test(httpOrigin)) return httpOrigin.replace(/\/$/, '');
      return '';
    } catch {
      return '';
    }
  };

  // Map known DRM license hosts to local proxy paths to avoid TLS verification at client
  const mapLicenseUrlToProxy = (url) => {
    try {
      if (!url || typeof url !== 'string') return url;
      return url;
    } catch {
      return url;
    }
  };

  // General media proxy (manifest/segments) via same-origin to avoid upstream TLS issues
  const mapMediaUrlToProxy = (url) => {
    try {
      if (!url || typeof url !== 'string') return url;
      return url;
    } catch {
      return url;
    }
  };
  

  // Debug channel navigation props
  useEffect(() => {
    PlayerLog.info("Props", {
      embedded,
      onChannelChange: !!onChannelChange,
      currentChannelIndex,
      totalChannels
    });
  }, [embedded, onChannelChange, currentChannelIndex, totalChannels]);


  


  // Volume handler
  const handleVolumeChange = (newVolume) => {
    setCurrentVolume(newVolume);
    if (onVolumeChange) onVolumeChange(newVolume);
  };

  const handleOptionClick = (option) => {
    if (option.action) option.action();
  };

  // Program progress calc
  const calculateProgramProgress = () => {
    if (!programStartTime || !programEndTime) {
      return { progress: progressPercentage, timeRemaining: timeRemaining };
    }
    const now = new Date();
    const start = new Date(programStartTime);
    const end = new Date(programEndTime);

    if (now < start) {
      return { progress: 0, timeRemaining: `${Math.ceil((start - now) / 60000)}m until start` };
    } else if (now > end) {
      return { progress: 100, timeRemaining: "Program ended" };
    } else {
      const totalDuration = end - start;
      const elapsed = now - start;
      const progress = Math.round((elapsed / totalDuration) * 100);
      const remaining = Math.ceil((end - now) / 60000);
      return { progress: Math.min(progress, 100), timeRemaining: `${remaining}m left` };
    }
  };

  useEffect(() => {
    // show overlay initially
    setOverlayVisible(true);
    if (overlayTimerId) clearTimeout(overlayTimerId);
    const id = setTimeout(() => setOverlayVisible(false), 10000);
    setOverlayTimerId(id);
    return () => { if (id) clearTimeout(id); };
  }, []);

  // favorites: update when prop changes
  useEffect(() => {
    setCurrentChannelId(channelId || null);
    try { setIsFavorite(channelId ? Favorites.has(channelId) : false); } catch {}
  }, [channelId]);

  // favorites: subscribe to external changes
  useEffect(() => {
    const unsub = Favorites.subscribe(() => {
      try { setIsFavorite(currentChannelId ? Favorites.has(currentChannelId) : false); } catch {}
    });
    return () => { try { unsub && unsub(); } catch {} };
  }, [currentChannelId]);

  // Hint the browser to prefetch media data
  useEffect(() => {
    try {
      if (videoRef.current) {
        videoRef.current.preload = 'auto';
        videoRef.current.autoplay = autoPlay;
        videoRef.current.playsInline = true;
      }
    } catch {}
  }, [autoPlay]);

  // keep video element muted per prop
  useEffect(() => {
    try {
      if (videoRef.current) {
        videoRef.current.muted = muted;
      }
    } catch {}
  }, [videoRef, muted]);

  // Detailed video element event logging to understand "stuck" playback
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    const describeBuffered = () => {
      try {
        const out = [];
        for (let i = 0; i < videoEl.buffered.length; i += 1) {
          out.push({
            start: videoEl.buffered.start(i),
            end: videoEl.buffered.end(i),
          });
        }
        return out;
      } catch {
        return [];
      }
    };

    const logState = (event, extra = {}) => {
      PlayerLog.info("VideoEvent", {
        event,
        currentTime: videoEl.currentTime,
        readyState: videoEl.readyState, // 0–4, how much is buffered
        networkState: videoEl.networkState, // 0–3, network status
        paused: videoEl.paused,
        ended: videoEl.ended,
        buffered: describeBuffered(),
        ...extra,
      });
    };

    const handleWaiting = () => logState("waiting");
    const handleStalled = () => logState("stalled");
    const handlePlaying = () => logState("playing");
    const handleCanPlay = () => logState("canplay");
    const handleSeeked = () => logState("seeked");
    const handleSeeking = () => logState("seeking");
    const handleEnded = () => logState("ended");
    const handlePause = () => logState("pause");
    const handleLoadedMeta = () => logState("loadedmetadata");
    const handleError = () => {
      const mediaError = videoEl.error;
      PlayerLog.error("VideoError", {
        code: mediaError?.code,
        message: mediaError?.message,
      });
      logState("error");
    };
    const handleTimeUpdate = () => {
      const now = Date.now();
      if (now - lastPlaybackLogRef.current > 5000) {
        lastPlaybackLogRef.current = now;
        logState("timeupdate");
      }
    };

    videoEl.addEventListener("waiting", handleWaiting);
    videoEl.addEventListener("stalled", handleStalled);
    videoEl.addEventListener("playing", handlePlaying);
    videoEl.addEventListener("canplay", handleCanPlay);
    videoEl.addEventListener("seeked", handleSeeked);
    videoEl.addEventListener("seeking", handleSeeking);
    videoEl.addEventListener("ended", handleEnded);
    videoEl.addEventListener("pause", handlePause);
    videoEl.addEventListener("loadedmetadata", handleLoadedMeta);
    videoEl.addEventListener("error", handleError);
    videoEl.addEventListener("timeupdate", handleTimeUpdate);

    return () => {
      videoEl.removeEventListener("waiting", handleWaiting);
      videoEl.removeEventListener("stalled", handleStalled);
      videoEl.removeEventListener("playing", handlePlaying);
      videoEl.removeEventListener("canplay", handleCanPlay);
      videoEl.removeEventListener("seeked", handleSeeked);
      videoEl.removeEventListener("seeking", handleSeeking);
      videoEl.removeEventListener("ended", handleEnded);
      videoEl.removeEventListener("pause", handlePause);
      videoEl.removeEventListener("loadedmetadata", handleLoadedMeta);
      videoEl.removeEventListener("error", handleError);
      videoEl.removeEventListener("timeupdate", handleTimeUpdate);
    };
  }, []);

  // Pause playback when app loses visibility (e.g., TV screen lock, screensaver)
  // and optionally resume when it becomes visible again.
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    const handleVisibilityChange = () => {
      try {
        if (document.visibilityState === 'hidden') {
          // Stop preview / main playback while not visible
          videoEl.pause();
        } else if (document.visibilityState === 'visible') {
          // Resume only if autoPlay is enabled and media was previously playing
          if (autoPlay && videoEl.paused) {
            videoEl.play().catch(() => {});
          }
        }
      } catch {}
    };

    const handleWindowBlur = () => {
      try { videoEl.pause(); } catch {}
    };

    const handleWindowFocus = () => {
      try {
        if (autoPlay && videoEl.paused && document.visibilityState === 'visible') {
          videoEl.play().catch(() => {});
        }
      } catch {}
    };

    try {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('blur', handleWindowBlur);
      window.addEventListener('focus', handleWindowFocus);
    } catch {}

    return () => {
      try {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('blur', handleWindowBlur);
        window.removeEventListener('focus', handleWindowFocus);
      } catch {}
    };
  }, [autoPlay]);

  const showOverlay = () => {
    setOverlayVisible(true);
    setTopOverlayVisible(false); // bottom and top overlays are mutually exclusive
    if (overlayTimerId) clearTimeout(overlayTimerId);
    const id = setTimeout(() => setOverlayVisible(false), 10000);
    setOverlayTimerId(id);
  };

  const toggleTopOverlay = () => {
    // Top overlay should only appear when bottom overlay is NOT visible
    if (!overlayVisible) {
      setTopOverlayVisible((v) => !v);
    }
  };

  // Auto-hide the top overlay after 5 seconds whenever it becomes visible
  useEffect(() => {
    if (!topOverlayVisible) return;
    const id = setTimeout(() => {
      setTopOverlayVisible(false);
    }, 5000);
    return () => {
      clearTimeout(id);
    };
  }, [topOverlayVisible]);

  useEffect(() => {
    const { progress, timeRemaining } = calculateProgramProgress();
    setDynamicProgress(progress);
    setDynamicTimeRemaining(timeRemaining);

    const timer = setInterval(() => {
      setCurrentTime(new Date());
      const { progress, timeRemaining } = calculateProgramProgress();
      setDynamicProgress(progress);
      setDynamicTimeRemaining(timeRemaining);
    }, 60000);

    return () => clearInterval(timer);
  }, [programStartTime, programEndTime, progressPercentage, timeRemaining]);



  // --- Kotlin-like numeric channel search: commit digits -> channel by channelNo ---
  const commitChannelSearch = useCallback((numberStr) => {
    if (!numberStr) return;
    if (!onChannelChange || !Array.isArray(channelList) || channelList.length === 0) {
      return;
    }

    const num = parseInt(numberStr, 10);
    if (!Number.isFinite(num)) return;

    const targetIndex = channelList.findIndex((ch) => {
      if (!ch) return false;
      const rawNo =
        ch?.content?.channelNo ??
        ch?.content?.channelNumber ??
        ch?.channelNo ??
        ch?.channelNumber;
      if (rawNo == null) return false;
      return String(rawNo) === String(num);
    });

    if (targetIndex >= 0) {
      onChannelChange(targetIndex);
      return;
    }

    // No matching channel – show toast in player (no icon)
    toast.error(`The channel ${num} is not available`, { icon: null });
  }, [channelList, onChannelChange]);

  // Clear numeric search timer on unmount
  useEffect(() => {
    return () => {
      if (digitTimerRef.current) {
        clearTimeout(digitTimerRef.current);
        digitTimerRef.current = null;
      }
    };
  }, []);

  // Initialize Shaka once; on URL change just call load with fast-start config
  useEffect(() => {
    if (controlsOnly) {
      // Skip player initialization and media load in controls-only mode
      setError(null);
      setIsLoading(false);
      setIsVideoLoaded(false);
      // Ensure any previously playing content is stopped
      try {
        const p = shakaPlayerRef.current;
        if (p && typeof p.unload === 'function') {
          p.unload().catch(() => {});
        }
      } catch {}
      try {
        if (videoRef.current) {
          videoRef.current.pause();
          // Clear the media source so the last channel does not continue showing
          videoRef.current.removeAttribute('src');
          // Reload to reset the element state
          videoRef.current.load();
        }
      } catch {}
      return;
    }
    setError(null);
    setIsLoading(true);
    setRetryCount(0); // Reset retry count when video URL changes
    setIsVideoLoaded(false);

    shaka.polyfill.installAll();

    if (!shaka.Player.isBrowserSupported()) {
      setError({ message: "Browser not supported" });
      setIsLoading(false);
      return;
    }

    // Create player instance once (attach to media element instead of ctor arg per Shaka v4.15 deprecation)
    if (!shakaPlayerRef.current) {
      const player = new shaka.Player();
      shakaPlayerRef.current = player;
      try {
        if (videoRef.current) {
          // Attach media element before any load/config
          player.attach(videoRef.current).catch((e) => logShakaError(e, 'player.attach'));
        }
      } catch (e) {
        logShakaError(e, 'player.attach');
      }

      player.addEventListener("error", (e) => {
        logShakaError(e, "player.event");
        
        const errorDetail = e.detail;
        if (errorDetail) {
          setError({
            ...errorDetail,
            message: errorDetail.message || "Unknown error occurred",
            code: errorDetail.code || "UNKNOWN",
            category: errorDetail.category || "UNKNOWN",
            severity: errorDetail.severity || "UNKNOWN"
          });
        } else {
          setError({
            message: "Unknown error occurred",
            code: "UNKNOWN",
            category: "UNKNOWN",
            severity: "UNKNOWN"
          });
        }
        
        // Don't show error dialog immediately - let retry logic handle it
        // Error dialog will show after max retries are exhausted
        setIsLoading(false);
      });

      player.addEventListener("loading", () => {
        PlayerLog.info("ShakaEvent.loading");
        setIsLoading(true);
        setError(null);
        setLoadingMessage("Loading video stream...");
      });

      player.addEventListener("loaded", () => {
        PlayerLog.info("ShakaEvent.loaded");
        setIsLoading(false);
        setError(null);
        setIsVideoLoaded(true);
      });

      player.addEventListener("buffering", (evt) => {
        try {
          const stats = player.getStats ? player.getStats() : null;
          PlayerLog.info("ShakaEvent.buffering", {
            buffering: evt.buffering,
            reason: evt.reason,
            stats: stats
              ? {
                  width: stats.width,
                  height: stats.height,
                  estimatedBandwidth: stats.estimatedBandwidth,
                  playTime: stats.playTime,
                  bufferingTime: stats.bufferingTime,
                  state: stats.state,
                }
              : null,
          });
        } catch {}
      });
    }

    // Streaming configuration – tuned for stability over low-latency to avoid frequent rebuffering
    try {
      shakaPlayerRef.current.configure({
        streaming: {
          // Disable ultra low-latency; keep a safer live buffer to avoid stalls
          lowLatencyMode: false,
          // Target ~8–10s of buffer so short network jitter does not stall playback
          bufferingGoal: 10,
          // Require ~3s of data before resuming after a stall
          rebufferingGoal: 3,
          stallEnabled: true,
          startAtSegmentBoundary: true,
          // Keep more history so catch-up/seek around the live edge is smoother
          bufferBehind: 30,
        },
        abr: {
          // Start from a more conservative bandwidth estimate so initial quality is not too high
          defaultBandwidthEstimate: 3_000_000,
          // Give ABR a bit more time between quality switches
          switchInterval: 3.0,
        },
        manifest: {
          dash: { ignoreMinBufferTime: true },
        },
      });
    } catch {}

    // DRM configuration (must be set before load)
    try {
      if (drm && drm.keySystem && drm.licenseUrl) {
        shakaPlayerRef.current.configure({
          drm: {
            servers: { [drm.keySystem]: drm.licenseUrl },
            advanced: {
              'com.widevine.alpha': {
                videoRobustness: ['SW_SECURE_DECODE'],
                audioRobustness: ['SW_SECURE_CRYPTO'],
              },
            },
          },
        });

        const net = shakaPlayerRef.current.getNetworkingEngine?.();
        if (net && !drmFiltersInstalledRef.current) {
          try {
            net.registerRequestFilter((type, request) => {
              if (type === shaka.net.NetworkingEngine.RequestType.LICENSE) {
                try {
                  // Debug visibility
                  PlayerLog.info("DRM.request", {
                    uris: request.uris,
                    headers: request.headers,
                    withCreds: request.allowCrossSiteCredentials,
                    bodyBytes: request.body?.byteLength ?? 0,
                  });
                  if (drm.headers && typeof drm.headers === 'object') {
                    request.headers = { ...(request.headers || {}), ...drm.headers };
                  }
                  if (typeof drm.withCredentials === 'boolean') {
                    request.allowCrossSiteCredentials = !!drm.withCredentials;
                  }
                } catch {}
              } else {
                try {
                  const kind = Object.keys(shaka.net.NetworkingEngine.RequestType).find(k => shaka.net.NetworkingEngine.RequestType[k] === type) || type;
                  PlayerLog.info("NET.request", { type: kind, uris: request.uris });
                } catch {}
              }
            });
            net.registerResponseFilter((type, response) => {
              try {
                const kind = Object.keys(shaka.net.NetworkingEngine.RequestType).find(k => shaka.net.NetworkingEngine.RequestType[k] === type) || type;
                PlayerLog.info(
                  type === shaka.net.NetworkingEngine.RequestType.LICENSE ? "DRM.response" : "NET.response",
                  {
                  type: kind,
                  uri: response.uri,
                  status: response.status,
                  headers: response.headers,
                  bodyBytes: response.data?.byteLength ?? 0,
                  }
                );
                if (type === shaka.net.NetworkingEngine.RequestType.MANIFEST && response.data) {
                  try {
                    const head = new TextDecoder().decode(response.data.slice(0, 256));
                    const firstTwo = head.split(/\r?\n/).slice(0, 2).join('\n');
                    PlayerLog.info("MANIFEST.head", { uri: response.uri, head: firstTwo });
                    const trimmed = head.replace(/^\uFEFF/, '').trimStart();
                    const ct = String(response.headers?.['content-type'] || response.headers?.['Content-Type'] || '');
                    const isHls = trimmed.startsWith('#EXTM3U');
                    const isMpd = trimmed.startsWith('<MPD') || /application\/dash\+xml/i.test(ct);
                    if (!isHls && !triedManifestFallbackRef.current) {
                      triedManifestFallbackRef.current = true;
                      const p = shakaPlayerRef.current;
                      const wasProxied = /\/media-proxy\//.test(response.uri || '');
                      const original = String(videoUrl || '');
                      if (isMpd && original) {
                        p.load(original, null, 'application/dash+xml')
                          .then(() => PlayerLog.info("FALLBACK.dashReload.ok"))
                          .catch((e) => PlayerLog.error("FALLBACK.dashReload.failed", e));
                      } else if (wasProxied && original) {
                        p.load(original, null, 'application/x-mpegurl')
                          .then(() => PlayerLog.info("FALLBACK.directReload.ok"))
                          .catch((e) => PlayerLog.error("FALLBACK.directReload.failed", e));
                      }
                    }
                  } catch {}
                }
              } catch {}
            });
            drmFiltersInstalledRef.current = true;
            PlayerLog.info("DRM.filtersInstalled");
          } catch {}
        }
      }
    } catch {}

    // Install lightweight logging filters only (no URL rewriting)
    try {
      const net = shakaPlayerRef.current.getNetworkingEngine?.();
      if (net && !networkFiltersInstalledRef.current) {
        net.registerRequestFilter((type, request) => {
          try {
            const kind = Object.keys(shaka.net.NetworkingEngine.RequestType).find(k => shaka.net.NetworkingEngine.RequestType[k] === type) || type;
            PlayerLog.info("NET.request", { type: kind, uris: request.uris });
          } catch {}
        });
        net.registerResponseFilter((type, response) => {
          try {
            const kind = Object.keys(shaka.net.NetworkingEngine.RequestType).find(k => shaka.net.NetworkingEngine.RequestType[k] === type) || type;
            PlayerLog.info("NET.response", {
              type: kind,
              uri: response.uri,
              status: response.status,
              headers: response.headers,
            });
            if (type === shaka.net.NetworkingEngine.RequestType.MANIFEST && response.data) {
              try {
                const head = new TextDecoder().decode(response.data.slice(0, 160));
                PlayerLog.info("MANIFEST.head", { uri: response.uri, head: head.split('\n')[0] });
              } catch {}
            }
          } catch {}
        });
        networkFiltersInstalledRef.current = true;
      }
    } catch {}

    setLoadingMessage("Connecting to stream...");
    loadStartTsRef.current = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    try {
      PlayerLog.info("ShakaLoad.start", { videoUrl });
    } catch {}
    shakaPlayerRef.current
      .load(videoUrl)
      .then(() => {
        setError(null);
        setIsLoading(false);
        setIsVideoLoaded(true);
        try {
          const end = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
          PlayerLog.info("ShakaLoad.loaded", {
            videoUrl,
            loadMs: Math.round(end - loadStartTsRef.current),
          });
          // Populate track options once manifest is loaded
          try {
            const p = shakaPlayerRef.current;
            const vTracks = (p.getVariantTracks?.() || []);
            const tTracks = (p.getTextTracks?.() || []);
            const langs = Array.from(new Set(vTracks.map(t => t.language).filter(Boolean)));
            const texts = Array.from(new Set(tTracks.map(t => t.language).filter(Boolean)));
            const qualities = Array.from(new Set(vTracks.filter(t => t.height).map(t => `${t.height}p`))).sort((a,b)=>parseInt(b)-parseInt(a));
            setAudioOptions(langs);
            setTextOptions(texts.length > 0 ? [...texts, 'Off'] : []);
            setQualityOptions(qualities);
            const activeV = vTracks.find(t => t.active);
            const activeT = tTracks.find(t => t.active);
            setSelectedAudio(activeV?.language || null);
            setSelectedQuality(activeV?.height ? `${activeV.height}p` : null);
            const textVisible = p.isTextTrackVisible?.();
            setSelectedText(textVisible ? (activeT?.language || null) : 'Off');
          } catch {}
        } catch {}
      })
      .catch((err) => {
        logShakaError(err, "player.load.catch");
        
        if (err) {
          setError({
            ...err,
            message: err.message || "Unknown error occurred",
            code: err.code || "UNKNOWN",
            category: err.category || "UNKNOWN",
            severity: err.severity || "UNKNOWN"
          });
        } else {
          setError({
            message: "Unknown error occurred",
            code: "UNKNOWN",
            category: "UNKNOWN",
            severity: "UNKNOWN"
          });
        }
        
        // Don't show error dialog immediately - let retry logic handle it
        // Error dialog will show after max retries are exhausted
        setIsLoading(false);
      });

    // Cleanup on unmount only
    return () => {};
  }, [videoUrl, controlsOnly]);

  // Auto-retry on error after 5-6 seconds
  useEffect(() => {
    if (!error || !videoUrl || !shakaPlayerRef.current) return;
    
    // Don't retry if we've exceeded max retries
    if (retryCount >= MAX_RETRIES) {
      PlayerLog.warn("ShakaRetry.maxReached", { retryCount, MAX_RETRIES });
      return;
    }

    const retryTimer = setTimeout(() => {
      PlayerLog.info("ShakaRetry.attempt", {
        attempt: retryCount + 1,
        max: MAX_RETRIES,
        videoUrl,
      });
      
      // Clear error state before retry
      setError(null);
      setIsLoading(true);
      setLoadingMessage("Retrying connection...");
      
      // Retry loading the video
      const player = shakaPlayerRef.current;
      if (player && videoUrl) {
        player
          .load(videoUrl)
          .then(() => {
            PlayerLog.info("ShakaRetry.success");
            setError(null);
            setIsLoading(false);
            setIsVideoLoaded(true);
            setRetryCount(0); // Reset retry count on success
          })
          .catch((err) => {
            PlayerLog.error("ShakaRetry.failed", err);
            logShakaError(err, "player.retry.catch");
            
            // Increment retry count
            setRetryCount(prev => prev + 1);
            
            // Set error again (will trigger another retry if under max)
            if (err) {
              setError({
                ...err,
                message: err.message || "Retry failed",
                code: err.code || "UNKNOWN",
                category: err.category || "UNKNOWN",
                severity: err.severity || "UNKNOWN"
              });
            } else {
              setError({
                message: "Retry failed",
                code: "UNKNOWN",
                category: "UNKNOWN",
                severity: "UNKNOWN"
              });
            }
            
            setIsLoading(false);
            // Don't open error dialog on retry - let it retry again if under max
            if (retryCount + 1 >= MAX_RETRIES) {
              openErrorDialog(); // Only show dialog after max retries
            }
          });
      }
    }, RETRY_DELAY);

    return () => clearTimeout(retryTimer);
  }, [error, videoUrl, retryCount]);

  // Embedded preview: player-scoped SSE for overlays (fingerprint only for preview)
  useEffect(() => {
    if (!embedded) return;
    let sse = null;
    (async () => {
      try {
        const userRaw = sessionStorage.getItem('user') || localStorage.getItem('user');
        let region = '1';
        
        try { 
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
        
        const liveChannel = (channelNumber && channelTitle) ? `${channelNumber}:${channelTitle}` : (currentChannelId || channelId || channelTitle || '');
        sse = createSseConnection('/app/combined-sse', {
          query: {
            region: region,
            appVersion: 'caastv_1.0.26',
            macId: mac,
            ...(liveChannel ? { liveChannel: liveChannel } : {})
          },
          onMessage: (payload) => {
            try {
              if (!payload || typeof payload !== 'object') return;
              const currentId = String(liveChannel || '').trim();
              const extractTargets = (rule) => {
                try {
                  const single = rule?.channelId || rule?.ChannelID || rule?.channel || rule?.liveChannel || rule?.LiveChannel;
                  const list = rule?.channelIds || rule?.channels || rule?.liveChannels || rule?.channelIdList || rule?.liveChannelIds || rule?.channelList;
                  const fromSingle = single ? [String(single)] : [];
                  let fromList = [];
                  if (Array.isArray(list)) fromList = list.map(String);
                  else if (typeof list === 'string') fromList = list.split(/[;,\s]+/).map(v=>v.trim()).filter(Boolean);
                  return Array.from(new Set([...fromSingle, ...fromList]));
                } catch { return []; }
              };
              const matchesChannel = (rule) => {
                try {
                  const scope = (rule?.scope || rule?.targetScope || rule?.fingerprintScope || '').toString().toLowerCase();
                  // Preview requirement: only show when scope is strictly 'player' AND targeted to the current channel
                  if (scope !== 'player') return false;
                  const targets = extractTargets(rule).map(t=>String(t||'').trim());
                  if (targets.length > 0) {
                    return targets.some((t)=>{
                      if (t === currentId) return true;
                      const i = t.indexOf(':');
                      if (i>0) { const idPart = t.slice(0,i).trim(); if (idPart && (currentId===idPart || currentId.startsWith(idPart+':'))) return true; }
                      return false;
                    });
                  }
                  // No explicit targeting → do not show in preview
                  return false;
                } catch { return false; }
              };

              if (Array.isArray(payload.fingerprints)) {
                const fps = payload.fingerprints.filter(fp => fp && fp.enabled !== false && fp.enabled !== 0 && matchesChannel(fp));
                setEmbeddedFingerprints(fps);
              }
              if (Array.isArray(payload.scrollMessages)) {
                const sms = payload.scrollMessages.map(sm=>({
                  ...sm,
                  enabled: sm?.enabled ?? sm?.e ?? true,
                  message: (sm?.message ?? sm?.m ?? '').toString(),
                })).filter(sm=> sm && sm.enabled && sm.message.trim() && matchesChannel(sm));
                // Do not render scroll messages in preview; ignore
              }
              if (Array.isArray(payload.forceMessages)) {
                const fms = payload.forceMessages.map(fm=>({
                  ...fm,
                  enabled: fm?.enabled ?? fm?.e ?? true,
                  message: fm?.message ?? fm?.m,
                  messageTitle: fm?.messageTitle ?? fm?.t ?? fm?.title,
                })).filter(fm=> fm && fm.enabled && (String(fm.messageTitle || fm.message || '').trim()) && matchesChannel(fm));
                // Do not render force messages in preview; ignore
              }
            } catch {}
          },
          onError: () => {},
        });
      } catch {}
    })();
    return () => { try { sse && sse.close && sse.close(); } catch {} };
  }, [embedded, channelNumber, channelTitle, channelId, currentChannelId]);

  useEffect(() => {
    return () => {
      try { shakaPlayerRef.current && shakaPlayerRef.current.destroy(); } catch {}
      shakaPlayerRef.current = null;
    };
  }, []);

  const handleClose = () => {
    if (onClose) onClose();
  };

  const handleRetry = () => {
    setError(null);
    setIsLoading(true);
    setRetryCount((prev) => prev + 1);
    setIsVideoLoaded(false);
    setShowErrorDialog(false);
  };

  // Apply selections using Shaka APIs
  const applyAudioLang = (lang) => {
    try {
      const p = shakaPlayerRef.current;
      if (!p) return;
      if (lang) {
        p.selectAudioLanguage(lang);
        setSelectedAudio(lang);
      }
    } catch {}
  };

  const applyTextLang = (lang) => {
    try {
      const p = shakaPlayerRef.current;
      if (!p) return;
      if (!lang || lang === 'Off') {
        p.setTextTrackVisibility(false);
        setSelectedText('Off');
      } else {
        p.setTextTrackVisibility(true);
        p.selectTextLanguage(lang);
        setSelectedText(lang);
      }
    } catch {}
  };

  const applyQuality = (label) => {
    try {
      const p = shakaPlayerRef.current;
      if (!p) return;
      if (!label) {
        p.configure({ abr: { enabled: true } });
        setSelectedQuality(null);
        return;
      }
      const height = parseInt(String(label).replace(/[^0-9]/g, ''), 10);
      if (!Number.isFinite(height)) return;
      const vTracks = (p.getVariantTracks?.() || []);
      // Prefer exact height; fallback to closest lower height
      let cand = vTracks.find(t => t.height === height) || vTracks
        .filter(t => t.height && t.height <= height)
        .sort((a,b)=> (b.height||0)-(a.height||0))[0];
      if (cand) {
        p.configure({ abr: { enabled: false } });
        p.selectVariantTrack(cand, /* clearBuffer= */ true, /* safeMargin= */ 0);
        setSelectedQuality(`${cand.height}p`);
      }
    } catch {}
  };

  // Handle a logical "BACK" coming from outside (e.g., history pop / hardware back)
  // without immediately exiting the player.
  useEffect(() => {
    const handleSoftBack = () => {
      // 1) If any selection overlay is open, close it and return focus to top overlay
      if (showAudioSel || showTextSel || showQualitySel) {
        if (showAudioSel) setShowAudioSel(false);
        if (showTextSel) setShowTextSel(false);
        if (showQualitySel) setShowQualitySel(false);
        setOverlayVisible(false);
        setTopOverlayVisible(true);
        setTopFocusToken((t) => t + 1);
        return;
      }
      // 2) If only top overlay is open, just hide it
      if (topOverlayVisible) {
        setTopOverlayVisible(false);
      }
      // 3) If neither is open, let the page-level handler decide whether to exit
    };

    document.addEventListener('player-soft-back', handleSoftBack);
    return () => {
      document.removeEventListener('player-soft-back', handleSoftBack);
    };
  }, [showAudioSel, showTextSel, showQualitySel, topOverlayVisible]);

  // === DPAD Key Handling for Channel Navigation ===
  useEffect(() => {
    const handleDpadNavigation = (e) => {
      try {
        PlayerLog.info("KeyDown", {
          key: e.key,
          embedded,
          totalChannels,
        });
        // If a global force-push overlay is active, block all DPAD/back handling here
        try {
          if (typeof window !== 'undefined' && window.__CAASTV_FORCE_PUSH_ACTIVE) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
        } catch {}
        // Do NOT auto-show bottom overlay for all keys; manage per key below

        // --- Numeric channel input (0–9) ---
        const isDigitKey = typeof e.key === "string" && /^[0-9]$/.test(e.key);
        if (isDigitKey) {
          e.preventDefault();
          e.stopPropagation();
  
          const digit = e.key;
          // Build up to 4 digits like "1234"
          const prev = lastDigitsRef.current || "";
          if (prev.length < 4) {
            const next = prev + digit;
            lastDigitsRef.current = next;
            setTypedDigits(next);
          }
  
          // Keep bottom overlay visible while typing
          showOverlay();
  
          // Restart debounce timer
          if (digitTimerRef.current) {
            clearTimeout(digitTimerRef.current);
          }
          digitTimerRef.current = setTimeout(() => {
            const current = lastDigitsRef.current || "";
            if (current) {
              commitChannelSearch(current);
            }
            lastDigitsRef.current = "";
            setTypedDigits("");
          }, DEBOUNCE_MS);
          return;
        }
  
        // When a selection overlay is open, it owns DPAD; only Back/Escape closes it here
        if (showAudioSel || showTextSel || showQualitySel) {
          if (
            e.key === 'Escape' ||
            e.key === 'Backspace' ||
            e.key === 'Back' ||
            e.key === 'GoBack' ||
            e.key === 'BrowserBack'
          ) {
            if (showAudioSel) setShowAudioSel(false);
            if (showTextSel) setShowTextSel(false);
            if (showQualitySel) setShowQualitySel(false);
            setOverlayVisible(false);
            setTopOverlayVisible(true); // keep top overlay visible
            setTopFocusToken((t) => t + 1); // refocus last top icon
            e.preventDefault();
            e.stopPropagation();
          }
          return;
        }

        // When top overlay is open, let it consume left/right/enter.
        // Back/Escape (including webOS-style Back keys) should hide the top overlay only.
        if (topOverlayVisible) {
          if (
            e.key === 'Escape' ||
            e.key === 'Backspace' ||
            e.key === 'Back' ||
            e.key === 'GoBack' ||
            e.key === 'BrowserBack'
          ) {
            setTopOverlayVisible(false);
            e.preventDefault();
            e.stopPropagation();
          }
          return; // ignore other keys at player level while top overlay is active
        }

        // When no overlays are open, treat hardware BACK as "exit player" instead of history back.
        // Include common TV back mappings: LG webOS (keyCode 461), generic Back/GoBack/BrowserBack,
        // and Backspace on some remotes when used outside text fields.
        const isHardBack =
          e.key === 'Back' ||
          e.key === 'GoBack' ||
          e.key === 'BrowserBack' ||
          e.key === 'Backspace' ||
          e.keyCode === 461 ||
          e.which === 461 ||
          e.keyCode === 8 ||
          e.which === 8;
        if (!showAudioSel && !showTextSel && !showQualitySel && !topOverlayVisible && isHardBack) {
          if (typeof onClose === 'function') {
            e.preventDefault();
            e.stopPropagation();
            onClose();
            return;
          }
        }
  
        switch (e.key) {
          case "ArrowLeft":
            showOverlay();
            PlayerLog.info("ChannelNav.left");
            // Change to previous channel
            if (onChannelChange && totalChannels > 0) {
              const prevChannelIndex = currentChannelIndex > 0 ? currentChannelIndex - 1 : totalChannels - 1;
              PlayerLog.info("ChannelNav.change", {
                direction: "prev",
                from: currentChannelIndex,
                to: prevChannelIndex,
              });
              onChannelChange(prevChannelIndex);
            } else {
              console.log('Cannot change channel - missing callback or no channels');
            }
            e.preventDefault();
            break;
          case "ArrowRight":
            showOverlay();
            PlayerLog.info("ChannelNav.right");
            // Change to next channel
            if (onChannelChange && totalChannels > 0) {
              const nextChannelIndex = currentChannelIndex < totalChannels - 1 ? currentChannelIndex + 1 : 0;
              PlayerLog.info("ChannelNav.change", {
                direction: "next",
                from: currentChannelIndex,
                to: nextChannelIndex,
              });
              onChannelChange(nextChannelIndex);
            } else {
              console.log('Cannot change channel - missing callback or no channels');
            }
            e.preventDefault();
            break;
          case "ArrowUp":
            // Only show the top overlay when bottom overlay is not visible
            if (!overlayVisible) {
              toggleTopOverlay();
            }
            e.preventDefault();
            break;
          case "ArrowDown":
            // When bottom overlay is hidden, pressing down should bring it back
            if (!overlayVisible) {
              showOverlay();
            }
            e.preventDefault();
            break;
          case "Escape":
          case "Backspace":
            setTopOverlayVisible(false);
            e.preventDefault();
            break;
          case "Enter":
            showOverlay();
            e.preventDefault();
            break;
          default:
            break;
        }
      } catch (err) {
        try {
          PlayerLog.error("KeyDown.error", err);
        } catch {}
      }
    };

    // Only add event listener when overlay is visible (not embedded)
    if (!embedded) {
      PlayerLog.info("KeyDown.listener.add");
      // Use capture phase so we can intercept Back before outer handlers (e.g., exit player/router)
      document.addEventListener("keydown", handleDpadNavigation, true);
      return () => {
        PlayerLog.info("KeyDown.listener.remove");
        document.removeEventListener("keydown", handleDpadNavigation, true);
      };
    } else {
      PlayerLog.info("KeyDown.listener.skipEmbedded");
    }
  }, [
    embedded,
    onChannelChange,
    currentChannelIndex,
    totalChannels,
    overlayVisible,
    topOverlayVisible,
    showAudioSel,
    showTextSel,
    showQualitySel,
    DEBOUNCE_MS,
    commitChannelSearch,
    showOverlay,
  ]);





  // === UI Render ===
  if (embedded) {
    const mapped = error ? mapErrorDetails(error?.code, error?.message) : null;
    const errorIconSrc = error ? (errorIcon || errorIconDefault) : (errorIcon || errorIconDefault);
    return (
      <div className={`shaka-player-embedded ${className}`}>
        {isLoading && <div className="loading-overlay"></div>}
        <video ref={videoRef} className="video-player-embedded" autoPlay={autoPlay} playsInline muted={muted} />
        {/* Preview: show only player-scoped fingerprints targeted to this channel */}
        {Array.isArray(embeddedFingerprints) && embeddedFingerprints.map((fp) => (
          <FingerprintOverlay key={fp._id || fp.id || JSON.stringify(fp)} rule={fp} anchorRef={videoRef} />
        ))}
        <CommonDialog
          showDialog={!!error && showErrorDialog}
          title={mapped?.title || "Unknown error"}
          message={null}
          errorCode={mapped?.code}
          errorMessage={mapped?.message}
          iconSrc={errorIconSrc}
          isErrorAdded={true}
          borderColor="transparent"
          onDismiss={() => setShowErrorDialog(false)}
          inlineOverlay
          compact
        />
        {PlayerLog.info("Dialog.embedded", {
          hasError: !!error,
          showErrorDialog,
          showDialog: !!error && showErrorDialog,
        })}
      </div>
    );
  }

  return (
    <div className="shaka-player-overlay">
      {/* Local toast host for player messages (invalid channel, etc.) */}
      <Toaster
        position="bottom-center"
        toastOptions={{
          duration: 2000,
          style: {
            background: "#1a1a1a",
            color: "#fff",
            borderRadius: "14px",
            fontSize: "25px",
            padding: "16px 24px",
            border: "1px solid rgba(255,255,255,0.25)",
            fontWeight: 600,
            minWidth: "400px",
            textAlign: "center",
          },
        }}
      />
      <div className="shaka-player-container">
        <div className="video-container">
          <video ref={videoRef} className="video-player" autoPlay={autoPlay} playsInline muted={muted} />
          {/* Numeric channel input overlay (top-right) */}
          {typedDigits && (
            <div className="numeric-input-overlay">
              {typedDigits}
            </div>
          )}
          {!embedded && topOverlayVisible && !overlayVisible && (
            <TopOverlay
              isFavorite={isFavorite}
              onFavoriteClick={() => {
                setLastTopOverlayIndex(0);
                if (currentChannelId) {
                  Favorites.toggle(currentChannelId);
                  setIsFavorite(Favorites.has(currentChannelId));
                } else {
                  setIsFavorite((v) => !v);
                }
                if (onFavorite) onFavorite();
              }}
              onAudioClick={() => { setLastTopOverlayIndex(1); setShowAudioSel(true); }}
              desiredFocusIndex={lastTopOverlayIndex}
              focusToken={topFocusToken}
            />
          )}
        </div>

        {/* Kotlin-like footer overlay */}
        <PlayerOverlay
          visible={!embedded && overlayVisible}
          channelNumber={channelNumber}
          channelTitle={channelTitle}
          channelLogo={channelLogo}
          bgGradient={bgGradient}
          programmes={programmes}
          programmeIndex={0}
          currentProgramTitle={currentProgram}
          nextProgramTitle={nextProgram}
          currentStartTime={programStartTime}
          currentEndTime={programEndTime}
          onFavorite={() => handleOptionClick(options.find(o => o.id === 'favorite') || {})}
        />

        {onClose && (
          <button className="close-button" onClick={handleClose}>
            <FeatherIcon icon="x" size={24} />
          </button>
        )}
      </div>
      {/* Selection overlays */}
      {showAudioSel && (
        <SelectionOverlay
          title="Audio"
          options={audioOptions.length ? audioOptions : []}
          selected={selectedAudio}
          onSelect={(opt) => {
            if (audioOptions.length) applyAudioLang(opt);
            setShowAudioSel(false);
            setOverlayVisible(false);
            setTopOverlayVisible(true);
            setTopFocusToken((t) => t + 1);
          }}
          onDismiss={() => {
            setShowAudioSel(false);
            setOverlayVisible(false);
            setTopOverlayVisible(true);
            setTopFocusToken((t) => t + 1);
          }}
        />
      )}
      {showTextSel && (
        <SelectionOverlay
          title="Subtitles"
          options={textOptions.length ? textOptions : []}
          selected={selectedText}
          extraTopOption={textOptions.length ? 'Off' : null}
          onExtraTopSelect={() => { applyTextLang('Off'); setShowTextSel(false); setOverlayVisible(false); setTopOverlayVisible(true); }}
          onSelect={(opt) => { if (textOptions.length) applyTextLang(opt); setShowTextSel(false); setOverlayVisible(false); setTopOverlayVisible(true); }}
          onDismiss={() => { setShowTextSel(false); setOverlayVisible(false); setTopOverlayVisible(true); }}
        />
      )}
      {showQualitySel && (
        <SelectionOverlay
          title="Video Quality"
          options={qualityOptions.length ? qualityOptions : []}
          selected={selectedQuality}
          extraTopOption={qualityOptions.length ? 'Auto' : null}
          onExtraTopSelect={() => { applyQuality(null); setShowQualitySel(false); setOverlayVisible(false); setTopOverlayVisible(true); }}
          onSelect={(opt) => { applyQuality(opt); setShowQualitySel(false); setOverlayVisible(false); setTopOverlayVisible(true); }}
          onDismiss={() => { setShowQualitySel(false); setOverlayVisible(false); setTopOverlayVisible(true); }}
        />
      )}
      {(() => {
        const mapped = error ? mapErrorDetails(error?.code, error?.message) : null;
        const errorIconSrcMain = errorIcon || errorIconDefault;
        return (
          <CommonDialog
            showDialog={!!error && showErrorDialog}
            title={mapped?.title || "Unknown error"}
            message={null}
            errorCode={mapped?.code}
            errorMessage={mapped?.message}
            iconSrc={errorIconSrcMain}
            isErrorAdded={true}
            borderColor="transparent"
            onDismiss={() => setShowErrorDialog(false)}
          />
        );
      })()}
      {PlayerLog.info("Dialog.main", {
        hasError: !!error,
        showErrorDialog,
        showDialog: !!error && showErrorDialog,
      })}
    </div>
  );
};

export default ShakaPlayer;
