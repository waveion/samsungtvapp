/**
 * Samsung Tizen TV Web API Support
 * Compatible with Tizen 6.0 - 10.0
 * 
 * This file provides a unified interface for Samsung Tizen TV APIs
 * with proper error handling and fallbacks.
 */

(function(window) {
  'use strict';

  // Check if we're running on Tizen
  const isTizen = typeof window.tizen !== 'undefined';
  
  // Create namespace
  window.TizenTV = {
    /**
     * Check if running on Tizen platform
     */
    isTizen: function() {
      return isTizen;
    },

    /**
     * Get Tizen version
     */
    getVersion: function() {
      try {
        if (isTizen && window.tizen.systeminfo) {
          return window.tizen.systeminfo.getCapability('http://tizen.org/feature/platform.version');
        }
      } catch (e) {
        console.warn('TizenTV: Cannot get version', e);
      }
      return null;
    },

    /**
     * Register hardware key events (Back, Exit, etc.)
     */
    registerKeys: function(keys) {
      if (!isTizen) return;
      
      const defaultKeys = keys || [
        'MediaPlay',
        'MediaPause',
        'MediaStop',
        'MediaPlayPause',
        'MediaRewind',
        'MediaFastForward',
        '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
        'ChannelUp',
        'ChannelDown',
        'ColorF0Red',
        'ColorF1Green',
        'ColorF2Yellow',
        'ColorF3Blue'
      ];

      try {
        if (window.tizen && window.tizen.tvinputdevice) {
          const supportedKeys = window.tizen.tvinputdevice.getSupportedKeys();
          
          defaultKeys.forEach(function(keyName) {
            try {
              const keyCode = supportedKeys.find(function(k) {
                return k.name === keyName;
              });
              
              if (keyCode) {
                window.tizen.tvinputdevice.registerKey(keyName);
                console.log('TizenTV: Registered key:', keyName);
              }
            } catch (e) {
              console.warn('TizenTV: Failed to register key:', keyName, e);
            }
          });
        }
      } catch (e) {
        console.warn('TizenTV: Key registration failed', e);
      }
    },

    /**
     * Unregister hardware keys
     */
    unregisterKeys: function(keys) {
      if (!isTizen) return;
      
      try {
        if (window.tizen && window.tizen.tvinputdevice) {
          keys.forEach(function(keyName) {
            try {
              window.tizen.tvinputdevice.unregisterKey(keyName);
            } catch (e) {
              console.warn('TizenTV: Failed to unregister key:', keyName, e);
            }
          });
        }
      } catch (e) {
        console.warn('TizenTV: Key unregistration failed', e);
      }
    },

    /**
     * Exit the application
     */
    exit: function() {
      try {
        if (isTizen && window.tizen && window.tizen.application) {
          window.tizen.application.getCurrentApplication().exit();
        } else {
          // Fallback for browser testing
          window.close();
        }
      } catch (e) {
        console.warn('TizenTV: Exit failed', e);
        window.close();
      }
    },

    /**
     * Hide the application (minimize to background)
     */
    hide: function() {
      try {
        if (isTizen && window.tizen && window.tizen.application) {
          window.tizen.application.getCurrentApplication().hide();
        }
      } catch (e) {
        console.warn('TizenTV: Hide failed', e);
      }
    },

    /**
     * Get device information
     */
    getDeviceInfo: function() {
      const info = {
        platform: 'unknown',
        model: 'unknown',
        version: 'unknown',
        resolution: {
          width: window.screen.width,
          height: window.screen.height
        },
        userAgent: navigator.userAgent
      };

      if (!isTizen) {
        info.platform = 'browser';
        return info;
      }

      try {
        info.platform = 'tizen';
        
        // Get product info if available
        if (window.webapis && window.webapis.productinfo) {
          info.model = window.webapis.productinfo.getModel() || 'unknown';
          info.version = window.webapis.productinfo.getVersion() || 'unknown';
          info.firmwareVersion = window.webapis.productinfo.getFirmware() || 'unknown';
          info.duid = window.webapis.productinfo.getDuid() || 'unknown';
        }

        // Get system info
        if (window.tizen && window.tizen.systeminfo) {
          info.platformVersion = window.tizen.systeminfo.getCapability('http://tizen.org/feature/platform.version');
        }
      } catch (e) {
        console.warn('TizenTV: Failed to get device info', e);
      }

      return info;
    },

    /**
     * Get MAC address for device identification
     */
    getMacAddress: function(callback) {
      if (!isTizen) {
        callback && callback(null);
        return;
      }

      try {
        if (window.webapis && window.webapis.network) {
          window.webapis.network.getMac(function(mac) {
            callback && callback(mac);
          }, function(error) {
            console.warn('TizenTV: Failed to get MAC address', error);
            callback && callback(null);
          });
        } else {
          callback && callback(null);
        }
      } catch (e) {
        console.warn('TizenTV: MAC address retrieval failed', e);
        callback && callback(null);
      }
    },

    /**
     * Check network connectivity
     */
    checkNetwork: function(callback) {
      if (!isTizen) {
        callback && callback(navigator.onLine);
        return;
      }

      try {
        if (window.webapis && window.webapis.network) {
          window.webapis.network.isConnectedToGateway(function() {
            callback && callback(true);
          }, function() {
            callback && callback(false);
          });
        } else {
          callback && callback(navigator.onLine);
        }
      } catch (e) {
        console.warn('TizenTV: Network check failed', e);
        callback && callback(navigator.onLine);
      }
    },

    /**
     * Set volume (if supported)
     */
    setVolume: function(level) {
      if (!isTizen) return;
      
      try {
        if (window.webapis && window.webapis.tvinfo) {
          const maxVolume = window.webapis.tvinfo.getMaxVolume();
          const targetVolume = Math.min(Math.max(0, level), maxVolume);
          window.webapis.tvinfo.setVolume(targetVolume);
        }
      } catch (e) {
        console.warn('TizenTV: Set volume failed', e);
      }
    },

    /**
     * Get current volume
     */
    getVolume: function() {
      if (!isTizen) return 50;
      
      try {
        if (window.webapis && window.webapis.tvinfo) {
          return window.webapis.tvinfo.getVolume();
        }
      } catch (e) {
        console.warn('TizenTV: Get volume failed', e);
      }
      return 50;
    },

    /**
     * Register visibility change handler
     */
    onVisibilityChange: function(callback) {
      if (!isTizen) {
        document.addEventListener('visibilitychange', function() {
          callback && callback(document.visibilityState === 'visible');
        });
        return;
      }

      try {
        if (window.tizen && window.tizen.application) {
          window.tizen.application.getCurrentApplication().addEventListener('visibilitychange', function(event) {
            callback && callback(event.state === 'visible');
          });
        }
      } catch (e) {
        console.warn('TizenTV: Visibility change handler failed', e);
      }
    },

    /**
     * Get supported DRM systems
     */
    getSupportedDRM: function() {
      const drm = {
        widevine: false,
        playready: false
      };

      try {
        // Check for Widevine
        if (window.MediaKeys || window.WebKitMediaKeys) {
          drm.widevine = true;
        }
        
        // Tizen typically supports Widevine and PlayReady
        if (isTizen) {
          drm.widevine = true;
          drm.playready = true;
        }
      } catch (e) {
        console.warn('TizenTV: DRM check failed', e);
      }

      return drm;
    },

    /**
     * Prevent screensaver/sleep
     */
    preventScreensaver: function() {
      if (!isTizen) return;
      
      try {
        if (window.tizen && window.tizen.power) {
          window.tizen.power.request('SCREEN', 'SCREEN_NORMAL');
        }
      } catch (e) {
        console.warn('TizenTV: Prevent screensaver failed', e);
      }
    },

    /**
     * Release screensaver prevention
     */
    releaseScreensaver: function() {
      if (!isTizen) return;
      
      try {
        if (window.tizen && window.tizen.power) {
          window.tizen.power.release('SCREEN');
        }
      } catch (e) {
        console.warn('TizenTV: Release screensaver failed', e);
      }
    }
  };

  // Auto-initialize on Tizen
  if (isTizen) {
    console.log('TizenTV: Platform detected, version:', window.TizenTV.getVersion());
    
    // Register default keys on load
    window.addEventListener('load', function() {
      window.TizenTV.registerKeys();
      console.log('TizenTV: Keys registered');
    });

    // Handle back button
    document.addEventListener('keydown', function(e) {
      if (e.keyCode === 10009 || e.key === 'Back') {
        const event = new CustomEvent('tizen-back-button', { bubbles: true });
        document.dispatchEvent(event);
      }
    });
  }

})(window);

