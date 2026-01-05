import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import infoPng from '../../assets/info.png';
import logoutPng from '../../assets/logout.png';
import './Settings.css';
import CommonDialog from '../../components/CommonDialog';
import exitIcon from '../../assets/exit_icon.svg';
import { getDeviceIdentifier } from '../../utils/fingerprint';
import Constants from '../../config/constants';
import { performFullLogout } from '../../utils/logout';

const DEVICE_PSEUDO_MAC_KEY = 'device_pseudo_mac';
const DEVICE_PSEUDO_MAC_COLON_KEY = 'device_pseudo_mac_colon';

function Settings() {
    const navigate = useNavigate();
    const [showInfo, setShowInfo] = useState(false);
    const [showExitDialog, setShowExitDialog] = useState(false); // logout confirm
    const [showExitAppDialog, setShowExitAppDialog] = useState(false); // back → exit app
    const [user, setUser] = useState(null);
    const [deviceId, setDeviceId] = useState(null);
    const [macAddress, setMacAddress] = useState(null);
    const [modelName, setModelName] = useState('WEB BROWSER');
    const [appVersion, setAppVersion] = useState(Constants.APP_VERSION); // default from constants
    const showInfoRef = useRef(false);
    const infoBtnRef = useRef(null);
    const logoutBtnRef = useRef(null);
    const infoOkRef = useRef(null);

    useEffect(() => {
        const storedUser = sessionStorage.getItem('user');
        if (storedUser) {
            try {
                setUser(JSON.parse(storedUser));
            } catch {}
        }

        let isMounted = true;
        (async () => {
            try {
                const id = await getDeviceIdentifier();
                if (isMounted) {
                    setDeviceId(id);
                }
            } catch (e) {
            }
        })();

        // Load pseudo MAC (from splash/login) to show as MAC ID in System information
        try {
            if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
                const withColons = localStorage.getItem(DEVICE_PSEUDO_MAC_COLON_KEY);
                const normalized = localStorage.getItem(DEVICE_PSEUDO_MAC_KEY);
                const value = (withColons && withColons.trim()) || (normalized && normalized.trim()) || null;
                if (isMounted && value) {
                    setMacAddress(value);
                }
            }
        } catch {
        }

        // Load app version from appinfo.json (try to get latest from runtime)
        (async () => {
            try {
                // Try to fetch from public folder
                const response = await fetch('/appinfo.json');
                if (response.ok) {
                    const appInfo = await response.json();
                    if (isMounted && appInfo?.version) {
                        setAppVersion(appInfo.version);
                        return;
                    }
                }
            } catch (e) {
                // Fallback to imported constant version
            }
        })();

        return () => {
            isMounted = false;
        };
    }, []);

    // Resolve LG TV model name (webOS deviceInfo from official webOSTV.js)
    useEffect(() => {
        let isMounted = true;
        try {
            if (typeof window !== 'undefined') {
                const w = window;
                if (w.webOS && typeof w.webOS.deviceInfo === 'function') {
                    const handleInfo = (info) => {
                        if (!isMounted || !info) return;
                        const model =
                            info.modelName ||
                            info.model ||
                            info.modelName2 ||
                            info.productName ||
                            info.modelId ||
                            'LG webOS TV';
                        try {
                            console.log('[CAASTV][LGTV][Settings] deviceInfo model resolved to:', model);
                        } catch {}
                        setModelName(String(model));
                    };
                    // Support both callback-style and sync-return variants
                    const maybeInfo = w.webOS.deviceInfo(handleInfo);
                    if (maybeInfo) {
                        handleInfo(maybeInfo);
                    }
                }
            }
        } catch {
        }
        return () => {
            isMounted = false;
        };
    }, []);

    const handleLogoutConfirm = () => {
        // Match Profile's logout behavior and clear all persisted UI state
        performFullLogout();
        setShowExitDialog(false);
        navigate('/panmetro-login', { replace: true });
    };

    useEffect(() => {
        showInfoRef.current = showInfo;
    }, [showInfo]);

    // Ensure initial focus on Info card
    useEffect(() => {
        const t = setTimeout(() => {
            infoBtnRef.current?.focus();
        }, 50);
        return () => clearTimeout(t);
    }, []);

    // When System Info opens, focus the Back button
    useEffect(() => {
        if (showInfo) {
            const t = setTimeout(() => {
                try { document.activeElement?.blur(); } catch {}
                infoOkRef.current?.focus();
            }, 50);
            return () => clearTimeout(t);
        }
    }, [showInfo]);

    // Back flow like EPG: first Back → expand+focus sidebar, second Back (from sidebar) → exit app dialog
    useEffect(() => {
        const onPop = (e) => {
            try { e.preventDefault?.(); } catch {}

            // While a global force-push message is visible, completely ignore
            // browser/remote BACK so the screen cannot change underneath it.
            try {
                if (typeof window !== 'undefined' && window.__CAASTV_FORCE_PUSH_ACTIVE) {
                    try { window.history.pushState({ settingsGuard: true }, ''); } catch {}
                    return;
                }
            } catch {}

            // If System information is open, completely ignore browser/remote back
            if (showInfoRef.current) {
                try { window.history.pushState({ settingsGuard: true }, ''); } catch {}
                return;
            }
            const focusInSidebar = !!document.activeElement?.closest?.('.sidebar');
            if (!focusInSidebar) {
                try { document.dispatchEvent(new CustomEvent('sidebar-expand')); } catch {}
                setTimeout(() => {
                    const activeOrFirst = document.querySelector('.sidebar .nav-item.active') || document.querySelector('.sidebar .nav-item');
                    activeOrFirst?.focus();
                }, 100);
            } else {
                setShowExitAppDialog(true);
            }
            try { window.history.pushState({ settingsGuard: true }, ''); } catch {}
        };
        try { window.history.pushState({ settingsGuard: true }, ''); } catch {}
        window.addEventListener('popstate', onPop);
        return () => window.removeEventListener('popstate', onPop);
    }, []);

    // Listen for sidebar-dispatched open-exit-dialog events
    useEffect(() => {
        const openExit = () => setShowExitAppDialog(true);
        document.addEventListener('open-exit-dialog', openExit);
        return () => document.removeEventListener('open-exit-dialog', openExit);
    }, []);

    return (
        <div 
            className="settings-container"
            data-navigation-container="true"
            onKeyDown={(e) => {
                // If a global force-push overlay is active, block BACK/DPAD entirely
                try {
                    if (typeof window !== 'undefined' && window.__CAASTV_FORCE_PUSH_ACTIVE) {
                        e.preventDefault();
                        e.stopPropagation();
                        return;
                    }
                } catch {}

                if (e.key === 'Backspace' || e.key === 'Escape' || e.key === 'Back' || e.key === 'GoBack') {
                    // If System information is open, ignore back keys entirely
                    if (showInfo) {
                        e.preventDefault();
                        e.stopPropagation();
                        return;
                    }
                    e.preventDefault();
                    try { document.dispatchEvent(new CustomEvent('sidebar-expand')); } catch {}
                    setTimeout(() => {
                        const activeOrFirst = document.querySelector('.sidebar .nav-item.active') || document.querySelector('.sidebar .nav-item');
                        activeOrFirst?.focus();
                    }, 100);
                }
            }}
        >
            <div className="settings-panel">
                <div className="settings-grid">
                    <button
                        className="settings-card"
                        onClick={() => setShowInfo(true)}
                        ref={infoBtnRef}
                        tabIndex={0}
                        onKeyDown={(e) => {
                            if (e.key === 'ArrowRight') {
                                e.preventDefault();
                                logoutBtnRef.current?.focus();
                            } else if (e.key === 'ArrowLeft') {
                                e.preventDefault();
                                // Move focus to sidebar when at leftmost item
                                document.activeElement?.blur();
                                document.dispatchEvent(new CustomEvent('sidebar-expand'));
                            }
                        }}
                    >
                        <img src={infoPng} alt="Info" className="settings-card-icon-img" />
                        <div className="settings-card-title">Info</div>
                    </button>
                    <button
                        className="settings-card"
                        onClick={() => setShowExitDialog(true)}
                        ref={logoutBtnRef}
                        tabIndex={0}
                        onKeyDown={(e) => {
                            if (e.key === 'ArrowLeft') {
                                e.preventDefault();
                                infoBtnRef.current?.focus();
                            }
                        }}
                    >
                        <img src={logoutPng} alt="Logout" className="settings-card-icon-img" />
                        <div className="settings-card-title">Logout</div>
                    </button>
                </div>
            </div>

            {showInfo && (
                <div 
                    className="settings-modal" 
                    role="dialog" 
                    aria-modal="true"
                    onKeyDown={(e) => {
                        if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) {
                            e.preventDefault();
                            e.stopPropagation();
                        } else if (e.key === 'Backspace' || e.key === 'Escape' || e.key === 'Back' || e.key === 'GoBack') {
                            // Ignore back keys while System information dialog is open
                            e.preventDefault();
                            e.stopPropagation();
                        } else if (e.key === 'Enter') {
                            e.preventDefault();
                            setShowInfo(false);
                            setTimeout(() => infoBtnRef.current?.focus(), 50);
                        }
                    }}
                >
                    <div className="settings-modal-content">
                        <h2 className="settings-modal-title">System information</h2>
                        <div className="settings-info-grid">
                            <div className="settings-info-row"><span>Username</span><span>{(user?.data?.username || 'Panmetro').toString()}</span></div>
                            <div className="settings-info-row">
                                <span>MAC ID</span>
                                <span>{(macAddress || deviceId || (typeof window !== 'undefined' ? window.TVUDID : '') || user?.data?.macId || 'WEB').toString()}</span>
                            </div>
                            <div className="settings-info-row"><span>APP VERSION</span><span>{appVersion || APP_VERSION || '1.0.1'}</span></div>
                            <div className="settings-info-row"><span>NETWORK ID</span><span>1</span></div>
                            <div className="settings-info-row"><span>OTA</span><span>Latest</span></div>
                            <div className="settings-info-row"><span>MODEL</span><span>{modelName}</span></div>
                            <div className="settings-info-row"><span>NETWORK NAME</span><span>Panmetro Convergence Pvt Ltd</span></div>
                        </div>
                        <div className="settings-modal-actions">
                            <button 
                                className="settings-modal-button"
                                onClick={() => {
                                    setShowInfo(false);
                                    setTimeout(() => infoBtnRef.current?.focus(), 50);
                                }}
                                ref={infoOkRef}
                            >
                                Back
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showExitDialog && (
                <CommonDialog
                    showDialog={showExitDialog}
                    title="Logout App"
                    message="Are you sure you want to logout and exit the app?"
                    isErrorAdded={false}
                    borderColor="#5a6676"
                    dismissButtonText="No"
                    onDismiss={() => {
                        setShowExitDialog(false);
                        // ensure only one element is focused at a time
                        document.activeElement?.blur();
                        setTimeout(() => logoutBtnRef.current?.focus(), 30);
                    }}
                    confirmButtonText="Yes"
                    onConfirm={handleLogoutConfirm}
                    initialFocusOnConfirm={false}
                />
            )}

            {showExitAppDialog && (
                <CommonDialog
                    showDialog={showExitAppDialog}
                    title="Exit App"
                    message="Are you sure you want to exit the app?"
                    iconSrc={exitIcon}
                    isErrorAdded={true}
                    borderColor="transparent"
                    dismissButtonText="No"
                    onDismiss={() => {
                        setShowExitAppDialog(false);
                        try { document.dispatchEvent(new CustomEvent('sidebar-expand')); } catch {}
                        setTimeout(() => {
                            const activeOrFirst = document.querySelector('.sidebar .nav-item.active') || document.querySelector('.sidebar .nav-item');
                            activeOrFirst?.focus();
                        }, 100);
                    }}
                    confirmButtonText="Yes"
                    onConfirm={() => {
                        setShowExitAppDialog(false);
                        try { window.open('', '_self'); window.close(); } catch {}
                        try { navigate('/', { replace: true }); } catch {}
                    }}
                    initialFocusOnConfirm={false}
                />
            )}
        </div>
    );
}

export default Settings;