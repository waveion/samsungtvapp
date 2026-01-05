/**
 * Application Constants
 * Central configuration for all API endpoints and tokens
 * 
 * NOTE: These are evaluated at RUNTIME (not build time) to properly detect browser vs TV
 */
export const APP_VERSION = '1.0.8';
// Function to detect if running in browser (localhost) or on TV - evaluated at runtime
function isBrowser() {
  if (typeof window === 'undefined') return false;
  return window.location.hostname === 'localhost' || 
         window.location.hostname === '127.0.0.1';
}

// Static constants (never change)
const STATIC_CONSTANTS = {
  maxLimit: 10,
  CMS_HEADER_TOKEN: 'BUAA8JJkzfMI56y4BhEhU',
  DRM_HEADER_TOKEN: 'wmo3iTxhwMxm37F7Sex3v',
  enableDetailedLogging: true,
  DEFAULT_API: 'cms',
};



// Dynamic constants (evaluated at runtime based on environment)
const getDynamicConstants = () => {
  const browser = isBrowser();
  
  return {
    // API Endpoints
    CMS_BASE_URL: 'http://10.22.254.46:7443/api/', 
     // ? 'http://localhost:3001/api/'  // Proxy for browser (avoid CORS)
     // : 'http://10.22.254.46:7443/api/',  // Direct for TV
    
    DRM_LICENSE_BASE: 'https://drm.panmetroconvergence.com:4443', //browser
    //  ? 'http://localhost:3001/drm-license'
     // : 'https://drm.panmetroconvergence.com:4443',
    
    LOGIN_SMS_BASE: 'https://drm.panmetroconvergence.com:3443/', //browser
    //  ? 'http://localhost:3001/drm'
    //  : 'https://drm.panmetroconvergence.com:3443/',

    // API Configuration Object
    API_CONFIGS: {
      cms: {
        baseURL: 'http://10.22.254.46:7443/api',  // Direct for TV
        //  ? 'http://localhost:3001/api'  // Proxy for browser
        //  : 'http://10.22.254.46:7443/api',  // Direct for TV
        apiKey: 'BUAA8JJkzfMI56y4BhEhU',
        name: 'CMS API'
      },
      drm: {
        baseURL: 'https://drm.panmetroconvergence.com:3443/', //browser
    //  ? 'http://localhost:3001/drm'
    //  : 'https://drm.panmetroconvergence.com:3443/',
        apiKey: 'wmo3iTxhwMxm37F7Sex3v',
        name: 'DRM API'
      },
      drmLicense: {
        baseURL: 'https://drm.panmetroconvergence.com:4443', //browser
    //  ? 'http://localhost:3001/drm-license'
     // : 'https://drm.panmetroconvergence.com:4443',
        apiKey: 'wmo3iTxhwMxm37F7Sex3v',
        name: 'DRM License Server'
      }
    },

    // Environment
    IS_BROWSER: browser,
  };
};



// Combine static and dynamic constants
const Constants = {
  ...STATIC_CONSTANTS,
  ...getDynamicConstants()
};

export default Constants;

