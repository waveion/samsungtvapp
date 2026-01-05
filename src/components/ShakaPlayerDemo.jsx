import React, { useState } from 'react';
import ShakaPlayer from './ShakaPlayer';
import './ShakaPlayerDemo.css';

const ShakaPlayerDemo = () => {
  const [showPlayer, setShowPlayer] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [progress, setProgress] = useState(25);

  // Demo data
  const demoChannel = {
    number: "313",
    title: "Aaj Tak",
    logo: "https://via.placeholder.com/120x120/ff4444/ffffff?text=आज+तक",
    isFree: true
  };

  const demoPrograms = {
    current: {
      title: "Breaking News",
      timeSlot: "12:30 PM - 01:00 PM",
      timeRemaining: "23m left"
    },
    next: "Non-Stop 100"
  };

  // Dynamic banner options
  const bannerOptions = [
    {
      id: 'breaking-news',
      name: 'Breaking News Banner',
      image: 'https://www.google.com/url?sa=i&url=https%3A%2F%2Finsamachar.com%2Faaj-ki-taaja-khabar-12-august-2024-breaking-news-hindi-aaj-ke-mukhya-samachar%2F&psig=AOvVaw3bjMm1zfb7i0hvnqcuZ7Q3&ust=1755068655417000&source=images&cd=vfe&opi=89978449&ved=0CBUQjRxqFwoTCMD-r7PahI8DFQAAAAAdAAAAABAE',
      text: 'BREAKING NEWS'
    },
    {
      id: 'live-sports',
      name: 'Live Sports Banner',
      image: 'https://via.placeholder.com/200x80/00ff00/ffffff?text=LIVE+SPORTS',
      text: 'LIVE SPORTS'
    },
    {
      id: 'special-report',
      name: 'Special Report Banner',
      image: 'https://via.placeholder.com/200x80/ff8800/ffffff?text=SPECIAL+REPORT',
      text: 'SPECIAL REPORT'
    },
    {
      id: 'no-banner',
      name: 'No Banner',
      image: null,
      text: null
    }
  ];

  // Dynamic options configurations
  const optionsConfigs = [
    {
      id: 'default',
      name: 'Default Options',
      options: [
        { id: 'favorite', icon: 'heart', label: 'Favorite', action: () => console.log('Added to favorites') },
        { id: 'info', icon: 'info', label: 'Info', action: () => console.log('Show program info') },
        { id: 'record', icon: 'circle', label: 'Record', action: () => console.log('Start recording') }
      ]
    },
    {
      id: 'extended',
      name: 'Extended Options',
      options: [
        { id: 'favorite', icon: 'heart', label: 'Favorite', action: () => console.log('Added to favorites') },
        { id: 'share', icon: 'share-2', label: 'Share', action: () => console.log('Share content') },
        { id: 'info', icon: 'info', label: 'Info', action: () => console.log('Show program info') },
        { id: 'record', icon: 'circle', label: 'Record', action: () => console.log('Start recording') },
        { id: 'settings', icon: 'settings', label: 'Settings', action: () => console.log('Open settings') }
      ]
    },
    {
      id: 'minimal',
      name: 'Minimal Options',
      options: [
        { id: 'favorite', icon: 'heart', label: 'Favorite', action: () => console.log('Added to favorites') }
      ]
    }
  ];

  const [selectedBanner, setSelectedBanner] = useState(bannerOptions[0]);
  const [selectedOptions, setSelectedOptions] = useState(optionsConfigs[0]);

  // Simulate progress update
  React.useEffect(() => {
    if (showPlayer) {
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) return 0;
          return prev + 1;
        });
      }, 30000); // Update every 30 seconds

      return () => clearInterval(interval);
    }
  }, [showPlayer]);

  // Handler functions
  const handleVolumeChange = (volume) => {
    console.log('Volume changed to:', volume);
  };

  const handleFavorite = () => {
    console.log('Added to favorites');
  };

  const handleInfo = () => {
    console.log('Show program info');
  };

  const handleRecord = () => {
    console.log('Start recording');
  };

  const handleOptions = () => {
    console.log('Show options menu');
  };

  return (
    <div className="shaka-player-demo">
      <div className="demo-header">
        <h1>Enhanced ShakaPlayer Demo</h1>
        <p>Dynamic Banner Images & Configurable Options</p>
        
        <div className="demo-controls">
          <div className="control-section">
            <h3>Select Banner:</h3>
            <div className="banner-selector">
              {bannerOptions.map((banner) => (
                <button
                  key={banner.id}
                  className={`banner-option ${selectedBanner.id === banner.id ? 'active' : ''}`}
                  onClick={() => setSelectedBanner(banner)}
                >
                  {banner.image ? (
                    <img src={banner.image} alt={banner.name} />
                  ) : (
                    <div className="no-banner">No Banner</div>
                  )}
                  <span>{banner.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="control-section">
            <h3>Select Options:</h3>
            <div className="options-selector">
              {optionsConfigs.map((config) => (
                <button
                  key={config.id}
                  className={`option-config ${selectedOptions.id === config.id ? 'active' : ''}`}
                  onClick={() => setSelectedOptions(config)}
                >
                  {config.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button 
          className="demo-button"
          onClick={() => setShowPlayer(true)}
        >
          Launch Enhanced Player
        </button>
      </div>

      {showPlayer && (
        <ShakaPlayer
          videoUrl="https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"
          onClose={() => setShowPlayer(false)}
          channelTitle={demoChannel.title}
          channelNumber={demoChannel.number}
          channelLogo={demoChannel.logo}
          nextProgram={demoPrograms.next}
          currentProgram={demoPrograms.current.title}
          isFree={demoChannel.isFree}
          currentProgramTitle={demoPrograms.current.title}
          currentProgramTime={demoPrograms.current.timeSlot}
          timeRemaining={demoPrograms.current.timeRemaining}
          progressPercentage={progress}
          volume={80}
          onVolumeChange={handleVolumeChange}
          onFavorite={handleFavorite}
          onInfo={handleInfo}
          onRecord={handleRecord}
          onOptions={handleOptions}
          // Dynamic banner and options
          bannerImage={selectedBanner.image}
          bannerText={selectedBanner.text}
          showBanner={!!selectedBanner.image}
          options={selectedOptions.options}
          showVolumeControl={true}
          showOptionsLabel={true}
        />
      )}

      <div className="demo-info">
        <h2>New Dynamic Features:</h2>
        <ul>
          <li>✅ Dynamic banner images with custom text overlay</li>
          <li>✅ Configurable options array with custom icons and actions</li>
          <li>✅ Toggle banner visibility on/off</li>
          <li>✅ Customizable volume control visibility</li>
          <li>✅ Tooltips on hover for option buttons</li>
          <li>✅ Responsive banner sizing for all devices</li>
          <li>✅ Fallback to default banner when no image provided</li>
          <li>✅ Easy integration with your content management system</li>
        </ul>

        <h3>Usage Example:</h3>
        <pre className="code-example">
{`<ShakaPlayer
  // ... other props ...
  
  // Dynamic Banner
  bannerImage="https://your-cdn.com/breaking-news-banner.jpg"
  bannerText="BREAKING NEWS"
  showBanner={true}
  
  // Dynamic Options
  options={[
    { id: 'favorite', icon: 'heart', label: 'Favorite', action: handleFavorite },
    { id: 'share', icon: 'share-2', label: 'Share', action: handleShare },
    { id: 'info', icon: 'info', label: 'Info', action: handleInfo },
    { id: 'record', icon: 'circle', label: 'Record', action: handleRecord }
  ]}
  
  showVolumeControl={true}
  showOptionsLabel={true}
/>`}
        </pre>

        <h3>Banner Image Requirements:</h3>
        <ul>
          <li>Recommended size: 200x80px (desktop), 160x60px (tablet), 140x50px (mobile)</li>
          <li>Format: JPG, PNG, or WebP</li>
          <li>Text overlay will be automatically added on top</li>
          <li>Images are automatically scaled and cropped to fit</li>
        </ul>
      </div>
    </div>
  );
};

export default ShakaPlayerDemo;
