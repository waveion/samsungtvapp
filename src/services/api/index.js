/**
 * API Module Index
 * Clean Architecture API Layer
 * 
 * This module provides a clean, maintainable API layer with:
 * - Separation of concerns (Client, Services, Endpoints)
 * - Domain-specific services (CMS, DRM, Auth)
 * - Centralized endpoint definitions
 * - Full backward compatibility
 * 
 * Usage:
 * 
 * // Default usage (backward compatible)
 * import API from '../services/api';
 * const data = await API.get('/endpoint');
 * 
 * // Domain-specific services (new clean way)
 * import API from '../services/api';
 * const banners = await API.cms.getBanners();
 * const user = await API.auth.login(username, password);
 * const session = await API.drm.createSession(deviceId);
 */

export { default } from './ApiService';
export { default as ApiClient } from './ApiClient';
export { default as CmsService } from './CmsService';
export { default as DrmService } from './DrmService';
export { default as AuthService } from './AuthService';
export { default as ApiEndpoints } from './ApiEndpoints';
export { Constants } from './ApiService';

