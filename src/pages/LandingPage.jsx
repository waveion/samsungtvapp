import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import API from '../services/api';
import { getGradientStyle } from '../utils/gradientUtils';
import './LandingPage.css';

/* -----------------------------
   Custom hook: navigation logic
-------------------------------- */
const useHomeScreenNavigation = (itemsPerRow = 6) => {
  const containerRef = useRef(null);
  const lastLeftKeyTime = useRef(0);
  const leftKeyDelay = 300;

  useEffect(() => {
    const handleKeyDown = (e) => {
      const isActiveElementInContainer = containerRef.current?.contains(document.activeElement);
      const isSidebarElement = document.activeElement?.closest('.sidebar');

      if (isSidebarElement || !isActiveElementInContainer) {
        return;
      }

      const currentCategorySection = document.activeElement?.closest('.category-section');
      if (!currentCategorySection) return;

      const focusableElements = Array.from(currentCategorySection.querySelectorAll('.channel-card') || []);
      if (focusableElements.length === 0) return;

      const currentIndex = focusableElements.findIndex(el => el === document.activeElement);
      if (currentIndex === -1) return;

      let newIndex = currentIndex;

      switch (e.key) {
        case 'ArrowRight':
          if (currentIndex < focusableElements.length - 1) {
            newIndex = currentIndex + 1;
          }
          e.preventDefault();
          break;

        case 'ArrowLeft': {
          const now = Date.now();
          if (now - lastLeftKeyTime.current < leftKeyDelay) {
            e.preventDefault();
            return;
          }
          lastLeftKeyTime.current = now;

          if (currentIndex % itemsPerRow === 0) {
            e.preventDefault();
            const sidebar = document.querySelector('.sidebar');
            if (sidebar) {
              document.dispatchEvent(new CustomEvent('sidebar-expand'));
              const menuItems = sidebar.querySelectorAll('.nav-item');
              const menuPaths = ['/', '/search','/tv','/movies','/sports','/live','/categories','/profile'];
              let active = menuItems[0];
              menuItems.forEach((item,i) => {
                if (menuPaths[i] === window.location.pathname) active = item;
              });
              setTimeout(() => active.focus(), 100);
            }
            return;
          }
          newIndex = currentIndex - 1;
          e.preventDefault();
          break;
        }

        case 'ArrowDown': {
          const allCategorySections = containerRef.current?.querySelectorAll('.category-section') || [];
          const currentCategoryIndex = Array.from(allCategorySections).findIndex(section => section === currentCategorySection);

          if (currentCategoryIndex < allCategorySections.length - 1) {
            const nextCategory = allCategorySections[currentCategoryIndex + 1];
            const nextCategoryElements = Array.from(nextCategory.querySelectorAll('.channel-card') || []);
            if (nextCategoryElements.length > 0) {
              const targetIndex = Math.min(currentIndex, nextCategoryElements.length - 1);
              nextCategoryElements[targetIndex].focus();
              nextCategory.scrollIntoView({ behavior: 'smooth', block: 'start' });
              return;
            }
          } else {
            window.scrollBy({ top: 300, behavior: 'smooth' });
            return;
          }
          e.preventDefault();
          break;
        }

        case 'ArrowUp': {
          const allCategorySections = containerRef.current?.querySelectorAll('.category-section') || [];
          const currentCategoryIndex = Array.from(allCategorySections).findIndex(section => section === currentCategorySection);

          if (currentCategoryIndex > 0) {
            const prevCategory = allCategorySections[currentCategoryIndex - 1];
            const prevCategoryElements = Array.from(prevCategory.querySelectorAll('.channel-card') || []);
            if (prevCategoryElements.length > 0) {
              const targetIndex = Math.min(currentIndex, prevCategoryElements.length - 1);
              prevCategoryElements[targetIndex].focus();
            }
            return;
          } else {
            const banner = containerRef.current?.querySelector('.banner-section img');
            if (banner) banner.focus();
            return;
          }
        }
        e.preventDefault();
        break;

        case 'Enter':
          document.activeElement?.click();
          e.preventDefault();
          break;

        case 'Escape':
          const sidebar = document.querySelector('.sidebar');
          if (sidebar) sidebar.classList.remove('expanded');
          e.preventDefault();
          break;
      }

      if (newIndex !== currentIndex && focusableElements[newIndex]) {
        focusableElements[newIndex].focus();

        const parentGrid = focusableElements[newIndex].closest('.channels-grid');
        if (parentGrid) {
          const card = focusableElements[newIndex];
          const cardRect = card.getBoundingClientRect();
          const gridRect = parentGrid.getBoundingClientRect();

          if (cardRect.left < gridRect.left) {
            parentGrid.scrollBy({ left: cardRect.left - gridRect.left - 20, behavior: 'smooth' });
          } else if (cardRect.right > gridRect.right) {
            parentGrid.scrollBy({ left: cardRect.right - gridRect.right + 20, behavior: 'smooth' });
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [itemsPerRow]);

  return containerRef;
};

/* -----------------------------
   Main LandingPage component
-------------------------------- */
const LandingPage = () => {
  const navigate = useNavigate();
  const firstBannerRef = useRef(null);
  const firstChannelRef = useRef(null);

  const [banners, setBanners] = useState([]);
  const [homescreenCategories, setHomescreenCategories] = useState([]);
  const [epgData, setEpgData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bannerIndex, setBannerIndex] = useState(0);

  const epgDataMap = useMemo(() => {
    const map = new Map();
    epgData.forEach(item => {
      if (item.content?.ChannelID) {
        map.set(item.content.ChannelID, item);
      }
    });
    return map;
  }, [epgData]);

  const getItemsPerRow = () => {
    if (window.innerWidth <= 480) return 3;
    if (window.innerWidth <= 768) return 4;
    return 6;
  };

  const navigationRef = useHomeScreenNavigation(getItemsPerRow());

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!loading && !error) {
      const timer = setTimeout(() => {
        const firstChannelCard = document.querySelector('.channel-card');
        if (firstChannelCard) firstChannelCard.focus();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [loading, error]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [bannersRes, categoriesRes, epgRes] = await Promise.all([
        API.get("/banners"),
       // API.get("/homescreenCategory"),
        API.get("/epg-files/all-publish")
      ]);

      setBanners(Array.isArray(bannersRes) ? bannersRes : []);
      setHomescreenCategories(categoriesRes);
      const normalized = Array.isArray(epgRes) ? epgRes.map(raw => ({
        _id: raw?._id,
        content: {
          _id: raw?._id,
          ChannelID: raw?.ChannelID || '',
          title: raw?.title || '',
          description: raw?.description || '',
          contentType: raw?.contentType || 'live',
          streamType: raw?.streamType || '',
          drmType: (raw?.DRM || raw?.drmType || raw?.DRMType || '').toString().toLowerCase() || 'none',
          assetId: raw?.assetId || '',
          genre: Array.isArray(raw?.genre) ? raw.genre : [],
          videoUrl: raw?.videoUrl || raw?.streamUrl || '',
          language: raw?.language || null,
          thumbnailUrl: raw?.thumbnailUrl || raw?.logoUrl || '',
          logoUrl: raw?.logoUrl || raw?.thumbnailUrl || '',
          published: Boolean(raw?.published),
          channelNo: raw?.channelNo || raw?.channelNumber || '',
          bgGradient: raw?.bgGradient || null,
          tv: raw?.tv || null,
        },
        channelId: raw?.ChannelID || '',
        displayName: raw?.title || ''
      })) : [];
      setEpgData(normalized);
    } catch (err) {
      console.error("Error fetching data", err);
      setError("Failed to load data. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (banners.length <= 1) return;
    const interval = setInterval(() => {
      setBannerIndex(prev => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [banners.length]);

  const handleChannelClick = useCallback((channelId, channelTitle) => {
    const cleanChannelId = encodeURIComponent(channelId);
    const cleanChannelTitle = encodeURIComponent(channelTitle);
    navigate(`/player?channelId=${cleanChannelId}&title=${cleanChannelTitle}`);
  }, [navigate]);

  /* renderChannels with filtering like old code */
  const renderChannelsForCategory = useCallback((cat) => {
    const validChannels = cat.channels.filter((chId) =>
      epgData.find((item) => item.content.ChannelID === chId)
    );

    return (
      <div className="channels-grid">
        {validChannels.length === 0 && <div className="no-channels">No channels</div>}
        {validChannels.map((chId, idx) => {
          const channel = epgDataMap.get(chId);
          const channelTitle = channel?.content?.title || chId;
          const thumb = channel?.content?.thumbnailUrl;

          return (
            <div
              key={chId}
              className="channel-card"
              ref={idx === 0 ? firstChannelRef : null}
              tabIndex={0}  // ✅ focusable
              onClick={() => handleChannelClick(chId, channelTitle)}
              title={`Click to play ${channelTitle}`}
            >
              <div className="channel-thumbnail" style={getGradientStyle(channel?.content?.bgGradient)}>
                {thumb && <img src={thumb} alt={channelTitle} className="channel-image" />}
              </div>
              <span className="channel-title">{channelTitle}</span>
            </div>
          );
        })}
      </div>
    );
  }, [epgData, epgDataMap, handleChannelClick]);

  if (loading) {
    return (
      <div className="landing-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="landing-page">
        <div className="error-container">
          <p>{error}</p>
          <button onClick={fetchData} className="retry-button">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="landing-page" 
      ref={navigationRef}
      data-navigation-container="true"
      data-items-per-row={getItemsPerRow()}
    >
      {banners.length > 0 ? (
        <div className="banner-section">
          <img
            ref={firstBannerRef}
            src={banners[bannerIndex].bannerUrl}
            alt={banners[bannerIndex].name}
            className="banner-image"
            loading="eager"
          />
          <div className="banner-overlay">
            <div className="banner-title">{banners[bannerIndex].name}</div>
            <div className="banner-description">Watch the latest breaking news</div>
          </div>
          {banners.length > 1 && (
            <div className="banner-dots">
              {banners.map((_, idx) => (
                <span
                  key={idx}
                  className={`banner-dot ${idx === bannerIndex ? 'active' : ''}`}
                  onClick={() => setBannerIndex(idx)}
                />
              ))}
            </div>
          )}
          <div className="banner-gradient" />
        </div>
      ) : (
        <div className="banner-placeholder">Banner Preview</div>
      )}

      <div className="content-section">
        {homescreenCategories
          .sort((a, b) => a.order - b.order)
          .map(cat => (
            <div key={cat._id} className="category-section">
              <div className="category-title">{cat.name}</div>
              {renderChannelsForCategory(cat)}
            </div>
          ))}
      </div>
    </div>
  );
};

export default LandingPage;
