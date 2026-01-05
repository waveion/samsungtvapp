/**
 * API Service - Clean Architecture Implementation
 * 
 * This file provides the main API interface using clean architecture principles:
 * - ApiClient: Core HTTP client
 * - Domain Services: CmsService, DrmService, AuthService
 * - ApiEndpoints: Centralized endpoint definitions
 * - Backward compatible with existing code
 */

import API, { Constants } from './api/ApiService';

// Log environment and endpoints on initialization
console.log('[API] Environment:', Constants.IS_BROWSER ? 'Browser (via proxy)' : 'TV (direct)');
console.log('[API] CMS API:', Constants.API_CONFIGS.cms.name, Constants.API_CONFIGS.cms.baseURL);
console.log('[API] DRM API:', Constants.API_CONFIGS.drm.name, Constants.API_CONFIGS.drm.baseURL);
console.log('[API] DRM License:', Constants.API_CONFIGS.drmLicense.name, Constants.API_CONFIGS.drmLicense.baseURL);

// For backward compatibility
const API_CONFIGS = Constants.API_CONFIGS;
const DEFAULT_API = Constants.DEFAULT_API;
const API_BASE_URL = API_CONFIGS[DEFAULT_API].baseURL;
const SSE_BASE_URL = API_BASE_URL;

// Export the API instance and Constants
export default API;
export { Constants }; 

// ---- Lightweight SSE helper with headers and auto-retry ----
export function createSseConnection(path, { query = {}, headers = {}, onMessage, onError, onOpen, retryMs = 3000 } = {}) {
  const buildUrl = (extraQuery = {}) => {
    const u = new URL(`${SSE_BASE_URL}${path}`);
    Object.entries(query || {}).forEach(([k, v]) => { if (v !== undefined && v !== null) u.searchParams.set(k, String(v)); });
    Object.entries(extraQuery || {}).forEach(([k, v]) => { if (v !== undefined && v !== null) u.searchParams.set(k, String(v)); });
    return u;
  };
  let url = buildUrl();

  let controller = new AbortController();
  let isClosed = false;
  let retryTimer = null;

  const mergeHeaders = {
    'Accept': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'x-api-key': Constants.CMS_HEADER_TOKEN,
    ...headers,
  };

  // Always prefer fetch streaming so we can send auth headers.
  // EventSource cannot attach custom headers and would cause 401.
  const supportsStreams = true;

  const connectFetch = async () => {
    try {
      if (isClosed) return;
      
      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: mergeHeaders,
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        throw new Error(`SSE failed: ${res.status}`);
      }
      onOpen && onOpen();

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      while (!isClosed) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const raw = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const line = raw.split('\n').map(l => l.replace(/^data:\s?/, '')).join('\n');
          if (!line) continue;
          try {
            const data = JSON.parse(line);
            onMessage && onMessage(data);
          } catch {
            // non-JSON data; still forward as raw string
            onMessage && onMessage(line);
          }
        }
      }
    } catch (err) {
      if (isClosed) return;
      onError && onError(err);
      retryTimer = setTimeout(start, retryMs);
    }
  };

  let es = null;
  const connectEventSource = () => {
    try {
      if (isClosed) return;
      // EventSource cannot send custom headers; not used because server requires header auth.
      const u = buildUrl();
      es = new EventSource(u.toString());
      es.onopen = () => { onOpen && onOpen(); };
      es.onmessage = (e) => {
        const line = e.data;
        if (!line) return;
        try { onMessage && onMessage(JSON.parse(line)); }
        catch { onMessage && onMessage(line); }
      };
      es.onerror = (e) => {
        if (isClosed) return;
        try { es.close(); } catch {}
        onError && onError(e);
        retryTimer = setTimeout(start, retryMs);
      };
    } catch (err) {
      if (isClosed) return;
      onError && onError(err);
      retryTimer = setTimeout(start, retryMs);
    }
  };

  const start = () => {
    // Force fetch path to ensure API key is sent as a header
    connectFetch();
  };

  start();

  return {
    close() {
      isClosed = true;
      try { controller.abort(); } catch {}
      if (retryTimer) clearTimeout(retryTimer);
      try { es && es.close && es.close(); } catch {}
    }
  };
}