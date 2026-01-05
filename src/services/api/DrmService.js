/**
 * DrmService - Digital Rights Management API Service
 * Handles DRM-related API calls (authentication, sessions, licenses)
 */

import ApiEndpoints from './ApiEndpoints';
import Constants from '../../config/constants';

class DrmService {
  constructor(apiClient) {
    this.client = apiClient;
    this.drmBaseURL = Constants.API_CONFIGS.drm.baseURL;
    this.licenseBaseURL = Constants.API_CONFIGS.drmLicense.baseURL;
  }

  /**
   * Login check via DRM API
   */
  async loginCheck(credentials) {
    return this.client.post(ApiEndpoints.DRM.LOGIN_CHECK, credentials, {
      baseURL: this.drmBaseURL
    });
  }

  /**
   * SMS authentication
   */
  async smsAuth(phoneNumber) {
    return this.client.post(ApiEndpoints.DRM.SMS_AUTH, { phoneNumber }, {
      baseURL: this.drmBaseURL
    });
  }

  /**
   * Verify OTP
   */
  async verifyOtp(phoneNumber, otp) {
    return this.client.post(ApiEndpoints.DRM.VERIFY_OTP, { phoneNumber, otp }, {
      baseURL: this.drmBaseURL
    });
  }

  /**
   * Create session
   */
  async createSession(deviceId) {
    return this.client.post(ApiEndpoints.DRM.CREATE_SESSION, { deviceId }, {
      baseURL: this.drmBaseURL
    });
  }

  /**
   * Validate session
   */
  async validateSession(sessionId) {
    return this.client.post(ApiEndpoints.DRM.VALIDATE_SESSION, { sessionId }, {
      baseURL: this.drmBaseURL
    });
  }

  /**
   * Destroy session
   */
  async destroySession(sessionId) {
    return this.client.post(ApiEndpoints.DRM.DESTROY_SESSION, { sessionId }, {
      baseURL: this.drmBaseURL
    });
  }

  /**
   * Get DRM license
   */
  async getLicense(contentId, userId) {
    return this.client.post(ApiEndpoints.LICENSE.GET_LICENSE, { contentId, userId }, {
      baseURL: this.licenseBaseURL
    });
  }

  /**
   * Validate DRM license
   */
  async validateLicense(licenseId) {
    return this.client.post(ApiEndpoints.LICENSE.VALIDATE_LICENSE, { licenseId }, {
      baseURL: this.licenseBaseURL
    });
  }

  /**
   * Renew DRM license
   */
  async renewLicense(licenseId) {
    return this.client.post(ApiEndpoints.LICENSE.RENEW_LICENSE, { licenseId }, {
      baseURL: this.licenseBaseURL
    });
  }
}

export default DrmService;

