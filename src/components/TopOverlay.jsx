import React from 'react';
import FeatherIcon from 'feather-icons-react';
import './TopOverlay.css';

const TopOverlay = ({
  isFavorite = false,
  onFavoriteClick = () => {},
  onAudioClick = () => {},
  desiredFocusIndex = 0,
  focusToken = 0,
}) => {
  const btnRefs = React.useRef([]);
  const [focusIndex, setFocusIndex] = React.useState(desiredFocusIndex || 0);

  React.useEffect(() => {
    // Focus first button when overlay mounts
    const b = btnRefs.current[desiredFocusIndex || 0];
    try { b && b.focus({ preventScroll: true }); } catch {}
  }, []);

  // When parent asks to focus a specific button, honor it
  React.useEffect(() => {
    const idx = Number.isFinite(desiredFocusIndex) ? desiredFocusIndex : 0;
    setFocusIndex(idx);
    const el = btnRefs.current[idx];
    try { el && el.focus({ preventScroll: true }); } catch {}
  }, [desiredFocusIndex, focusToken]);

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const next = (focusIndex + 1) % 2; // Only 2 buttons now
      setFocusIndex(next);
      try { btnRefs.current[next]?.focus({ preventScroll: true }); } catch {}
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const next = (focusIndex + 1) % 2; // wrap left (only 2 buttons)
      setFocusIndex(next);
      try { btnRefs.current[next]?.focus({ preventScroll: true }); } catch {}
    }
  };

  return (
    <div className="top-overlay-root" role="toolbar" aria-label="Player controls" onKeyDown={handleKeyDown} tabIndex={-1}>
      <button
        className="top-overlay-btn"
        onClick={onFavoriteClick}
        tabIndex={0}
        aria-label="Favorite"
        ref={(el) => (btnRefs.current[0] = el)}
        onFocus={() => setFocusIndex(0)}
      >
        <FeatherIcon icon={isFavorite ? 'heart' : 'heart'} fill={isFavorite ? 'currentColor' : 'none'} />
        <span className="top-overlay-label">Favorites</span>
      </button>

      <button
        className="top-overlay-btn"
        onClick={onAudioClick}
        tabIndex={0}
        aria-label="Audio"
        ref={(el) => (btnRefs.current[1] = el)}
        onFocus={() => setFocusIndex(1)}
      >
        <FeatherIcon icon="volume-2" />
        <span className="top-overlay-label">Audio</span>
      </button>
    </div>
  );
};

export default TopOverlay;


