// DRM utilities for building license URLs and encoding helpers
import Constants from '../config/constants';

function toBase64(str) {
	try {
		if (typeof btoa === 'function') return btoa(str);
		// Node/polyfill
		return Buffer.from(str, 'utf-8').toString('base64');
	} catch {
		return '';
	}
}

export function base64UrlSafe(input) {
	try {
		const b64 = toBase64(String(input ?? ''));
		return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
	} catch {
		return '';
	}
}

export function buildCryptoGuardLicenseUrl({
	baseUrl = Constants.DRM_LICENSE_BASE,
	contentUrl,
	contentId,
	username,
	password,
	uniqueDeviceId,
	deviceTypeName = 'Web TV',
	playState = '1',
	drmSystem = 'Widevine',
} = {}) {
	try {
		const u = new URL(baseUrl);
		// Ensure no stray '?&' later
		const qp = new URLSearchParams();
		qp.set('PlayState', String(playState));
		qp.set('DrmSystem', String(drmSystem));
		if (username != null) qp.set('LoginName', base64UrlSafe(username));
		if (password != null) qp.set('Password', base64UrlSafe(password));
		if (contentId != null) qp.set('KeyId', base64UrlSafe(contentId));
		if (uniqueDeviceId != null) qp.set('UniqueDeviceId', base64UrlSafe(uniqueDeviceId));
		if (contentUrl != null) qp.set('ContentUrl', base64UrlSafe(contentUrl));
		if (deviceTypeName != null) qp.set('DeviceTypeName', base64UrlSafe(deviceTypeName));
		const out = `${u.origin}${u.pathname}?${qp.toString()}`;
		return out.replace('?&', '?');
	} catch {
		return baseUrl;
	}
}

export function deriveWidevineServers(licenseUrl) {
	return licenseUrl ? { 'com.widevine.alpha': String(licenseUrl) } : undefined;
}


