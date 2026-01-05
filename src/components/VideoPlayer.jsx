import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ShakaPlayer from './ShakaPlayer';
import API from '../services/api';
import './VideoPlayer.css';

const VideoPlayer = ({ 
    channelId, 
    channelTitle, 
    onClose, 
    showCloseButton = true,
    autoPlay = true,
    className = '',
    containerClassName = '',
    embedded = false
}) => {
    const navigate = useNavigate();
    const [showPlayer, setShowPlayer] = useState(false);
    const [channelInfo, setChannelInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchChannelData = async () => {
            try {
                setLoading(true);
                setError(null);
                
                if (!channelId) {
                    console.log('VideoPlayer - No channelId provided');
                    if (onClose) {
                        onClose();
                    } else {
                        if (window.history.length > 1) {
                            navigate(-1);
                        } else {
                            navigate('/', { replace: true });
                        }
                    }
                    return;
                }

                const decodedChannelId = decodeURIComponent(channelId);
                const decodedChannelTitle = decodeURIComponent(channelTitle || 'Live Channel');
                
                console.log('VideoPlayer - Decoded values:', { decodedChannelId, decodedChannelTitle });
                
                // Fetch EPG data to get the channel's video URL
                const epgRes = await API.get("/epg-files/join-epg-content");
                console.log('EPG Data loaded for VideoPlayer:', epgRes);
                
                // Find the specific channel
                const channelData = epgRes?.find(item => 
                    item.content?.ChannelID === decodedChannelId
                );
                
                console.log('Found channel data:', channelData);
                console.log('All available channels:', epgRes?.map(item => ({
                    id: item.content?.ChannelID,
                    title: item.content?.title,
                    hasVideoUrl: !!(item.content?.videoUrl || item.content?.streamUrl)
                })));
                
                if (channelData) {
                    // Extract video URL from channel data
                    const videoUrl = channelData.content?.streamUrl || 
                                    channelData.content?.videoUrl || 
                                    channelData.content?.url ||
                                    channelData.streamUrl ||
                                    channelData.videoUrl ||
                                    channelData.url;
                    
                    console.log('Found video URL:', videoUrl);
                    
                    if (videoUrl) {
                        setChannelInfo({
                            id: decodedChannelId,
                            title: decodedChannelTitle,
                            videoUrl: videoUrl,
                            channelData: channelData.content
                        });
                        setShowPlayer(true);
                    } else {
                        console.error('No video URL found for channel:', decodedChannelId);
                        console.error('Available fields in channel data:', Object.keys(channelData.content || {}));
                        setError(`No video stream available for ${decodedChannelTitle}. Available fields: ${Object.keys(channelData.content || {}).join(', ')}`);
                    }
                } else {
                    console.error('Channel not found:', decodedChannelId);
                    console.error('Available channel IDs:', epgRes?.map(item => item.content?.ChannelID));
                    setError(`Channel "${decodedChannelTitle}" not found. Available channels: ${epgRes?.map(item => item.content?.ChannelID).join(', ')}`);
                }
                
            } catch (err) {
                console.error('Error fetching channel data:', err);
                setError('Failed to load channel data. Please check your connection and try again.');
            } finally {
                setLoading(false);
            }
        };

        fetchChannelData();
    }, [channelId, channelTitle, onClose, navigate]);

    const handleClosePlayer = () => {
        setShowPlayer(false);
        if (onClose) {
            onClose();
        } else {
            if (window.history.length > 1) {
                navigate(-1);
            } else {
                navigate('/', { replace: true });
            }
        }
    };

    if (loading) {
        return (
            <div className={`video-player-container ${embedded ? 'video-player-embedded' : ''} ${containerClassName}`}>
                <div className="video-loading">
                    <div className="video-spinner"></div>
                    <p>Loading channel...</p>
                </div>
            </div>
        );
    }  

    if (error) {
        return (
            <div className={`video-player-container ${embedded ? 'video-player-embedded' : ''} ${containerClassName}`}>
                <div className="video-error-container">
                    <p>{error}</p>
                    <button 
                        onClick={handleClosePlayer} 
                        className="video-retry-button"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    if (!showPlayer || !channelInfo) {
        return null;
    }

    return (
        <div className={`video-player-container ${embedded ? 'video-player-embedded' : ''} ${containerClassName}`}>            
            <ShakaPlayer
                videoUrl={channelInfo.videoUrl}
                channelTitle={channelInfo.title}
                channelNumber={channelInfo?.channelData?.channelNo}
                channelLogo={channelInfo?.channelData?.logoUrl || channelInfo?.channelData?.thumbnailUrl}
                bgGradient={channelInfo?.channelData?.bgGradient}
                programmes={channelInfo?.channelData?.tv?.programme || []}
                onClose={showCloseButton ? handleClosePlayer : null}
                autoPlay={autoPlay}
                className={`${className} ${embedded ? 'shaka-player-embedded' : ''}`}
                embedded={embedded}
            />
        </div>
    );
};

export default VideoPlayer; 