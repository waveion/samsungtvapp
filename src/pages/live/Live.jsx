import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import API from '../../services/api';
import { useEpgInfinite, useManifest } from '../../services/epgManifestQueries';
import { getGradientStyle } from '../../utils/gradientUtils';
import './Live.css';
import CommonDialog from '../../components/CommonDialog';
import exitIcon from '../../assets/exit_icon.svg';

// Persist last-used filters and channel between Live and Player screens
const LIVE_PERSIST_KEY = 'live_screen_state_v1';

const loadLiveScreenState = () => {
  try {
    const raw = sessionStorage.getItem(LIVE_PERSIST_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      categoryName: parsed.categoryName || 'All',
      languageName: parsed.languageName || 'All',
      lastChannelId: parsed.lastChannelId || null,
    };
  } catch {
    return null;
  }
};

const saveLiveScreenState = ({ categoryName, languageName, lastChannelId }) => {
  try {
    const payload = {
      categoryName: categoryName || 'All',
      languageName: languageName || 'All',
      lastChannelId: lastChannelId || null,
    };
    sessionStorage.setItem(LIVE_PERSIST_KEY, JSON.stringify(payload));
  } catch {
    // ignore storage errors
  }
};

// EPG is centralized via React Query; no per-screen cache needed

// ---------- Small Utilities ----------
const isScrollable = (node) => {
  if (!node) return false;
  const cs = getComputedStyle(node);
  const canScrollY = /(auto|scroll)/.test(cs.overflowY);
  return canScrollY && node.scrollHeight > node.clientHeight;
};

const getScrollableAncestor = (el) => {
  let node = el?.parentElement;
  while (node) {
    if (isScrollable(node)) return node;
    node = node.parentElement;
  }
  return document.scrollingElement || document.documentElement || document.body;
};

// double RAF to ensure layout (images/fonts) settled before we scroll
const afterLayout = (fn) => requestAnimationFrame(() => requestAnimationFrame(fn));

// Robust scroll helpers (work across TV/web engines)
const scrollContainerTo = (container, top) => {
  if (!container) return;
  const isDoc =
    container === document.scrollingElement ||
    container === document.documentElement ||
    container === document.body;

  if (isDoc) {
    window.scrollTo({ top, behavior: 'auto' });
  } else if (typeof container.scrollTo === 'function') {
    container.scrollTo({ top, behavior: 'auto' });
  } else {
    container.scrollTop = top;
  }
};

// center `el` inside `container` vertically
const scrollIntoAncestorCenterY = (el, container) => {
  if (!el || !container) return;
  const containerRect = container.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  const offsetTop = (elRect.top - containerRect.top) + container.scrollTop;
  const target = Math.max(0, Math.round(offsetTop - (container.clientHeight - elRect.height) / 2));
  scrollContainerTo(container, target);
};

// -------------------------------------

// LanguageMenu
function LanguageMenu({
  languages,
  selectedIndex,
  focusedIndex,
  focusType,
  onLanguageClick,
  languageRefs,
  setFocusType,
  setFocusedLanguageIndex,
}) {
  return (
    <div className="language-menu">
      <div className="category-menu-container">
        {languages.map((lang, index) => (
          <button
            key={lang}
            className={`language-item ${selectedIndex === index ? 'selected' : ''} ${focusedIndex === index && focusType === 'language' ? 'focused' : ''}`}
            onClick={() => onLanguageClick(lang)}
            onFocus={() => { setFocusType('language'); setFocusedLanguageIndex(index); }}
            ref={(el) => (languageRefs.current[index] = el)}
            tabIndex={0}
          >
            {lang.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}

function Live() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    data: epgPagesData,
    isLoading: epgLoading,
    fetchNextPage: fetchNextEpgPage,
    hasNextPage: hasMoreEpgPages,
    isFetchingNextPage: epgFetchingNext,
  } = useEpgInfinite(
    { pageSize: 50 },
    {
      // Keep EPG fresh in background so "no channels" state can auto-recover
      refetchInterval: 30000,
      refetchOnWindowFocus: false,
    }
  );
  const { data: manifestData = {}, isLoading: manifestLoading } = useManifest();

  // Prefer in-memory React Query cache (prefetched during splash), then fall back to sessionStorage.
  const [epgData, setEpgData] = useState(() => {
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
  });

  const [filteredEpgData, setFilteredEpgData] = useState(() => {
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
  });
  const [loading, setLoading] = useState(true);
  // Initialize languages and genres from manifest cache (prefer React Query, then sessionStorage)
  const manifestCacheData = (() => {
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
  const initialGenres = Array.isArray(manifestCacheData?.genre)
    ? ['All', ...manifestCacheData.genre.map((g) => g?.name).filter(Boolean)]
    : [];
  const initialLanguages = Array.isArray(manifestCacheData?.language)
    ? ['All', ...manifestCacheData.language.map((l) => l?.name).filter(Boolean)]
    : [];

  const [selectedCategory, setSelectedCategory] = useState(initialGenres.length > 0 ? 0 : -1);
  const [availableLanguages, setAvailableLanguages] = useState(initialLanguages);
  const [selectedLanguageIndex, setSelectedLanguageIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [availableGenres, setAvailableGenres] = useState(initialGenres);
  const [isSidebarFocused, setIsSidebarFocused] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  // How far ahead to show programmes (hours). Can grow on demand when navigating right.
  const [windowHoursAhead, setWindowHoursAhead] = useState(6);

  // Focus management state
  const [focusedGenreIndex, setFocusedGenreIndex] = useState(-1);
  const [focusedLanguageIndex, setFocusedLanguageIndex] = useState(-1);
  const [focusedChannelIndex, setFocusedChannelIndex] = useState(-1);
  const [focusedProgramIndex, setFocusedProgramIndex] = useState(-1);
  const [focusType, setFocusType] = useState('none'); // 'genre' | 'language' | 'channel' | 'program' | 'none'

  // Refs
  const genreRefs = useRef([]);
  const languageRefs = useRef([]);
  const channelRefs = useRef([]);   // logo/button inside left column
  const programRefs = useRef([]);   // 2D grid of program cells
  const rowRefs = useRef([]);       // entire .epg-channel-row (important)

  const containerRef = useRef(null);
  const leftPanelRef = useRef(null);
  const timeHeaderRef = useRef(null);
  const timeSlotsRef = useRef(null);
  const epgBodyRef = useRef(null);  // THE vertical scroll container
  const restoreStateOnceRef = useRef(false);
  const restoredFromPersistRef = useRef(false);

  // Layout for live indicator
  const [layout, setLayout] = useState({
    oneSlotWidth: 300,
    indicatorLeft: 400,
    bodyHeight: 0,
  });

  // ---- Virtualization state (channels list) ----
  const [rowHeight, setRowHeight] = useState(110);
  const [visibleStartIndex, setVisibleStartIndex] = useState(0);
  const [visibleEndIndex, setVisibleEndIndex] = useState(20);
  const overscan = 5;

  // Extract unique genres (fallback if manifest missing)
  const extractGenresFromEpgData = (data) => {
    try {
      const genres = new Set(['All']);
      if (Array.isArray(data)) {
        data.forEach((channel) => {
          if (channel?.content?.genre && Array.isArray(channel.content.genre)) {
            channel.content.genre.forEach((g) => g?.name && genres.add(g.name));
          }
        });
      }
      return Array.from(genres);
    } catch {
      return ['All'];
    }
  };

  // Extract unique languages (fallback if manifest missing)
  const extractLanguagesFromEpgData = (data) => {
    try {
      const languages = new Set(['All']);
      if (Array.isArray(data)) {
        data.forEach((channel) => {
          const langObj = channel?.content?.language;
          if (!langObj) return;
          const name =
            typeof langObj === 'string'
              ? langObj
              : langObj.name || langObj.title || langObj.Language || '';
          if (name) languages.add(String(name));
        });
      }
      return Array.from(languages);
    } catch {
      return ['All'];
    }
  };

  // Parse EPG time format (YYYYMMDDHHMMSS +0530)
  const parseEpgTime = (epgTime) => {
    try {
      const timePart = (epgTime || '').split(' ')[0];
      const y = timePart.substring(0, 4);
      const m = timePart.substring(4, 6);
      const d = timePart.substring(6, 8);
      const hh = timePart.substring(8, 10);
      const mm = timePart.substring(10, 12);
      const ss = timePart.substring(12, 14);
      return new Date(`${y}-${m}-${d}T${hh}:${mm}:${ss}`);
    } catch {
      return new Date();
    }
  };

  // Program cell width (based on 30-minute slot width)
  const calculateProgramWidth = useCallback((startTime, endTime) => {
    try {
      if (!startTime || !endTime) {
        return Math.max(180, layout.oneSlotWidth);
      }
      const start = parseEpgTime(startTime);
      const end = parseEpgTime(endTime);
      const mins = (end.getTime() - start.getTime()) / 60000;
      const base = layout.oneSlotWidth || 300; // width for 30 min slot
      return Math.max(180, (mins / 30) * base);
    } catch {
      return Math.max(180, layout.oneSlotWidth || 300);
    }
  }, [layout.oneSlotWidth]);

  // Programs list (use normalized structure first, fall back to legacy tv.programme)
  const getAvailablePrograms = (channel) => {
    const list =
      channel?.content?.programme ||
      channel?.tv?.programme ||
      [];
    return Array.isArray(list) ? list : [];
  };

  // Window programs around current time to reduce DOM weight
  const getProgramsForWindow = useCallback((channel) => {
    try {
      const programs = getAvailablePrograms(channel);
      if (!programs || programs.length === 0) return [];

      const windowStart = new Date(currentTime);
      windowStart.setMinutes(windowStart.getMinutes() - 15);
      const windowEnd = new Date(currentTime);
      windowEnd.setMinutes(windowEnd.getMinutes() + (60 * Math.max(1, windowHoursAhead))); // configurable future window

      const filtered = programs.filter((p) => {
        const s = parseEpgTime(p._start);
        const e = parseEpgTime(p._stop);
        return e > windowStart && s < windowEnd;
      });

      // Fallback: ensure at least a few items to avoid empty rows
      if (filtered.length === 0) return programs.slice(0, 3);
      return filtered;
    } catch {
      return getAvailablePrograms(channel).slice(0, 3);
    }
  }, [currentTime, windowHoursAhead]);

  // Apply filters
  const applyFilters = useCallback(
    (categoryName, languageName) => {
      try {
        const byGenre =
          categoryName === 'All'
            ? epgData
            : epgData.filter(
                (channel) =>
                  Array.isArray(channel?.content?.genre) &&
                  channel.content.genre.some((g) => g?.name === categoryName)
              );

        const filtered =
          !languageName || languageName === 'All'
            ? byGenre
            : byGenre.filter((channel) => {
                const langObj = channel?.content?.language;
                if (!langObj) return false;
                const name =
                  typeof langObj === 'string'
                    ? langObj
                    : langObj.name || langObj.title || langObj.Language || '';
                return name.toLowerCase() === languageName.toLowerCase();
              });

        setFilteredEpgData(filtered);
        return filtered;
      } catch {
        setFilteredEpgData([]);
        return [];
      }
    },
    [epgData]
  );

  // Keyboard nav
  const focusSidebar = useCallback(() => {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return false;
    setIsSidebarFocused(true);
    document.dispatchEvent(new CustomEvent('sidebar-expand'));
    document.querySelector('.live-container')?.blur();

    // Move focus to the active nav item if nothing in the sidebar is focused yet
    const tryFocusActive = () => {
      const sidebarEl = document.querySelector('.sidebar');
      const alreadyFocusedInside = !!document.activeElement && sidebarEl?.contains(document.activeElement);
      if (alreadyFocusedInside) return;
      const activeOrFirst = sidebarEl?.querySelector('.nav-item.active') || sidebarEl?.querySelector('.nav-item');
      activeOrFirst?.focus();
    };
    // Try next frame only; avoid later overrides while user navigates
    requestAnimationFrame(tryFocusActive);

    return true;
  }, []);

  const handleKeyDown = (e) => {
    try {
      // If a global force-push overlay is active, completely block DPAD/back on Live
      try {
        if (typeof window !== 'undefined' && window.__CAASTV_FORCE_PUSH_ACTIVE) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      } catch {}

      // Debug logging for rapid EPG navigation / BACK flows
      try {
        // eslint-disable-next-line no-console
        console.log('[Live][KeyDown]', {
          key: e.key,
          keyCode: e.keyCode,
          which: e.which,
          focusType,
          focusedGenreIndex,
          focusedLanguageIndex,
          focusedChannelIndex,
          focusedProgramIndex,
          isSidebarFocused,
          showExitDialog,
        });
      } catch {}
      // If exit dialog is open, do not handle DPAD here (let dialog own focus/keys)
      if (showExitDialog) {
        return;
      }
      // When sidebar is focused, let the sidebar own DPAD/back, and block native EPG navigation
      if (isSidebarFocused) {
        try {
          e.preventDefault();
          e.stopPropagation();
        } catch {}
        return;
      }
      // Prevent native browser/TV spatial navigation from hijacking focus
      e.stopPropagation();

      switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        if (focusType === 'language') {
          setFocusType('genre');
          const genreIndex = Math.max(0, selectedCategory);
          setFocusedGenreIndex(genreIndex);
          setSelectedCategory(genreIndex); // Set immediately for smooth transition
        } else if (focusType === 'channel' || focusType === 'program') {
          if (focusedChannelIndex > 0) {
            const next = focusedChannelIndex - 1;
            setFocusType('channel');
            setFocusedChannelIndex(next);
            ensureChannelIndexVisible(next);
          } else {
            setFocusType('language');
            setFocusedLanguageIndex(Math.max(0, selectedLanguageIndex));
          }
        }
        break;

      case 'ArrowDown':
        e.preventDefault();
        if (focusType === 'none') {
          setFocusType('channel');
          setFocusedChannelIndex(0);
          ensureChannelIndexVisible(0);
        } else if (focusType === 'genre') {
          setFocusType('language');
          const langIndex = Math.max(0, selectedLanguageIndex);
          setFocusedLanguageIndex(langIndex);
          setSelectedLanguageIndex(langIndex); // Set immediately for smooth transition
        } else if (focusType === 'language') {
          setFocusType('channel');
          setFocusedChannelIndex(0);
          ensureChannelIndexVisible(0);
        } else if (focusType === 'channel') {
          if (focusedChannelIndex < filteredEpgData.length - 1) {
            const next = focusedChannelIndex + 1;
            setFocusedChannelIndex(next);
            ensureChannelIndexVisible(next);
          }
        } else if (focusType === 'program') {
          if (focusedChannelIndex < filteredEpgData.length - 1) {
            setFocusType('channel');
            const next = focusedChannelIndex + 1;
            setFocusedChannelIndex(next);
            ensureChannelIndexVisible(next);
          }
        }
        break;

      case 'ArrowLeft': {
        e.preventDefault();
        if (focusType === 'none') {
          focusSidebar();
        } else if (focusType === 'genre') {
          if (focusedGenreIndex === 0) focusSidebar();
          else {
            const nextIndex = focusedGenreIndex - 1;
            setFocusedGenreIndex(nextIndex);
            setSelectedCategory(nextIndex); // Set immediately for smooth transition
          }
        } else if (focusType === 'language') {
          if (focusedLanguageIndex === 0) focusSidebar();
          else {
            const nextIndex = focusedLanguageIndex - 1;
            setFocusedLanguageIndex(nextIndex);
            setSelectedLanguageIndex(nextIndex); // Set immediately for smooth transition
          }
        } else if (focusType === 'channel') {
          focusSidebar();
        } else if (focusType === 'program') {
          if (focusedProgramIndex === 0) setFocusType('channel');
          else setFocusedProgramIndex((v) => v - 1);
        }
        break;
      }

      case 'Backspace':
      case 'Escape':
      case 'Back':
      case 'GoBack':
      case 'BrowserBack': {
        try {
          // eslint-disable-next-line no-console
          console.log('[Live][BackKey]', {
            key: e.key,
            keyCode: e.keyCode,
            which: e.which,
            focusType,
            focusedChannelIndex,
            focusedProgramIndex,
            isSidebarFocused,
          });
        } catch {}
        e.preventDefault();
        // Always send focus to the sidebar from EPG (anywhere in content)
        setFocusType('none');
        setFocusedChannelIndex(-1);
        setFocusedProgramIndex(-1);
        focusSidebar();
        break;
      }

      case 'ArrowRight':
        e.preventDefault();
        if (focusType === 'genre') {
          if (focusedGenreIndex < availableGenres.length - 1) {
            const nextIndex = focusedGenreIndex + 1;
            setFocusedGenreIndex(nextIndex);
            setSelectedCategory(nextIndex); // Set immediately for smooth transition
          }
        } else if (focusType === 'language') {
          if (focusedLanguageIndex < availableLanguages.length - 1) {
            const nextIndex = focusedLanguageIndex + 1;
            setFocusedLanguageIndex(nextIndex);
            setSelectedLanguageIndex(nextIndex); // Set immediately for smooth transition
          }
        } else if (focusType === 'channel') {
          const channel = filteredEpgData[focusedChannelIndex];
          const programs = getProgramsForWindow(channel);
          if (programs && programs.length > 0) {
            setFocusType('program');
            setFocusedProgramIndex(0);
            afterLayout(() => ensureProgramCellVisible(focusedChannelIndex, 0));
          } // else stay on channel
        } else if (focusType === 'program') {
          const channel = filteredEpgData[focusedChannelIndex];
          const programs = getProgramsForWindow(channel);
          if (focusedProgramIndex < programs.length - 1) {
            const next = focusedProgramIndex + 1;
            setFocusedProgramIndex(next);
            afterLayout(() => ensureProgramCellVisible(focusedChannelIndex, next));
            // If we're near the end of current window, proactively expand by 6h
            if (next >= Math.max(0, programs.length - 2)) {
              setWindowHoursAhead((h) => h + 6);
            }
          } else {
            // At end of window; expand future window and keep focus on programme list
            setWindowHoursAhead((h) => h + 6); // add 6 more hours
            // After window grows and rerenders, ensure we stay in programme focus
            setTimeout(() => {
              try {
                const newPrograms = getProgramsForWindow(filteredEpgData[focusedChannelIndex] || channel);
                const nextIndex = Math.min(focusedProgramIndex + 1, Math.max(0, newPrograms.length - 1));
                setFocusType('program');
                setFocusedProgramIndex(nextIndex);
                ensureProgramCellVisible(focusedChannelIndex, nextIndex);
              } catch { /* noop */ }
            }, 0);
          }
        }
        break;

      case 'Enter':
        e.preventDefault();
        if (focusType === 'genre') {
          const category = availableGenres[focusedGenreIndex];
          if (category) {
            handleCategoryClick(category);
          }
        } else if (focusType === 'language') {
          const language = availableLanguages[focusedLanguageIndex];
          if (language) {
            handleLanguageClick(language);
          }
        } else if (focusType === 'channel') {
          // Guard against rapid key presses when no channel is focused/loaded yet
          if (
            focusedChannelIndex >= 0 &&
            focusedChannelIndex < filteredEpgData.length
          ) {
            const channel = filteredEpgData[focusedChannelIndex];
            if (channel) {
              handleChannelClick(channel);
            }
          }
        } else if (focusType === 'program') {
          if (
            focusedChannelIndex >= 0 &&
            focusedChannelIndex < filteredEpgData.length
          ) {
            const channel = filteredEpgData[focusedChannelIndex];
            if (channel) {
              handleChannelClick(channel);
            }
          }
        }
        break;

      default: {
        // Handle TV hardware BACK keys that arrive only as keyCodes (no e.key string),
        // such as LG webOS (461) or some remotes that send 8/10009 for back.
        if (e && (e.keyCode === 461 || e.which === 461 || e.keyCode === 8 || e.which === 8 || e.keyCode === 10009 || e.which === 10009)) {
          try {
            // eslint-disable-next-line no-console
            console.log('[Live][BackKey461]', {
              key: e.key,
              keyCode: e.keyCode,
              which: e.which,
              focusType,
              focusedChannelIndex,
              focusedProgramIndex,
              isSidebarFocused,
            });
          } catch {}
          e.preventDefault();
          // Mirror the Back-case behaviour: always move focus to sidebar
          setFocusType('none');
          setFocusedChannelIndex(-1);
          setFocusedProgramIndex(-1);
          focusSidebar();
        }
        break;
      }
    }
    } catch (err) {
      try {
        // eslint-disable-next-line no-console
        console.error('[Live][KeyDownError]', err);
      } catch {}
    }
  };

  // Flatten paginated EPG data into a single array
  const flattenedEpg = React.useMemo(() => {
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

  // Consume centralized EPG data
  useEffect(() => {
    if (epgLoading) {
      setLoading(true);
      return;
    }
    const data = Array.isArray(flattenedEpg) ? flattenedEpg : [];
    setEpgData(data);
    setFilteredEpgData(data);
    // Fallback genres/languages if manifest not yet loaded
    if (!manifestData || (!manifestData.genre && !manifestData.language)) {
      const genres = extractGenresFromEpgData(data);
      setAvailableGenres(genres);
      if (selectedCategory < 0) setSelectedCategory(0);
      const langs = extractLanguagesFromEpgData(data);
      setAvailableLanguages(langs);
      if (selectedLanguageIndex < 0) setSelectedLanguageIndex(0);
    }
    setLoading(false);
  }, [flattenedEpg, epgLoading]);

  // Apply manifest-provided languages and genres when available
  useEffect(() => {
    try {
      if (!manifestLoading && manifestData) {
        const genresArr = Array.isArray(manifestData.genre)
          ? ['All', ...manifestData.genre.map((g) => g?.name).filter(Boolean)]
          : undefined;
        const langsArr = Array.isArray(manifestData.language)
          ? ['All', ...manifestData.language.map((l) => l?.name).filter(Boolean)]
          : undefined;

        if (genresArr && genresArr.length > 0) {
          setAvailableGenres(genresArr);
          if (selectedCategory < 0) setSelectedCategory(0);
        }
        if (langsArr && langsArr.length > 0) {
          setAvailableLanguages(langsArr);
          if (selectedLanguageIndex < 0) setSelectedLanguageIndex(0);
        }
      }
    } catch { /* noop */ }
  }, [manifestData, manifestLoading]);

  // Languages are derived from EPG; no extra network call

  // Ensure the selected category button is scrolled into view, even when
  // selected programmatically (e.g., restored from Player).
  useEffect(() => {
    if (selectedCategory < 0) return;
    const el = genreRefs.current[selectedCategory];
    if (el && typeof el.scrollIntoView === 'function') {
      try {
        el.scrollIntoView({ block: 'center', inline: 'center' });
      } catch {
        // ignore scroll errors
      }
    }
  }, [selectedCategory]);

  // Restore last-used filters and channel (for Live → Player → back)
  useEffect(() => {
    if (restoreStateOnceRef.current) return;
    if (!epgData || epgData.length === 0) return;
    if (!Array.isArray(availableGenres) || availableGenres.length === 0) return;
    if (!Array.isArray(availableLanguages) || availableLanguages.length === 0) return;

    const persisted = loadLiveScreenState();
    if (!persisted) {
      restoreStateOnceRef.current = true;
      restoredFromPersistRef.current = false;
      return;
    }

    const categoryIndex = (() => {
      const idx = availableGenres.indexOf(persisted.categoryName || 'All');
      return idx >= 0 ? idx : 0;
    })();

    const languageIndex = (() => {
      const idx = availableLanguages.indexOf(persisted.languageName || 'All');
      return idx >= 0 ? idx : 0;
    })();

    const categoryName = availableGenres[categoryIndex] || 'All';
    const languageName = availableLanguages[languageIndex] || 'All';

    setSelectedCategory(categoryIndex);
    setSelectedLanguageIndex(languageIndex);

    const filtered = applyFilters(categoryName, languageName) || [];

    let channelIndexToFocus = 0;
    if (persisted.lastChannelId) {
      const matchIndex = filtered.findIndex((ch) => {
        const id = ch?.content?.ChannelID || ch?.channelId;
        return id && String(id) === String(persisted.lastChannelId);
      });
      if (matchIndex >= 0) {
        channelIndexToFocus = matchIndex;
      }
    }

    setFocusType('channel');
    setFocusedChannelIndex(channelIndexToFocus);

    restoredFromPersistRef.current = true;
    restoreStateOnceRef.current = true;
  }, [epgData, availableGenres, availableLanguages, applyFilters]);

  // Reset element refs when channel list changes to avoid stale references after filtering
  useEffect(() => {
    channelRefs.current = [];
    rowRefs.current = [];
    programRefs.current = [];
  }, [filteredEpgData]);

  // Compute layout for the live-time indicator (robust against DOM changes)
  useEffect(() => {
    const computeLayout = () => {
      try {
        const bodyEl = epgBodyRef.current;
        const slotsEl = timeSlotsRef.current;
        if (!bodyEl || !slotsEl) return;

        const bodyRect = bodyEl.getBoundingClientRect();
        const slotsRect = slotsEl.getBoundingClientRect();
        const slotEls = Array.from(slotsEl.children || []);
        const firstSlotRect = slotEls[0]?.getBoundingClientRect();
        const oneSlotWidth =
          firstSlotRect?.width && firstSlotRect.width > 0
            ? firstSlotRect.width
            : Math.max(150, slotsRect.width / Math.max(1, slotEls.length || 5));

        const now = new Date();
        const roundedMinutes = now.getMinutes() < 30 ? 0 : 30;
        const blockStart = new Date(now);
        blockStart.setMinutes(roundedMinutes, 0, 0);
        const fraction = Math.min(1, Math.max(0, (now - blockStart) / (30 * 60 * 1000)));

        const startLeft = slotsRect.left - bodyRect.left;
        const indicatorLeft = startLeft + fraction * oneSlotWidth;

        const bodyHeight = bodyEl.clientHeight;
        setLayout({ oneSlotWidth, indicatorLeft, bodyHeight });
      } catch { /* noop */ }
    };

    const raf = () => requestAnimationFrame(computeLayout);
    const t1 = setTimeout(computeLayout, 0);
    const t2 = setTimeout(computeLayout, 50);
    window.addEventListener('resize', raf);

    const interval = setInterval(() => {
      setCurrentTime(new Date());
      computeLayout();
    }, 30000); // update every 30s instead of 1s

    computeLayout();

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearInterval(interval);
      window.removeEventListener('resize', raf);
    };
  }, [filteredEpgData.length]);

  // Measure row height once available to improve virtualization accuracy
  useEffect(() => {
    const measure = () => {
      const anyRow = rowRefs.current.find((el) => el);
      const h = anyRow?.offsetHeight;
      if (h && h > 40 && h !== rowHeight) setRowHeight(h);
    };
    const t = setTimeout(measure, 0);
    return () => clearTimeout(t);
  }, [filteredEpgData.length, rowRefs, rowHeight]);

  // Update visible range based on scroll position
  const updateVisibleRange = useCallback(() => {
    const container = epgBodyRef.current;
    if (!container) return;
    const total = filteredEpgData.length;
    if (total === 0) {
      setVisibleStartIndex(0);
      setVisibleEndIndex(0);
      return;
    }
    const scrollTop = container.scrollTop;
    const viewport = container.clientHeight || 0;
    const estRow = Math.max(1, rowHeight);
    const start = Math.max(0, Math.floor(scrollTop / estRow) - overscan);
    const count = Math.ceil(viewport / estRow) + overscan * 2;
    const end = Math.min(total, start + count);
    if (start !== visibleStartIndex || end !== visibleEndIndex) {
      setVisibleStartIndex(start);
      setVisibleEndIndex(end);
    }
  }, [filteredEpgData.length, rowHeight, overscan, visibleStartIndex, visibleEndIndex]);

  // Attach scroll/resize listeners for virtualization
  useEffect(() => {
    const el = epgBodyRef.current;
    if (!el) return;
    const handler = () => updateVisibleRange();
    handler();
    el.addEventListener('scroll', handler, { passive: true });
    window.addEventListener('resize', handler);
    return () => {
      el.removeEventListener('scroll', handler);
      window.removeEventListener('resize', handler);
    };
  }, [epgBodyRef, updateVisibleRange]);

  // Trigger loading next EPG page when nearing the end of loaded channels
  useEffect(() => {
    const totalLoaded = filteredEpgData.length;
    if (totalLoaded === 0) return;
    const threshold = Math.max(0, totalLoaded - Math.max(5, overscan * 2));
    if (visibleEndIndex >= threshold && hasMoreEpgPages && !epgFetchingNext) {
      fetchNextEpgPage().catch(() => {});
    }
  }, [filteredEpgData.length, visibleEndIndex, overscan, hasMoreEpgPages, epgFetchingNext, fetchNextEpgPage]);

  // ---- CENTRALIZED ENSURE-VISIBLE ROUTINES ----
  const ensureChannelIndexVisible = (index) => {
    if (showExitDialog) return;
    const preferredContainer = epgBodyRef.current;
    const rowEl = rowRefs.current[index];
    const logoEl = channelRefs.current[index] || rowEl?.querySelector?.('.channel-logo');
    const targetEl = logoEl || rowEl;
    const container = (preferredContainer && isScrollable(preferredContainer))
      ? preferredContainer
      : getScrollableAncestor(targetEl || preferredContainer);

    if (!targetEl) {
      // Element not rendered yet due to virtualization: scroll to its estimated position
      const estTop = Math.max(0, Math.round(index * Math.max(1, rowHeight) - (container.clientHeight / 2)));
      scrollContainerTo(container, estTop);
      // Let virtualization render, then try again
      afterLayout(() => {
        const rEl = rowRefs.current[index];
        const lEl = channelRefs.current[index] || rEl?.querySelector?.('.channel-logo');
        const tEl = lEl || rEl;
        if (tEl) {
          scrollIntoAncestorCenterY(tEl, container);
          try { tEl.scrollIntoView?.({ block: 'center', inline: 'nearest' }); } catch {}
          tEl?.focus?.({ preventScroll: true });
        }
      });
      return;
    }

    afterLayout(() => {
      scrollIntoAncestorCenterY(targetEl, container);
      try { targetEl.scrollIntoView?.({ block: 'center', inline: 'nearest' }); } catch {}
      targetEl?.focus?.({ preventScroll: true });
    });
  };

  const ensureProgramCellVisible = (cIndex, pIndex) => {
    if (showExitDialog) return;
    const cellEl = programRefs.current[cIndex]?.[pIndex];
    const preferredContainer = epgBodyRef.current;
    if (!cellEl) {
      // Scroll vertically to bring the row into view so the cell renders
      const container = (preferredContainer && isScrollable(preferredContainer))
        ? preferredContainer
        : getScrollableAncestor(preferredContainer);
      const estTop = Math.max(0, Math.round(cIndex * Math.max(1, rowHeight) - (container.clientHeight / 2)));
      scrollContainerTo(container, estTop);
      afterLayout(() => {
        const newCell = programRefs.current[cIndex]?.[pIndex];
        if (!newCell) return;
        const programRow = newCell.closest('.program-row');
        if (programRow) {
          const rowRect = programRow.getBoundingClientRect();
          const cellRect = newCell.getBoundingClientRect();
          const leftWithin = (cellRect.left - rowRect.left) + programRow.scrollLeft;
          const targetLeft = Math.max(0, Math.round(leftWithin - (programRow.clientWidth - cellRect.width) / 2));
          if (typeof programRow.scrollTo === 'function') {
            programRow.scrollTo({ left: targetLeft, behavior: 'auto' });
          } else {
            programRow.scrollLeft = targetLeft;
          }
        }
        newCell.focus({ preventScroll: true });
      });
      return;
    }
    const rowEl = rowRefs.current[cIndex] || cellEl.closest('.epg-channel-row');
    const container = (preferredContainer && isScrollable(preferredContainer))
      ? preferredContainer
      : getScrollableAncestor(rowEl || cellEl);

    afterLayout(() => {
      // 1) ensure the row is centered vertically
      scrollIntoAncestorCenterY(rowEl || cellEl, container);

      // 2) center the program cell horizontally in its own row scroller
      const programRow = cellEl.closest('.program-row');
      if (programRow) {
        const rowRect = programRow.getBoundingClientRect();
        const cellRect = cellEl.getBoundingClientRect();
        const leftWithin = (cellRect.left - rowRect.left) + programRow.scrollLeft;
        const targetLeft = Math.max(0, Math.round(leftWithin - (programRow.clientWidth - cellRect.width) / 2));
        if (typeof programRow.scrollTo === 'function') {
          programRow.scrollTo({ left: targetLeft, behavior: 'auto' });
        } else {
          programRow.scrollLeft = targetLeft;
        }
      }
      cellEl.focus({ preventScroll: true });
    });
  };

  // React to focus state changes (DPAD-driven)
  useLayoutEffect(() => {
    if (showExitDialog) return;
    if (focusType === 'genre' && focusedGenreIndex >= 0) {
      const el = genreRefs.current[focusedGenreIndex];
      el?.scrollIntoView({ block: 'center', inline: 'center' });
      el?.focus({ preventScroll: true });
    } else if (focusType === 'language' && focusedLanguageIndex >= 0) {
      const el = languageRefs.current[focusedLanguageIndex];
      el?.scrollIntoView({ block: 'center', inline: 'center' });
      el?.focus({ preventScroll: true });
    } else if (focusType === 'channel' && focusedChannelIndex >= 0) {
      ensureChannelIndexVisible(focusedChannelIndex);
    } else if (focusType === 'program' && focusedChannelIndex >= 0 && focusedProgramIndex >= 0) {
      ensureProgramCellVisible(focusedChannelIndex, focusedProgramIndex);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusType, focusedGenreIndex, focusedLanguageIndex, focusedChannelIndex, focusedProgramIndex, showExitDialog]);

  // Apply filters when focusing on a category (genre) item
  useEffect(() => {
    if (focusType === 'genre' && focusedGenreIndex >= 0 && availableGenres[focusedGenreIndex]) {
      const category = availableGenres[focusedGenreIndex];
      const languageName = availableLanguages[selectedLanguageIndex] || 'All';
      setSelectedCategory(focusedGenreIndex);
      applyFilters(category, languageName);
    }
  }, [focusType, focusedGenreIndex, availableGenres, availableLanguages, selectedLanguageIndex, applyFilters]);

  // Apply filters when focusing on a language item
  useEffect(() => {
    if (focusType === 'language' && focusedLanguageIndex >= 0 && availableLanguages[focusedLanguageIndex]) {
      const language = availableLanguages[focusedLanguageIndex];
      const categoryName = availableGenres[selectedCategory] || 'All';
      setSelectedLanguageIndex(focusedLanguageIndex);
      applyFilters(categoryName, language);
    }
  }, [focusType, focusedLanguageIndex, availableLanguages, availableGenres, selectedCategory, applyFilters]);

  // Ensure "All" selected on first load
  useEffect(() => {
    if (availableGenres.length > 0 && selectedCategory < 0) {
      setSelectedCategory(0);
    }
  }, [availableGenres, selectedCategory]);

  // Init focus to first channel (but do not override restored state from Player)
  useEffect(() => {
    if (showExitDialog) return;
    // If we just restored a persisted selection (coming back from Player),
    // keep that focus instead of jumping to the first channel.
    if (restoredFromPersistRef.current) return;

    if (!isSidebarFocused && filteredEpgData.length > 0) {
      if (focusType === 'none' || focusedChannelIndex < 0) {
        setFocusType('channel');
        setFocusedChannelIndex(0);
        ensureChannelIndexVisible(0);
      }
    }
  }, [filteredEpgData, isSidebarFocused, showExitDialog, focusType, focusedChannelIndex]);

  // Sidebar focus
  useEffect(() => {
    const handleFocusIn = (e) => {
      const isSidebarElement = e.target.closest('.sidebar');
      const isLiveElement = e.target.closest('.live-container');
      if (isSidebarElement) {
        setIsSidebarFocused(true);
      } else if (isLiveElement) {
        setIsSidebarFocused(false);
        // Whenever focus returns to the Live/EPG container, make sure
        // the sidebar is collapsed so we don't see it visually open
        // while navigating the grid.
        try {
          document.dispatchEvent(new CustomEvent('sidebar-collapse'));
        } catch {}
      }
    };
    document.addEventListener('focusin', handleFocusIn);
    const openExit = () => setShowExitDialog(true);
    document.addEventListener('open-exit-dialog', openExit);
    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('open-exit-dialog', openExit);
    };
  }, []);

  // Global BACK key safety-net while on Live/EPG
  // Ensures hardware BrowserBack / keyCode 461 never leaves us on a blank screen
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      try {
        // If a global force-push overlay is active, completely block BACK here as well
        try {
          if (typeof window !== 'undefined' && window.__CAASTV_FORCE_PUSH_ACTIVE) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
        } catch {}

        // If exit dialog is open, do not override its own key handling
        if (showExitDialog) return;

        const isBackKey =
          e.key === 'Backspace' ||
          e.key === 'Escape' ||
          e.key === 'Back' ||
          e.key === 'GoBack' ||
          e.key === 'BrowserBack' ||
          e.keyCode === 461 || e.which === 461 ||   // LG webOS
          e.keyCode === 8   || e.which === 8   ||   // Backspace-as-back
          e.keyCode === 10009 || e.which === 10009; // Samsung Tizen

        if (!isBackKey) return;

        try {
          // eslint-disable-next-line no-console
          console.log('[Live][GlobalBack]', {
            key: e.key,
            keyCode: e.keyCode,
            which: e.which,
            isSidebarFocused,
            showExitDialog,
            activeElement: document.activeElement && document.activeElement.className,
          });
        } catch {}

        // If the event started inside the sidebar, let the sidebar own BACK
        // so it can open the global exit dialog. For all other places
        // (including the Live/EPG container), this global handler will
        // implement the standard "first BACK → sidebar, second BACK → exit".
        const startedInSidebar = !!e.target?.closest?.('.sidebar');
        if (startedInSidebar) return;

        // Only intercept "global" back presses (e.g., when focus is on body/document)
        try {
          e.preventDefault();
          e.stopPropagation();
        } catch {}

        if (!isSidebarFocused) {
          // First BACK from global context → move focus to sidebar
          focusSidebar();
        } else {
          // If sidebar is already focused, show exit dialog instead of letting
          // the browser navigate away to a blank screen.
          setShowExitDialog(true);
        }
      } catch (err) {
        try {
          // eslint-disable-next-line no-console
          console.error('[Live][GlobalBackError]', err);
        } catch {}
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleGlobalKeyDown, true);
    };
  }, [showExitDialog, isSidebarFocused, focusSidebar]);

  const handleCategoryClick = (category) => {
    const idx = availableGenres.indexOf(category);
    setSelectedCategory(idx);
    const languageName = availableLanguages[selectedLanguageIndex] || 'All';
    applyFilters(category, languageName);
    setFocusType('channel');
    setFocusedChannelIndex(0);
    ensureChannelIndexVisible(0);
  };

  const handleLanguageClick = (language) => {
    const idx = availableLanguages.indexOf(language);
    setSelectedLanguageIndex(idx >= 0 ? idx : 0);
    const categoryName = availableGenres[selectedCategory] || 'All';
    applyFilters(categoryName, language);
    setFocusType('channel');
    setFocusedChannelIndex(0);
    ensureChannelIndexVisible(0);
  };

  const handleChannelClick = (channel) => {
    // Extra safety: ignore invalid calls that can happen with very fast key presses
    if (!channel || !channel.content) {
      try {
        // eslint-disable-next-line no-console
        console.warn('[Live][handleChannelClick] Ignored invalid channel payload', channel);
      } catch {}
      return;
    }

    try {
      // eslint-disable-next-line no-console
      console.log('[Live][ChannelClick]', {
        channelId: channel?.content?.ChannelID || channel?.channelId,
        title: channel?.content?.title || channel?.displayName,
      });
    } catch {}
    const cleanChannelId = encodeURIComponent(channel.content?.ChannelID || channel.channelId);
    const cleanChannelTitle = encodeURIComponent(
      channel.content?.title || channel.displayName || 'Unknown Channel'
    );

    // Persist the current filters and selected channel so that when returning
    // from the Player screen, the Live EPG restores the same view.
    const categoryName = availableGenres[selectedCategory] || 'All';
    const languageName = availableLanguages[selectedLanguageIndex] || 'All';
    const lastChannelId = channel.content?.ChannelID || channel.channelId || null;
    saveLiveScreenState({ categoryName, languageName, lastChannelId });

    navigate(`/player?channelId=${cleanChannelId}&title=${cleanChannelTitle}`, {
      state: {
        fromScreen: 'live',
        channelList: filteredEpgData.map((item) => ({
          id: item.content?.ChannelID || item.channelId,
          name: item.content?.title || item.displayName || 'Unknown Channel',
          logo: item.content?.logoUrl || item.content?.thumbnailUrl,
          videoUrl: item.content?.videoUrl,
          bgGradient: item.content?.bgGradient,
        })),
        currentChannelId: channel.content?.ChannelID || channel.channelId,
        currentChannelTitle: channel.content?.title || channel.displayName || 'Unknown Channel',
      },
    });
  };

  // Time slots (5 x 30 min)
  const generateTimeSlots = (ts) => {
    const out = [];
    const now = new Date(ts);
    const m = now.getMinutes();
    now.setMinutes(m < 30 ? 0 : 30, 0, 0);
    for (let i = 0; i < 5; i++) {
      out.push(
        now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
      );
      now.setMinutes(now.getMinutes() + 30);
    }
    return out;
  };

  const timeSlots = React.useMemo(() => {
    try {
      return generateTimeSlots(currentTime.getTime());
    } catch {
      return ['12:00 AM', '12:30 AM', '1:00 AM', '1:30 AM', '2:00 AM'];
    }
  }, [currentTime]);

  // Build lightweight skeleton channels to avoid blocking UI on initial load
  const showSkeleton = filteredEpgData.length === 0;
  const skeletonChannels = React.useMemo(() => {
    if (!showSkeleton) return [];
    const count = 14; // show ~14 placeholder rows
    return Array.from({ length: count }).map((_, i) => ({ _id: `skeleton-${i}`, content: {} }));
  }, [showSkeleton]);

  return (
    <div
      className="live-container"
      tabIndex={showExitDialog ? -1 : (isSidebarFocused ? -1 : 0)}
      aria-hidden={showExitDialog ? true : false}
      onKeyDown={handleKeyDown}
      data-navigation-container="true"
      ref={containerRef}
    >
      <div className="epg-screen">
        <div className="epg-content">
          {/* Category Menu */}
          <CategoryMenu
            genres={availableGenres}
            selectedIndex={selectedCategory}
            focusedIndex={focusedGenreIndex}
            focusType={focusType}
            onCategoryClick={handleCategoryClick}
            genreRefs={genreRefs}
            setFocusType={setFocusType}
            setFocusedGenreIndex={setFocusedGenreIndex}
            setSelectedCategory={setSelectedCategory}
          />

          {/* Language Menu */}
          {availableLanguages.length > 0 && (
            <LanguageMenu
              languages={availableLanguages}
              selectedIndex={selectedLanguageIndex}
              focusedIndex={focusedLanguageIndex}
              focusType={focusType}
              onLanguageClick={handleLanguageClick}
              languageRefs={languageRefs}
              setFocusType={setFocusType}
              setFocusedLanguageIndex={setFocusedLanguageIndex}
            />
          )}

          {/* EPG Content */}
          <EPGContent
            channels={showSkeleton ? skeletonChannels : filteredEpgData}
            currentTime={currentTime}
            timeSlots={timeSlots}
            focusedChannelIndex={focusedChannelIndex}
            focusedProgramIndex={focusedProgramIndex}
            focusType={focusType}
            onChannelClick={handleChannelClick}
            channelRefs={channelRefs}
            programRefs={programRefs}
            rowRefs={rowRefs}
            calculateProgramWidth={calculateProgramWidth}
            getProgramsForWindow={getProgramsForWindow}
            leftPanelRef={leftPanelRef}
            timeHeaderRef={timeHeaderRef}
            timeSlotsRef={timeSlotsRef}
            epgBodyRef={epgBodyRef}
            indicatorLeft={layout.indicatorLeft}
            bodyHeight={layout.bodyHeight}
            visibleStartIndex={visibleStartIndex}
            visibleEndIndex={visibleEndIndex}
            rowHeight={rowHeight}
          />
        </div>
      </div>
      <CommonDialog
        showDialog={showExitDialog}
        title="Exit App"
        message={"Are you sure you want to exit the app?"}
        errorCode={null}
        errorMessage={null}
        isErrorAdded={true}
        iconSrc={exitIcon}
        borderColor="transparent"
        confirmButtonText="Yes"
        onConfirm={() => {
          setShowExitDialog(false);
          try { window.open('', '_self'); window.close(); } catch {}
          try { navigate('/', { replace: true }); } catch {}
        }}
        dismissButtonText="No"
        onDismiss={() => { setShowExitDialog(false); focusSidebar(); }}
      />
    </div>
  );
}

// CategoryMenu
function CategoryMenu({
  genres,
  selectedIndex,
  focusedIndex,
  focusType,
  onCategoryClick,
  genreRefs,
  setFocusType,
  setFocusedGenreIndex,
  setSelectedCategory,
}) {
  return (
    <div className="category-menu">
      <div className="category-menu-container">
        {genres.map((genre, index) => (
          <button
            key={genre}
            className={`category-item ${selectedIndex === index ? 'selected' : ''} ${focusedIndex === index && focusType === 'genre' ? 'focused' : ''}`}
            onClick={() => onCategoryClick(genre)}
            onFocus={() => { 
              setFocusType('genre'); 
              setFocusedGenreIndex(index);
              // Keep the visual "selected" pill in sync when user moves focus
              if (typeof setSelectedCategory === 'function') {
                setSelectedCategory(index);
              }
            }}
            ref={(el) => (genreRefs.current[index] = el)}
            tabIndex={0}
          >
            {genre.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}

// EPGContent
function EPGContent({
  channels,
  currentTime,
  timeSlots,
  focusedChannelIndex,
  focusedProgramIndex,
  focusType,
  onChannelClick,
  channelRefs,
  programRefs,
  rowRefs,
  calculateProgramWidth,
  getProgramsForWindow,
  leftPanelRef,
  timeHeaderRef,
  timeSlotsRef,
  epgBodyRef,
  indicatorLeft,
  bodyHeight,
  visibleStartIndex,
  visibleEndIndex,
  rowHeight,
}) {
  if (channels.length === 0) {
    return (
      <div className="epg-no-channels">
        <div className="no-channels-message">No channels available</div>
      </div>
    );
  }

  const total = channels.length;
  const start = Math.max(0, Math.min(visibleStartIndex || 0, total));
  const end = Math.max(start, Math.min(visibleEndIndex || 0, total));
  const topSpacerHeight = start * Math.max(1, rowHeight || 0);
  const bottomSpacerHeight = Math.max(0, (total - end) * Math.max(1, rowHeight || 0));

  return (
    <div className="epg-content-inner">
      {/* Header */}
      <div className="epg-header">
        <div className="left-panel-header" ref={leftPanelRef}>
          <div className="time-indicator">
            <div className="time-icon">⚡</div>
            <div className="current-time">
              {currentTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
            </div>
          </div>
        </div>
        <div className="time-header" ref={timeHeaderRef}>
          <div className="time-slots" ref={timeSlotsRef}>
            {Array.isArray(timeSlots) && timeSlots.length > 0
              ? timeSlots.map((time, index) => (
                  <div key={index} className="time-slot">{time || '12:00 AM'}</div>
                ))
              : <div className="time-slot">12:00 AM</div>}
          </div>
        </div>
      </div>

      {/* Body under header */}
      <div className="epg-body">
        <div className="epg-channels" ref={epgBodyRef}>
          {/* top spacer to preserve scroll height */}
          {topSpacerHeight > 0 && (
            <div style={{ height: `${topSpacerHeight}px` }} aria-hidden="true" />
          )}
          {channels.slice(start, end).map((channel, idx) => {
            const channelIndex = start + idx;
            return (
            <div
              key={channel._id || channelIndex}
              className="epg-channel-row"
              ref={(el) => (rowRefs.current[channelIndex] = el)}
            >
              <ChannelInfo
                channel={channel}
                channelIndex={channelIndex}
                onPlayClicked={onChannelClick}
                focusRequester={channelRefs}
                isFocused={focusedChannelIndex === channelIndex && focusType === 'channel'}
                scrollContainerRef={epgBodyRef}   // pass the vertical scroll container
              />

              <div className="program-row">
                {(() => {
                  const programs = getProgramsForWindow(channel);
                  if (!programs || programs.length === 0) {
                    return (
                      <div className="program-cell no-info" style={{ width: `${Math.max(180, 300)}px` }} tabIndex={0}>
                        <div className="program-content">
                          <span className="program-title">No information available</span>
                        </div>
                      </div>
                    );
                  }
                  return programs.map((program, programIndex) => {
                    const w = calculateProgramWidth(program._start, program._stop);
                    const isFocused = focusedChannelIndex === channelIndex &&
                                      focusedProgramIndex === programIndex &&
                                      focusType === 'program';
                    return (
                      <div
                        key={programIndex}
                        className={`program-cell ${isFocused ? 'focused' : ''}`}
                        style={{ width: `${w}px` }}
                        role="button"
                        tabIndex={0}
                        ref={(el) => {
                          if (!programRefs.current[channelIndex]) programRefs.current[channelIndex] = [];
                          programRefs.current[channelIndex][programIndex] = el;
                        }}
                        onFocus={() => {
                          // Keep visible when DOM focus lands here
                          const cell = programRefs.current[channelIndex]?.[programIndex];
                          if (!cell) return;
                          const container = epgBodyRef?.current || getScrollableAncestor(cell);
                          afterLayout(() => {
                            // Vertical centering (row)
                            const rowEl = rowRefs.current[channelIndex] || cell.closest('.epg-channel-row');
                            scrollIntoAncestorCenterY(rowEl || cell, container);

                            // Horizontal centering (inside row)
                            const programRow = cell.closest('.program-row');
                            if (programRow) {
                              const rowRect = programRow.getBoundingClientRect();
                              const cellRect = cell.getBoundingClientRect();
                              const leftWithin = (cellRect.left - rowRect.left) + programRow.scrollLeft;
                              const targetLeft = Math.max(0, Math.round(leftWithin - (programRow.clientWidth - cellRect.width) / 2));
                              if (typeof programRow.scrollTo === 'function') {
                                programRow.scrollTo({ left: targetLeft, behavior: 'auto' });
                              } else {
                                programRow.scrollLeft = targetLeft;
                              }
                            }
                          });
                        }}
                      >
                        <div className="program-content">
                          <span className="program-title">{program.title || 'No Program'}</span>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
            );
          })}
          {/* bottom spacer to preserve scroll height */}
          {bottomSpacerHeight > 0 && (
            <div style={{ height: `${bottomSpacerHeight}px` }} aria-hidden="true" />
          )}
        </div>

        {/* Live indicator */}
        <div
          className="live-time-indicator"
          style={{ left: `${indicatorLeft}px`, height: `${bodyHeight}px` }}
          aria-hidden="true"
        >
          <div className="time-line"></div>
          <div className="time-indicator-dot"></div>
          {/* Top circle indicator */}
          <div className="time-indicator-top-circle">
            <div className="time-indicator-circle-stroke"></div>
            <div className="time-indicator-icon">▶</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ChannelInfo
function ChannelInfo({
  channel,
  channelIndex,
  onPlayClicked,
  focusRequester,
  isFocused,
  scrollContainerRef, // new
}) {
  const gradientStyle = getGradientStyle(channel.content?.bgGradient);

  return (
    <div className="channel-info">
      <div className="channel-number">{channel.content?.channelNo || ''}</div>
      <div
        className={`channel-logo ${isFocused ? 'focused' : ''}`}
        style={gradientStyle}
        onClick={() => onPlayClicked(channel)}
        role="button"
        tabIndex={0}
        ref={(el) => (focusRequester.current[channelIndex] = el)}
        onFocus={(e) => {
          // When the logo gets real DOM focus, ensure its row is centered and visible.
          const el = e.currentTarget;
          const container = scrollContainerRef?.current || document.scrollingElement;
          afterLayout(() => scrollIntoAncestorCenterY(el, container));
        }}
      >
        {channel.content?.thumbnailUrl ? (
          <img
            src={channel.content.thumbnailUrl}
            alt={channel.content?.title || channel.displayName || 'Channel'}
            loading="lazy"
            decoding="async"
            fetchpriority={channelIndex < 10 ? 'high' : 'auto'}
          />
        ) : (
          <div className="channel-placeholder">
            {(channel.content?.title || channel.displayName || 'C').charAt(0)}
          </div>
        )}
      </div>
    </div>
  );
}

export default Live;
