import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import VideoPlayer from '../../components/VideoPlayer';
import API from '../../services/api';
import { getGradientStyle } from '../../utils/gradientUtils';
import './TvPlayer.css';

function TvPlayer({ 
    channelList = [], 
    currentChannelId = null,
    currentChannelTitle = null,
    currentChannelProgram = null
}) {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const location = useLocation();
    const channelId = searchParams.get('channelId') || currentChannelId;
    const title = searchParams.get('title') || currentChannelTitle;
    const [activeTab, setActiveTab] = useState('suggestions');
    const [currentChannel, setCurrentChannel] = useState(null);
    const [suggestions, setSuggestions] = useState([]);
    const [currentProgram, setCurrentProgram] = useState(null);

    // Get program data from location state or props
    const getCurrentProgram = () => {
        return location.state?.currentChannelProgram || currentChannelProgram || null;
    };

    // Format time from HHMMSS to HH:MM AM/PM
    const formatTime = (timeString) => {
        if (!timeString || timeString.length !== 6) return '';
        
        const hours = parseInt(timeString.substring(0, 2));
        const minutes = timeString.substring(2, 4);
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        
        return `${displayHours}:${minutes} ${ampm}`;
    };

    // Format date from YYYYMMDD to readable format
    const formatDate = (dateString) => {
        if (!dateString || dateString.length !== 8) return '';
        
        const year = dateString.substring(0, 4);
        const month = dateString.substring(4, 6);
        const day = dateString.substring(6, 8);
        
        const date = new Date(`${year}-${month}-${day}`);
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
        });
    };

    // Get channel list from location state or props
    const getChannelList = () => {
        // Priority: location state > props > empty array
        return location.state?.channelList || channelList || [];
    };

    // Process channel data and set up suggestions
    useEffect(() => {
        const processChannelData = async () => {
            try {
                // Set current program data
                const programData = getCurrentProgram();
                setCurrentProgram(programData);
                
                const availableChannelList = getChannelList();
                
                // If channelList is provided, use it directly
                if (availableChannelList.length > 0) {
                    // Find current channel from the provided list
                    const currentChannelData = availableChannelList.find(channel => 
                        channel.channelId === channelId || channel.id === channelId
                    );
                    
                    if (currentChannelData) {
                        setCurrentChannel({
                            id: channelId,
                            name: title || currentChannelData.name || 'Unknown Channel',
                            videoUrl: currentChannelData.videoUrl || currentChannelData.streamUrl,
                            thumbnail: currentChannelData.thumbnail,
                            logo: currentChannelData.logo
                        });
                    }

                    // Set suggestions as remaining channels (excluding current)
                    const remainingChannels = availableChannelList
                        .filter(channel => 
                            (channel.channelId !== channelId && channel.id !== channelId)
                        )
                        .map(channel => ({
                            id: channel.channelId || channel.id,
                            name: channel.name,
                            logo: channel.logo || channel.thumbnail,
                            videoUrl: channel.videoUrl || channel.streamUrl
                        }));

                    setSuggestions(remainingChannels);
                } else {
                    // Fallback: Fetch data if no channelList provided
                    const homescreenResponse = await API.get("/homescreenCategory");
                    const mostWatchedCategory = homescreenResponse.find(cat => cat.name === "Most Watched");
                    
                    const epgResponse = await API.get('/epg-files/join-epg-content');
                    
                    const currentChannelData = epgResponse.find(item => 
                        item.content?.ChannelID === channelId
                    );
                    
                    if (currentChannelData) {
                        setCurrentChannel({
                            id: channelId,
                            name: title || currentChannelData.content?.title || 'Unknown Channel',
                            videoUrl: currentChannelData.content?.streamUrl || 
                                      currentChannelData.content?.videoUrl || 
                                      currentChannelData.content?.url,
                            thumbnail: currentChannelData.content?.thumbnailUrl,
                            logo: currentChannelData.content?.logoUrl
                        });
                    }

                    if (mostWatchedCategory && mostWatchedCategory.channels) {
                        const mostWatchedChannels = mostWatchedCategory.channels
                            .filter(chId => chId !== channelId)
                            .map(chId => {
                                const channel = epgResponse.find(item => item.content?.ChannelID === chId);
                                return {
                                    id: chId,
                                    name: channel ? channel.content?.title : chId,
                                    logo: channel?.content?.logoUrl || channel?.content?.thumbnailUrl,
                                    videoUrl: channel?.content?.streamUrl || 
                                             channel?.content?.videoUrl || 
                                             channel?.content?.url
                                };
                            })
                            .filter(channel => channel.name && channel.name !== 'Unknown Channel');

                        setSuggestions(mostWatchedChannels);
                    } else {
                        const otherChannels = epgResponse
                            .filter(item => item.content?.ChannelID !== channelId)
                            .slice(0, 10)
                            .map(item => ({
                                id: item.content?.ChannelID,
                                name: item.content?.title || 'Unknown Channel',
                                logo: item.content?.logoUrl || item.content?.thumbnailUrl,
                                videoUrl: item.content?.streamUrl || 
                                         item.content?.videoUrl || 
                                         item.content?.url
                            }));
                        setSuggestions(otherChannels);
                    }
                }
                
            } catch (error) {
                console.error('Error processing channel data:', error);
            }
        };

        if (channelId) {
            processChannelData();
        }
    }, [channelId, title, getChannelList()]);

    const handleChannelClick = (newChannelId, newChannelName) => {
        const cleanChannelId = encodeURIComponent(newChannelId);
        const cleanChannelName = encodeURIComponent(newChannelName);
        
        // Pass the current channel list to maintain context
        const currentChannelList = getChannelList();
        navigate(`/tv-player?channelId=${cleanChannelId}&title=${cleanChannelName}`, {
            replace: true,
            state: {
                channelList: currentChannelList,
                currentChannelId: newChannelId,
                currentChannelTitle: newChannelName
            }
        });
    };

    const handleBackNavigation = () => {
        // Use browser history to go back to the previous page
        if (window.history.length > 1) {
            navigate(-1);
        } else {
            // Fallback to home if no history
            navigate('/', { replace: true });
        }
    };

    return (
        <div className="tv-player-container">
            {/* Top Navigation Bar */}
            <div className="tv-top-nav">
                <div className="tv-nav-left">
                    <div className="tv-logo">WebTV</div>
                    <div className="tv-nav-menu">
                        <span className="tv-nav-item">Free Streaming</span>
                        <span className="tv-nav-item tv-active">LIVE TV</span>
                    </div>
                </div>
                <div className="tv-nav-right">
                    {/* <div className="tv-nav-icon">
                        <span className="tv-icon">🌐</span>
                        <span>Languages</span>
                    </div>
                    <div className="tv-nav-icon">
                        <span className="tv-icon">🔍</span>
                        <span>Search</span>
                    </div>
                    <div className="tv-nav-icon">
                        <span className="tv-icon">👤</span>
                        <span>Sign in</span>
                        <span className="tv-dropdown">▼</span>
                    </div> */}
                </div>
            </div>

            {/* Main Content */}
            <div className="tv-main-content">
                {/* Left Section - Video Player */}
                <div className="tv-video-section">
                    {/* Video Player */}
                    <div className="tv-video-player">
                        <VideoPlayer
                            channelId={channelId}
                            channelTitle={title}
                            showCloseButton={false}
                            autoPlay={true}
                            embedded={true}
                            containerClassName="tv-video-player-container"
                            onClose={handleBackNavigation}
                        />
                    </div>

                    {/* Program Details */}
                    <div className="tv-program-details">
                        <div className="tv-program-title">{currentChannel?.name || 'Live Channel'}</div>
                        <div className="tv-program-meta">
                            <span className="tv-program-info">
                                {currentProgram ? (
                                    `${currentProgram.title} | ${currentProgram.day}, ${formatDate(currentProgram.date)} | ${formatTime(currentProgram.start)} - ${formatTime(currentProgram.end)}`
                                ) : (
                                    'Loading program information...'
                                )}
                            </span>
                            <div className="tv-program-actions">
                                <button className="tv-action-btn">
                                    <span className="tv-heart-icon">♥</span>
                                    <span>Favourite</span>
                                </button>
                                <button className="tv-action-btn">
                                    <span className="tv-share-icon">↗</span>
                                    <span>Share</span>
                                </button>
                            </div>
                        </div>
                        <div className="tv-program-description">
                            {currentProgram?.desc || 'No program description available.'}
                        </div>
                    </div>
                </div>

                {/* Right Section - Sidebar */}
                <div className="tv-sidebar">
                    {/* Sidebar Tabs */}
                    <div className="tv-sidebar-tabs">
                        <button 
                            className={`tv-tab-btn ${activeTab === 'suggestions' ? 'tv-active' : ''}`}
                            onClick={() => setActiveTab('suggestions')}
                        >
                            SUGGESTIONS
                        </button>
                        <button 
                            className={`tv-tab-btn ${activeTab === 'catchup' ? 'tv-active' : ''}`}
                            onClick={() => setActiveTab('catchup')}
                        >
                            CATCH-UP
                        </button>
                    </div>

                    {/* Tab Content */}
                    <div className="tv-tab-content">
                        {activeTab === 'suggestions' && (
                            <div className="tv-suggestions-list">
                                {suggestions.length > 0 ? (
                                    suggestions.map((channel) => (
                                        <div 
                                            key={channel.id} 
                                            className={`tv-suggestion-item ${channel.id === channelId ? 'tv-current' : ''}`}
                                            onClick={() => handleChannelClick(channel.id, channel.name)}
                                        >
                                            <div className="tv-channel-logo" style={getGradientStyle(channel.bgGradient)}>
                                                {channel.logo ? (
                                                    <img src={channel.logo} alt={channel.name} />
                                                ) : (
                                                    <div className="tv-channel-placeholder">📺</div>
                                                )}
                                            </div>
                                            <div className="tv-channel-info">
                                                {channel.id === channelId && (
                                                    <div className="tv-channel-status">Watching Now</div>
                                                )}
                                                <div className="tv-channel-name">{channel.name}</div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="tv-no-suggestions">
                                        <p>No suggestions available</p>
                                    </div>
                                )}
                                <div className="tv-scroll-indicator"></div>
                            </div>
                        )}

                        {activeTab === 'catchup' && (
                            <div className="tv-catchup-list">
                                <div className="tv-no-catchup">No Catchup available</div>
                                {/* {catchUpContent.map((item) => (
                                    <div key={item.id} className="tv-catchup-item">
                                        <div className="tv-catchup-info">
                                            <div className="tv-catchup-name">{item.name}</div>
                                            <div className="tv-catchup-time">{item.time} • {item.duration}</div>
                                        </div>
                                    </div>
                                ))} */}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default TvPlayer;