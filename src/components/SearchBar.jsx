import React, { useState, useEffect, useRef } from 'react';
import { 
  TextField, 
  InputAdornment, 
  IconButton, 
  Popper, 
  Paper, 
  List, 
  ListItem, 
  ListItemText, 
  ListItemIcon,
  Typography,
  Box,
  CircularProgress,
  ClickAwayListener
} from '@mui/material';
import FeatherIcon from 'feather-icons-react';
import { useNavigate } from 'react-router-dom';
import API from '../services/api';
import './SearchBar.css';

const SearchBar = ({ 
  placeholder = "Search...", 
  showSuggestions = true, 
  maxSuggestions = 5,
  onSearch,
  className = ""
}) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchData, setSearchData] = useState([]);
  const anchorRef = useRef(null);

  useEffect(() => {
    // Load search data on mount
    loadSearchData();
  }, []);

  useEffect(() => {
    if (query.trim() && showSuggestions) {
      generateSuggestions();
    } else {
      setSuggestions([]);
      setShowDropdown(false);
    }
  }, [query, searchData]);

  const loadSearchData = async () => {
    try {
      const [epgRes, moviesRes, tvShowsRes] = await Promise.all([
        API.get("/epg-files/all-publish").catch(() => []),
        API.get("/movies").catch(() => []),
        API.get("/tv-shows").catch(() => [])
      ]);

      const mapChannel = (raw) => {
        const genreNames = Array.isArray(raw?.genre) ? raw.genre.map(g => g?.name).filter(Boolean) : [];
        return {
          ChannelID: raw?.ChannelID || '',
          title: raw?.title || '',
          description: raw?.description || '',
          genre: genreNames.join(', '),
          thumbnailUrl: raw?.thumbnailUrl || raw?.logoUrl || '',
          videoUrl: raw?.videoUrl || raw?.streamUrl || '',
          type: 'channel',
          searchText: raw?.title || ''
        };
      };

      const allData = [
        ...(Array.isArray(epgRes) ? epgRes.map(mapChannel) : []),
        ...(moviesRes || []).map(movie => ({
          ...movie,
          type: 'movie',
          searchText: movie.title || ''
        })),
        ...(tvShowsRes || []).map(show => ({
          ...show,
          type: 'tv-show',
          searchText: show.title || ''
        }))
      ];

      setSearchData(allData);
    } catch (err) {
      console.error("Error loading search data:", err);
    }
  };

  const generateSuggestions = () => {
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }

    const searchTerm = query.toLowerCase();
    const filtered = searchData
      .filter(item => 
        item.searchText?.toLowerCase().includes(searchTerm) ||
        item.description?.toLowerCase().includes(searchTerm)
      )
      .slice(0, maxSuggestions)
      .map(item => ({
        ...item,
        searchScore: calculateSearchScore(item, searchTerm)
      }))
      .sort((a, b) => b.searchScore - a.searchScore);

    setSuggestions(filtered);
    setShowDropdown(filtered.length > 0);
  };

  const calculateSearchScore = (item, searchTerm) => {
    let score = 0;
    const title = item.searchText?.toLowerCase() || '';
    const description = item.description?.toLowerCase() || '';
    
    if (title.includes(searchTerm)) score += 10;
    if (title.startsWith(searchTerm)) score += 5;
    if (description.includes(searchTerm)) score += 3;
    if (title === searchTerm) score += 20;
    
    return score;
  };

  const handleSearch = (searchQuery = query) => {
    if (!searchQuery.trim()) return;

    if (onSearch) {
      onSearch(searchQuery);
    } else {
      // Default behavior: navigate to search page
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`, { replace: true });
    }
    
    setShowDropdown(false);
  };

  const handleSuggestionClick = (suggestion) => {
    if (suggestion.type === 'channel') {
      const channelId = encodeURIComponent(suggestion.ChannelID);
      const channelTitle = encodeURIComponent(suggestion.title);
      navigate(`/player?channelId=${channelId}&title=${channelTitle}`);
    } else {
      navigate(`/player?type=${suggestion.type}&id=${suggestion.id}&title=${encodeURIComponent(suggestion.title)}`);
    }
    setShowDropdown(false);
    setQuery('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  const getSuggestionIcon = (type) => {
    switch (type) {
      case 'channel':
        return 'radio';
      case 'movie':
        return 'film';
      case 'tv-show':
        return 'monitor';
      default:
        return 'search';
    }
  };

  const getSuggestionColor = (type) => {
    switch (type) {
      case 'channel':
        return '#4CAF50';
      case 'movie':
        return '#2196F3';
      case 'tv-show':
        return '#FF9800';
      default:
        return '#757575';
    }
  };

  return (
    <div className={`search-bar-container ${className}`}>
      <TextField
        ref={anchorRef}
        fullWidth
        variant="outlined"
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyPress={handleKeyPress}
        onFocus={() => query.trim() && suggestions.length > 0 && setShowDropdown(true)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <FeatherIcon icon="search" size={20} />
            </InputAdornment>
          ),
          endAdornment: (
            <InputAdornment position="end">
              {loading && <CircularProgress size={20} />}
              {query && (
                <IconButton 
                  size="small" 
                  onClick={() => setQuery('')}
                  className="clear-button"
                >
                  <FeatherIcon icon="x" size={16} />
                </IconButton>
              )}
            </InputAdornment>
          ),
        }}
        className="search-bar-input"
      />

      {showSuggestions && (
        <ClickAwayListener onClickAway={() => setShowDropdown(false)}>
          <Popper
            open={showDropdown}
            anchorEl={anchorRef.current}
            placement="bottom-start"
            className="search-suggestions-popper"
            modifiers={[
              {
                name: 'offset',
                options: {
                  offset: [0, 8],
                },
              },
            ]}
          >
            <Paper className="search-suggestions-paper" elevation={8}>
              {suggestions.length > 0 ? (
                <List className="search-suggestions-list">
                  {suggestions.map((suggestion, index) => (
                    <ListItem
                      key={`${suggestion.type}-${suggestion.id || suggestion.ChannelID}-${index}`}
                      button
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="suggestion-item"
                    >
                      <ListItemIcon className="suggestion-icon">
                        <FeatherIcon 
                          icon={getSuggestionIcon(suggestion.type)} 
                          size={16}
                          color={getSuggestionColor(suggestion.type)}
                        />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Typography variant="body2" className="suggestion-title">
                            {suggestion.title || suggestion.searchText}
                          </Typography>
                        }
                        secondary={
                          <Typography variant="caption" className="suggestion-meta">
                            {suggestion.type} • {suggestion.genre || 'No genre'}
                          </Typography>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              ) : query.trim() && !loading ? (
                <Box className="no-suggestions">
                  <Typography variant="body2" color="text.secondary">
                    No results found
                  </Typography>
                </Box>
              ) : null}
            </Paper>
          </Popper>
        </ClickAwayListener>
      )}
    </div>
  );
};

export default SearchBar; 