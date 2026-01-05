import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  TextField, 
  InputAdornment, 
  IconButton, 
  Box, 
  Typography, 
  CircularProgress,
  Alert
} from '@mui/material';
import FeatherIcon from 'feather-icons-react';
import API from '../services/api';
import SearchChannelCard from '../components/SearchChannelCard';
import './SearchPage.css';

// Custom hook for search screen navigation
const useSearchScreenNavigation = () => {
  const containerRef = useRef(null);
  const lastLeftKeyTime = useRef(0);
  const leftKeyDelay = 300; // 300ms delay to prevent rapid sidebar jumping

  // Function to calculate items per row based on container width
  const getItemsPerRow = () => {
    const container = containerRef.current;
    if (!container) return 6; // fallback
    
    const gridContainer = container.querySelector('.results-grid');
    if (!gridContainer) return 6; // fallback
    
    const containerWidth = gridContainer.offsetWidth;
    const cardWidth = 240; // minmax(240px, 1fr) from CSS
    const gap = 25; // gap from CSS
    
    // Calculate how many cards fit in one row
    const itemsPerRow = Math.floor((containerWidth + gap) / (cardWidth + gap));
    return Math.max(1, itemsPerRow); // ensure at least 1
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Only handle events if the active element is within this container
      const isActiveElementInContainer = containerRef.current?.contains(document.activeElement);
      const isSidebarElement = document.activeElement?.closest('.sidebar');
      
      // Don't handle events if sidebar is focused or if active element is not in this container
      if (isSidebarElement || !isActiveElementInContainer) {
        return;
      }

      // Get all focusable elements in the search page
      const focusableElements = Array.from(containerRef.current?.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"]), .search-channel-card, [data-search-input="true"]') || []);
      if (focusableElements.length === 0) return;

      const currentIndex = focusableElements.findIndex(el => el === document.activeElement);
      if (currentIndex === -1) return;

      const itemsPerRow = getItemsPerRow();
      let newIndex = currentIndex;

      switch (e.key) {
        case 'ArrowRight':
          // Simple linear navigation for search page
          if (currentIndex < focusableElements.length - 1) {
            newIndex = currentIndex + 1;
          }
          e.preventDefault();
          break;

        case 'ArrowLeft':
          // Check if enough time has passed since last left key press
          const currentTime = Date.now();
          if (currentTime - lastLeftKeyTime.current < leftKeyDelay) {
            e.preventDefault();
            return; // Ignore rapid left key presses
          }
          lastLeftKeyTime.current = currentTime;
          
          // Check if we're at the leftmost position in the current row
          const currentRowStartIndex = Math.floor(currentIndex / itemsPerRow) * itemsPerRow;
          const isLeftmostInRow = currentIndex === currentRowStartIndex;
          
          // Simple linear navigation for search page
          if (currentIndex > 0) {
            newIndex = currentIndex - 1;
          } else if (isLeftmostInRow) {
            // Only expand sidebar if we're at the leftmost position in the current row
            const sidebar = document.querySelector('.sidebar');
            if (sidebar) {
              document.dispatchEvent(new CustomEvent('sidebar-expand'));
              
              // Find the active menu item based on current route
              const currentPath = window.location.pathname;
              const menuItems = sidebar.querySelectorAll('.nav-item');
              
              let activeMenuItem = null;
              menuItems.forEach((item, index) => {
                const menuPaths = ['/', '/search', '/tv', '/movies', '/sports', '/live', '/categories', '/profile'];
                if (menuPaths[index] === currentPath) {
                  activeMenuItem = item;
                }
              });
              
              if (!activeMenuItem && menuItems.length > 0) {
                activeMenuItem = menuItems[0];
              }
              
              if (activeMenuItem) {
                setTimeout(() => {
                  activeMenuItem.focus();
                }, 100);
              }
            }
            return;
          } else {
            // If not leftmost in row, wrap to the end of the previous row
            const prevRowEndIndex = currentRowStartIndex - 1;
            if (prevRowEndIndex >= 0) {
              newIndex = prevRowEndIndex;
            }
          }
          e.preventDefault();
          break;

        case 'ArrowDown':
          // Grid navigation: move to next row
          const nextRowIndex = currentIndex + itemsPerRow;
          if (nextRowIndex < focusableElements.length) {
            newIndex = nextRowIndex;
          } else {
            // If we're in the last row, stay in current position
            newIndex = currentIndex;
          }
          e.preventDefault();
          break;

        case 'ArrowUp':
          // Grid navigation: move to previous row
          const prevRowIndex = currentIndex - itemsPerRow;
          if (prevRowIndex >= 0) {
            newIndex = prevRowIndex;
          } else {
            // If we're in the first row, focus search input
            const searchInput = containerRef.current?.querySelector('[data-search-input="true"] input, .search-input input, .search-input textarea, input[placeholder*="search"], input[placeholder*="Search"]');
            if (searchInput) {
              searchInput.focus();
              return;
            } else {
              // Stay in current position if no search input found
              newIndex = currentIndex;
            }
          }
          e.preventDefault();
          break;

        case 'Enter':
          // Default behavior: click the focused element
          document.activeElement?.click();
          e.preventDefault();
          break;

        case 'Escape':
          // Collapse sidebar and focus main content
          const sidebar = document.querySelector('.sidebar');
          if (sidebar) {
            sidebar.classList.remove('expanded');
          }
          e.preventDefault();
          break;
      }

      // Focus the new element if index changed
      if (newIndex !== currentIndex && focusableElements[newIndex]) {
        focusableElements[newIndex].focus();
        console.log(`Search Navigation: ${e.key} - From index ${currentIndex} to ${newIndex}`);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return containerRef;
};

const SearchPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Data states
  const [epgData, setEpgData] = useState([]);
  const [trendingChannels, setTrendingChannels] = useState([]);

  // Use search screen navigation hook
  const navigationRef = useSearchScreenNavigation();

  useEffect(() => {
    // Load initial data
    fetchInitialData();
    
    // Check for initial search query from URL
    const params = new URLSearchParams(location.search);
    const initialQuery = params.get('q');
    if (initialQuery) {
      setSearchQuery(decodeURIComponent(initialQuery));
      // Perform search after data is loaded
      setTimeout(() => performSearch(decodeURIComponent(initialQuery)), 1000);
    }
  }, [location.search]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Try to fetch EPG data
      const epgRes = await API.get("/epg-files/join-epg-content");
      
      if (epgRes && Array.isArray(epgRes)) {
        setEpgData(epgRes);
        // Set trending channels (first 12 channels or all if less than 12)
        const trending = epgRes.slice(0, 12);
        setTrendingChannels(trending);
      } else {
        console.error("Invalid EPG data format:", epgRes);
        setError("Invalid data format received from server.");
      }
    } catch (err) {
      console.error("Error fetching initial data:", err);
      setError("Failed to load content. Please try again.");
    } finally {
      setLoading(false);
    }
  };



  const performSearch = async (query = searchQuery) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const searchTerm = query.toLowerCase();
      // Search in EPG data (channels)
      const results = epgData.filter(item => {
        const title = item.content?.title?.toLowerCase() || '';
        const description = item.content?.description?.toLowerCase() || '';
        const channelId = item.content?.ChannelID?.toLowerCase() || '';
        
        const matches = title.includes(searchTerm) || 
               description.includes(searchTerm) || 
               channelId.includes(searchTerm);        
        
        return matches;
      });

      setSearchResults(results);
      
    } catch (err) {
      console.error("Search error:", err);
      setError("Search failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    performSearch();
  };

  // Add real-time search as user types
  useEffect(() => {
    if (searchQuery.trim()) {
      performSearch();
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, epgData]);

  // Debug: Log when epgData changes
  useEffect(() => {
    console.log("EPG Data updated, total channels:", epgData.length);
  }, [epgData]);

  // Focus management after data loads
  useEffect(() => {
    if (!loading && !error) {
      // Wait a bit for DOM to update, then focus first channel card
      const timer = setTimeout(() => {
        const firstChannelCard = document.querySelector('.search-channel-card');
        if (firstChannelCard) {
          firstChannelCard.focus();
          console.log('Focused first channel card on search page');
        } else {
          console.log('No channel cards found on search page');
        }
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [loading, error]);

  // Handle focus when navigating to this page from sidebar
  useEffect(() => {
    const handleFocusRequest = () => {
      setTimeout(() => {
        const searchInput = document.querySelector('[data-search-input="true"] input, .search-input input, .search-input textarea, input[placeholder*="search"], input[placeholder*="Search"]');
        if (searchInput) {
          searchInput.focus();
          console.log('Focused search input from focus request');
        } else {
          // Fallback to first focusable element
          const firstFocusable = document.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"]), .search-channel-card');
          if (firstFocusable) {
            firstFocusable.focus();
            console.log('Focused first focusable element from focus request');
          }
        }
      }, 100);
    };

    document.addEventListener('focus-search-page', handleFocusRequest);
    return () => document.removeEventListener('focus-search-page', handleFocusRequest);
  }, []);

  const handleResultClick = (result) => {
    const channelId = encodeURIComponent(result.content.ChannelID);
    const channelTitle = encodeURIComponent(result.content.title);
    navigate(`/player?channelId=${channelId}&title=${channelTitle}`);
  };

  const handleTrendingClick = (channel) => {
    const channelId = encodeURIComponent(channel.content.ChannelID);
    const channelTitle = encodeURIComponent(channel.content.title);
    navigate(`/player?channelId=${channelId}&title=${channelTitle}`);
  };

  return (
    <div 
      className="search-page" 
      ref={navigationRef}
      data-navigation-container="true"
    >
      {/* Search Header */}
      <div className="search-header">
        <Typography variant="h4" component="h1" className="search-title">
          Search Channels
        </Typography>
        
        {/* Search Input */}
        <form onSubmit={handleSearchSubmit} className="search-form">
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Search for channels..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            tabIndex={0}
            data-search-input="true"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <FeatherIcon icon="search" size={20} />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  {loading && <CircularProgress size={20} />}
                  {searchQuery && (
                    <IconButton onClick={() => setSearchQuery('')}>
                      <FeatherIcon icon="x" size={16} />
                    </IconButton>
                  )}
                </InputAdornment>
              ),
            }}
            className="search-input"
          />
        </form>
      </div>

      {/* Content Area */}
      <div className="search-content">
        {error && (
          <Alert severity="error" className="search-error">
            {error}
          </Alert>
        )}

        {loading ? (
          <Box className="loading-container">
            <CircularProgress />
            <Typography>Loading...</Typography>
          </Box>
        ) : searchQuery ? (
          // Search Results
          <div className="search-results">
            {searchResults.length === 0 ? (
              <Box className="no-results">
                <FeatherIcon icon="search" size={48} />
                <Typography variant="h6">No channels found</Typography>
                <Typography variant="body2" color="text.secondary">
                  Try adjusting your search terms
                </Typography>
              </Box>
            ) : (
              <div className="results-grid">
                {searchResults.map((result) => (
                  <SearchChannelCard
                    key={result.content.ChannelID}
                    channel={result}
                    onClick={() => handleResultClick(result)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleResultClick(result);
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          // Trending Content when no search
          <div className="trending-section">
            <Typography variant="h5" component="h2" className="trending-title">
              <FeatherIcon icon="trending-up" size={24} style={{ marginRight: '8px' }} />
              Trending Channels
            </Typography>
            <Typography variant="body2" color="text.secondary" className="trending-subtitle">
              Popular channels you might like
            </Typography>
            
            <div className="results-grid">
              {trendingChannels.map((channel) => (
                <SearchChannelCard
                  key={channel.content.ChannelID}
                  channel={channel}
                  onClick={() => handleTrendingClick(channel)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleTrendingClick(channel);
                    }
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchPage; 