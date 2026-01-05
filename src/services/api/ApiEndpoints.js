/**
 * ApiEndpoints - Centralized API endpoint definitions
 * All API paths are defined here for easy maintenance and discoverability
 */

const ApiEndpoints = {
  // ============================================
  // CMS API Endpoints (Content Management)
  // ============================================
  CMS: {
    // Health & Status
    HEALTH: '/app/health',
    // manifest & Status
      // Authentication
    LOGIN: '/v1/logincheck',
    LOGOUT: '/v1/logout',
    
    // Content
    BANNERS: '/banners',
    CATEGORIES: '/homescreenCategory',
    MOVIES: '/movies',
    TV_SHOWS: '/tv-shows',
    CHANNELS: '/channels',
    
    // EPG (Electronic Program Guide)
    EPG_ALL: '/epg-files/all-publish',
    EPG_BY_ID: (id) => `/epg-files/${id}`,
    
    // Search
    SEARCH: '/search',
    
    // User Profile
    USER_PROFILE: '/user/profile',
    USER_FAVORITES: '/user/favorites',
    USER_WATCHLIST: '/user/watchlist',
    
    // Device
    DEVICE_PSEUDO_MAC: '/device/pseudo-mac',
    DEVICE_REGISTER: '/device/register',
  },

  // ============================================
  // DRM API Endpoints (Authentication & DRM)
  // ============================================
  DRM: {
    // Authentication
    LOGIN_CHECK: '/src/api/v1/logincheck',
    SMS_AUTH: '/auth/sms',
    VERIFY_OTP: '/auth/verify-otp',
    
    // Session Management
    CREATE_SESSION: '/session/create',
    VALIDATE_SESSION: '/session/validate',
    DESTROY_SESSION: '/session/destroy',
  },

  // ============================================
  // DRM License Server Endpoints
  // ============================================
  LICENSE: {
    // License Acquisition
    GET_LICENSE: '/license/get',
    VALIDATE_LICENSE: '/license/validate',
    RENEW_LICENSE: '/license/renew',
  },
};

// Freeze the endpoints to prevent modifications
Object.freeze(ApiEndpoints);
Object.freeze(ApiEndpoints.CMS);
Object.freeze(ApiEndpoints.DRM);
Object.freeze(ApiEndpoints.LICENSE);

export default ApiEndpoints;

