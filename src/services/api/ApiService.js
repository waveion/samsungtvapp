/**
 * ApiService - Main API Service Facade
 * Combines all domain-specific services and provides a unified interface
 * Maintains backward compatibility with existing code
 */

import ApiClient from './ApiClient';
import CmsService from './CmsService';
import DrmService from './DrmService';
import AuthService from './AuthService';
import ApiEndpoints from './ApiEndpoints';
import Constants from '../../config/constants';

class ApiService {
  constructor() {
    // Initialize core client
    this.client = new ApiClient();
    
    // Initialize domain services
    this.cms = new CmsService(this.client);
    this.drm = new DrmService(this.client);
    this.auth = new AuthService(this.client);
    
    // Store configs for backward compatibility
    this.configs = Constants.API_CONFIGS;
    this.baseURL = Constants.API_CONFIGS.cms.baseURL;
    this.defaultConfig = Constants.DEFAULT_API;
    this._cache = this.client.cache;
  }

  // ============================================
  // Backward Compatibility Methods
  // ============================================

  /**
   * Generic request method (backward compatible)
   */
  async request(endpoint, options = {}) {
    return this.client.request(endpoint, options);
  }

  /**
   * GET request
   */
  async get(endpoint, options = {}) {
    return this.client.get(endpoint, options);
  }

  /**
   * GET with caching
   */
  async getWithCache(endpoint, ttlMs = 300000, options = {}) {
    return this.client.getWithCache(endpoint, ttlMs, options);
  }

  /**
   * POST request
   */
  async post(endpoint, data, options = {}) {
    return this.client.post(endpoint, data, options);
  }

  /**
   * PUT request
   */
  async put(endpoint, data, options = {}) {
    return this.client.put(endpoint, data, options);
  }

  /**
   * DELETE request
   */
  async delete(endpoint, options = {}) {
    return this.client.delete(endpoint, options);
  }

  /**
   * Request to DRM API (backward compatible)
   */
  async requestDrm(endpoint, options = {}) {
    return this.client.request(endpoint, {
      ...options,
      baseURL: this.configs.drm.baseURL
    });
  }

  /**
   * Request to DRM License Server (backward compatible)
   */
  async requestDrmLicense(endpoint, options = {}) {
    return this.client.request(endpoint, {
      ...options,
      baseURL: this.configs.drmLicense.baseURL
    });
  }

  /**
   * Request to CMS API (backward compatible)
   */
  async requestCms(endpoint, options = {}) {
    return this.client.request(endpoint, {
      ...options,
      baseURL: this.configs.cms.baseURL
    });
  }

  // ============================================
  // Helper Methods
  // ============================================

  /**
   * Get CMS base URL
   */
  getCmsBaseUrl() {
    return this.configs.cms.baseURL;
  }

  /**
   * Get DRM base URL
   */
  getDrmBaseUrl() {
    return this.configs.drm.baseURL;
  }

  /**
   * Get DRM License URL
   */
  getDrmLicenseUrl() {
    return this.configs.drmLicense.baseURL;
  }

  /**
   * Get API key for URL
   */
  getApiKey(url) {
    return this.client.getApiKey(url);
  }

  /**
   * Clear all cache
   */
  clearCache() {
    this.client.clearCache();
  }

  /**
   * Clear specific cache entry
   */
  clearCacheEntry(endpoint) {
    this.client.clearCacheEntry(endpoint);
  }
}

// Create singleton instance
const API = new ApiService();

// Export both the instance and the class
export default API;
export { ApiService, ApiEndpoints, Constants };

