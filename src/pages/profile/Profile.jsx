import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './Profile.css';
import CommonDialog from '../../components/CommonDialog';
import userIcon from '../../../public/user_icon_2.png';
import exitIcon from '../../assets/exit_icon.svg';
import { performFullLogout } from '../../utils/logout';

function Profile() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [showLogoutDialog, setShowLogoutDialog] = useState(false);
    const [showExitDialog, setShowExitDialog] = useState(false);
    const logoutBtnRef = useRef(null);

    const handleContainerKeyDown = (e) => {
        // While a global force-push message is visible, completely block
        // BACK/DPAD so the profile screen cannot react beneath it.
        try {
            if (typeof window !== 'undefined' && window.__CAASTV_FORCE_PUSH_ACTIVE) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
        } catch {}

        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            try { document.activeElement?.blur(); } catch {}
            try { document.dispatchEvent(new CustomEvent('sidebar-expand')); } catch {}
            // Fallback: focus first sidebar item shortly after expand
            setTimeout(() => {
                const firstMenuItem = document.querySelector('.sidebar .nav-item');
                firstMenuItem?.focus();
            }, 200);
        } else if (e.key === 'Backspace' || e.key === 'Escape' || e.key === 'Back' || e.key === 'GoBack') {
            // Match EPG: first back moves focus to sidebar (expanded). Second back (handled by sidebar) opens dialog.
            e.preventDefault();
            try { document.activeElement?.blur(); } catch {}
            try { document.dispatchEvent(new CustomEvent('sidebar-expand')); } catch {}
            setTimeout(() => {
                const activeOrFirst = document.querySelector('.sidebar .nav-item.active') || document.querySelector('.sidebar .nav-item');
                activeOrFirst?.focus();
            }, 100);
        }
    };

    useEffect(() => {
        const storedUser = sessionStorage.getItem('user');
        
        if (!storedUser) {
            return;
        }

        let userData;
        
        if (typeof storedUser === 'string') {
            try {
                userData = JSON.parse(storedUser);
            } catch (error) {
                return;
            }
        } else {
            userData = storedUser;
        }
        
        // Validate user data has required fields - updated for new structure
        if (!userData || !userData.data || !userData.data.userId) {
            return;
        }
        
        // Set user data from the new structure
        setUser(userData.data);

        // No need to fetch additional data since all info is in sessionStorage
    }, []);

    const handleLogout = () => setShowLogoutDialog(true);
    const confirmLogout = () => {
        performFullLogout();
        setShowLogoutDialog(false);
        navigate('/panmetro-login', { replace: true });
    };
    const cancelLogout = () => {
        setShowLogoutDialog(false);
        // Return focus to the logout button after dialog closes
        try { setTimeout(() => logoutBtnRef.current?.focus(), 50); } catch {}
    };

    const handleLogin = () => {
        navigate('/login', { replace: true });
    };
    const maskedMobile = useMemo(() => {
        const m = user?.mobileNo || '';
        if (!m) return '';
        const digits = m.replace(/\D/g, '');
        if (digits.length < 4) return m;
        const last4 = digits.slice(-4);
        return `+91 ******${last4}`;
    }, [user]);

    const primaryPackage = user?.packages?.[0] || null;
    const planName = (
        primaryPackage?.packageName ||
        (Array.isArray(user?.pkgdata) ? user.pkgdata[0] : null) ||
        user?.packageName ||
        'Basic Plan'
    );
    const expiryRaw = (
        primaryPackage?.packageExpiryDate ||
        user?.packageExpiryDate ||
        user?.packageExpiry ||
        null
    );
    const expiryDate = expiryRaw ? new Date(expiryRaw).toLocaleDateString() : '';

    // Focus logout on initial mount
    useEffect(() => {
        const t = setTimeout(() => {
            try { logoutBtnRef.current?.focus(); } catch {}
        }, 160);
        return () => clearTimeout(t);
    }, []);

    // Listen for global request to open exit dialog (dispatched by Sidebar on back)
    useEffect(() => {
        const openExit = () => setShowExitDialog(true);
        document.addEventListener('open-exit-dialog', openExit);
        return () => document.removeEventListener('open-exit-dialog', openExit);
    }, []);

    // Intercept native back via popstate to match EPG flow
    useEffect(() => {
        try { window.history.pushState({ profileGuard: true }, ''); } catch {}
        const onPop = (e) => {
            try { e.preventDefault?.(); } catch {}

            // If a force-push message is active, do not let BACK move away
            // from the current screen; immediately re-push guard state.
            try {
                if (typeof window !== 'undefined' && window.__CAASTV_FORCE_PUSH_ACTIVE) {
                    try { window.history.pushState({ profileGuard: true }, ''); } catch {}
                    return;
                }
            } catch {}

            const focusInSidebar = !!document.activeElement?.closest?.('.sidebar');
            if (!focusInSidebar) {
                try { document.dispatchEvent(new CustomEvent('sidebar-expand')); } catch {}
                setTimeout(() => {
                    const activeOrFirst = document.querySelector('.sidebar .nav-item.active') || document.querySelector('.sidebar .nav-item');
                    activeOrFirst?.focus();
                }, 100);
            } else {
                setShowExitDialog(true);
            }
            try { window.history.pushState({ profileGuard: true }, ''); } catch {}
        };
        window.addEventListener('popstate', onPop);
        return () => window.removeEventListener('popstate', onPop);
    }, []);

    return (
        <div className="profile2-container" tabIndex={0} onKeyDown={handleContainerKeyDown}>
            <div className="profile2-content">
                <section className="profiles2-section">
                    <div className="profiles2-header"><h3>Profiles</h3></div>
                    <div className="profiles2-row">
                        <div className="profile2-chip active">
                            <div className="profile2-chip-avatar"><img src={userIcon} alt="user" /></div>
                            <div className="profile2-chip-name">{user?.username || 'CaasTV'}</div>
                            {/* <div className="profile2-chip-id">{user?.userId || 'PAN00029'}</div> */}
                        </div>
                    </div>
                </section>
                <section className="package2-section">
                    <div className="package2-header"><h3>Package Details</h3></div>
                    <div className="package2-row">
                        <div className="package2-left">
                            <div className="package2-name">{planName}</div>
                            {expiryDate ? (<div className="package2-exp">Expiry on : {expiryDate}</div>) : null}
                        </div>
                        <button className="profile2-logout" onClick={handleLogout} ref={logoutBtnRef} tabIndex={0}>Log Out</button>
                    </div>
                </section>
            </div>

            <CommonDialog
                showDialog={showLogoutDialog}
                title="Logout App"
                message="Are you sure you want to logout and exit the app?"
                isErrorAdded={false}
                confirmButtonText="Yes"
                onConfirm={confirmLogout}
                dismissButtonText="No"
                onDismiss={cancelLogout}
                borderColor="#2a2a2a"
                initialFocusOnConfirm={false}
            />

            <CommonDialog
                showDialog={showExitDialog}
                title="Exit App"
                message={"Are you sure you want to exit the app?"}
                iconSrc={exitIcon}
                isErrorAdded={true}
                errorCode={null}
                errorMessage={null}
                borderColor="transparent"
                confirmButtonText="Yes"
                onConfirm={() => {
                    setShowExitDialog(false);
                    try { window.open('', '_self'); window.close(); } catch {}
                    try { navigate('/', { replace: true }); } catch {}
                }}
                dismissButtonText="No"
                onDismiss={() => {
                    setShowExitDialog(false);
                    // Return focus to sidebar when dialog is dismissed
                    try { document.dispatchEvent(new CustomEvent('sidebar-expand')); } catch {}
                    setTimeout(() => {
                        const activeOrFirst = document.querySelector('.sidebar .nav-item.active') || document.querySelector('.sidebar .nav-item');
                        activeOrFirst?.focus();
                    }, 100);
                }}
            />
        </div>
    );
}

export default Profile;
