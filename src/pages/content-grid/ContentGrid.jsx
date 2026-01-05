import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getGradientStyle } from '../../utils/gradientUtils';
import './ContentGrid.css';

function ContentGrid() {
    const location = useLocation();
    const navigate = useNavigate();
    const [content, setContent] = useState([]);
    const [categoryName, setCategoryName] = useState('');
    const [categoryType, setCategoryType] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [totalCount, setTotalCount] = useState(0);

    useEffect(() => {
        if (location.state) {
            setContent(location.state.content || []);
            setCategoryName(location.state.categoryName || '');
            setCategoryType(location.state.categoryType || '');
            setCategoryId(location.state.categoryId || '');
            setTotalCount(location.state.totalCount || 0);
        } else {
            // If no state, redirect back to categories
            navigate('/categories', { replace: true });
        }
    }, [location.state, navigate]);

    const handleContentClick = (item) => {
        console.log('Content clicked:', item);
        
        // Create channel list for suggestions (excluding current item)
        const suggestions = content
            .filter(contentItem => contentItem._id !== item._id)
            .map(contentItem => ({
                id: contentItem.ChannelID || contentItem._id,
                name: contentItem.title,
                logo: contentItem.thumbnailUrl,
                videoUrl: contentItem.videoUrl,
                thumbnail: contentItem.thumbnailUrl,
                bgGradient: contentItem.bgGradient
            }));
        
        // Clean the channel ID and title to handle special characters
        const cleanChannelId = encodeURIComponent(item.ChannelID || item._id);
        const cleanChannelTitle = encodeURIComponent(item.title);
        
        // Navigate to TV player using URL parameters and state (like Categories page)
        navigate(`/tv-player?channelId=${cleanChannelId}&title=${cleanChannelTitle}`, {
            replace: true,
            state: {
                channelList: suggestions,
                currentChannelId: item.ChannelID || item._id,
                currentChannelTitle: item.title
            }
        });
    };

    const handleBackClick = () => {
        navigate('/categories');
    };

    return (
        <div className="content-grid-container">
            {/* Header */}
            <div className="content-header">
                <button className="back-button" onClick={handleBackClick}>
                    ← Back to Categories
                </button>
                <h1 className="category-title">{categoryName}</h1>
                <div className="content-count">
                    {totalCount} {totalCount === 1 ? 'item' : 'items'}
                </div>
            </div>

            {/* Content Grid */}
            <div className="content-grid">
                {content.map((item) => (
                    <div 
                        key={item._id} 
                        className="content-card"
                        onClick={() => handleContentClick(item)}
                    >
                        <div className="content-thumbnail" style={getGradientStyle(item.bgGradient)}>{ console.log(item.bgGradient)}
                            <img 
                                src={item.thumbnailUrl} 
                                alt={item.title}
                                className="content-image"
                                onError={(e) => {
                                    e.target.src = 'https://via.placeholder.com/300x450/333/666?text=No+Image';
                                }}
                            />
                            {item.contentType === 'live' && (
                                <div className="live-dot" title="Live"></div>
                            )}
                        </div>
                        <div className="content-info">
                            <h3 className="content-title">{item.title}</h3>                            
                            <div className="content-meta">
                                {item.genre && item.genre.length > 0 && (
                                    <span className="content-genre" title={item.genre[0].name}>
                                        {item.genre[0].name}
                                    </span>
                                )}
                                {item.language && (
                                    <span className="content-language" title={item.language.name}>
                                        {item.language.name}
                                    </span>
                                )}
                                {/* {item.channelNo && (
                                    <span className="content-channel">
                                        Ch. {item.channelNo}
                                    </span>
                                )} */}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Empty State */}
            {content.length === 0 && (
                <div className="content-empty">
                    <div className="empty-icon">📺</div>
                    <h3>No content available</h3>
                    <p>No {categoryType} content found for "{categoryName}"</p>
                </div>
            )}
        </div>
    );
}

export default ContentGrid; 