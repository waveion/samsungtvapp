import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useEpgInfinite, useManifest } from '../../services/epgManifestQueries';
import * as Favorites from '../../utils/favorites';
import './Genre.css';
import splashLogo from '../../assets/app_logo_splash.png';
import ShakaPlayer from '../../components/ShakaPlayer';
import ErrorBoundary from '../../components/ErrorBoundary';
import PreviewBanner from '../../components/PreviewBanner';
import '../login/PanmetroLoginScreen.css';
import FeatherIcon from 'feather-icons-react';
import topCorner from '../../assets/top_corner.webp';
import panmetroBrand from '../../assets/panmetro_brand.png';
import { buildCryptoGuardLicenseUrl } from '../../utils/drm';
import { getDeviceIdentifier } from '../../utils/fingerprint';
import CommonDialog from '../../components/CommonDialog';
import { isAssetPlayableViaDRM, ensureEntitlementsForUser } from '../../services/drmhelper';
import { getGradientStyle } from '../../utils/gradientUtils';

export default function Genre() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const LAST_SELECTED_GENRE_KEY = 'genre:lastSelected';
  const LAST_FOCUSED_CHANNEL_KEY = 'genre:lastFocusedChannel';
  const LAST_FOCUSED_CHANNEL_ID_KEY = 'genre:lastFocusedChannelId';
  const LAST_FOCUSED_FROM_PLAYER_FLAG_KEY = 'genre:lastFocusedFromPlayer';
  const {
    data: epgPagesData,
    isLoading: epgLoading,
    fetchNextPage: fetchNextEpgPage,
    hasNextPage: hasMoreEpgPages,
    isFetchingNextPage: epgFetchingNext,
  } = useEpgInfinite(
    { pageSize: 50 },
    {
      // Periodically refresh EPG in the background so "no channels" state can recover
      refetchInterval: 30000,
      refetchOnWindowFocus: false,
    }
  );
  // ---- Hydrate from session cache to avoid flicker ----
  const epgCache = (() => {
    // Prefer in-memory React Query cache (prefetched during splash),
    // fall back to sessionStorage if needed.
    try {
      const fromQuery = queryClient.getQueryData(['epg']);
      if (Array.isArray(fromQuery)) return fromQuery;
    } catch {}
    try {
      const raw = sessionStorage.getItem('epgCache');
      const parsed = raw ? JSON.parse(raw) : null;
      return Array.isArray(parsed?.data) ? parsed.data : [];
    } catch {
      return [];
    }
  })();

  const manifestCache = (() => {
    try {
      const fromQuery = queryClient.getQueryData(['manifest']);
      if (fromQuery) return fromQuery;
    } catch {}
    try {
      const raw = sessionStorage.getItem('manifestCache');
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed?.data || null;
    } catch {
      return null;
    }
  })();

  // Also read manifest from React Query so landing channel works even if
  // sessionStorage hydration fails (e.g., on first-ever app launch on device)
  const { data: manifest } = useManifest();

  const getInitialGenres = () => {
    const base = ['All'];
    const favIds = new Set(Favorites.getAll());
    if (favIds.size > 0) base.push('Favorites');
    const fromManifest = Array.isArray(manifestCache?.genre)
      ? manifestCache.genre.map(g => g?.name).filter(Boolean)
      : [];
    // De-duplicate while preserving base order
    const set = new Set(base);
    const out = [...base];
    fromManifest.forEach(name => { if (!set.has(name)) { set.add(name); out.push(name); } });
    return out;
  };

  const [genres, setGenres] = useState(getInitialGenres);

  const getInitialSelectedIndex = () => {
    const last = (() => { try { return sessionStorage.getItem(LAST_SELECTED_GENRE_KEY) || 'All'; } catch { return 'All'; } })();
    const idx = genres.indexOf(last);
    return idx >= 0 ? idx : 0;
  };

  const [selectedGenreIndex, setSelectedGenreIndex] = useState(getInitialSelectedIndex);

  const [epgData, setEpgData] = useState(epgCache);

  const normalizeGenreName = (value) => {
    if (value === null || value === undefined) return '';
    try {
      return String(value).trim().toLowerCase();
    } catch {
      return '';
    }
  };

  const filterByGenre = useCallback((sourceList, genreName) => {
    const list = Array.isArray(sourceList) ? sourceList : [];
    const target = normalizeGenreName(genreName);
    if (!target || target === 'all') return list;

    return list.filter((ch) => {
      const arr = ch?.content?.genre;
      if (!Array.isArray(arr) || arr.length === 0) return false;
      return arr.some((g) => normalizeGenreName(g?.name) === target);
    });
  }, []);
  const [filteredChannels, setFilteredChannels] = useState(() => {
    // Apply initial filter based on cached EPG and last selection
    const last = (() => {
      try {
        return sessionStorage.getItem(LAST_SELECTED_GENRE_KEY) || 'All';
      } catch {
        return 'All';
      }
    })();
    if (normalizeGenreName(last) === 'all') return epgCache;
    if (normalizeGenreName(last) === 'favorites') {
      const fav = new Set(Favorites.getAll());
      return epgCache.filter(
        (ch) => fav.has(ch?.content?.ChannelID || ch?.channelId)
      );
    }
    return filterByGenre(epgCache, last);
  });
  const [focusedGenreIndex, setFocusedGenreIndex] = useState(0);
  const [focusedChannelIndex, _setFocusedChannelIndex] = useState(() => {
    try {
      const fromPlayer =
        sessionStorage.getItem(LAST_FOCUSED_FROM_PLAYER_FLAG_KEY) === '1';
      if (fromPlayer) {
        const storedId =
          sessionStorage.getItem(LAST_FOCUSED_CHANNEL_ID_KEY) || '';
        if (storedId) {
          // Use the same genre selection as the initial filteredChannels state
          const lastSelected =
            sessionStorage.getItem(LAST_SELECTED_GENRE_KEY) || 'All';
          const norm = normalizeGenreName(lastSelected);
          let list = epgCache;
          if (norm === 'favorites') {
            const fav = new Set(Favorites.getAll());
            list = epgCache.filter((ch) =>
              fav.has(ch?.content?.ChannelID || ch?.channelId)
            );
          } else if (norm !== 'all') {
            list = filterByGenre(epgCache, lastSelected);
          }
          const idx = list.findIndex(
            (ch) =>
              String(ch?.content?.ChannelID || ch?.channelId || '') ===
              storedId
          );
          if (idx >= 0) return idx;
        }
      }

      const raw = sessionStorage.getItem(LAST_FOCUSED_CHANNEL_KEY);
      const parsed = raw != null ? parseInt(raw, 10) : NaN;
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    } catch {
      return 0;
    }
  });
  const setFocusedChannelIndex = useCallback((valueOrUpdater) => {
    _setFocusedChannelIndex((prev) => {
      const next =
        typeof valueOrUpdater === 'function' ? valueOrUpdater(prev) : valueOrUpdater;
      const safeNext = Number.isFinite(next) && next >= 0 ? next : 0;
      try {
        sessionStorage.setItem(LAST_FOCUSED_CHANNEL_KEY, String(safeNext));
      } catch {}
      return safeNext;
    });
  }, []);
  const [isGenrePaneFocused, setIsGenrePaneFocused] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());   

  const genreRefs = useRef([]);
  const channelRefs = useRef([]);
  const channelTitleRefs = useRef([]);
  const restoreFocusAttemptsRef = useRef(0);

  // Robust helper to vertically center a channel row inside the channel
  // scroll container, instead of relying only on element.scrollIntoView,
  // which can be unreliable on some TV engines.
  const scrollChannelRowIntoView = (index) => {
    const el = channelRefs.current[index];
    if (!el) return;

    let container = null;
    try {
      container = el.closest('.channel-scroll');
    } catch {
      container = null;
    }

    if (container && container.scrollHeight > container.clientHeight) {
      try {
        const cRect = container.getBoundingClientRect();
        const eRect = el.getBoundingClientRect();
        const offsetTop = (eRect.top - cRect.top) + container.scrollTop;
        const target = Math.max(
          0,
          Math.round(offsetTop - (container.clientHeight - eRect.height) / 2)
        );
        if (typeof container.scrollTo === 'function') {
          container.scrollTo({ top: target, behavior: 'auto' });
        } else {
          container.scrollTop = target;
        }
        return;
      } catch {
        // fall through to generic scrollIntoView
      }
    }

    try {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    } catch {
      try { el.scrollIntoView(); } catch {}
    }
  };

  // EPG comes from centralized query cache
  const flattenedEpg = useMemo(() => {
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

  // Update epgData and reapply filter when new pages arrive
  useEffect(() => {
    if (epgLoading) return;
    const data = Array.isArray(flattenedEpg) ? flattenedEpg : [];
    setEpgData(data);
    // Re-apply filter with current selection
    const name = genres[selectedGenreIndex] || 'All';
    if (normalizeGenreName(name) === 'all') {
      setFilteredChannels(data);
    } else if (normalizeGenreName(name) === 'favorites') {
      const fav = new Set(Favorites.getAll());
      setFilteredChannels(
        data.filter((ch) =>
          fav.has(ch?.content?.ChannelID || ch?.channelId)
        )
      );
    } else {
      setFilteredChannels(filterByGenre(data, name));
    }
  }, [epgLoading, flattenedEpg, genres, selectedGenreIndex, filterByGenre]); 

  // Ensure focused channel index is always within bounds of the filtered list
  useEffect(() => {
    setFocusedChannelIndex((idx) => {
      const maxIndex = Math.max(0, filteredChannels.length - 1);
      if (!Number.isFinite(idx) || idx < 0) return 0;
      return Math.min(idx, maxIndex);
    });
  }, [filteredChannels.length, setFocusedChannelIndex]);

  // Persist the last focused channel ID so we can restore focus after returning from Player.
  // When coming back from the Player screen, we temporarily skip this write so that
  // the ID set in PlayerPage is not immediately overwritten on first render.
  useEffect(() => {
    let skipPersist = false;
    try {
      skipPersist =
        sessionStorage.getItem(LAST_FOCUSED_FROM_PLAYER_FLAG_KEY) === '1';
    } catch {
      skipPersist = false;
    }
    if (skipPersist) return;

    const ch = filteredChannels[focusedChannelIndex];
    if (!ch) return;
    const id = ch?.content?.ChannelID || ch?.channelId;
    if (!id) return;
    try {
      sessionStorage.setItem(LAST_FOCUSED_CHANNEL_ID_KEY, String(id));
    } catch {
      // ignore storage errors
    }
  }, [focusedChannelIndex, filteredChannels]);

  // On (re)entering the Genre screen, try to restore focus to the last watched channel
  // using its ID instead of relying only on the numeric index, which can change
  // when EPG pages load in a different order per genre.
  useEffect(() => {
    // Limit the number of attempts so we don't keep fetching forever
    if (restoreFocusAttemptsRef.current >= 6) return;

    let storedId = '';
    try {
      storedId = sessionStorage.getItem(LAST_FOCUSED_CHANNEL_ID_KEY) || '';
    } catch {
      storedId = '';
    }
    if (!storedId) {
      // Nothing to restore; disable further attempts
      restoreFocusAttemptsRef.current = 6;
      return;
    }

    // Wait until we actually have some channels for the current genre
    if (!Array.isArray(filteredChannels) || filteredChannels.length === 0) {
      if (hasMoreEpgPages && !epgFetchingNext) {
        restoreFocusAttemptsRef.current += 1;
        fetchNextEpgPage().catch(() => {});
      }
      return;
    }

    const idx = filteredChannels.findIndex(
      (ch) => String(ch?.content?.ChannelID || ch?.channelId || '') === storedId
    );

    if (idx >= 0) {
      // Move focus back to the last watched channel row
      setIsGenrePaneFocused(false);
      setFocusedChannelIndex(idx);
      restoreFocusAttemptsRef.current = 6;

      // We have consumed the "from player" focus hint; clear the flag so
      // subsequent focus changes are persisted normally.
      try {
        sessionStorage.removeItem(LAST_FOCUSED_FROM_PLAYER_FLAG_KEY);
      } catch {
        // ignore storage errors
      }

      // Explicitly scroll the restored row into view using the robust helper,
      // scheduled after layout so refs & scroll heights are ready.
      try {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            scrollChannelRowIntoView(idx);
            setTimeout(() => scrollChannelRowIntoView(idx), 160);
          });
        });
      } catch {
        // ignore scheduling errors
      }
    } else if (hasMoreEpgPages && !epgFetchingNext) {
      // Channel might be in a yet-unloaded EPG page; fetch a bit more and try again
      restoreFocusAttemptsRef.current += 1;
      fetchNextEpgPage().catch(() => {});
    } else {
      // Give up after a few tries; fallback to index-based behaviour
      restoreFocusAttemptsRef.current = 6;
    }
  }, [
    filteredChannels,
    hasMoreEpgPages,
    epgFetchingNext,
    fetchNextEpgPage,
    setFocusedChannelIndex,
  ]);

  // Clock updates
  useEffect(() => {
    const id = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  // Ensure the last selected genre is scrolled into view (even when the
  // genre pane is not currently focused), so when we return from Player
  // the previously chosen genre is visible in the left list.
  useEffect(() => {
    try {
      const doScrollGenre = () => {
        const el = genreRefs.current[selectedGenreIndex];
        if (!el) return;

        // Prefer scrolling the dedicated genre scroll container rather than
        // relying on browser scrollIntoView heuristics, which can be flaky
        // on some TV engines.
        let container = null;
        try {
          container = el.closest('.genre-scroll');
        } catch {
          container = null;
        }

        if (container && container.scrollHeight > container.clientHeight) {
          try {
            const cRect = container.getBoundingClientRect();
            const eRect = el.getBoundingClientRect();
            const offsetTop = (eRect.top - cRect.top) + container.scrollTop;
            const target = Math.max(0, Math.round(offsetTop - (container.clientHeight - eRect.height) / 2));
            if (typeof container.scrollTo === 'function') {
              container.scrollTo({ top: target, behavior: 'auto' });
            } else {
              container.scrollTop = target;
            }
            return;
          } catch {
            // fall through to generic scrollIntoView
          }
        }

        try {
          el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        } catch {
          try { el.scrollIntoView(); } catch {}
        }
      };

      // Double RAF to wait for layout, then perform a precise scroll,
      // and retry once more shortly after in case images/fonts shift layout.
      const rafId = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          doScrollGenre();
          setTimeout(doScrollGenre, 160);
        });
      });
      return () => cancelAnimationFrame(rafId);
    } catch {
      // ignore scheduling errors
    }
  }, [selectedGenreIndex, genres.length]);

  const formatDate = (date) => {
    try {
      return date.toLocaleDateString('en-US', {
        year: 'numeric', month: '2-digit', day: '2-digit'
      });
    } catch {
      return '';
    }
  };

  const formatClock = (date) => {
    try {
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit', hour12: false
      });
    } catch {
      return '';
    }
  };

  const applyFilter = useCallback((genreName) => {
    const name = genreName || 'All';
    let next = [];

    if (normalizeGenreName(name) === 'all') {
      next = epgData;
    } else if (normalizeGenreName(name) === 'favorites') {
      const fav = new Set(Favorites.getAll());
      next = epgData.filter((ch) =>
        fav.has(ch?.content?.ChannelID || ch?.channelId)
      );
    } else {
      next = filterByGenre(epgData, name);
    }

    setFilteredChannels(next);

    // If this genre currently has no channels but more EPG pages exist,
    // proactively load the next page so results can appear without scrolling.
    if (
      next.length === 0 &&
      hasMoreEpgPages &&
      !epgFetchingNext
    ) {
      fetchNextEpgPage().catch(() => {});
    }
  }, [epgData, filterByGenre, hasMoreEpgPages, epgFetchingNext, fetchNextEpgPage]);

// Build genre list as union of manifest (cached) and EPG-derived, keeping All/Favorites at top
useEffect(() => {
  const base = ['All'];
  const favIds = new Set(Favorites.getAll());
  if (favIds.size > 0) base.push('Favorites');

    const fromManifest = Array.isArray(manifestCache?.genre)
    ? manifestCache.genre.map(g => g?.name).filter(Boolean)
    : [];
    const fromEpg = (() => {
    const gset = new Set();
      epgData.forEach(ch => {
      const arr = ch?.content?.genre || [];
      if (Array.isArray(arr)) arr.forEach(g => g?.name && gset.add(g.name));
    });
    return Array.from(gset);
  })();

  const merged = (() => {
    const seen = new Set(base);
    const out = [...base];
    [...fromManifest, ...fromEpg].forEach(name => { if (name && !seen.has(name)) { seen.add(name); out.push(name); } });
    return out;
  })();

  setGenres(merged);
  // If the previously selected genre is no longer present, reset to All
  setSelectedGenreIndex(idx => (merged[idx] ? idx : 0));
}, [epgData]);

// React to favorites changes (show/hide Favorites tab)
useEffect(() => {
  const unsub = Favorites.subscribe(() => {
    const favIds = Favorites.getAll();
    setGenres(prev => {
      const withoutFav = prev.filter(g => g !== 'Favorites');
      const withAll = withoutFav.includes('All') ? withoutFav : ['All', ...withoutFav];
      if (favIds.length > 0) {
        const rest = withAll.filter((_, i) => i !== 0);
        return ['All', 'Favorites', ...rest];
      }
      return withAll;
    });
    // If viewing Favorites and it became empty, switch to All
    if (favIds.length === 0 && genres[selectedGenreIndex] === 'Favorites') {
      setSelectedGenreIndex(0);
      applyFilter('All');
    }
  });
  return () => { try { unsub && unsub(); } catch {} };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [applyFilter, genres, selectedGenreIndex]);

// Initial filter: restore last selected genre (fallback to All)
// Note: We intentionally do NOT reset focusedChannelIndex here, to avoid
// snapping focus back to the first item when EPG/pages load in the background.
useEffect(() => {
  const last = (() => {
    try {
      return sessionStorage.getItem(LAST_SELECTED_GENRE_KEY) || 'All';
    } catch {
      return 'All';
    }
  })();

  const name = genres.includes(last) ? last : 'All';
  const idx = Math.max(0, genres.indexOf(name));

  setSelectedGenreIndex(idx === -1 ? 0 : idx);
  applyFilter(name);
}, [genres, applyFilter]);

  // Keyboard navigation
  const onKeyDown = (e) => {
    // If a global force-push overlay is active, completely block DPAD/back on Genre
    try {
      if (typeof window !== 'undefined' && window.__CAASTV_FORCE_PUSH_ACTIVE) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
    } catch {}

    if (e.key === 'Escape' || e.key === 'Backspace' || e.key === 'Back' || e.key === 'GoBack') {
      // Leaving Genre to Live via back should behave like a fresh EPG screen:
      // reset Live's saved filters/focus so it starts from the top.
      try {
        sessionStorage.removeItem('live_screen_state_v1');
      } catch {}
      navigate('/live');
      return;
    }
    if (e.key === 'ArrowLeft') {
      // Move focus from channel list into the currently selected genre item,
      // not always the first one, so DPAD-left after returning from Player
      // lands on the last selected genre.
      setIsGenrePaneFocused(true);
      setFocusedGenreIndex(selectedGenreIndex);
      return;
    }
    if (e.key === 'ArrowRight') {
      setIsGenrePaneFocused(false);
      return;
    }
    if (isGenrePaneFocused) {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedGenreIndex(i => Math.max(0, i - 1));
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedGenreIndex(i => Math.min(genres.length - 1, i + 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        setSelectedGenreIndex(focusedGenreIndex);
        const name = genres[focusedGenreIndex] || 'All';
        try {
          sessionStorage.setItem(LAST_SELECTED_GENRE_KEY, name);
          // User has manually chosen a genre; disable landing auto-focus overrides
          sessionStorage.setItem('landingFocusApplied', '1');
        } catch {}
        applyFilter(name);
        setIsGenrePaneFocused(false);
        setFocusedChannelIndex(0);
      }
    } else {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedChannelIndex(i => Math.max(0, i - 1));
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedChannelIndex(i => Math.min(filteredChannels.length - 1, i + 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const ch = filteredChannels[focusedChannelIndex];
        if (!ch) return;
        const cleanChannelId = encodeURIComponent(ch.content?.ChannelID || ch.channelId);
        const cleanChannelTitle = encodeURIComponent(ch.content?.title || ch.displayName || 'Unknown Channel');
        navigate(`/player?channelId=${cleanChannelId}&title=${cleanChannelTitle}`, {
          state: {
            fromScreen: 'genre',
            channelList: filteredChannels.map(item => ({
              id: item.content?.ChannelID || item.channelId,
              name: item.content?.title || item.displayName || 'Unknown Channel',
              logo: item.content?.logoUrl || item.content?.thumbnailUrl,
              videoUrl: item.content?.videoUrl,
              bgGradient: item.content?.bgGradient
            })),
            currentChannelId: ch.content?.ChannelID || ch.channelId,
            currentChannelTitle: ch.content?.title || ch.displayName || 'Unknown Channel'
          }
        });
      }
    }
  };

  // Intercept browser back button and redirect to /live,
  // but do NOT navigate while a force-push overlay is active.
  useEffect(() => {
    const handlePopState = (e) => {
      try {
        if (typeof window !== 'undefined' && window.__CAASTV_FORCE_PUSH_ACTIVE) {
          // While force message is on (no OK button), completely block back navigation.
          e?.preventDefault?.();
          try {
            // Re-push a guard state so the URL/screen does not change.
            window.history && window.history.pushState && window.history.pushState({ fromGenre: true }, '');
          } catch {}
          return;
        }
      } catch {}

      e?.preventDefault?.();
      navigate('/live', { replace: true });
    };
    // Push a dummy state so the next back triggers popstate here
    try { window.history.pushState({ fromGenre: true }, ''); } catch {}
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [navigate]);

  useEffect(() => {
    // Use requestAnimationFrame to sync with browser paint cycle for smooth transitions
    const rafId = requestAnimationFrame(() => {
      // Use double RAF to ensure CSS class has been applied and browser is ready to paint
      requestAnimationFrame(() => {
        if (isGenrePaneFocused) {
          const el = genreRefs.current[focusedGenreIndex];
          try {
            if (el) {
              el.focus({ preventScroll: true });
              // Ensure focused genre item is visible within the scroll container
              try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch {}
            }
          } catch {}
        } else {
          const el = channelRefs.current[focusedChannelIndex];
          try {
            if (el) {
              el.focus({ preventScroll: true });
              // Ensure focused channel row is visible within the scroll container
              scrollChannelRowIntoView(focusedChannelIndex);
            }
          } catch {}
        }
      });
    });
    return () => cancelAnimationFrame(rafId);
  }, [isGenrePaneFocused, focusedGenreIndex, focusedChannelIndex, filteredChannels]);

  // Detect overflowing channel titles and enable marquee animation
  useEffect(() => {
    const updateOverflow = () => {
      channelTitleRefs.current.forEach((container) => {
        if (!container) return;
        const textEl = container.querySelector('.channel-title-text');
        if (!textEl) return;
  
        // Reset previous state
        container.classList.remove('is-overflowing');
        container.style.removeProperty('--scroll-distance');
        container.style.removeProperty('--marquee-duration');
        container.style.removeProperty('--marquee-delay');
        container.style.removeProperty('--marquee-iterations');
  
        // Is the inner text wider than the visible container?
        const isOverflow = textEl.scrollWidth > container.clientWidth + 1;
        if (isOverflow) {
          container.classList.add('is-overflowing');
          // distance = text width - visible width + a small gap
          const distance = Math.max(0, textEl.scrollWidth - container.clientWidth + 24);
          container.style.setProperty('--scroll-distance', `${distance}px`);

          // Kotlin basicMarquee approximation:
          // iterations = Int.MAX_VALUE -> CSS 'infinite'
          // initialDelayMillis = 0 -> 0ms
          // velocity = 30.dp -> ~30px/sec in CSS pixels
          const velocityPxPerSec = 30; // tune if you need to match TV density
          // seamless loop distance is full text width + gap between copies
          const loopDistance = Math.max(0, textEl.scrollWidth + 24);
          const durationSec = loopDistance > 0 ? (loopDistance / velocityPxPerSec) : 0;
          container.style.setProperty('--loop-distance', `${loopDistance}px`);
          container.style.setProperty('--marquee-duration', `${Math.max(0.001, durationSec)}s`);
          container.style.setProperty('--marquee-delay', `0ms`);
          container.style.setProperty('--marquee-iterations', `infinite`);
        }
      });
    };
  
    const t = setTimeout(updateOverflow, 50);
    window.addEventListener('resize', updateOverflow);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', updateOverflow);
    };
  }, [filteredChannels, focusedChannelIndex, isGenrePaneFocused]);
  

  // Debounce preview selection to avoid rapid loads while navigating
  const [debouncedIndex, setDebouncedIndex] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedIndex(focusedChannelIndex), 250);
    return () => clearTimeout(t);
  }, [focusedChannelIndex]);
  const preview = useMemo(() => filteredChannels[debouncedIndex], [filteredChannels, debouncedIndex]);
  
  // Build DRM config for preview (same logic as main player)
  const [previewDrmConfig, setPreviewDrmConfig] = useState(null);
  const [previewBlocked, setPreviewBlocked] = useState(false);
  const [previewBlockedMsg, setPreviewBlockedMsg] = useState('');
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!preview?.content) {
        setPreviewDrmConfig(null);
        setPreviewBlocked(false);
        setPreviewBlockedMsg('');
        return;
      }
      
      try {
        const drmTypeRaw = preview?.content?.drmType || preview?.drmType || preview?.content?.DRMType || preview?.content?.DRM;
        const drmType = (drmTypeRaw || '').toString().toLowerCase();
        setPreviewBlocked(false);
        setPreviewBlockedMsg('');
        
        if (drmType === 'cryptoguard') {
          // Subscription gate for preview (no buttons; just show message)
          try {
            const epgAssetOrContentId = preview?.content?.assetId || preview?.content?.KeyId || preview?.content?.keyId || '';
            let allowed = isAssetPlayableViaDRM({ assetId: String(epgAssetOrContentId), contentId: String(epgAssetOrContentId) });
            if (!allowed) {
              let customerNumber = '';
              try {
                const raw = sessionStorage.getItem('user') || localStorage.getItem('user');
                const u = raw ? JSON.parse(raw) : {};
                customerNumber = u?.data?.customerNumber || u?.customerNumber || '';
              } catch {}
              await ensureEntitlementsForUser({ customerNumber });
              allowed = isAssetPlayableViaDRM({ assetId: String(epgAssetOrContentId), contentId: String(epgAssetOrContentId) });
            }
            if (!allowed) {
              if (!cancelled) {
                setPreviewDrmConfig(null);
                setPreviewBlocked(true);
                setPreviewBlockedMsg('This channel is not subscribed to your package.');
              }
              return; // Do not build DRM for preview
            }
          } catch {}

          const user = (() => { 
            try { 
              return JSON.parse(sessionStorage.getItem('user') || localStorage.getItem('user') || '{}'); 
            } catch { 
              return {}; 
            } 
          })();
          const deviceId = await getDeviceIdentifier().catch(() => null);
          const uniqueIdPref = user?.credentials?.macId || user?.data?.macId || deviceId || '';
          const videoUrl = preview.content?.streamUrl || 
                          preview.content?.videoUrl || 
                          preview.content?.url ||
                          preview.streamUrl ||
                          preview.videoUrl ||
                          preview.url;
          const contentId = preview.content?.assetId || preview.content?.KeyId || preview.content?.keyId || '';
          
          let licenseUrl = buildCryptoGuardLicenseUrl({
            baseUrl: 'https://drm.panmetroconvergence.com:4443/',
            contentUrl: videoUrl,
            contentId,
            username: user?.data?.username || user?.credentials?.username || '',
            password: user?.credentials?.password || '',
            uniqueDeviceId: uniqueIdPref,
            deviceTypeName: 'Android TV',
          });
          
          // Use proxy in browser context
          try {
            const origin = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : '';
            if (origin.startsWith('http')) {
              const u = new URL(licenseUrl);
              const proxy = new URL(origin);
              const prefix = '/drm/cryptoguard';
              proxy.pathname = prefix + (u.pathname || '/');
              if (!proxy.pathname.endsWith('/')) proxy.pathname += '/';
              proxy.search = u.search;
              licenseUrl = proxy.toString();
            }
          } catch {}
          
          if (!cancelled) {
            setPreviewDrmConfig({ keySystem: 'com.widevine.alpha', licenseUrl });
            setPreviewBlocked(false);
            setPreviewBlockedMsg('');
          }
        } else if (drmType === 'sigma' || drmType === 'widevine') {
          let licenseUrl = preview?.content?.licenseUrl || 'https://license-staging.sigmadrm.com/license/verify/widevine';
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
          if (!cancelled) {
            setPreviewDrmConfig({ keySystem: 'com.widevine.alpha', licenseUrl });
            setPreviewBlocked(false);
            setPreviewBlockedMsg('');
          }
        } else {
          if (!cancelled) {
            setPreviewDrmConfig(null);
            setPreviewBlocked(false);
            setPreviewBlockedMsg('');
          }
        }
      } catch (err) {
        if (!cancelled) {
          setPreviewDrmConfig(null);
          setPreviewBlocked(false);
          setPreviewBlockedMsg('');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [preview]);

  // Load next page when nearing end of list
  useEffect(() => {
    const total = filteredChannels.length;
    if (!total) return;
    const threshold = Math.max(0, total - 5);
    if (focusedChannelIndex >= threshold && hasMoreEpgPages && !epgFetchingNext) {
      fetchNextEpgPage().catch(() => {});
    }
  }, [filteredChannels.length, focusedChannelIndex, hasMoreEpgPages, epgFetchingNext, fetchNextEpgPage]);

  // On first app launch after splash: focus landing channel from manifest and auto-play its preview
  useEffect(() => {
    try {
      const applied = (() => { try { return sessionStorage.getItem('landingFocusApplied') === '1'; } catch { return false; } })();
      if (applied) return;

      // Prefer live manifest from React Query; fall back to sessionStorage cache
      const landingSource = manifest?.landingChannel || manifestCache?.landingChannel;
      console.log('[Genre] landingSource from manifest', landingSource);
      const landingIdRaw = landingSource?.channelId;
      const landingId = landingIdRaw ? String(landingIdRaw) : '';
      console.log('[Genre] landingChannel id/title/video', {
        id: landingId,
        title: landingSource?.title,
        videoUrl: landingSource?.videoUrl,
      });
      if (!landingId) return;

      // Ensure we are in 'All' so the channel is visible
      const allIndex = Math.max(0, genres.indexOf('All'));
      if (selectedGenreIndex !== allIndex) {
        try { sessionStorage.setItem(LAST_SELECTED_GENRE_KEY, 'All'); } catch {}
        setSelectedGenreIndex(allIndex);
        applyFilter('All');
        return; // wait for filteredChannels to update
      }

      if (!Array.isArray(filteredChannels) || filteredChannels.length === 0) return;

      const getId = (ch) => String(ch?.content?.ChannelID || ch?.channelId || '');
      const getTitle = (ch) => String(ch?.content?.title || ch?.displayName || '');
      const getVideo = (ch) => String(ch?.content?.videoUrl || '');

      let idx = filteredChannels.findIndex((ch) => getId(ch) === landingId);
      console.log('[Genre] landing match by id', { landingId, idx, total: filteredChannels.length });
      // Fallbacks: match by title or videoUrl if id mismatch
      if (idx < 0) {
        const landingTitle = String(landingSource?.title || '').toLowerCase();
        if (landingTitle) {
          idx = filteredChannels.findIndex((ch) => getTitle(ch).toLowerCase() === landingTitle);
        }
      }
      if (idx < 0) {
        const landingVideo = String(landingSource?.videoUrl || '').toLowerCase();
        if (landingVideo) {
          idx = filteredChannels.findIndex((ch) => getVideo(ch).toLowerCase() === landingVideo);
        }
      }

      if (idx >= 0) {
        setIsGenrePaneFocused(false);
        setFocusedChannelIndex(idx);
        setDebouncedIndex(idx); // ensure preview picks it up immediately
        console.log('[Genre] landing channel focus applied at index', idx);
        try { sessionStorage.setItem('landingFocusApplied', '1'); } catch {}

        // Explicitly scroll the landing channel row into view using the same
        // robust helper we use for restoring focus after returning from Player.
        // This avoids cases where the correct channel is focused but remains
        // off-screen at the top of the list on first app launch.
        try {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              scrollChannelRowIntoView(idx);
              setTimeout(() => scrollChannelRowIntoView(idx), 160);
            });
          });
        } catch {
          // ignore scheduling errors
        }

        return;
      }

      // If not found in current pages, try to fetch more pages a few times
      try {
        const key = 'landingFindAttempts';
        const current = (() => { try { return parseInt(sessionStorage.getItem(key) || '0', 10); } catch { return 0; } })();
        if (hasMoreEpgPages && !epgFetchingNext && current < 6) {
          fetchNextEpgPage().catch(() => {});
          try { sessionStorage.setItem(key, String(current + 1)); } catch {}
        }
      } catch {}
    } catch { /* noop */ }
  }, [genres, selectedGenreIndex, filteredChannels, applyFilter, manifest, manifestCache, hasMoreEpgPages, epgFetchingNext, fetchNextEpgPage]);

  return (
    <div className="genre-container" tabIndex={0} onKeyDown={onKeyDown}>
      {/* Top Bar (Panmetro style) */}
      <div className="panmetro-topbar">
        <div className="panmetro-topbar-content">
          <div className="panmetro-topbar-line-left"></div>
          <div className="panmetro-topbar-logo">
            <div className="panmetro-topbar-logo-container">
              <img src={topCorner} alt="Top Corner" className="panmetro-topbar-corner" />
              <img src={panmetroBrand} alt="Panmetro Brand" className="panmetro-topbar-brand-logo" />
            </div>
          </div>
          <div className="panmetro-topbar-line"></div>
          <div className="panmetro-topbar-line-extended"></div>
          <div className="panmetro-topbar-time">
            <span className="pm-time-item">
              <FeatherIcon icon="calendar" className="pm-time-icon" size={28} />
              <span className="pm-time-text">{formatDate(currentTime)}</span>
            </span>
            <span className="pm-time-item">
              <FeatherIcon icon="clock" className="pm-time-icon" size={28} />
              <span className="pm-time-text">{formatClock(currentTime)}</span>
            </span>
          </div>
        </div>
      </div>

      <div className="genre-layout">
        <div className="genre-col">
          <div className="genre-panel">
            <div className="arrow-row up" aria-hidden>
              <span className="arrow-icon">▲</span>
            </div>
            <div className="genre-scroll">
              {genres.map((g, idx) => {
                const isFocused = focusedGenreIndex === idx && isGenrePaneFocused;
                const isSelected = selectedGenreIndex === idx;
                const isAll = (g || '').toUpperCase() === 'ALL';
                return (
                  <div
                    key={g}
                    className={`genre-item ${isSelected ? 'selected' : ''} ${isFocused ? 'focused' : ''} ${isAll ? 'is-all' : ''}`}
                    onClick={() => {
                      setSelectedGenreIndex(idx);
                      try {
                        sessionStorage.setItem(LAST_SELECTED_GENRE_KEY, g || 'All');
                        // User click overrides any pending landing auto-focus
                        sessionStorage.setItem('landingFocusApplied', '1');
                      } catch {}
                      applyFilter(g);
                      setFocusedChannelIndex(0);
                      setIsGenrePaneFocused(false);
                    }}
                    ref={el => { genreRefs.current[idx] = el; }}
                    tabIndex={-1}
                    role="button"
                  >
                    {isAll ? (
                      <div className="genre-item-all">
                        <div className="genre-text">{g.toUpperCase()}</div>
                        <div className="genre-play"><span>▶</span></div>
                      </div>
                    ) : (
                      <div className="genre-text">{g.toUpperCase()}</div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="arrow-row down" aria-hidden>
              <span className="arrow-icon muted">▼</span>
            </div>
          </div>
        </div>
        <div className="channel-col">
          <div className="channel-panel">
            <div className="arrow-row up" aria-hidden>
              <span className="arrow-icon muted">▲</span>
            </div>
            <div className="channel-scroll">
              {filteredChannels.length === 0 ? (
                <div className="channel-empty-message">
                  {epgLoading || epgFetchingNext ? (
                    <>
                      Loading channels...
                      <br />
                      Please wait.
                    </>
                  ) : epgData.length === 0 ? (
                    <>
                      No channels available
                      <br />
                      Get back soon!
                    </>
                  ) : (
                    <>
                      No channels match this filter
                      <br />
                      Try a different genre.
                    </>
                  )}
                </div>
              ) : (
                filteredChannels.map((ch, idx) => (
                  <div
                    key={ch._id || ch.channelId || ch.content?.ChannelID || idx}
                    className={`channel-row ${focusedChannelIndex === idx && !isGenrePaneFocused ? 'focused' : ''}`}
                    tabIndex={-1}
                    ref={el => { channelRefs.current[idx] = el; }}
                    onClick={() => setFocusedChannelIndex(idx)}
                    role="button"
                  >
                    <div className="channel-thumb" style={getGradientStyle(ch.content?.bgGradient)}>
                      {ch.content?.thumbnailUrl ? (
                        <img src={ch.content.thumbnailUrl} alt={ch.content?.title || ch.displayName || 'Channel'} loading="lazy" decoding="async" fetchpriority="low" />
                      ) : (
                        <div className="channel-thumb-placeholder">{(ch.content?.title || ch.displayName || 'C').charAt(0)}</div>
                      )}
                    </div>
                    <div className="channel-meta">
                      <div className="channel-num">{ch.content?.channelNo || ''}</div>
                      <div
                        className="channel-title"
                        ref={el => { channelTitleRefs.current[idx] = el; }}
                      >
                        <div className="channel-title-viewport">
                          <div className="marquee-track">
                            <span className="channel-title-text">
                              {ch.content?.title || ch.displayName || ''}
                            </span>
                            <span className="channel-title-text clone" aria-hidden="true">
                              {ch.content?.title || ch.displayName || ''}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="arrow-row down" aria-hidden>
              <span className="arrow-icon muted">▼</span>
            </div>
          </div>
        </div>
        <div className="preview-col">
          <div className="preview-panel">
            <div className="preview-banner">
              {(() => {
                // Use same videoUrl resolution logic as main player
                const videoUrl = preview?.content?.streamUrl || 
                                preview?.content?.videoUrl || 
                                preview?.content?.url ||
                                preview?.streamUrl ||
                                preview?.videoUrl ||
                                preview?.url;
                
                if (!videoUrl) return null;
                
                return (
                  <>
                    {!previewBlocked ? (
                      <ErrorBoundary>
                        <ShakaPlayer
                          key={`${preview?.content?.ChannelID || preview?.channelId || ''}::${previewDrmConfig?.licenseUrl || 'no-drm'}`}
                          embedded
                          className="genre-preview-player"
                          videoUrl={videoUrl}
                          channelTitle={preview.content?.title || preview.displayName || ''}
                          channelNumber={preview.content?.channelNo || preview.content?.channelNumber || ''}
                          channelId={preview.content?.ChannelID || preview.channelId}
                          drm={previewDrmConfig}
                        />
                      </ErrorBoundary>
                    ) : (
                      <div className="genre-preview-player blocked">
                        <CommonDialog
                          showDialog={true}
                          title="Subscription required"
                          message={previewBlockedMsg}
                          inlineOverlay={true}
                          compact={true}
                          // No buttons for preview
                          isErrorAdded={true}
                          passive={true}
                        />
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
            <PreviewBanner />
          </div>
        </div>
      </div>

      {/* Bottom Bar (Panmetro style) */}
      <div className="panmetro-bottombar">
        <div className="panmetro-bottombar-content">
          <div className="panmetro-bottombar-line"></div>
          <div className="panmetro-bottombar-text">Powered by PANMETRO</div>
        </div>
      </div>
    </div>
  );
}


