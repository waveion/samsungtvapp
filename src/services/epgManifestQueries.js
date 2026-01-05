import { useQuery, useInfiniteQuery, QueryClient } from '@tanstack/react-query';
import API from './api';
import { showToast } from '../utils/logout';
import Constants from '../config/constants';

// ---- Centralized fetchers and parsers ----

// Small helpers for robust normalization
const pickFirst = (obj, keys, fallback = undefined) => {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null) return v;
  }
  return fallback;
};

const toStringSafe = (v, fallback = '') => {
  if (v === null || v === undefined) return fallback;
  try { return String(v); } catch { return fallback; }
};

const toNumberSafe = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const toBooleanSafe = (v, fallback = false) => {
  if (typeof v === 'boolean') return v;
  if (v === 'true' || v === '1' || v === 1) return true;
  if (v === 'false' || v === '0' || v === 0) return false;
  return fallback;
};

const ensureArray = (v) => Array.isArray(v) ? v : (v !== undefined && v !== null ? [v] : []);

const toNameObj = (v) => {
  if (!v) return null;
  if (typeof v === 'string') return { name: v };
  const name = v.name || v.Name || v.title || v.Title || v.language || v.Language;
  return name ? { name: toStringSafe(name) } : null;
};

const pickArray = (obj, keys) => {
  for (const k of keys) {
    const val = obj?.[k];
    if (Array.isArray(val)) return val;
  }
  return [];
};

function normalizeEpgItem(raw) {
  if (!raw || typeof raw !== 'object') return raw;

  // Normalize genre and language
  const genreRaw = pickArray(raw, ['genre', 'genres', 'Genre', 'Genres']);
  const genre = genreRaw.map(toNameObj).filter(Boolean);
  const language = toNameObj(pickFirst(raw, ['language', 'Language'], null)) || null;

  // Normalize DRM/license
  const drmTypeRaw = pickFirst(raw, ['DRM', 'drmType', 'DRMType'], 'none');
  const drmType = toStringSafe(drmTypeRaw).toLowerCase() || 'none';
  const licenseUrl = toStringSafe(pickFirst(raw, ['licenseUrl', 'LicenseUrl', 'licenseURL'], ''));

  // Normalize programmes (flatten typical EPG fields)
  const programmeList = (() => {
    const arr = pickArray(raw, ['programme', 'programmes', 'programs']);
    const tvArr = pickArray(raw?.tv || {}, ['programme', 'programmes', 'programs']);
    const combined = Array.isArray(arr) && arr.length > 0 ? arr : tvArr;
    return (combined || []).map((p) => ({
      title: toStringSafe(p?.title || p?.Title || p?.name || p?.Name || ''),
      desc: toStringSafe(p?.desc || p?.Desc || p?.description || ''),
      _start: toStringSafe(p?._start || p?.start || ''),
      _stop: toStringSafe(p?._stop || p?.stop || ''),
      category: toStringSafe(p?.category || ''),
    }));
  })();

  const content = {
    _id: raw._id,
    ChannelID: raw.ChannelID || raw.channelId || raw.id || '',
    title: raw.title || raw.name || raw.displayName || '',
    description: raw.description || '',
    contentType: raw.contentType || 'live',
    streamType: raw.streamType || '',
    drmType,
    licenseUrl,
    assetId: raw.assetId || raw.AssetId || raw.keyId || raw.KeyId || '',
    genre,
    videoUrl: raw.videoUrl || raw.streamUrl || raw.url || '',
    language,
    thumbnailUrl: raw.thumbnailUrl || raw.logo || raw.logoUrl || '',
    logoUrl: raw.logoUrl || raw.logo || raw.thumbnailUrl || '',
    published: Boolean(raw.published),
    channelNo: raw.channelNo || raw.channelNumber || '',
    bgGradient: raw.bgGradient || null,
    tv: raw.tv || null,
    programme: programmeList,
    // Extra metadata (kept lightweight)
    country: toStringSafe(pickFirst(raw, ['country', 'Country'], '')),
    region: toStringSafe(pickFirst(raw, ['region', 'Region'], '')),
    tags: ensureArray(pickFirst(raw, ['tags', 'Tags'], [])).map(toStringSafe),
    bouquet: toStringSafe(pickFirst(raw, ['bouquet', 'Bouquet'], '')),
  };
  return {
    _id: raw._id,
    content,
    // convenient fallbacks used across UI
    channelId: content.ChannelID,
    displayName: content.title,
  };
}

function normalizeManifest(raw) {
  const genreRaw = pickArray(raw, ['genre', 'genres', 'Genre', 'Genres']);
  const languageRaw = pickArray(raw, ['language', 'languages', 'Language', 'Languages']);

  const genre = genreRaw.map(toNameObj).filter(Boolean);
  const language = languageRaw.map(toNameObj).filter(Boolean);

  // Contact
  const contactRaw = pickFirst(raw, ['contact', 'Contact'], {});
  const contact = {
    version: toNumberSafe(contactRaw?.__v ?? contactRaw?.version, 0),
    _id: toStringSafe(contactRaw?._id, null),
    address: toStringSafe(contactRaw?.address, null),
    email: toStringSafe(contactRaw?.email, null),
    phone: toStringSafe(contactRaw?.phone, null),
    website: toStringSafe(contactRaw?.website, null),
  };

  // Landing channel
  const landingRaw = pickFirst(raw, ['landingChannel', 'LandingChannel'], {});
  const landingChannel = {
    _id: toStringSafe(landingRaw?._id, null),
    title: toStringSafe(landingRaw?.title, null),
    channelId: toStringSafe(landingRaw?.channelId || landingRaw?.ChannelID, null),
    videoUrl: toStringSafe(landingRaw?.videoUrl, null),
    createdAt: toStringSafe(landingRaw?.createdAt, null),
    updatedAt: toStringSafe(landingRaw?.updatedAt, null),
    version: toNumberSafe(landingRaw?.__v ?? landingRaw?.version, 0),
  };

  // Style/navigation
  const styleNavRaw = pickFirst(raw, ['styleNavigation', 'StyleNavigation'], {});
  const styleNavigation = {
    fontName: toStringSafe(styleNavRaw?.fontName || styleNavRaw, ''),
  };

  // Components
  const normalizeComponent = (c) => ({
    _id: toStringSafe(c?._id, ''),
    isVisible: toBooleanSafe(c?.isVisible, true),
    name: toStringSafe(c?.name, ''),
  });

  // Categories (EPGCategory)
  const normalizeCategory = (c) => ({
    _id: toStringSafe(c?._id, ''),
    name: toStringSafe(c?.name, ''),
    published: toBooleanSafe(c?.published, false),
    version: toNumberSafe(c?.__v ?? c?.version, 0),
    iconUrl: (() => {
      const list = ensureArray(c?.iconUrl).map(toStringSafe).filter(Boolean);
      const single = toStringSafe(c?.iconUrl, '');
      return list.length > 0 ? list : (single ? [single] : []);
    })(),
    defaultIcon: toStringSafe(c?.defaultIcon, null),
    customIconUrl: toStringSafe(c?.customIconUrl || c?.CustomIconUrl, null),
  });

  // Tabs
  const tabsRaw = pickArray(raw, ['tab', 'tabs', 'Tab', 'Tabs']);
  const tab = tabsRaw.map((t) => ({
    version: toNumberSafe(t?.__v ?? t?.version, 0),
    _id: toStringSafe(t?._id, ''),
    components: ensureArray(t?.components).map(normalizeComponent),
    displayName: toStringSafe(t?.displayName || t?.name, ''),
    iconUrl: toStringSafe(t?.iconUrl, ''),
    isVisible: toBooleanSafe(t?.isVisible, true),
    name: toStringSafe(t?.name, ''),
    sequence: toNumberSafe(t?.sequence, 0),
    categories: ensureArray(t?.categories).map(normalizeCategory),
  }));

  // Root manifest fields
  const manifest = {
    appName: toStringSafe(pickFirst(raw, ['appName', 'AppName'], 'WaveTVApp')),
    logo: toStringSafe(pickFirst(raw, ['logo', 'Logo'], '')),
    splashUrl: toStringSafe(pickFirst(raw, ['splashUrl', 'SplashUrl', 'splashURL'], '')),
    baseUrl: toStringSafe(pickFirst(raw, ['baseUrl', 'BaseUrl', 'BaseURL'], '')),
    styleNavigation,
    tab,
    contact,
    landingChannel,
    language,
    genre,
  };

  return manifest;
}

async function fetchEpgRaw() {
  try {
    const endpoint = '/epg-files/all-publish';
    const baseURL = Constants.API_CONFIGS.cms.baseURL;
    const fullURL = 'http://10.22.254.46:7443/api/epg-files/all-publish';//`${baseURL}${endpoint}`;
    const environment = Constants.IS_BROWSER ? 'Browser (via proxy)' : 'TV (direct)';
    
    console.log('[EPG] ========== FETCHING EPG DATA ==========');
    console.log('[EPG] Environment:', environment);
    console.log('[EPG] Base URL:', baseURL);
    console.log('[EPG] Endpoint:', endpoint);
    console.log('[EPG] Full URL:', fullURL);
    console.log('[EPG] Calling API.cms.getAllEpg()...');
    
    // Show environment info on TV
    try {
      showToast(`[EPG] Fetching from ${fullURL}`);
    } catch {}
    
    const data = await API.cms.getAllEpg();
    
    console.log('[EPG] Raw response type:', typeof data);
    console.log('[EPG] Is Array?:', Array.isArray(data));
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      console.log('[EPG] Response keys:', Object.keys(data));
      console.log('[EPG] First 200 chars:', JSON.stringify(data).substring(0, 200));
    }
    console.log('[EPG] Full response:', data);

    // Show toast on TV for debugging
    try {
      if (Array.isArray(data)) {
        showToast(`[EPG] Received array with ${data.length} items`, 5000);
      } else if (data && typeof data === 'object') {
        const keys = Object.keys(data);
        showToast(`[EPG] Received object with keys: ${keys.join(', ')}`, 5000);
      } else {
        showToast(`[EPG] Received: ${typeof data}`, 5000);
      }
    } catch (toastError) {
      console.warn('[EPG] Toast failed:', toastError);
    }
    // Support both array and envelope shapes
    let items = [];
    if (Array.isArray(data)) {
      console.log('[EPG] Data is direct array');
      items = data;
    } else if (data && (Array.isArray(data.items) || Array.isArray(data.data) || Array.isArray(data.rows) || Array.isArray(data.result))) {
      console.log('[EPG] Data is wrapped in envelope');
      items = data.items || data.data || data.rows || data.result || [];
      console.log('[EPG] Extracted from key:', 
        data.items ? 'items' : 
        data.data ? 'data' : 
        data.rows ? 'rows' : 'result'
      );
    } else if (data && typeof data === 'object') {
      console.log('[EPG] Searching for arrays in object...');
      const arrayValues = Object.values(data).filter(v => Array.isArray(v));
      if (arrayValues.length > 0) {
        items = arrayValues[0];
        console.log('[EPG] Found array in object, length:', items.length);
      } else {
        console.warn('[EPG] No arrays found in response object');
        items = [];
      }
    } else {
      console.warn('[EPG] Unexpected data type or null/undefined');
      items = [];
    }

    console.log('[EPG] Parsed items count:', items.length);
    
    if (items.length > 0) {
      console.log('[EPG] Sample item:', items[0]);
    }
    
    const normalized = items.map(normalizeEpgItem).filter(Boolean);
    console.log('[EPG] Normalized items count:', normalized.length);
    
    // Cache the result
    try { 
      sessionStorage.setItem('epgCache', JSON.stringify({ t: Date.now(), data: normalized })); 
      console.log('[EPG] Cached successfully');
    } catch (cacheError) {
      console.warn('[EPG] Cache failed:', cacheError);
    }
    
    return normalized;
  } catch (error) {
    console.error('[EPG] Fetch failed:', error);
    console.error('[EPG] Error details:', {
      message: error.message,
      status: error.status,
      stack: error.stack
    });
    
    // Show error toast on TV
    try {
      showToast(`[EPG] ERROR: ${error.message}`, 8000);
    } catch {}
    
    // Try to return cached data on error
    try {
      const cached = sessionStorage.getItem('epgCache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && Array.isArray(parsed.data)) {
          console.log('[EPG] Returning cached data:', parsed.data.length, 'items');
          showToast(`[EPG] Using cached data: ${parsed.data.length} items`, 5000);
          return parsed.data;
        }
      }
    } catch {}
    
    // Return empty array instead of throwing
    console.warn('[EPG] Returning empty array due to error');
    showToast('[EPG] Returning empty array - no data!', 8000);
    return [];
  }
}

async function fetchManifestRaw() {
  try {
    const endpoint = '/manifest';
    const baseURL = Constants.API_CONFIGS.cms.baseURL;
    const fullURL = 'http://10.22.254.46:7443/api/manifest';//`${baseURL}${endpoint}`;
    const environment = Constants.IS_BROWSER ? 'Browser (via proxy)' : 'TV (direct)';
    
    console.log('[MANIFEST] ========== FETCHING MANIFEST DATA ==========');
    console.log('[MANIFEST] Environment:', environment);
    console.log('[MANIFEST] Base URL:', baseURL);
    console.log('[MANIFEST] Endpoint:', endpoint);
    console.log('[MANIFEST] Full URL:', fullURL);
    console.log('[MANIFEST] Calling API.cms.getManifest()...');
    
    // Show environment info on TV
    try {
      showToast(`[MANIFEST] Fetching from ${fullURL}`);
    } catch {}
    
    const data = await API.cms.getManifest();
    
    // Show toast on TV for debugging
    try {
      if (data && data.appName) {
        showToast(`[MANIFEST] App: ${data.appName}`, 5000);
      } else if (data && typeof data === 'object') {
        const keys = Object.keys(data);
        showToast(`[MANIFEST] Keys: ${keys.slice(0, 3).join(', ')}...`, 5000);
      } else {
        showToast(`[MANIFEST] Received: ${typeof data}`, 5000);
      }
    } catch (toastError) {
      console.warn('[MANIFEST] Toast failed:', toastError);
    }
    
    console.log('[MANIFEST] Raw response type:', typeof data);
    console.log('[MANIFEST] Is null/undefined?:', data === null || data === undefined);
    if (data && typeof data === 'object') {
      console.log('[MANIFEST] Response keys:', Object.keys(data));
      console.log('[MANIFEST] First 200 chars:', JSON.stringify(data).substring(0, 200));
    }
    console.log('[MANIFEST] Full response:', data);
    
    const normalized = normalizeManifest(data || {});
    console.log('[MANIFEST] Normalized successfully');
    console.log('[MANIFEST] Normalized keys:', Object.keys(normalized));
    
    // Cache the result
    try { 
      sessionStorage.setItem('manifestCache', JSON.stringify({ t: Date.now(), data: normalized })); 
      console.log('[MANIFEST] Cached successfully');
    } catch (cacheError) {
      console.warn('[MANIFEST] Cache failed:', cacheError);
    }
    
    return normalized;
  } catch (error) {
    console.error('[MANIFEST] Fetch failed:', error);
    console.error('[MANIFEST] Error details:', {
      message: error.message,
      status: error.status,
      stack: error.stack
    });
    
    // Show error toast on TV
    try {
      showToast(`[MANIFEST] ERROR: ${error.message}`, 8000);
    } catch {}
    
    // Try to return cached data on error
    try {
      const cached = sessionStorage.getItem('manifestCache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.data) {
          console.log('[MANIFEST] Returning cached data');
          showToast('[MANIFEST] Using cached data', 5000);
          return parsed.data;
        }
      }
    } catch {}
    
    // Return empty manifest instead of throwing
    console.warn('[MANIFEST] Returning empty manifest due to error');
    showToast('[MANIFEST] Returning empty - no data!', 8000);
    return normalizeManifest({});
  }
}

export const EPG_QUERY_KEY = ['epg'];
export const MANIFEST_QUERY_KEY = ['manifest'];

export function useEpg(options = {}) {
  return useQuery({
    queryKey: EPG_QUERY_KEY,
    queryFn: fetchEpgRaw,
    retry: 3, // Retry failed requests 3 times
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
    staleTime: 30000, // Consider data stale after 30 seconds
    // Allow per-hook overrides while keeping global defaults
    ...options,
  });
}

// Optional helper if you need to pre-warm cache during app startup
export function prefetchEpg(queryClient /**: QueryClient */) {
  return queryClient.prefetchQuery({ 
    queryKey: EPG_QUERY_KEY, 
    queryFn: fetchEpgRaw,
    retry: 2,
    staleTime: 30000
  });
}

export function useManifest(options = {}) {
  return useQuery({
    queryKey: MANIFEST_QUERY_KEY,
    queryFn: fetchManifestRaw,
    retry: 3, // Retry failed requests 3 times
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
}

export function prefetchManifest(queryClient /**: QueryClient */) {
  return queryClient.prefetchQuery({ 
    queryKey: MANIFEST_QUERY_KEY, 
    queryFn: fetchManifestRaw,
    retry: 2,
    staleTime: 5 * 60 * 1000
  });
}

// Infinite/paginated EPG loader. If the backend supports offset/limit, it will use it.
// For current backend, we fetch the full list in a single page.
export function useEpgInfinite({ pageSize = 60 } = {}, options = {}) {
  return useInfiniteQuery({
    queryKey: [...EPG_QUERY_KEY, 'infinite', pageSize],
    // Single-page loader: fetch the complete EPG list once.
    queryFn: async () => await fetchEpgRaw(),
    // No additional pages – treat the entire dataset as one page.
    getNextPageParam: () => undefined,
    retry: 3, // Retry on error
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    staleTime: 30000,
    ...options,
  });
}


