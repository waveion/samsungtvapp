/**
 * ApiClient - Core HTTP client for making API requests
 * Handles request/response logic, error handling, and headers
 */

import Constants from '../../config/constants';

class ApiClient {
  constructor(config = {}) {
    this.config = config;
    this.cache = new Map(); // key -> { data, expiry }
  }

  /**
   * Get the appropriate API key based on the URL
   */
  getApiKey(url) {
    // Check if using DRM endpoint
    if (url.includes(Constants.API_CONFIGS.drm.baseURL) || 
        url.includes(Constants.API_CONFIGS.drmLicense.baseURL) ||
        url.includes('drm.panmetroconvergence.com') ||
        url.includes(':3443') || 
        url.includes(':4443')) {
      return Constants.API_CONFIGS.drm.apiKey;
    }
    // Default to CMS API key
    return Constants.API_CONFIGS.cms.apiKey;
  }

  /**
   * Core request method - all requests go through this
   */
  async request(endpoint, options = {}) {
    // Allow override of base URL via options
    const baseURL = options.baseURL || Constants.API_CONFIGS.cms.baseURL;
    const url = `${baseURL}${endpoint}`;
    const apiKey = this.getApiKey(url);
    
    console.log('[API][REQUEST] ========== NEW REQUEST ==========');
    console.log('[API][REQUEST] Endpoint:', endpoint);
    console.log('[API][REQUEST] BaseURL from options:', options.baseURL || 'not provided');
    console.log('[API][REQUEST] BaseURL used:', baseURL);
    console.log('[API][REQUEST] Full URL:', url);
    console.log('[API][REQUEST] API Key:', apiKey.substring(0, 10) + '...');
    
    const config = {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        ...options.headers,
      },
      ...options,
    };

    // Remove baseURL from options to avoid passing it to fetch
    delete config.baseURL;

    try {
      console.log(`[API][REQUEST] Fetching: ${config.method} ${url}`);
      
      const response = await fetch(url, config);
      
      console.log(`[API][REQUEST] Response status: ${response.status} ${response.statusText}`);
      console.log(`[API][REQUEST] Response headers:`, {
        'content-type': response.headers.get('content-type'),
        'content-length': response.headers.get('content-length')
      });
      
      if (!response.ok) {
        console.error('[API][REQUEST] Response not OK, handling error...');
        return this.handleErrorResponse(response);
      }
      
      console.log('[API][REQUEST] Response OK, parsing...');
      const result = await this.handleSuccessResponse(response);
      console.log('[API][REQUEST] Parsed result type:', typeof result, 'isArray:', Array.isArray(result));
      return result;
    } catch (error) {
      console.error('[API][REQUEST] ========== REQUEST FAILED ==========');
      console.error('[API][REQUEST] URL:', url);
      console.error('[API][REQUEST] Method:', config.method);
      console.error('[API][REQUEST] Error:', error.message);
      console.error('[API][REQUEST] Stack:', error.stack);
      throw error;
    }
  }

  /**
   * Handle successful response
   */
  async handleSuccessResponse(response) {
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      if (Constants.enableDetailedLogging) {
        console.log('[API] Success:', data);
      }
      return data;
    } else {
      // Not JSON, return as text
      const text = await response.text();
      if (Constants.enableDetailedLogging) {
        console.warn('[API] Response is not JSON:', text.substring(0, 100));
      }
      return text;
    }
  }

  /**
   * Handle error response
   */
  async handleErrorResponse(response) {
    if (response.status === 401) {
      // Clear auth tokens on unauthorized
      try { 
        sessionStorage.removeItem('user'); 
        localStorage.removeItem('user');
      } catch {}
      console.warn('[API] 401 Unauthorized - cleared auth tokens');
    }
    
    let message = `HTTP error! status: ${response.status}`;
    
    try {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        if (data && (data.message || data.error)) {
          message = data.message || data.error;
        }
      } else {
        const text = await response.text();
        if (text) message = text;
      }
    } catch (parseError) {
      console.error('[API] Error parsing error response:', parseError);
    }
    
    const error = new Error(message);
    error.status = response.status;
    error.statusText = response.statusText;
    throw error;
  }

  /**
   * GET request
   */
  async get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  /**
   * GET request with caching
   */
  async getWithCache(endpoint, ttlMs = 300000, options = {}) {
    const now = Date.now();
    const baseURL = options.baseURL || Constants.API_CONFIGS.cms.baseURL;
    const key = `GET:${baseURL}${endpoint}`;
    
    console.log('[API][getWithCache] Endpoint:', endpoint);
    console.log('[API][getWithCache] BaseURL:', baseURL);
    console.log('[API][getWithCache] Full URL:', baseURL + endpoint);
    console.log('[API][getWithCache] TTL:', ttlMs);
    console.log('[API][getWithCache] Options:', options);
    
    const hit = this.cache.get(key);
    if (hit && hit.expiry > now) {
      console.log('[API] Cache hit:', key);
      return hit.data;
    }
    
    console.log('[API][getWithCache] Cache miss, fetching...');
    const data = await this.get(endpoint, options);
    console.log('[API][getWithCache] Data received, type:', typeof data, 'isArray:', Array.isArray(data));
    this.cache.set(key, { data, expiry: now + Math.max(0, ttlMs) });
    return data;
  }

  /**
   * POST request
   */
  async post(endpoint, data, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * PUT request
   */
  async put(endpoint, data, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /**
   * DELETE request
   */
  async delete(endpoint, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'DELETE',
    });
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Clear specific cache entry
   */
  clearCacheEntry(endpoint) {
    const baseURL = Constants.API_CONFIGS.cms.baseURL;
    const key = `GET:${baseURL}${endpoint}`;
    this.cache.delete(key);
  }
}

export default ApiClient;

