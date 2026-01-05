// DRM entitlements helpers: login handled elsewhere.
// Fetch user packages and channels and persist for app usage.
const IS_HTTP_CONTEXT = (typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin.startsWith('http'));
const DRM_BASE = IS_HTTP_CONTEXT
  ? '/drm/panmetro'
  : 'https://drm.panmetroconvergence.com:3443';
const DRM_API_KEY = 'wmo3iTxhwMxm37F7Sex3v';

async function drmGet(path) {
  const url = `${DRM_BASE}${path}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'X-API-KEY': DRM_API_KEY,
    },
  });
  if (!res.ok) {
    const body = await (async () => {
      try { return await res.text(); } catch { return ''; }
    })();
    throw new Error(`DRM GET ${path} failed: ${res.status} ${body || ''}`);
  }
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await res.json() : JSON.parse(await res.text());
  return data;
}

export async function fetchCustomerServices(customerNumber, { page = 1, limit = 20 } = {}) {
  if (!customerNumber) throw new Error('customerNumber required');
  const data = await drmGet(`/src/api/v1/customer-services/${encodeURIComponent(customerNumber)}?page=${page}&limit=${limit}`);
  try {
    const count = Array.isArray(data?.results) ? data.results.length : 0;
    void count;
  } catch {}
  return data;
}

export async function fetchServiceLiveChannels(serviceId, { page = 1, limit = 1000 } = {}) {
  if (!serviceId) throw new Error('serviceId required');
  const data = await drmGet(`/src/api/v1/services-assets/livechannels/${encodeURIComponent(serviceId)}?page=${page}&limit=${limit}`);
  try {
    const count = Array.isArray(data?.results) ? data.results.length : 0;
    void count;
  } catch {}
  return data;
}

// Backward-compatible reader for stored entitlements (supports old array or new structured map)
function readStoredEntitlements() {
  try {
    const raw = sessionStorage.getItem('userPkgChannels') || localStorage.getItem('userPkgChannels');
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch { return {}; }
}

// Normalize a single package entry to { assetIds: string[], contentIds: string[] }
function normalizePkgEntry(entry) {
  if (!entry) return { assetIds: [], contentIds: [] };
  // Old format: string[] of asset-ids
  if (Array.isArray(entry)) return { assetIds: entry.map(String), contentIds: [] };
  // New format
  const assetIds = Array.isArray(entry.assetIds) ? entry.assetIds.map(String) : [];
  const contentIds = Array.isArray(entry.contentIds) ? entry.contentIds.map(String) : [];
  return { assetIds, contentIds };
}

export function isAssetPlayableViaDRM({ assetId = '', contentId = '' } = {}) {
  const map = readStoredEntitlements();
  if (!map || typeof map !== 'object') return false;
  const a = String(assetId || '').trim();
  const c = String(contentId || '').trim();
  if (!a && !c) return false;

  for (const key of Object.keys(map)) {
    const entry = normalizePkgEntry(map[key]);
    if (a && entry.assetIds.includes(a)) return true;
    if (c && entry.contentIds.includes(c)) return true;
  }
  return false;
}

export async function ensureEntitlementsForUser({ customerNumber } = {}) {
  try {
    const existing = readStoredEntitlements();
    if (existing && Object.keys(existing).length > 0) return existing;
  } catch {}
  if (!customerNumber) {
    try {
      const rawUser = sessionStorage.getItem('user') || localStorage.getItem('user');
      if (rawUser) {
        const parsed = JSON.parse(rawUser);
        customerNumber = parsed?.data?.customerNumber || parsed?.customerNumber || '';
      }
    } catch {}
  }
  if (!customerNumber) return {};
  const refreshed = await refreshUserPackagesAndChannels({ customerNumber });
  return refreshed?.channelsByPkg || {};
}

function isServiceActive(item) {
  const endDateStr = item?.['end-date'] || item?.['expire-date'] || item?.expireDate || item?.endDate;
  if (!endDateStr) return true;
  const end = new Date(endDateStr + 'T23:59:59Z');
  return isFinite(end.getTime()) ? end.getTime() >= Date.now() : true;
}

export async function refreshUserPackagesAndChannels({ customerNumber } = {}) {
  if (!customerNumber) return { pkgIds: [], channelsByPkg: {} };
  const services = await fetchCustomerServices(customerNumber);
  const results = Array.isArray(services?.results) ? services.results : [];
  const activeServiceIds = results
    .filter(isServiceActive)
    .map(x => String(x?.['service-id'] ?? x?.serviceId ?? ''))
    .filter(Boolean);
  try { console.log('[DRM] Active serviceIds', activeServiceIds); } catch {}

  const channelsByPkg = {};
  for (const sid of activeServiceIds) {
    try {
      const ch = await fetchServiceLiveChannels(sid);
      const items = Array.isArray(ch?.results) ? ch.results : [];
      const assetIds = items
        .map(x => String(x?.['asset-id'] ?? x?.assetId ?? ''))
        .filter(Boolean);
      const contentIds = items
        .map(x => String(x?.['content-id'] ?? x?.contentId ?? ''))
        .filter(Boolean);
      channelsByPkg[sid] = { assetIds, contentIds };
    } catch (e) {
      void e;
    }
  }

  try { sessionStorage.setItem('userPkgIds', JSON.stringify(activeServiceIds)); } catch {}
  try { localStorage.setItem('userPkgIds', JSON.stringify(activeServiceIds)); } catch {}
  try { sessionStorage.setItem('userPkgChannels', JSON.stringify(channelsByPkg)); } catch {}
  try { localStorage.setItem('userPkgChannels', JSON.stringify(channelsByPkg)); } catch {}

  return { pkgIds: activeServiceIds, channelsByPkg };
}


