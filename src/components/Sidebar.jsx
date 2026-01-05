import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import FeatherIcon from 'feather-icons-react';
import './Sidebar.css';
import { useManifest } from '../services/epgManifestQueries';

const Sidebar = ({ mainRef }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false); // collapsed by default
  const sidebarRef = useRef(null);

  // Load manifest (prefetched at app startup)
  const { data: manifest } = useManifest();

  // Map manifest tab names to existing app routes
  const ROUTE_MAP = {
    profile: '/profile',
    channels: '/genre',
    all: '/genre',
    home: '/',
    search: '/search',
    movies: '/movies',
    app: '/tv',
    settings: '/settings',
    epg: '/live', // no dedicated EPG screen; route to Live for now
  };

  // Fallback static menu (used if manifest not ready or empty)
  const fallbackMenu = [
    { icon: 'user', label: 'Profile', path: '/profile' },
    { icon: 'tv', label: 'Live TV', path: '/genre' },
    { icon: 'radio', label: 'Live', path: '/live' },
    { icon: 'settings', label: 'Settings', path: '/settings' },
  ];

  // Build dynamic menu from manifest tabs
  const manifestTabs = Array.isArray(manifest?.tab) ? manifest.tab : [];
  const allowedNames = new Set(['epg','settings','channels','profile','home','search','all','movies','app']);

  const dynamicMenu = manifestTabs
    .filter(t => t && allowedNames.has(String(t.name || '').toLowerCase()) && t.isVisible)
    .map(t => ({
      rawName: String(t.name || '').toLowerCase(),
      sequence: Number.isFinite(t.sequence) ? t.sequence : 0,
      iconUrl: t.iconUrl || '',
      label: t.displayName || t.name || '',
      path: ROUTE_MAP[String(t.name || '').toLowerCase()] || null,
    }))
    .filter(it => !!it.path)
    .sort((a, b) => a.sequence - b.sequence);

  // Ensure Profile (if present) is the first item
  const profileIdx = dynamicMenu.findIndex(it => it.rawName === 'profile');
  const menuItems = (() => {
    if (dynamicMenu.length === 0) return fallbackMenu;
    if (profileIdx > 0) {
      const copy = dynamicMenu.slice();
      const [profileItem] = copy.splice(profileIdx, 1);
      return [profileItem, ...copy];
    }
    return dynamicMenu;
  })();

  const profileItem = menuItems[0];
  const otherItems = menuItems.slice(1);

  const getFeatherIconName = (item) => {
    if (item?.icon) return item.icon;
    switch ((item?.rawName || '').toLowerCase()) {
      case 'profile': return 'user';
      case 'channels': return 'grid';
      case 'all': return 'grid';
      case 'home': return 'home';
      case 'search': return 'search';
      case 'movies': return 'film';
      case 'app': return 'box';
      case 'settings': return 'settings';
      case 'epg': return 'calendar';
      default: return 'tv';
    }
  };

  // Move focus from the sidebar into the current page's content
  const focusContentForCurrentRoute = () => {
    if (location.pathname === '/') {
      // Home / landing page manages its own focus
      try { document.dispatchEvent(new CustomEvent('focus-landing-page')); } catch {}
      return;
    }

    // Profile screen: always return focus to the Logout button
    if (location.pathname === '/profile') {
      const logoutBtn = document.querySelector('.profile2-logout');
      if (logoutBtn) {
        try { logoutBtn.focus({ preventScroll: true }); } catch { logoutBtn.focus(); }
        return;
      }
      // If the button isn't found for some reason, fall through to the generic logic below
    }

    // Many pages (including TV guide / Live) mark their main container
    // with data-navigation-container to receive DPAD focus.
    const contentContainer = document.querySelector('[data-navigation-container]');

    if (
      location.pathname === '/tv' ||
      location.pathname === '/movies' ||
      location.pathname === '/sports' ||
      location.pathname === '/live' ||
      location.pathname === '/settings'
    ) {
      const targetRoot = contentContainer || document.querySelector('.main-content');
      if (targetRoot) {
        const firstFocusable = targetRoot.querySelector(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"]), .channel-card'
        );
        if (firstFocusable) {
          try { firstFocusable.focus({ preventScroll: true }); } catch { firstFocusable.focus(); }
          return;
        }
      }
    }

    // Fallback: focus main content wrapper
    if (mainRef?.current) {
      try { mainRef.current.focus({ preventScroll: true }); } catch { mainRef.current.focus(); }
    }
  };

  // When sidebar expands, focus the active route's nav item
  useEffect(() => {
    if (!isExpanded) return;

    const timer = setTimeout(() => {
      // If something in the sidebar already has focus (e.g., set by the page),
      // don't override it. This prevents snapping back while the user navigates.
      if (sidebarRef.current && sidebarRef.current.contains(document.activeElement)) {
        return;
      }

      // Prefer to focus the item matching current route.
      // If current route is '/genre' (EPG list) but the sidebar doesn't include it,
      // fall back to focusing the Live tab ('/live') instead of defaulting to Profile.
      let activeIndex = menuItems.findIndex(item => item.path === location.pathname);
      if (activeIndex === -1 && location.pathname === '/genre') {
        const liveIdx = menuItems.findIndex(item => item.path === '/live');
        if (liveIdx !== -1) activeIndex = liveIdx;
      }
      if (activeIndex < 0) activeIndex = 0;
      setFocusedIndex(activeIndex);

      const menuEls = sidebarRef.current?.querySelectorAll('.nav-item');
      if (menuEls && menuEls[activeIndex]) {
        try { menuEls[activeIndex].focus({ preventScroll: true }); } catch { menuEls[activeIndex].focus(); }
        console.log('Focused active sidebar item index:', activeIndex);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [isExpanded, location.pathname, menuItems]);

  // Handle navigation from menu items
  const handleMenuKeyDown = (e, index) => {
    console.log('Menu key down:', e.key, 'on index:', index, 'keyCode:', e.keyCode, 'which:', e.which);

    // If a global force-push overlay is active, block all BACK/DPAD from the sidebar too.
    try {
      if (typeof window !== 'undefined' && window.__CAASTV_FORCE_PUSH_ACTIVE) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
    } catch {}
    
    // Intercept BACK keys (including TV remotes that only send keyCode values)
    const isBackKey =
      e.key === 'Escape' ||
      e.key === 'Backspace' ||
      e.key === 'Back' ||
      e.key === 'GoBack' ||
      e.key === 'BrowserBack' ||
      e.keyCode === 461 || e.which === 461 ||   // LG webOS
      e.keyCode === 8   || e.which === 8   ||   // Backspace-as-back on some devices
      e.keyCode === 10009 || e.which === 10009; // Samsung Tizen

    if (isBackKey) {
      e.preventDefault();
      try { document.dispatchEvent(new CustomEvent('open-exit-dialog')); } catch {}
      return;
    }

    if (e.key === 'ArrowDown' || e.key === 'Down') {
      e.preventDefault();
      const newIndex = (index + 1) % menuItems.length; // still uses the data array
      setFocusedIndex(newIndex);
  
    
      const menuEls = sidebarRef.current?.querySelectorAll('.nav-item');
      if (menuEls && menuEls[newIndex]) {
        menuEls[newIndex].focus();
        console.log('Moved DOWN to index:', newIndex, 'Item:', menuEls[newIndex].textContent);
      }
    } else if (e.key === 'ArrowUp' || e.key === 'Up') {
      e.preventDefault();
      const newIndex = (index - 1 + menuItems.length) % menuItems.length;
      setFocusedIndex(newIndex);

      const menuEls = sidebarRef.current?.querySelectorAll('.nav-item');
      if (menuEls && menuEls[newIndex]) {
        menuEls[newIndex].focus();
        console.log('Moved UP to index:', newIndex, 'Item:', menuEls[newIndex].textContent);
      }
    } else if (e.key === 'ArrowRight' || e.key === 'Right') {
      e.preventDefault();
      setIsExpanded(false);
      document.activeElement.blur();
      document.dispatchEvent(new CustomEvent('sidebar-collapse'));
      
      // Move focus into the current page content (e.g. TV Guide / Live)
      focusContentForCurrentRoute();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (location.pathname === menuItems[index].path) {
        setIsExpanded(false);
        document.activeElement.blur();
        document.dispatchEvent(new CustomEvent('sidebar-collapse'));
        // If user presses Enter on the already active item (e.g. TV Guide),
        // treat it like moving right into the content so navigation doesn't get stuck.
        focusContentForCurrentRoute();
      } else {
        const targetPath = menuItems[index].path;

        // When changing screens into Genre (channels) or Live (EPG),
        // reset their internal focus state so they start at the top
        // (first genre + first channel), instead of restoring the last one.
        // NOTE: we do NOT touch 'landingFocusApplied' here so the landing
        // channel auto-focus only happens once per app session.
        try {
          if (targetPath === '/genre') {
            sessionStorage.removeItem('genre:lastSelected');
            sessionStorage.removeItem('genre:lastFocusedChannel');
            sessionStorage.removeItem('genre:lastFocusedChannelId');
          } else if (targetPath === '/live') {
            sessionStorage.removeItem('live_screen_state_v1');
          }
        } catch {}

        navigate(targetPath, { replace: true });
        setIsExpanded(false);
        document.dispatchEvent(new CustomEvent('sidebar-collapse'));
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsExpanded(false);
      document.activeElement.blur();
      document.dispatchEvent(new CustomEvent('sidebar-collapse'));
      mainRef.current?.focus();
    }
  };

  useEffect(() => {
    const handleFocusIn = (e) => {
      if (e.target.closest('.sidebar')) {
        setIsExpanded(true);
      }
    };

    const handleSidebarExpand = () => {
      setIsExpanded(true);
    };

    const handleSidebarCollapse = () => {
      setIsExpanded(false);
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('sidebar-expand', handleSidebarExpand);
    document.addEventListener('sidebar-collapse', handleSidebarCollapse);
    
    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('sidebar-expand', handleSidebarExpand);
      document.removeEventListener('sidebar-collapse', handleSidebarCollapse);
    };
  }, []);
  


  return (
    <>
      {/* Full-height overlay that extends the brush gradient into the content area */}
      <div className={`sidebar-gradient-overlay ${isExpanded ? 'visible' : ''}`} />

      <div className={`sidebar ${isExpanded ? 'expanded' : ''}`} ref={sidebarRef}>

        <nav className="sidebar-nav">
        {/* Top: Profile */}
        <div
          key={profileItem.path}
          className={`nav-item 
            ${location.pathname === profileItem.path ? 'active' : ''} 
            ${0 === focusedIndex ? 'focused' : ''}`}
          tabIndex={0}
          onFocus={() => {
            setFocusedIndex(0);
            console.log('Focused on menu item:', 0, profileItem.label);
          }}
          onKeyDown={(e) => handleMenuKeyDown(e, 0)}
        >
            <div className="nav-icon">
              {profileItem.iconUrl ? (
                <img src={profileItem.iconUrl} alt={profileItem.label} width={36} height={36} />
              ) : (
                <FeatherIcon icon={getFeatherIconName(profileItem)} size={36} />
              )}
            </div>
          <span className="nav-label">{profileItem.label}</span>
        </div>

        <div className="nav-spacer" />

        {/* Bottom: other items */}
        {otherItems.map((item, idx) => {
          const realIndex = idx + 1;
          return (
            <div
              key={item.path}
              className={`nav-item 
                ${location.pathname === item.path ? 'active' : ''} 
                ${realIndex === focusedIndex ? 'focused' : ''}`}
              tabIndex={0}
              onFocus={() => {
                setFocusedIndex(realIndex);
                console.log('Focused on menu item:', realIndex, item.label);
              }}
              onKeyDown={(e) => handleMenuKeyDown(e, realIndex)}
            >
              <div className="nav-icon">
                {item.iconUrl ? (
                  <img src={item.iconUrl} alt={item.label} width={36} height={36} />
                ) : (
                  <FeatherIcon icon={getFeatherIconName(item)} size={36} />
                )}
              </div>
              <span className="nav-label">{item.label}</span>
            </div>
          );
        })}
      </nav>
      </div>
    </>
  );
};

export default Sidebar;
