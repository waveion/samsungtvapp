import React, { useRef, useEffect, useState, lazy, Suspense } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
  Navigate,
  useNavigate
} from 'react-router-dom';

import Sidebar from './components/Sidebar';
import SplashScreen from './components/SplashScreen';
import ProtectedRoute from './components/ProtectedRoute';
import PushOverlay from './components/PushOverlay';
import { useQueryClient } from '@tanstack/react-query';
import { prefetchEpg, prefetchManifest } from './services/epgManifestQueries';
import { refreshUserPackagesAndChannels } from './services/drmhelper';

import './App.css';

// Lazy load pages for better code splitting
const Genre = lazy(() => import('./pages/genre/Genre'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const PlayerPage = lazy(() => import('./pages/PlayerPage'));
const TvPlayer = lazy(() => import('./pages/tv-player/TvPlayer'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const Profile = lazy(() => import('./pages/profile/Profile'));
const Plan = lazy(() => import('./pages/plan/Plan'));
const Settings = lazy(() => import('./pages/settings/Settings'));
const EditProfile = lazy(() => import('./pages/edit-profile/EditProfile'));
const Categories = lazy(() => import('./pages/categories/Categories'));
const ContentGrid = lazy(() => import('./pages/content-grid/ContentGrid'));
const Live = lazy(() => import('./pages/live/Live'));
const About = lazy(() => import('./pages/About'));
const Login = lazy(() => import('./pages/login/Login'));
const PanmetroLoginScreen = lazy(() => import('./pages/login/PanmetroLoginScreen'));

// Loading fallback component
const PageLoader = () => (
  <div style={{ 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center', 
    height: '100vh',
    background: '#000',
    color: '#fff'
  }}>
    <div>Loading...</div>
  </div>
);

function MainContentWrapper() {
  const location = useLocation();
  const navigate = useNavigate();
  const mainRef = useRef(null);

  // Check whether user is authenticated (mirrors logic in ProtectedRoute)
  const isAuthed = (() => {
    try {
      const raw = sessionStorage.getItem('user') || localStorage.getItem('user');
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      const cn = parsed?.data?.customerNumber || parsed?.customerNumber || 
                 parsed?.data?.username || parsed?.credentials?.username ||
                 parsed?.data?.userId || parsed?.userId;
      return !!cn;
    } catch {
      return false;
    }
  })();

  // Focus management when route changes
  useEffect(() => {
    // Clear any existing focus first
    if (document.activeElement) {
      document.activeElement.blur();
    }

    // Small delay to ensure DOM is updated
    const timer = setTimeout(() => {
      // For genre page, let the component handle its own focus
      if (location.pathname === '/') {
        // Don't focus anything here, let Genre handle it
        return;
      }

      // For other pages, find the first focusable element
      const firstFocusable = mainRef.current?.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      
      if (firstFocusable) {
        firstFocusable.focus();
      } else {
        mainRef.current?.focus();
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [location.pathname]);

  // Global back button handler for Tizen TV and other devices
  useEffect(() => {
    const handleBackButton = (e) => {
      // Check if this is a back button press
      const isBackKey =
        e.key === 'Backspace' ||
        e.key === 'Escape' ||
        e.key === 'Back' ||
        e.key === 'GoBack' ||
        e.key === 'BrowserBack' ||
        e.keyCode === 461 || e.which === 461 ||   // LG webOS
        e.keyCode === 8   || e.which === 8   ||   // Backspace
        e.keyCode === 10009 || e.which === 10009; // Samsung Tizen

      if (isBackKey) {
        console.log('[APP] Back button pressed on:', location.pathname);
        
        // Don't handle back on login screens (let them handle it)
        if (location.pathname === '/panmetro-login' || location.pathname === '/login') {
          return;
        }

        // Don't handle back on player pages (let player handle it)
        if (location.pathname === '/player' || location.pathname === '/tv') {
          return;
        }

        // For all other pages, navigate back
        e.preventDefault();
        e.stopPropagation();
        
        if (window.history.length > 1) {
          console.log('[APP] Navigating back');
          navigate(-1);
        } else {
          console.log('[APP] No history, going to home');
          navigate('/', { replace: true });
        }
      }
    };

    // Register Tizen hardware key
    if (typeof window.tizen !== 'undefined') {
      try {
        window.tizen.tvinputdevice.registerKey('Back');
        console.log('[APP] Registered Tizen Back key');
      } catch (error) {
        console.warn('[APP] Failed to register Tizen Back key:', error);
      }
    }

    // Add event listener
    document.addEventListener('keydown', handleBackButton);

    return () => {
      document.removeEventListener('keydown', handleBackButton);
    };
  }, [location.pathname, navigate]);

  // Show sidebar only on specific in-app routes.
  // This avoids flashing the sidebar on intermediate/unknown paths
  // (e.g. during initial redirect from /index.html to /).
  const sidebarRoutes = [
    '/live',
    '/categories',
    '/content-grid',
    '/profile',
    '/plan',
    '/settings',
    '/edit-profile',
    '/about',
    '/tv',
    '/movies',
    '/sports',
    '/admin',
    '/player',
    '/tv-player',
    '/search',
  ];
  // Only show sidebar when user is authenticated AND on a sidebar route.
  // This prevents a brief flash of the sidebar when navigation momentarily
  // hits a protected route (e.g. when pressing BACK from the login screen
  // and ProtectedRoute immediately redirects to /panmetro-login).
  const showSidebar = isAuthed && sidebarRoutes.includes(location.pathname);

  return (
    <>
      {showSidebar && <Sidebar mainRef={mainRef} />}
      <div
        className={`main-content ${showSidebar ? 'with-sidebar' : ''}`}
        ref={mainRef}
        tabIndex={0}
      >
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Unprotected auth route */}
            <Route path="/panmetro-login" element={<PanmetroLoginScreen />} />
            <Route path="/login" element={<Login />} />

            {/* Protected application routes */}
            <Route path="/" element={<ProtectedRoute><Genre /></ProtectedRoute>} />
            <Route path="/genre" element={<ProtectedRoute><Genre /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
            <Route path="/player" element={<ProtectedRoute><PlayerPage /></ProtectedRoute>} />
            <Route path="/tv-player" element={<ProtectedRoute><TvPlayer /></ProtectedRoute>} />
            <Route path="/search" element={<ProtectedRoute><SearchPage /></ProtectedRoute>} />
            <Route path="/tv" element={<ProtectedRoute><div className="page-placeholder">TV Page</div></ProtectedRoute>} />
            <Route path="/movies" element={<ProtectedRoute><div className="page-placeholder">Movies Page</div></ProtectedRoute>} />
            <Route path="/sports" element={<ProtectedRoute><div className="page-placeholder">Sports Page</div></ProtectedRoute>} />
            <Route path="/live" element={<ProtectedRoute><Live /></ProtectedRoute>} />
            <Route path="/categories" element={<ProtectedRoute><Categories /></ProtectedRoute>} />
            <Route path="/content-grid" element={<ProtectedRoute><ContentGrid /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/plan" element={<ProtectedRoute><Plan /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/edit-profile" element={<ProtectedRoute><EditProfile /></ProtectedRoute>} />
            <Route path="/about" element={<ProtectedRoute><About /></ProtectedRoute>} />    

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        {/* <Footer /> */}
      </div>
    </>
  );
}

export default function App() {
  const mainRef = useRef(null);
  const [showSplash, setShowSplash] = useState(true);
  const queryClient = useQueryClient();
  const retryTimerRef = useRef(null);

  // Boot sequence: hydrate caches, refresh user data, then block on manifest + EPG
  useEffect(() => {
    // Hydrate session auth from persistent storage if available
    try {
      if (!sessionStorage.getItem('user')) {
        const persisted = localStorage.getItem('user');
        if (persisted) {
          sessionStorage.setItem('user', persisted);
        }
      }
    } catch {}
    // If user already logged in, refresh packages/channels silently
    try {
      const raw = sessionStorage.getItem('user') || localStorage.getItem('user');
      if (raw) {
        const parsed = JSON.parse(raw);
        const customerNumber = parsed?.data?.customerNumber || parsed?.customerNumber;
        if (customerNumber) {
          refreshUserPackagesAndChannels({ customerNumber })
            .then(({ pkgIds, channelsByPkg }) => {
            })
            .catch((err) => {
            });
        }
      }
    } catch {}
    // Hydrate from sessionStorage for instant availability
    try {
      const rawEpg = sessionStorage.getItem('epgCache');
      if (rawEpg) {
        const parsed = JSON.parse(rawEpg);
        if (parsed && parsed.data) {
          queryClient.setQueryData(['epg'], parsed.data);
        }
      }
    } catch {}
    try {
      const rawManifest = sessionStorage.getItem('manifestCache');
      if (rawManifest) {
        const parsed = JSON.parse(rawManifest);
        if (parsed && parsed.data) {
          queryClient.setQueryData(['manifest'], parsed.data);
        }
      }
    } catch {}

    // Block splash until both manifest and EPG are fetched and parsed successfully.
    // If fetch fails (server down), keep splash visible (with error dialog from SplashScreen)
    // and retry periodically until success.
    const attemptPrefetch = async () => {
      try {
        await Promise.all([
          prefetchEpg(queryClient),
          prefetchManifest(queryClient),
        ]);
      } catch (err) {
        // silently ignore prefetch errors; splash will stay visible and retry
      }

      // Check cache for data presence
      const hasManifest = !!queryClient.getQueryData(['manifest']);
      const hasEpg = !!queryClient.getQueryData(['epg']);

      if (hasManifest && hasEpg) {
        setShowSplash(false);
        if (retryTimerRef.current) {
          clearTimeout(retryTimerRef.current);
          retryTimerRef.current = null;
        }
      } else {
        // Retry after delay; keep splash (and error dialog) visible
        if (!retryTimerRef.current) {
          retryTimerRef.current = setTimeout(() => {
            retryTimerRef.current = null;
            attemptPrefetch();
          }, 5000);
        }
      }
    };

    attemptPrefetch();

    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [queryClient]);

  if (showSplash) {
    return <SplashScreen />;
  }

  return (
    <Router>
      <MainContentWrapper mainRef={mainRef} />
      <PushOverlay />
    </Router>
  );
}
