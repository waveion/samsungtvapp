/**
 * CmsService - Content Management System API Service
 * Handles all CMS-related API calls (content, categories, EPG, etc.)
 */

import ApiEndpoints from './ApiEndpoints';
import Constants from '../../config/constants';

class CmsService {
  constructor(apiClient) {
    this.client = apiClient;
    this.baseURL = Constants.API_CONFIGS.cms.baseURL;
  }

  /**
   * Health check
   */
  async checkHealth() {
    return this.client.get(ApiEndpoints.CMS.HEALTH);
  }


  /**
   * Get manifest
   */
  async getManifest() {
    return this.client.getWithCache(ApiEndpoints.CMS.MANIFEST, 300000, {
      baseURL: this.baseURL
    });
  }

  /**
   * Get banners
   */
  async getBanners() {
    return this.client.getWithCache(ApiEndpoints.CMS.BANNERS, 300000);
  }

  /**
   * Get categories
   */
  async getCategories() {
    return this.client.getWithCache(ApiEndpoints.CMS.CATEGORIES, 300000);
  }

  /**
   * Get all movies
   */
  async getMovies() {
    return this.client.getWithCache(ApiEndpoints.CMS.MOVIES, 300000);
  }

  /**
   * Get all TV shows
   */
  async getTvShows() {
    return this.client.getWithCache(ApiEndpoints.CMS.TV_SHOWS, 300000);
  }

  /**
   * Get all channels
   */
  async getChannels() {
    return this.client.getWithCache(ApiEndpoints.CMS.CHANNELS, 300000);
  }

  /**
   * Get all EPG data
   */
  async getAllEpg() {
    return this.client.getWithCache(ApiEndpoints.CMS.EPG_ALL, 0, {
      baseURL: this.baseURL
    });
  }

  /**
   * Get EPG by ID
   */
  async getEpgById(id) {
    return this.client.get(ApiEndpoints.CMS.EPG_BY_ID(id));
  }

  /**
   * Search content
   */
  async search(query) {
    return this.client.post(ApiEndpoints.CMS.SEARCH, { query });
  }

  /**
   * Get user profile
   */
  async getUserProfile() {
    return this.client.get(ApiEndpoints.CMS.USER_PROFILE);
  }

  /**
   * Get user favorites
   */
  async getUserFavorites() {
    return this.client.get(ApiEndpoints.CMS.USER_FAVORITES);
  }

  /**
   * Get user watchlist
   */
  async getUserWatchlist() {
    return this.client.get(ApiEndpoints.CMS.USER_WATCHLIST);
  }

  /**
   * Register device pseudo MAC
   */
  async registerPseudoMac(lgudid) {
    return this.client.post(ApiEndpoints.CMS.DEVICE_PSEUDO_MAC, { lgudid });
  }

  /**
   * Register device
   */
  async registerDevice(deviceData) {
    return this.client.post(ApiEndpoints.CMS.DEVICE_REGISTER, deviceData);
  }
}

export default CmsService;

