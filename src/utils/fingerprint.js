// Utilities to generate fingerprint display text and parse colors/transparency

function toUint8Array(str) {
  const encoder = new TextEncoder();
  return encoder.encode(str);
}

function bytesToHex(bytes) {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Minimal BASE58 (Bitcoin alphabet) encoder for Uint8Array
// Source adapted from common JS implementations to avoid external deps
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function base58Encode(bytes) {
  try {
    if (!bytes || !bytes.length) return '';
    // Count leading zeros
    let zeros = 0;
    while (zeros < bytes.length && bytes[zeros] === 0) zeros++;

    // Convert byte array to base58 digits
    const encoded = [];
    const input = Array.from(bytes); // mutable copy
    let startAt = zeros;
    while (startAt < input.length) {
      let carry = 0;
      for (let i = startAt; i < input.length; i++) {
        const val = (input[i] & 0xff);
        const acc = (carry << 8) | val; // carry * 256 + val
        input[i] = Math.floor(acc / 58);
        carry = acc % 58;
      }
      encoded.push(BASE58_ALPHABET[carry]);
      while (startAt < input.length && input[startAt] === 0) startAt++;
    }
    // Add leading zeros
    for (let i = 0; i < zeros; i++) encoded.push(BASE58_ALPHABET[0]);
    encoded.reverse();
    return encoded.join('');
  } catch {
    return '';
  }
}

// RFC 4648 Base32 (no padding) encoder
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32Encode(bytes) {
  try {
    if (!bytes || !bytes.length) return '';
    let output = '';
    let buffer = 0;
    let bitsLeft = 0;
    for (let i = 0; i < bytes.length; i++) {
      buffer = (buffer << 8) | (bytes[i] & 0xff);
      bitsLeft += 8;
      while (bitsLeft >= 5) {
        const index = (buffer >> (bitsLeft - 5)) & 31;
        output += BASE32_ALPHABET[index];
        bitsLeft -= 5;
      }
    }
    if (bitsLeft > 0) {
      const index = (buffer << (5 - bitsLeft)) & 31;
      output += BASE32_ALPHABET[index];
    }
    return output;
  } catch {
    return '';
  }
}

function stringToHex(str) {
  return Array.from(str)
    .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
    .join('');
}

function clamp01(n) {
  if (n == null || Number.isNaN(n)) return 0.5;
  return Math.min(1, Math.max(0, n));
}

export function parseHexColorWithAlpha(hex, transparencyStr) {
  try {
    const rawT = parseFloat(String(transparencyStr ?? '0.5'));
    const normT = Number.isFinite(rawT) ? (rawT > 1 ? rawT / 100 : rawT) : 0.5;
    const alpha = 1 - clamp01(normT);
    const c = (hex || '#000000').trim();
    let r = 0, g = 0, b = 0;
    if (/^#?[0-9a-fA-F]{6}$/.test(c)) {
      const h = c.replace('#', '');
      r = parseInt(h.slice(0, 2), 16);
      g = parseInt(h.slice(2, 4), 16);
      b = parseInt(h.slice(4, 6), 16);
    } else if (/^#?[0-9a-fA-F]{3}$/.test(c)) {
      const h = c.replace('#', '');
      r = parseInt(h[0] + h[0], 16);
      g = parseInt(h[1] + h[1], 16);
      b = parseInt(h[2] + h[2], 16);
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
  } catch {
    return 'rgba(0,0,0,0.5)';
  }
}

// Strict variant: if inputs are missing/invalid, return null (no fallback)
export function parseHexColorWithAlphaStrict(hex, transparencyStr) {
  try {
    if (hex == null || transparencyStr == null) return null;
    const rawT = parseFloat(String(transparencyStr));
    if (!Number.isFinite(rawT)) return null;
    const normT = rawT > 1 ? rawT / 100 : rawT;
    const alpha = 1 - clamp01(normT);
    if (!Number.isFinite(alpha)) return null;
    const c = String(hex).trim();
    let r, g, b;
    if (/^#?[0-9a-fA-F]{6}$/.test(c)) {
      const h = c.replace('#', '');
      r = parseInt(h.slice(0, 2), 16);
      g = parseInt(h.slice(2, 4), 16);
      b = parseInt(h.slice(4, 6), 16);
    } else if (/^#?[0-9a-fA-F]{3}$/.test(c)) {
      const h = c.replace('#', '');
      r = parseInt(h[0] + h[0], 16);
      g = parseInt(h[1] + h[1], 16);
      b = parseInt(h[2] + h[2], 16);
    } else {
      return null;
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
  } catch {
    return null;
  }
}

function getOrCreateDeviceId() {
  try {
    if (typeof window === 'undefined') return null;
    if (typeof localStorage === 'undefined') return null;

    const KEY = 'caastv_local_fallback_id';
    const existing = localStorage.getItem(KEY);
    if (existing && typeof existing === 'string' && existing.trim().length >= 8) {
      return existing.trim();
    }

    // Generate a random, app-scoped identifier (persists per install via localStorage)
    let bytes = new Uint8Array(16);
    try {
      if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
        window.crypto.getRandomValues(bytes);
      } else {
        // Very weak fallback, but still fine as a local-only install id
        for (let i = 0; i < bytes.length; i++) {
          bytes[i] = Math.floor(Math.random() * 256);
        }
      }
    } catch {
      for (let i = 0; i < bytes.length; i++) {
        bytes[i] = Math.floor(Math.random() * 256);
      }
    }

    const id = `LOCAL-${base32Encode(bytes).slice(0, 16)}`;
    localStorage.setItem(KEY, id);
    return id;
  } catch {
    return null;
  }
}

// Very small guard: ignore obviously wrong cached values (like app id)
function isLikelyValidDeviceId(id) {
  try {
    if (!id) return false;
    const s = String(id).trim();
    if (!s) return false;
    const lower = s.toLowerCase();
    // Explicitly ignore our known app id if it was ever stored by mistake
    if (lower === 'com.panmetro.app') return false;
    // Ignore obvious environment / placeholder values from system info
    if (lower === 'web' || lower === 'webos' || lower === 'unknown' || lower === 'n/a') return false;
    // Very short strings are almost certainly not real device ids
    if (s.length < 8) return false;
    return true;
  } catch {
    return false;
  }
}

// function to retrieve LG's unique device identifier (LGUID/DUID/UDID) on webOS
function getWebOSUniqueId(timeoutMs = 10000) {
  return new Promise((resolve) => {
    try {
      if (typeof window === 'undefined') return resolve(null);
      try {
        const cached = (typeof localStorage !== 'undefined') ? localStorage.getItem('caastv_unique_id') : null;
        if (cached && isLikelyValidDeviceId(cached)) {
          // Expose cached ID on global window for legacy/global access
          try {
            if (typeof window !== 'undefined') {
              window.TVUDID = cached;
            }
          } catch {}
          return resolve(cached);
        } else if (cached) {
          try {
            console.warn('[CAASTV][LGTV] Ignoring cached unique id that looks invalid:', cached);
          } catch {}
        }
      } catch {}
      let settled = false;
      const complete = (val) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          // Expose resolved ID on global window for legacy/global access
          try {
            if (typeof window !== 'undefined') {
              window.TVUDID = val || null;
            }
          } catch {}
          resolve(val || null);
        }
      };
      const timer = setTimeout(() => complete(null), timeoutMs);
      
      // Wait for webOS library to load if not immediately available
      const waitForWebOS = (attempts = 0, maxAttempts = 20) => {
        if (window.webOS || window.webOSDev) {
          startRetrieval();
        } else if (attempts < maxAttempts) {
          setTimeout(() => waitForWebOS(attempts + 1, maxAttempts), 100);
        } else {
          // webOS not available, try anyway with what we have
          startRetrieval();
        }
      };
      
      const startRetrieval = () => {
      // 1) webOSDev.LGUDID (available on many webOS builds)
      try {
        const devApi = (window.webOSDev || (window.webOS && window.webOS.dev));
        if (devApi && typeof devApi.LGUDID === 'function') {
          devApi.LGUDID({
            onSuccess: (res) => {
              const id = res && (res.id || res.deviceId);
              if (id && isLikelyValidDeviceId(id)) {
                const s = String(id);
                try { localStorage.setItem('caastv_unique_id', s); } catch {}
                complete(s);
              } else if (id) {
              }
            },
            onFailure: () => {},
          });
        }
      } catch {}

      // 2) webOS.deviceInfo() may expose duid/udid/deviceId on some versions
      try {
        const info = (window.webOS && typeof window.webOS.deviceInfo === 'function') ? window.webOS.deviceInfo() : null;
        const cand = info && (info.lgudid || info.duid || info.udid || info.deviceId || info.id);
        if (cand && isLikelyValidDeviceId(cand)) {
          const s = String(cand);
          try { localStorage.setItem('caastv_unique_id', s); } catch {}
          complete(s);
        } else if (cand) {
        }
      } catch {}

      // 3) PalmSystem fallbacks (some webOS builds expose an id/uuid here)
      try {
        const ps = window.PalmSystem || window.webkit && window.webkit.messageHandlers && null;
        const palmId = ps && (ps.deviceId || ps.identifier || ps.uuid);
        if (palmId && isLikelyValidDeviceId(palmId)) {
          const s = String(palmId);
          try { localStorage.setItem('caastv_unique_id', s); } catch {}
          complete(s);
        } else if (palmId) {
        }
      } catch {}

      // 4) Luna services fallbacks
      try {
        if (window.webOS && window.webOS.service) {
          // com.webos.service.sm device IDs (idList may contain LGUDID/DUID)
          try {
            window.webOS.service.request('luna://com.webos.service.sm', {
              method: 'deviceid/getIDs',
              parameters: { idType: ['LGUDID'] },
              onSuccess: (res) => {
                try {
                  const list = res?.idList || res?.id_list || [];
                  if (Array.isArray(list)) {
                    const match = list.find((it) => {
                      const t = String(it?.idType || it?.type || '').toUpperCase();
                      return t.includes('LGU') || t.includes('DUID') || t.includes('UDID');
                    });
                    const id = match?.idValue || match?.id;
                    if (id && isLikelyValidDeviceId(id)) {
                      const s = String(id);
                      try { localStorage.setItem('caastv_unique_id', s); } catch {}
                      complete(s);
                    }
                  }
                } catch (e) {
                }
              },
              onFailure: (err) => {
              },
            });
          } catch (e) {
          }

          // systemproperty getSystemInfo keys that sometimes expose ids
          try {
            window.webOS.service.request('luna://com.webos.service.tv.systemproperty', {
              method: 'getSystemInfo',
              parameters: { keys: ['lgudid', 'duid', 'udid', 'deviceId'] },
              onSuccess: (res) => {
                try {
                  const cand2 = res?.lgudid || res?.duid || res?.udid || res?.deviceId;
                  if (cand2 && isLikelyValidDeviceId(cand2)) {
                    const s = String(cand2);
                    try { localStorage.setItem('caastv_unique_id', s); } catch {}
                    complete(s);
                  }
                } catch (e) {
                }
              },
              onFailure: (err) => {
              },
            });
          } catch (e) {
          }
        } else {
        }
      } catch (e) {
      }
      };
      
      // Start waiting for webOS to be available
      waitForWebOS();
    } catch {
      resolve(null);
    }
  });
}

export async function makeFingerprintText({ method, obfuscationKey, textSeed }) {
  const uniqueId = await getWebOSUniqueId().catch(() => null);
  const deviceId = uniqueId || null; // use only LG/webOS-provided id
  if (!deviceId) return '';
  const seedLabel = (textSeed || 'lguid').toLowerCase();
  const base = `${seedLabel}:${deviceId}|key:${obfuscationKey ?? '12'}`;
  const algo = String(method || 'BASE16').trim().toUpperCase();

  try {
    if (algo.includes('SHA')) {
      const data = toUint8Array(base);
      const digest = await crypto.subtle.digest('SHA-256', data);
      const hex = bytesToHex(digest);
      return hex.slice(0, 16).toUpperCase();
    }
    if (algo.includes('BASE64')) {
      if (typeof btoa === 'function') return btoa(base).slice(0, 16);
      // Node/polyfill fallback
      return Buffer.from(base, 'utf-8').toString('base64').slice(0, 16);
    }
    if (algo.includes('BASE58')) {
      const bytes = toUint8Array(base);
      const b58 = base58Encode(bytes);
      return (b58 || '').slice(0, 16);
    }
    if (algo.includes('BASE32')) {
      const bytes = toUint8Array(base);
      const b32 = base32Encode(bytes);
      return (b32 || '').slice(0, 16);
    }
    if (algo.includes('PLAIN')) {
      // Show a readable compact string, not the entire base to avoid overflow
      // Example: lguid:ABCD1234|key:12 → take prefix of device and key
      const idPart = deviceId.toString().replace(/[^A-Za-z0-9]/g, '').slice(0, 8);
      const keyPart = String(obfuscationKey ?? '12').slice(0, 4);
      return `${seedLabel}:${idPart}|k:${keyPart}`;
    }
    // Default to BASE16/HEX of the plain string
    return stringToHex(base).slice(0, 16).toUpperCase();
  } catch {
    return stringToHex(base).slice(0, 16).toUpperCase();
  }
}

// Return real webOS MAC if available, else return generated device id
export async function getDeviceIdentifier({ allowSynthetic = true } = {}) {
  try {
    const uniqueId = await getWebOSUniqueId().catch(() => null);
    // Single allowed log for unique-id resolution
    try {
      console.log('[CAASTV][LGTV] getDeviceIdentifier() got LG/webOS uniqueId:', uniqueId || null);
    } catch {}
    // Mirror the identifier onto global window for easier non-React access
    try {
      if (typeof window !== 'undefined' && uniqueId) {
        window.TVUDID = uniqueId;
      }
    } catch {}
    if (uniqueId) return uniqueId;
    if (!allowSynthetic) {
      return null;
    }
    // Fallback to locally generated, app-scoped id when LG/webOS id is not available
    const local = getOrCreateDeviceId();
    try {
      if (typeof window !== 'undefined' && local) {
        window.TVUDID = local;
      }
    } catch {}
    return local;
  } catch {
    return null;
  }
}


