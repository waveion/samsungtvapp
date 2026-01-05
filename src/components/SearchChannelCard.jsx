import React from 'react';
import FeatherIcon from 'feather-icons-react';
import { getGradientStyle } from '../utils/gradientUtils';

const SearchChannelCard = ({ channel, onClick, onKeyDown }) => {
  const channelData = channel.content;
  const thumb = channelData?.thumbnailUrl;
  const channelTitle = channelData?.title || 'Unknown Channel';
  
  return (
    <div
      className="search-channel-card"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={onKeyDown}
      title={`Click to play ${channelTitle}`}
    >
      <div className="search-channel-thumbnail" style={getGradientStyle(channelData?.bgGradient)}>
        {thumb ? (
          <img
            src={thumb}
            alt={channelTitle}
            className="search-channel-image"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="search-channel-placeholder">
            <FeatherIcon icon="tv" size={32} />
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchChannelCard;
