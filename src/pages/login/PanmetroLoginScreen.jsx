import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './PanmetroLoginScreen.css';
import topCorner from '../../assets/top_corner.webp';
import panmetroBrand from '../../assets/panmetro_brand.png';
import qrCode from '../../assets/qrcode.png';
import { refreshUserPackagesAndChannels } from '../../services/drmhelper';
import CommonDialog from '../../components/CommonDialog';
import exitIcon from '../../assets/exit_icon.svg';
import FeatherIcon from 'feather-icons-react';
import QRCode from 'react-qr-code';
import API from '../../services/api';

const STATIC_MAC = 'A42280B923AA9FFA';

const DEVICE_PSEUDO_MAC_KEY = 'device_pseudo_mac';
const DEVICE_PSEUDO_MAC_COLON_KEY = 'device_pseudo_mac_colon';
const TV_LOGIN_SESSION_STORAGE_KEY = 'tvLoginSession';

function getInitialMacId() {
    if (typeof window === 'undefined') return STATIC_MAC;
    try {
        const withColons = localStorage.getItem(DEVICE_PSEUDO_MAC_COLON_KEY);
        if (withColons && withColons.trim()) {
            console.log('[PANMETRO][LOGIN] Using pseudo MAC with colons from storage:', withColons.trim());
            return withColons.trim();
        }
        const normalized = localStorage.getItem(DEVICE_PSEUDO_MAC_KEY);
        if (normalized && normalized.trim()) {
            console.log('[PANMETRO][LOGIN] Using normalized pseudo MAC from storage:', normalized.trim());
            return normalized.trim();
        }
    } catch {
        // ignore storage errors and fall through
    }
    console.log('[PANMETRO][LOGIN] Falling back to STATIC_MAC for initial MAC id');
    return STATIC_MAC;
}

function PanmetroLoginScreen() {
    const navigate = useNavigate();
    const [username, setUsername] = useState('PM09917');
    const [password, setPassword] = useState('Pm@123456');
    const [macId, setMacId] = useState(getInitialMacId); // Prefer pseudo MAC from splash, fallback to static
    const [usernameError, setUsernameError] = useState(false);
    const [passwordError, setPasswordError] = useState(false);
    const [isServerAvailable, setIsServerAvailable] = useState(true);
    const [backPressCount, setBackPressCount] = useState(0);
    const [showExitDialog, setShowExitDialog] = useState(false);
    const [loginErrorMessage, setLoginErrorMessage] = useState(null);
    
    // Focus management
    const usernameRef = useRef(null);
    const passwordRef = useRef(null);
    const loginRef = useRef(null);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [tvQrUrl, setTvQrUrl] = useState(null);
    const [tvExpiryMs, setTvExpiryMs] = useState(null);
    const [tvTimeRemainingSec, setTvTimeRemainingSec] = useState(null);

    // Update time every minute
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTime(new Date());
        }, 60000);
        return () => clearInterval(interval);
    }, []);

    // Load TV login session QR URL created during splash screen
    useEffect(() => {
        try {
            const raw =
                (typeof window !== 'undefined' && typeof sessionStorage !== 'undefined'
                    ? sessionStorage.getItem(TV_LOGIN_SESSION_STORAGE_KEY)
                    : null) ||
                (typeof window !== 'undefined' ? window.__CAASTV_TV_LOGIN_SESSION : null);

            let parsed = null;
            if (typeof raw === 'string') {
                parsed = JSON.parse(raw);
            } else if (raw && typeof raw === 'object') {
                parsed = raw;
            }

            const url = parsed && parsed.qrUrl;
            if (url && typeof url === 'string' && url.trim()) {
                const trimmed = url.trim();
                setTvQrUrl(trimmed);
                try {
                    console.log('[CAASTV][TV-LOGIN] Loaded QR URL for TV login:', trimmed);
                } catch {}
            }

            const expiresAt = parsed && parsed.expiresAt;
            if (expiresAt && typeof expiresAt === 'string') {
                const ms = Date.parse(expiresAt);
                if (!Number.isNaN(ms)) {
                    setTvExpiryMs(ms);
                }
            }
        } catch {
            // safely ignore errors, fallback to static QR image
        }
    }, []);

    // Countdown timer for QR expiry
    useEffect(() => {
        if (!tvExpiryMs) return;

        const updateRemaining = () => {
            const diffSec = Math.floor((tvExpiryMs - Date.now()) / 1000);
            setTvTimeRemainingSec(diffSec > 0 ? diffSec : 0);
        };

        updateRemaining();
        const id = setInterval(updateRemaining, 1000);
        return () => clearInterval(id);
    }, [tvExpiryMs]);

    // Redirect if already authenticated (only if valid shape)
    useEffect(() => {
        try {
            const raw = sessionStorage.getItem('user') || localStorage.getItem('user');
            if (!raw) return;
            const parsed = JSON.parse(raw);
            const cn = parsed?.data?.customerNumber || parsed?.customerNumber;
            if (cn) {
                navigate('/', { replace: true });
            }
        } catch {}
    }, [navigate]);

    // Set initial focus on username when component mounts
    useEffect(() => {
        if (usernameRef.current) {
            usernameRef.current.focus();
        }
        try {
            console.log('[PANMETRO][LOGIN] Initial macId state (displayed in UI):', macId);
        } catch {}
    }, []);

    // MAC remains static; no device lookup

    // Centralised back-press handler: first press arms, second press opens exit dialog.
    const handleBackPressCore = useCallback(() => {
        setBackPressCount((prev) => {
            if (prev === 0) {
                return 1; // arm the counter; do nothing visually
            }
            setShowExitDialog(true);
            return 0;
        });
    }, []);

    // Handle D-pad navigation and back key behavior
    useEffect(() => {
        const handleKeyDown = (e) => {
            // If a global force-push overlay is active (server-mandated message),
            // completely block all DPAD/back so the login screen cannot react.
            try {
                if (typeof window !== 'undefined' && window.__CAASTV_FORCE_PUSH_ACTIVE) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
            } catch {}

            // If exit dialog is open, let the dialog capture keys
            if (showExitDialog) {
                return;
            }

            const activeEl = document.activeElement;

            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    if (document.activeElement === usernameRef.current) {
                        passwordRef.current?.focus();
                    } else if (document.activeElement === passwordRef.current) {
                        loginRef.current?.focus();
                    }
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    if (document.activeElement === passwordRef.current) {
                        usernameRef.current?.focus();
                    } else if (document.activeElement === loginRef.current) {
                        passwordRef.current?.focus();
                    }
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (document.activeElement === usernameRef.current) {
                        passwordRef.current?.focus();
                    } else if (document.activeElement === passwordRef.current) {
                        loginRef.current?.focus();
                    } else if (document.activeElement === loginRef.current) {
                        handleLogin();
                    }
                    break;
                case 'Escape':
                case 'Backspace':
                case 'Back':
                case 'GoBack':
                case 'BrowserBack':
                    // If a text input currently has focus (LG on-screen keyboard likely open),
                    // let the platform/keyboard handle the BACK key (usually closes the keyboard).
                    if (activeEl === usernameRef.current || activeEl === passwordRef.current) {
                        return;
                    }
                    // Otherwise intercept all logical "back" keys so LG's own exit dialog never appears.
                    e.preventDefault();
                    e.stopPropagation();
                    handleBackPressCore();
                    break;
                default:
                    // LG webOS back key is often keyCode 461; catch it even if e.key is not set
                    if (e.keyCode === 461 || e.which === 461) {
                        if (activeEl === usernameRef.current || activeEl === passwordRef.current) {
                            // Let the on-screen keyboard consume this to close itself.
                            return;
                        }
                        e.preventDefault();
                        e.stopPropagation();
                        handleBackPressCore();
                    }
                    break;
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [username, password, showExitDialog, handleBackPressCore]);

    // Guard against browser/TV history back (popstate) so LG inbuilt exit dialog never opens.
    useEffect(() => {
        try {
            // Ensure there is always a history entry we can consume.
            window.history.pushState({ loginGuard: true }, '');
        } catch {}

        const onPopState = (e) => {
            try { e.preventDefault?.(); } catch {}

            // While a force-push message is active, swallow history BACK
            // and immediately re-push our guard entry so we stay put.
            try {
                if (typeof window !== 'undefined' && window.__CAASTV_FORCE_PUSH_ACTIVE) {
                    try { window.history.pushState({ loginGuard: true }, ''); } catch {}
                    return;
                }
            } catch {}

            // If a text input is focused (on-screen keyboard likely visible), let the
            // platform handle back/popstate (e.g., close the keyboard) and do not
            // interfere here.
            const activeEl = typeof document !== 'undefined' ? document.activeElement : null;
            if (activeEl === usernameRef.current || activeEl === passwordRef.current) {
                return;
            }

            // Otherwise consume the back navigation and re-push our guard state so the
            // browser does not navigate away or trigger its own exit UI.
            try { window.history.pushState({ loginGuard: true }, ''); } catch {}

            if (showExitDialog) {
                // If dialog already open, ignore further back presses here;
                // dialog itself will handle its keys.
                return;
            }

            handleBackPressCore();
        };

        window.addEventListener('popstate', onPopState);
        return () => {
            window.removeEventListener('popstate', onPopState);
        };
    }, [showExitDialog, handleBackPressCore]);

    // Reset back press counter if second press doesn't come in time
    useEffect(() => {
        if (backPressCount === 0) return;
        const timer = setTimeout(() => {
            setBackPressCount(0);
        }, 1500);
        return () => clearTimeout(timer);
    }, [backPressCount]);

    const handleUsernameChange = (e) => {
        const value = e.target.value;
        setUsername(value);
        const trimmed = value.trim();
        setUsernameError(trimmed === '' || trimmed.length < 3);
    };

    const handlePasswordChange = (e) => {
        const value = e.target.value;
        setPassword(value);
        const trimmed = value.trim();
        setPasswordError(trimmed === '' || trimmed.length < 3);
    };

    const handleLogin = async () => {
        let isValid = true;
        let msg = '';

        const u = username.trim();
        const p = password.trim();

        // Basic required + minimum length validation
        if (u === '') {
            isValid = false;
            msg = 'Username should not be blank';
            setUsernameError(true);
        } else if (u.length < 3) {
            isValid = false;
            msg = 'Username must be at least 3 characters';
            setUsernameError(true);
        } else if (p === '') {
            isValid = false;
            msg = 'Password should not be blank';
            setPasswordError(true);
        } else if (p.length < 3) {
            isValid = false;
            msg = 'Password must be at least 3 characters';
            setPasswordError(true);
        }

        if (!isValid) {
            setLoginErrorMessage(msg);
            return;
        }

        try {
            // Use pseudo MAC from storage/UI if available, else fallback to static
            const macForRequest = (() => {
                const raw = macId || STATIC_MAC;
                if (!raw) return STATIC_MAC;
                return String(raw).trim();
            })();

            const loginPayload = { 
                uname: username, 
                paswrd: password, 
                macaddr: macForRequest 
            };

            try {
                console.log('[PANMETRO][LOGIN] ========== LOGIN ATTEMPT START ==========');
                console.log('[PANMETRO][LOGIN] Environment:', Constants.IS_BROWSER ? 'Browser (proxy)' : 'TV (direct)');
                console.log('[PANMETRO][LOGIN] API Base URL:', API.getDrmBaseUrl());
                console.log('[PANMETRO][LOGIN] Endpoint: /src/api/v1/logincheck');
                console.log('[PANMETRO][LOGIN] Payload:', {
                    uname: loginPayload.uname,
                    macaddr: loginPayload.macaddr,
                    macaddr_displayedInUI: macId,
                    paswrdLength: (loginPayload.paswrd || '').length,
                });
            } catch {}

            // Use clean API architecture (goes through proxy in browser)
            const data = await API.drm.loginCheck(loginPayload);

            try {
                console.log('[PANMETRO][LOGIN] ========== API RESPONSE RECEIVED ==========');
                console.log('[PANMETRO][LOGIN] Full response:', JSON.stringify(data, null, 2));
                console.log('[PANMETRO][LOGIN] Return Code:', data?.returncode ?? data?.returnCode);
                console.log('[PANMETRO][LOGIN] Return Message:', data?.returnmessage ?? data?.returnMessage);
                console.log('[PANMETRO][LOGIN] Has User ID:', !!(data?.['user-id'] || data?.userId));
                console.log('[PANMETRO][LOGIN] Has Customer Number:', !!(data?.['customer-number'] || data?.customerNumber));
            } catch {}

            // Validate business response if return code/message are provided
            const rcRaw = (data?.returncode ?? data?.returnCode);
            const rc = rcRaw == null ? '' : String(rcRaw).trim();
            const rm = String(data?.returnmessage ?? data?.returnMessage ?? '').trim();
          
            // MORE PERMISSIVE validation logic
            // Consider typical backend codes: "00","01","02"... or 0/1/2 etc. plus textual success
            const successSet = new Set(['0','00','01','02','200','SUCCESS','OK','TRUE','ACTIVE']);
            const failureSet = new Set(['ERROR','FAILED','INVALID','UNAUTHORIZED','FORBIDDEN']);
          
            let isOk = true; // Default to success unless we find clear failure
            
            // Check return code
            if (rc) {
                const rcUpper = rc.toUpperCase();
                
                // Explicit success codes
                if (successSet.has(rcUpper)) {
                    isOk = true;
                }
                // Numeric codes: treat 0-99 as success (unless message says otherwise)
                else if (/^\d+$/.test(rc)) {
                    const numCode = Number(rc);
                    // Typically: 0-99 = success, 100+ = error
                    isOk = numCode < 100;
                }
                // Check if code contains failure keywords
                else if (failureSet.has(rcUpper) || /error|fail|invalid/i.test(rc)) {
                    isOk = false;
                }
            }
            
            // Check return message for failure keywords
            if (rm && failureSet.has(rm.toUpperCase()) || /error|fail|invalid|wrong|incorrect/i.test(rm)) {
                isOk = false;
            }
            
            // If we have user data, consider it a success
            if (data?.['user-id'] || data?.userId || data?.['customer-number'] || data?.customerNumber) {
                isOk = true;
            }
          
            if (!isOk) {
                const errorMsg = rm || `Login failed (code: ${rc || 'unknown'})`;
                console.error('[PANMETRO][LOGIN] Business validation failed:', {
                    returncode: rc,
                    returnmessage: rm,
                    fullResponse: data
                });
                throw new Error(errorMsg);
            }
            
            try {
                console.log('[PANMETRO][LOGIN] Business validation PASSED:', {
                    returncode: rc,
                    returnmessage: rm,
                    hasUserData: !!(data?.['user-id'] || data?.userId)
                });
            } catch {}
          
            // Normalization (handle array or object for pkgdata)
            let packages = [];
            try {
                if (Array.isArray(data?.pkgdata)) {
                    packages = data.pkgdata;
                } else if (Array.isArray(data?.pkgdata?.activepack)) {
                    packages = data.pkgdata.activepack;
                } else if (data?.pkgdata && typeof data.pkgdata === 'object') {
                    // Try to extract packages from any property that looks like a package list
                    packages = Object.values(data.pkgdata).find(v => Array.isArray(v)) || [];
                }
            } catch (e) {
                console.warn('[PANMETRO][LOGIN] Could not parse packages:', e);
                packages = [];
            }
            
            // Extract customer number - try ALL possible field names
            const customerNumber = 
                data?.['customer-number'] ?? 
                data?.customerNumber ?? 
                data?.custNumber ?? 
                data?.customernumber ??
                data?.customerNo ??
                data?.custno ??
                username; // Fallback to username if no customer number found
          
            const normalized = {
                data: {
                    userId: data?.['user-id'] ?? data?.userId ?? data?.id ?? username,
                    username: username,
                    customerId: data?.['customer-id'] ?? data?.customerId ?? null,
                    customerNumber: customerNumber, // CRITICAL: Must have this for auth
                    regionCode: String(data?.regioncode ?? data?.regionCode ?? '01').padStart(2,'0'),
                    packages,
                    // Store any additional data that might be useful
                    ...data
                },
                // ALSO store at root level for backward compatibility
                customerNumber: customerNumber,
                raw: data,
                credentials: { username, password, macId: macForRequest },
                loginTime: new Date().toISOString()
            };

            try {
                console.log('[PANMETRO][LOGIN] ========== USER DATA NORMALIZATION ==========');
                console.log('[PANMETRO][LOGIN] Normalized user data:', {
                    userId: normalized.data.userId,
                    customerNumber: normalized.data.customerNumber,
                    customerNumber_rootLevel: normalized.customerNumber,
                    packagesCount: packages.length,
                    regionCode: normalized.data.regionCode
                });
                console.log('[PANMETRO][LOGIN] Customer number is REQUIRED for auth:', !!customerNumber);
                console.log('[PANMETRO][LOGIN] Full normalized object:', JSON.stringify(normalized, null, 2));
            } catch {}

            try {
                const userJson = JSON.stringify(normalized);
                sessionStorage.setItem('user', userJson);
                localStorage.setItem('user', userJson);
                
                // Verify it was stored correctly
                const verify = sessionStorage.getItem('user');
                const parsed = JSON.parse(verify);
                const hasCustomerNumber = !!(parsed?.data?.customerNumber || parsed?.customerNumber);
                
                console.log('[PANMETRO][LOGIN] User data stored successfully');
                console.log('[PANMETRO][LOGIN] Verification - Has customer number:', hasCustomerNumber);
                
                if (!hasCustomerNumber) {
                    console.error('[PANMETRO][LOGIN] ⚠️ WARNING: Stored user has NO customer number!');
                    console.error('[PANMETRO][LOGIN] This will cause auth to fail and redirect to login');
                    console.error('[PANMETRO][LOGIN] API Response:', JSON.stringify(data, null, 2));
                }
            } catch (storageError) {
                console.error('[PANMETRO][LOGIN] Failed to store user data:', storageError);
            }

            // Refresh packages/channels in background (no UI notification)
            try {
                if (normalized?.data?.customerNumber) {
                    refreshUserPackagesAndChannels({ customerNumber: normalized.data.customerNumber })
                        .then(() => {})
                        .catch(() => {});
                }
            } catch {}

            // Final verification before navigation
            // Small delay to ensure storage is written
            await new Promise(resolve => setTimeout(resolve, 100));
            
            try {
                const storedUser = sessionStorage.getItem('user');
                const parsedUser = JSON.parse(storedUser);
                const finalCustomerNumber = parsedUser?.data?.customerNumber || 
                                           parsedUser?.customerNumber ||
                                           parsedUser?.data?.username;
                
                if (!finalCustomerNumber) {
                    console.error('[PANMETRO][LOGIN] ⚠️ CRITICAL: No customer identifier after storing!');
                    console.error('[PANMETRO][LOGIN] This will cause immediate redirect back to login');
                    console.error('[PANMETRO][LOGIN] Stored user object:', JSON.stringify(parsedUser, null, 2));
                    throw new Error('Authentication data incomplete. Please try again.');
                }
                
                console.log('[PANMETRO][LOGIN] ========== LOGIN SUCCESS ==========');
                console.log('[PANMETRO][LOGIN] Final customer identifier:', finalCustomerNumber);
                console.log('[PANMETRO][LOGIN] User will be authenticated');
                console.log('[PANMETRO][LOGIN] Navigating to home in 3...2...1...');
            } catch (verifyError) {
                console.error('[PANMETRO][LOGIN] Pre-navigation verification failed:', verifyError);
                throw verifyError;
            }
            
            // Navigate to home
            navigate('/', { replace: true });
            
            // Log after navigation attempt
            setTimeout(() => {
                console.log('[PANMETRO][LOGIN] Navigation called - if you see login screen again, check ProtectedRoute logs');
            }, 500);
        } catch (e) {
            try {
                console.error('[PANMETRO][LOGIN] ========== LOGIN FAILED ==========');
                console.error('[PANMETRO][LOGIN] Error Type:', e?.constructor?.name);
                console.error('[PANMETRO][LOGIN] Error Message:', e?.message || String(e));
                console.error('[PANMETRO][LOGIN] HTTP Status:', e?.status);
                console.error('[PANMETRO][LOGIN] Status Text:', e?.statusText);
                console.error('[PANMETRO][LOGIN] Stack:', e?.stack);
                console.error('[PANMETRO][LOGIN] Full Error Object:', JSON.stringify({
                    message: e?.message,
                    status: e?.status,
                    statusText: e?.statusText,
                    name: e?.name
                }, null, 2));
                console.error('[PANMETRO][LOGIN] Request Payload:', {
                    username: loginPayload?.uname,
                    macaddr: loginPayload?.macaddr
                });
                console.error('[PANMETRO][LOGIN] ========================================');
            } catch (logError) {
                console.error('[PANMETRO][LOGIN] Failed to log error:', logError);
            }
            
            // Show more detailed error message
            let errorMsg = 'Login failed';
            
            if (e?.message) {
                errorMsg = e.message;
            } else if (e?.statusText) {
                errorMsg = e.statusText;
            } else if (typeof e === 'string') {
                errorMsg = e;
            }
            
            // Add status code if available
            if (e?.status) {
                errorMsg = `${errorMsg} (Status: ${e.status})`;
            }
            
            // Make error message more user-friendly
            if (errorMsg.includes('Failed to fetch') || errorMsg.includes('Network')) {
                errorMsg = 'Network error. Please check your internet connection.';
            } else if (errorMsg.includes('timeout')) {
                errorMsg = 'Connection timeout. Please try again.';
            } else if (e?.status === 401) {
                errorMsg = 'Invalid username or password.';
            } else if (e?.status === 403) {
                errorMsg = 'Access denied. Please contact support.';
            } else if (e?.status >= 500) {
                errorMsg = 'Server error. Please try again later.';
            }
            
            setLoginErrorMessage(errorMsg);
        }
    };


    const formatDate = (date) => {
        try {
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
            });
        } catch {
            return '';
        }
    };

    const formatClock = (date) => {
        try {
            return date.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
            });
        } catch {
            return '';
        }
    };

    const formatRemaining = (seconds) => {
        if (seconds == null) return '';
        const total = Math.max(0, seconds);
        const mins = Math.floor(total / 60);
        const secs = total % 60;
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };

    return (
        <div className="panmetro-login-container">
            {/* Top Bar (Panmetro style with icons, same as Genre screen) */}
            <div className="panmetro-topbar">
                <div className="panmetro-topbar-content">
                    <div className="panmetro-topbar-line-left"></div>
                    <div className="panmetro-topbar-logo">
                        <div className="panmetro-topbar-logo-container">
                            <img src={topCorner} alt="Top Corner" className="panmetro-topbar-corner" />
                            <img src={panmetroBrand} alt="Panmetro Brand" className="panmetro-topbar-brand-logo" />
                        </div>
                    </div>
                    <div className="panmetro-topbar-line"></div>
                    <div className="panmetro-topbar-line-extended"></div>
                    <div className="panmetro-topbar-time">
                        <span className="pm-time-item">
                            <FeatherIcon icon="calendar" className="pm-time-icon" size={28} />
                            <span className="pm-time-text">{formatDate(currentTime)}</span>
                        </span>
                        <span className="pm-time-item">
                            <FeatherIcon icon="clock" className="pm-time-icon" size={28} />
                            <span className="pm-time-text">{formatClock(currentTime)}</span>
                        </span>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="panmetro-login-content">
                <div className="panmetro-login-boxes">
                    {/* Left Side - Pink Gradient Box */}
                    <div className="panmetro-login-left-box">
                        <div className="panmetro-login-form">
                            {/* Profile Icon */}
                            <div className="panmetro-profile-icon-container">
                                <div className={`panmetro-profile-icon ${isServerAvailable ? 'online' : 'offline'}`}>
                                    <div className="panmetro-profile-avatar">👤</div>
                                </div>
                            </div>

                            {/* Username Field */}
                            <div className="panmetro-input-group">
                                <div className="panmetro-input-icon">👤</div>
                                <input
                                    ref={usernameRef}
                                    type="text"
                                    value={username}
                                    onChange={handleUsernameChange}
                                    placeholder="UserName"
                                    className={`panmetro-login-input ${usernameError ? 'error' : ''}`}
                                />
                            </div>

                            {/* Password Field */}
                            <div className="panmetro-input-group">
                                <div className="panmetro-input-icon">🔒</div>
                                <input
                                    ref={passwordRef}
                                    type="password"
                                    value={password}
                                    onChange={handlePasswordChange}
                                    placeholder="Password"
                                    className={`panmetro-login-input ${passwordError ? 'error' : ''}`}
                                />
                            </div>

                            {/* MAC ID Field */}
                            <div className="panmetro-input-group">
                                <div className="panmetro-input-icon">🖥️</div>
                                <input
                                    type="text"
                                    value={macId}
                                    readOnly
                                    placeholder="MacId"
                                    className="panmetro-login-input disabled"
                                />
                            </div>

                            {/* Login Button */}
                            <button
                                ref={loginRef}
                                onClick={handleLogin}
                                className="panmetro-login-button"
                            >
                                <span>Next</span>
                                <span className="panmetro-arrow">→</span>
                            </button>
                        </div>
                    </div>

                    {/* Right Side - Teal Box */}
                    <div className="panmetro-login-right-box">
                        <div className="panmetro-brand-content">
                            <div className="panmetro-brand-logo">
                                <div className="panmetro-qr-heading">
                                    Scan the QR code to log in
                                </div>
                                {tvQrUrl ? (
                                    <>
                                        <div className="panmetro-qr-wrapper">
                                            <QRCode
                                                value={tvQrUrl}
                                                size={160}
                                                fgColor="#000000"
                                                bgColor="#FFFFFF"
                                                level="H"
                                            />
                                        </div>
                                        {tvExpiryMs && tvTimeRemainingSec !== null && (
                                            <div className={`panmetro-qr-timer ${tvTimeRemainingSec <= 0 ? 'expired' : ''}`}>
                                                {tvTimeRemainingSec > 0
                                                    ? `QR expires in ${formatRemaining(tvTimeRemainingSec)}`
                                                    : 'QR code expired'}
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <img src={qrCode} alt="QR Login" className="panmetro-logo-image" />
                                )}
                            </div>
                            <div className="panmetro-brand-title">Panmetro-IPTV</div>
                            <div className="panmetro-brand-subtitle">Future of entertainment</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Bar */}
            <div className="panmetro-bottombar">
                <div className="panmetro-bottombar-content">
                    <div className="panmetro-bottombar-line"></div>
                    <div className="panmetro-bottombar-text">
                        Powered by PANMETRO
                    </div>
                </div>
            </div>

            <CommonDialog
                showDialog={showExitDialog}
                title="Exit App"
                message="Do you want to exit the application?"
                iconSrc={exitIcon}         
                borderColor="transparent"
                confirmButtonText="Yes"
                dismissButtonText="No"
                onConfirm={() => {
                    setShowExitDialog(false);
                    try { window.open('', '_self'); window.close(); } catch {}
                }}
                onDismiss={() => {
                    setShowExitDialog(false);
                    // After cancelling exit, return focus to the username field
                    setTimeout(() => {
                        try {
                            usernameRef.current?.focus();
                        } catch {}
                    }, 30);
                }}
                initialFocusOnConfirm={true} 
            />

            <CommonDialog
                showDialog={!!loginErrorMessage}
                title="Login Failed"
                message={loginErrorMessage || ''}
                borderColor="red"
                confirmButtonText="OK"
                onConfirm={() => {
                    setLoginErrorMessage(null);
                    // Return focus to the Next button after dialog closes
                    setTimeout(() => {
                        try {
                            loginRef.current?.focus();
                        } catch {}
                    }, 30);
                }}
                dismissButtonText={null}
                onDismiss={() => {
                    setLoginErrorMessage(null);
                    setTimeout(() => {
                        try {
                            loginRef.current?.focus();
                        } catch {}
                    }, 30);
                }}
                initialFocusOnConfirm={true}
            />
        </div>
    );
}

export default PanmetroLoginScreen;
