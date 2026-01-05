import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../../services/api';
import './Categories.css';

function Categories() {
    const [mostWatchedChannels, setMostWatchedChannels] = useState([]);
    const [trendingChannels, setTrendingChannels] = useState([]);
    const [allGenres, setAllGenres] = useState([]);
    const [allLanguages, setAllLanguages] = useState([]);
    const [hoveredSection, setHoveredSection] = useState(null);
    const languagesGridRef = useRef(null);
    const genresGridRef = useRef(null);
    const navigate = useNavigate();

    // D-pad navigation state
    const containerRef = useRef(null);

    // Scroll functions
    const scrollLeft = (ref) => {
        if (ref.current) {
            ref.current.scrollBy({ left: -300, behavior: 'smooth' });
        }
    };

    const scrollRight = (ref) => {
        if (ref.current) {
            ref.current.scrollBy({ left: 300, behavior: 'smooth' });
        }
    };

    // D-pad navigation function
    const handleKeyDown = (e) => {
        const isActiveElementInContainer = containerRef.current?.contains(document.activeElement);
        
        if (!isActiveElementInContainer) {
            return;
        }

        const currentCategorySection = document.activeElement?.closest('.category-section-cat');
        if (!currentCategorySection) return;

        const focusableElements = Array.from(currentCategorySection.querySelectorAll('.category-card') || []);
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

            case 'ArrowLeft':
                if (currentIndex > 0) {
                    newIndex = currentIndex - 1;
                }
                e.preventDefault();
                break;

            case 'ArrowDown': {
                const allCategorySections = containerRef.current?.querySelectorAll('.category-section-cat') || [];
                const currentCategoryIndex = Array.from(allCategorySections).findIndex(section => section === currentCategorySection);

                if (currentCategoryIndex < allCategorySections.length - 1) {
                    const nextCategory = allCategorySections[currentCategoryIndex + 1];
                    const nextCategoryElements = Array.from(nextCategory.querySelectorAll('.category-card') || []);
                    if (nextCategoryElements.length > 0) {
                        const targetIndex = Math.min(currentIndex, nextCategoryElements.length - 1);
                        nextCategoryElements[targetIndex].focus();
                        nextCategory.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        return;
                    }
                }
                e.preventDefault();
                break;
            }

            case 'ArrowUp': {
                const allCategorySections = containerRef.current?.querySelectorAll('.category-section-cat') || [];
                const currentCategoryIndex = Array.from(allCategorySections).findIndex(section => section === currentCategorySection);

                if (currentCategoryIndex > 0) {
                    const prevCategory = allCategorySections[currentCategoryIndex - 1];
                    const prevCategoryElements = Array.from(prevCategory.querySelectorAll('.category-card') || []);
                    if (prevCategoryElements.length > 0) {
                        const targetIndex = Math.min(currentIndex, prevCategoryElements.length - 1);
                        prevCategoryElements[targetIndex].focus();
                        prevCategory.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        return;
                    }
                }
                e.preventDefault();
                break;
            }

            case 'Enter':
                document.activeElement?.click();
                e.preventDefault();
                break;
        }

        if (newIndex !== currentIndex && focusableElements[newIndex]) {
            focusableElements[newIndex].focus();

            const parentGrid = focusableElements[newIndex].closest('.category-grid');
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

    const handleChannelClick = (channelId, channelTitle, channelProgram, channelList) => {
        const cleanChannelId = encodeURIComponent(channelId);
        const cleanChannelTitle = encodeURIComponent(channelTitle);
        
        // Get current time in Asia/Kolkata timezone as HHMMSS
        const now = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false });
        const currentTime = now.replace(/:/g, ''); // Convert to "HHMMSS" format

        // Helper: Extract HHMMSS from _start/_stop
        function extractTime(str) {
        return str.slice(8, 14); // Get HHMMSS from YYYYMMDDHHMMSS
        }

        function getDayName(yyyymmdd) {
            const year = yyyymmdd.slice(0, 4);
            const month = yyyymmdd.slice(4, 6);
            const day = yyyymmdd.slice(6, 8);
            const date = new Date(`${year}-${month}-${day}`);
            return date.toLocaleDateString('en-US', { weekday: 'short' });
        }

        // Find the current program based on time only
        const currentProgram = channelProgram.find(item => {
        const startTime = extractTime(item._start);
        const stopTime = extractTime(item._stop);
        return currentTime >= startTime && currentTime < stopTime;
        });
        let programDetails = {
            date: currentProgram.date,
            day: getDayName(currentProgram.date),
            title: currentProgram.title,
            desc: currentProgram.desc,
            start: extractTime(currentProgram._start),
            end: extractTime(currentProgram._stop)
        };
        

        // return;
        // Pass the channel list as state to the TvPlayer
        navigate(`/tv-player?channelId=${cleanChannelId}&title=${cleanChannelTitle}`, {
            replace: true,
            state: {
                channelList: channelList,
                currentChannelId: channelId,
                currentChannelTitle: channelTitle,
                currentChannelProgram: programDetails
            }
        });
    };

    // Fetch Most Watched category data
    useEffect(() => {
        const fetchMostWatched = async () => {
            try {
                const response = await API.get("/homescreenCategory");
                const res1 = await API.get("/genres");
                const genres = res1.map(({ _id, name }) => ({ _id, name }));
                setAllGenres(genres);
                const res2 = await API.get("/languages");
                const languages = res2.map(({ _id, name }) => ({ _id, name }));
                setAllLanguages(languages);
                
                const mostWatchedCategory = response.find(cat => cat.name === "Most Watched");
                const trendingCategory = response.find(cat => cat.name === "Trending");
                
                // Fetch EPG data once for both categories
                const epgResponse = await API.get('/epg-files/join-epg-content');
                
                // Process Most Watched channels
                if (mostWatchedCategory && mostWatchedCategory.channels) {                    
                    const channelsWithDetails = mostWatchedCategory.channels
                        .map(chId => {
                            const channel = epgResponse.find(item => item.content?.ChannelID === chId);
                            if (!channel || !channel.content) {
                                return null;
                            }
                            
                            return {
                                id: chId,
                                name: channel.content.title || chId,
                                thumbnail: channel.content.thumbnailUrl,
                                channelId: chId,
                                bgGradient: channel.content.bgGradient,
                                programme: channel.tv.programme,
                            };
                        })
                        .filter(channel => channel !== null);
                    setMostWatchedChannels(channelsWithDetails);
                } else {
                    setMostWatchedChannels([]);
                }
                
                // Process Trending channels
                if (trendingCategory && trendingCategory.channels) {
                    const trendingChannelsWithDetails = trendingCategory.channels
                        .map(chId => {
                            const channel = epgResponse.find(item => item.content?.ChannelID === chId);
                            if (!channel || !channel.content) {
                                return null;
                            }
                            
                            return {
                                id: chId,
                                name: channel.content.title || chId,
                                thumbnail: channel.content.thumbnailUrl,
                                channelId: chId,
                                bgGradient: channel.content.bgGradient,
                                programme: channel.tv.programme,
                            };
                        })
                        .filter(channel => channel !== null);
                    setTrendingChannels(trendingChannelsWithDetails);
                } else {
                    setTrendingChannels([]);
                }
            } catch (err) {
                setMostWatchedChannels([]);
                setTrendingChannels([]);
            }
        };

        fetchMostWatched();
    }, []);

    // Add keyboard event listener for D-pad navigation
    useEffect(() => {
        const handleGlobalKeyDown = (e) => {
            // Only handle arrow keys and Enter
            if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter'].includes(e.key)) {
                handleKeyDown(e);
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        
        // Set initial focus on first card
        setTimeout(() => {
            const firstCard = document.querySelector('.language-card');
            if (firstCard) {
                firstCard.focus();
            }
        }, 100);

        return () => {
            window.removeEventListener('keydown', handleGlobalKeyDown);
        };
    }, []);

    const browseCategories = [
        { id: 1, name: 'Sparks', icon: '🔥', color: '#ff6b6b' },
        { id: 2, name: 'News', icon: '📰', color: '#4ecdc4' },
        { id: 3, name: 'TV', icon: '📺', color: '#45b7d1' },
        { id: 4, name: 'Movies', icon: '🍿', color: '#96ceb4' },
        { id: 5, name: 'Sports', icon: '🏃', color: '#feca57' }
    ];

    const studios = [
        { id: 4, name: 'peacock', logo: 'https://api-demo.caastv.com/uploads/icons/Peacock.png', color: '#ffffff' },
        { id: 5, name: 'Paramount+', logo: 'https://api-demo.caastv.com/uploads/icons/Paramount.svg', color: '#ffffff' },
        { id: 2, name: 'Disney+', logo: 'https://api-demo.caastv.com/uploads/icons/Disney.png', color: '#ffffff' },
        { id: 3, name: 'HBO', logo: 'https://api-demo.caastv.com/uploads/icons/HBO.svg', color: '#ffffff' },
        { id: 1, name: 'Caastv specials', logo: 'https://api-demo.caastv.com/uploads/icons/caastv.png', color: '#00d4ff' },
    ];

    const popularLanguages = [
        { "id": 1, "name": "Hindi", "native": "हिन्दी", "image": "https://api-demo.caastv.com/uploads/language-icons/hindi.png" },
        { "id": 2, "name": "English", "native": "English", "image": "https://api-demo.caastv.com/uploads/language-icons/tom.png" },
        { "id": 3, "name": "Tamil", "native": "தமிழ்", "image": "https://api-demo.caastv.com/uploads/language-icons/tamil.png" },
        { "id": 4, "name": "Telugu", "native": "తెలుగు", "image": "https://api-demo.caastv.com/uploads/language-icons/telugu.png" },
        { "id": 5, "name": "Malayalam", "native": "മലയാളം", "image": "https://api-demo.caastv.com/uploads/language-icons/malayalam.png" },
        { "id": 6, "name": "Bangali", "native": "বাংলা", "image": "https://api-demo.caastv.com/uploads/language-icons/bangali.png" },
        { "id": 7, "name": "Marathi", "native": "मराठी", "image": "https://api-demo.caastv.com/uploads/language-icons/marathi.png" },
        { "id": 8, "name": "Kannada", "native": "ಕನ್ನಡ", "image": "https://api-demo.caastv.com/uploads/language-icons/kannada.png" },
        { "id": 9, "name": "Gujrati", "native": "ગુજરાતી", "image": "https://api-demo.caastv.com/uploads/language-icons/gujrati.png" },
        { "id": 10, "name": "Bhojpuri", "native": "भोजपुरी", "image": "https://api-demo.caastv.com/uploads/language-icons/bhojpuri.png" },
        { "id": 11, "name": "Odia", "native": "ଓଡ଼ିଆ", "image": "https://api-demo.caastv.com/uploads/language-icons/odia.png" }
    ];

    const genreImages = {
        "action": "https://api-demo.caastv.com/uploads/genre-icons/action.jpg",
        "comedy": "https://api-demo.caastv.com/uploads/genre-icons/comedy.jpg",
        "drama": "https://api-demo.caastv.com/uploads/genre-icons/drama.jpg",
        "romance": "https://api-demo.caastv.com/uploads/genre-icons/romance.jpg",
        "horror": "https://api-demo.caastv.com/uploads/genre-icons/horror.jpg",
        "thriller": "https://api-demo.caastv.com/uploads/genre-icons/thriller.jpg",
        "fantasy": "https://api-demo.caastv.com/uploads/genre-icons/fantasy.jpeg",
        "sci-fi": "https://api-demo.caastv.com/uploads/genre-icons/sci-fi.jpg",
        "mystery": "https://api-demo.caastv.com/uploads/genre-icons/mystery.jpg",
        "biopic": "https://api-demo.caastv.com/uploads/genre-icons/biopic.jpg",
        "animation": "https://api-demo.caastv.com/uploads/genre-icons/animation.jpg"
    };

    const defaultGenreImages = [
        "https://api-demo.caastv.com/uploads/genre-icons/default1.jpg",
        "https://api-demo.caastv.com/uploads/genre-icons/default2.jpg",
        "https://api-demo.caastv.com/uploads/genre-icons/default3.jpg",
        "https://api-demo.caastv.com/uploads/genre-icons/default4.jpg",
        "https://api-demo.caastv.com/uploads/genre-icons/default5.jpg",
        "https://api-demo.caastv.com/uploads/genre-icons/default6.jpg",
        "https://api-demo.caastv.com/uploads/genre-icons/default7.jpg",
        "https://api-demo.caastv.com/uploads/genre-icons/default8.jpg",
        "https://api-demo.caastv.com/uploads/genre-icons/default9.jpg",
        "https://api-demo.caastv.com/uploads/genre-icons/default10.jpg"
    ];

    const genresWithImages = useMemo(() => {
        const usedImages = new Map();

        return allGenres.map((genre) => {
            const lowerName = genre.name.toLowerCase();
            let image;

            if (genreImages[lowerName]) {
                image = genreImages[lowerName];
            } else {
                // Check if already assigned a fallback
                if (usedImages.has(genre._id)) {
                    image = usedImages.get(genre._id);
                } else {
                    // Assign and store a random one
                    const randomImage = defaultGenreImages[Math.floor(Math.random() * defaultGenreImages.length)];
                    usedImages.set(genre._id, randomImage);
                    image = randomImage;
                }
            }

            return {
                ...genre,
                image
            };
        });
    }, [allGenres]);

    const languageImageMap = {
        "hindi": {
            image: "https://api-demo.caastv.com/uploads/language-icons/hindi.png",
            native: "हिन्दी"
        },
        "english": {
            image: "https://api-demo.caastv.com/uploads/language-icons/tom.png",
            native: "English"
        },
        "tamil": {
            image: "https://api-demo.caastv.com/uploads/language-icons/tamil.png",
            native: "தமிழ்"
        },
        "telugu": {
            image: "https://api-demo.caastv.com/uploads/language-icons/telugu.png",
            native: "తెలుగు"
        },
        "malayalam": {
            image: "https://api-demo.caastv.com/uploads/language-icons/malayalam.png",
            native: "മലയാളം"
        },
        "bangali": {
            image: "https://api-demo.caastv.com/uploads/language-icons/bangali.png",
            native: "বাংলা"
        },
        "marathi": {
            image: "https://api-demo.caastv.com/uploads/language-icons/marathi.png",
            native: "मराठी"
        },
        "kannada": {
            image: "https://api-demo.caastv.com/uploads/language-icons/kannada.png",
            native: "ಕನ್ನಡ"
        },
        "gujrati": {
            image: "https://api-demo.caastv.com/uploads/language-icons/gujrati.png",
            native: "ગુજરાતી"
        },
        "bhojpuri": {
            image: "https://api-demo.caastv.com/uploads/language-icons/bhojpuri.png",
            native: "भोजपुरी"
        },
        "odia": {
            image: "https://api-demo.caastv.com/uploads/language-icons/odia.png",
            native: "ଓଡ଼ିଆ"
        }
    };
    
    // Fallback images for languages not in hardcoded list
    const defaultLanguageImages = [
        "https://api-demo.caastv.com/uploads/language-icons/odia.png",
        "https://api-demo.caastv.com/uploads/language-icons/odia.png",
        "https://api-demo.caastv.com/uploads/language-icons/odia.png",
        "https://api-demo.caastv.com/uploads/language-icons/odia.png",
        "https://api-demo.caastv.com/uploads/language-icons/odia.png"
    ];

    const getRandomFallbackLanguageImage = () => {
        const index = Math.floor(Math.random() * defaultLanguageImages.length);
        return defaultLanguageImages[index];
    };

    // Handle genre click
    const handleGenreClick = async (genreId, genreName) => {
        try {
            // Build query parameters
            const params = new URLSearchParams({
                page: '1',
                limit: '20',
                genres: genreId,
                sorting: JSON.stringify({
                    field: 'title',
                    direction: 'asc'
                })
            });
            
            // Use clean API architecture
            const data = await API.get(`/content?${params}`);
            
            // Navigate to content grid with the data
            navigate('/content-grid', {
                replace: true,
                state: {
                    content: data.content,
                    totalCount: data.totalCount,
                    categoryName: genreName,
                    categoryType: 'genre',
                    categoryId: genreId
                }
            });
        } catch (error) {
            console.error("Error fetching genre content:", error);
        }
    };

    // Handle language click
    const handleLanguageClick = async (languageId, languageName) => {
        try {
            // Build query parameters
            const params = new URLSearchParams({
                page: '1',
                limit: '20',
                languages: languageId,
                sorting: JSON.stringify({
                    field: 'title',
                    direction: 'asc'
                })
            });
            
            // Use clean API architecture
            const data = await API.get(`/content?${params}`);            
            // Navigate to content grid with the data
            navigate('/content-grid', {
                replace: true,
                state: {
                    content: data.content,
                    totalCount: data.totalCount,
                    categoryName: languageName,
                    categoryType: 'language',
                    categoryId: languageId
                }
            });
        } catch (error) {
            console.error("Error fetching language content:", error);
        }
    };

    return (
        <div 
            className="categories-container" 
            ref={containerRef}
        >
            {/* <div className="categories-header">
                <h1>Categories</h1>
            </div> */}

            <div className="categories-content">
                {/* Browse Section */}
                {/* <div className="category-section-cat">
                    <h2>Browse</h2>
                    <div className="category-grid">
                        {browseCategories.map((category) => (
                            <div key={category.id} className="category-card browse-card">
                                <div className="browse-card-content">
                                    <div className="browse-icon-large">
                                        <span className="icon-text">{category.icon}</span>
                                    </div>
                                    <span className="browse-category-name">{category.name}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div> */}

                {/* Studios Section */}
                {/* <div className="category-section-cat">
                    <h2>Studios</h2>
                    <div className="category-grid">
                        {studios.map((studio) => (
                            <div key={studio.id} className="category-card studio-card">
                                <div className="studio-logo">
                                    <img src={studio.logo} alt={studio.name} className="studio-logo-img" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div> */}

                {/* Popular Languages Section */}
                <div 
                    className="category-section-cat"
                    onMouseEnter={() => setHoveredSection('languages')}
                    onMouseLeave={() => setHoveredSection(null)}
                >
                    <h2>Popular Languages</h2>
                    <div className="scroll-container">
                        {hoveredSection === 'languages' && (
                            <button 
                                className="scroll-btn scroll-btn-left"
                                onClick={() => scrollLeft(languagesGridRef)}
                            >‹
                            </button>
                        )}
                        <div className="category-grid languages-grid" ref={languagesGridRef}>
                        {allLanguages.map((language) => {
                            const lowerName = language.name.toLowerCase();
                            const data = languageImageMap[lowerName];

                            const image = data?.image || getRandomFallbackLanguageImage();
                            const native = data?.native || language.name;

                            return (
                                <button 
                                    key={language._id} 
                                    className="category-card language-card"
                                    onClick={() => handleLanguageClick(language._id, language.name)}
                                    tabIndex={0}
                                    aria-label={`Browse ${language.name} content`}
                                >
                                    <div className="language-image">
                                        <img src={image} alt={language.name} className="language-avatar-img" />
                                    </div>
                                    <div className="language-info">
                                        <span className="native-text">{native}</span>
                                        <span className="english-text">{language.name}</span>
                                    </div>
                                </button>
                            );
                        })}
                        </div>
                        {hoveredSection === 'languages' && (
                            <button 
                                className="scroll-btn scroll-btn-right"
                                onClick={() => scrollRight(languagesGridRef)}
                            >›
                            </button>
                        )}
                    </div>
                </div>

                {/* Popular Genres Section */}
                <div 
                    className="category-section-cat"
                    onMouseEnter={() => setHoveredSection('genres')}
                    onMouseLeave={() => setHoveredSection(null)}
                >
                    <h2>Popular Genres</h2>
                    <div className="scroll-container">
                        {hoveredSection === 'genres' && (
                            <button 
                                className="scroll-btn scroll-btn-left"
                                onClick={() => scrollLeft(genresGridRef)}
                            >‹
                            </button>
                        )}
                        <div className="category-grid genres-grid" ref={genresGridRef}>
                        {genresWithImages.map((genre) => (
                            <button 
                                key={genre._id} 
                                className="category-card genre-card"
                                onClick={() => handleGenreClick(genre._id, genre.name)}
                                tabIndex={0}
                                aria-label={`Browse ${genre.name} content`}
                            >
                                <div className="genre-image">
                                    <img src={genre.image} alt={genre.name} className="genre-avatar-img genre-image-blur" />
                                </div>
                                <div className="genre-info">
                                    <span className="genre-name">{genre.name}</span>
                                </div>
                            </button>
                        ))}
                        </div>
                        {hoveredSection === 'genres' && (
                            <button 
                                className="scroll-btn scroll-btn-right"
                                onClick={() => scrollRight(genresGridRef)}
                            >›
                            </button>
                            )}
                    </div>
                </div>

                {/* Most Watched Section */}
                <div className="category-section-cat">
                    <h2>Most Watched</h2>
                    <div className="category-grid most-watched-grid">
                        {mostWatchedChannels.map((channel) => (
                            <button 
                                key={channel.id} 
                                className="category-card most-watched-card"
                                onClick={() => handleChannelClick(channel.channelId, channel.name, channel.programme, mostWatchedChannels)}
                                tabIndex={0}
                                aria-label={`Watch ${channel.name}`}
                            >
                                <div className="most-watched-thumbnail">
                                    <img
                                        src={channel.thumbnail}
                                        alt={channel.name}
                                        className="most-watched-image most-watched-image-blur"
                                    />
                                </div>
                                <span className="most-watched-name">{channel.name}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Trending Section */}
                <div className="category-section-cat">
                    <h2>Trending</h2>
                    <div className="category-grid trending-grid">
                        {trendingChannels.map((channel) => (
                            <button 
                                key={channel.id} 
                                className="category-card trending-card"
                                onClick={() => handleChannelClick(channel.channelId, channel.name, channel.programme, trendingChannels)}
                                tabIndex={0}
                                aria-label={`Watch ${channel.name}`}
                            >
                                <div className="trending-thumbnail">
                                    <img
                                        src={channel.thumbnail}
                                        alt={channel.name}
                                        className="trending-image trending-image-blur"
                                    />
                                </div>
                                <span className="trending-name">{channel.name}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Categories; 