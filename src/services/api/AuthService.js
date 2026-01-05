/**
 * AuthService - Authentication Service
 * Handles user authentication, login, logout, and session management
 */

import ApiEndpoints from './ApiEndpoints';

class AuthService {
  constructor(apiClient) {
    this.client = apiClient;
    this.currentUser = null;
  }

  /**
   * Login with credentials
   */
  async login(username, password) {
    const response = await this.client.post(ApiEndpoints.CMS.LOGIN, {
      username,
      password
    });

    if (response && response.user) {
      this.currentUser = response.user;
      this.storeUserSession(response);
    }

    return response;
  }

  /**
   * Logout
   */
  async logout() {
    try {
      await this.client.post(ApiEndpoints.CMS.LOGOUT);
    } catch (error) {
      console.error('[Auth] Logout error:', error);
    } finally {
      this.clearUserSession();
    }
  }

  /**
   * Get current user
   */
  getCurrentUser() {
    if (this.currentUser) {
      return this.currentUser;
    }

    // Try to restore from storage
    return this.restoreUserSession();
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return this.getCurrentUser() !== null;
  }

  /**
   * Store user session in storage
   */
  storeUserSession(authData) {
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('user', JSON.stringify(authData.user));
        if (authData.token) {
          sessionStorage.setItem('token', authData.token);
        }
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('user', JSON.stringify(authData.user));
      }
    } catch (error) {
      console.error('[Auth] Error storing session:', error);
    }
  }

  /**
   * Restore user session from storage
   */
  restoreUserSession() {
    try {
      if (typeof sessionStorage !== 'undefined') {
        const userStr = sessionStorage.getItem('user');
        if (userStr) {
          this.currentUser = JSON.parse(userStr);
          return this.currentUser;
        }
      }
      if (typeof localStorage !== 'undefined') {
        const userStr = localStorage.getItem('user');
        if (userStr) {
          this.currentUser = JSON.parse(userStr);
          return this.currentUser;
        }
      }
    } catch (error) {
      console.error('[Auth] Error restoring session:', error);
    }
    return null;
  }

  /**
   * Clear user session
   */
  clearUserSession() {
    this.currentUser = null;
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem('user');
        sessionStorage.removeItem('token');
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('user');
      }
    } catch (error) {
      console.error('[Auth] Error clearing session:', error);
    }
  }

  /**
   * Get auth token
   */
  getAuthToken() {
    try {
      if (typeof sessionStorage !== 'undefined') {
        return sessionStorage.getItem('token');
      }
    } catch (error) {
      console.error('[Auth] Error getting token:', error);
    }
    return null;
  }
}

export default AuthService;

