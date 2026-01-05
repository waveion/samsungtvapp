import React from 'react';
import './SelectionOverlay.css';

const SelectionOverlay = ({
  title,
  options = [],
  selected = null,
  extraTopOption = null, // e.g., 'Auto'
  onExtraTopSelect = null,
  onSelect = () => {},
  onDismiss = () => {},
}) => {
  const hasExtra = Boolean(extraTopOption);
  const totalRows = (options?.length || 0) + (hasExtra ? 1 : 0);
  const listRef = React.useRef([]);
  const rootRef = React.useRef(null);

  const initialIndex = React.useMemo(() => {
    if (selected == null) return 0;
    const idx = options.indexOf(selected);
    return (idx >= 0 ? idx + (hasExtra ? 1 : 0) : 0);
  }, [selected, options, hasExtra]);

  const [focusIndex, setFocusIndex] = React.useState(initialIndex);

  React.useEffect(() => {
    // Focus overlay container first to ensure it receives DPAD events
    try { rootRef.current && rootRef.current.focus({ preventScroll: true }); } catch {}
    const el = listRef.current[focusIndex];
    try { el && el.focus({ preventScroll: true }); } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const moveFocus = (next) => {
    const clamped = Math.max(0, Math.min(totalRows - 1, next));
    setFocusIndex(clamped);
    const el = listRef.current[clamped];
    try { el && el.focus({ preventScroll: true }); } catch {}
  };

  const handleKeyDown = (e) => {
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault(); e.stopPropagation();
        moveFocus(focusIndex - 1);
        break;
      case 'ArrowDown':
        e.preventDefault(); e.stopPropagation();
        moveFocus(focusIndex + 1);
        break;
      case 'Enter':
      case 'NumpadEnter':
        e.preventDefault(); e.stopPropagation();
        if (hasExtra && focusIndex === 0) {
          onExtraTopSelect && onExtraTopSelect();
        } else {
          const optionIdx = hasExtra ? focusIndex - 1 : focusIndex;
          onSelect(options[optionIdx]);
        }
        break;
      case 'Backspace':
      case 'Escape':
      case 'Back':
      case 'GoBack':
      case 'BrowserBack':
        e.preventDefault(); e.stopPropagation();
        onDismiss();
        break;
      case 'ArrowLeft':
      case 'ArrowRight':
        // consume left/right while overlay is open
        e.preventDefault(); e.stopPropagation();
        break;
      default:
        break;
    }
  };

  return (
    <div className="selection-overlay" onKeyDown={handleKeyDown} tabIndex={-1} ref={rootRef}>
      <div className="selection-panel">
        <div className="selection-title">{title}</div>
        <div className="selection-list" role="listbox" aria-label={title}>
          {hasExtra && (
            <button
              className={`selection-row ${focusIndex === 0 ? 'focused' : ''} ${selected == null ? 'selected' : ''}`}
              ref={(el) => (listRef.current[0] = el)}
              onFocus={() => setFocusIndex(0)}
              onClick={() => onExtraTopSelect && onExtraTopSelect()}
            >
              <span className="selection-check">{selected == null ? '✓' : ''}</span>
              <span className="selection-text">{extraTopOption}</span>
            </button>
          )}

          {options.map((opt, i) => {
            const rowIdx = (hasExtra ? i + 1 : i);
            const isSel = opt === selected;
            return (
              <button
                key={opt}
                className={`selection-row ${focusIndex === rowIdx ? 'focused' : ''} ${isSel ? 'selected' : ''}`}
                ref={(el) => (listRef.current[rowIdx] = el)}
                onFocus={() => setFocusIndex(rowIdx)}
                onClick={() => onSelect(opt)}
              >
                <span className="selection-check">{isSel ? '✓' : ''}</span>
                <span className="selection-text">{opt}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SelectionOverlay;


