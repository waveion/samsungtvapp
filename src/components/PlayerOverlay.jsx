import React, { useEffect, useMemo, useState } from "react";
import FeatherIcon from "feather-icons-react";
import { getGradientStyle } from "../utils/gradientUtils";
import "./PlayerOverlay.css";
import appLogoSplash from "../assets/app_logo_splash.png";

// Parse EPG time format (YYYYMMDDHHMMSS +0530) or handle various time formats
function parseEpgTime(epgTime) {
  try {
    if (!epgTime) return null;
    
    // Handle different time formats
    if (typeof epgTime === 'string') {
      // Format: YYYYMMDDHHMMSS +0530
      const timePart = epgTime.split(" ")[0];
      if (timePart.length >= 14) {
        const year = timePart.substring(0, 4);
        const month = timePart.substring(4, 6);
        const day = timePart.substring(6, 8);
        const hour = timePart.substring(8, 10);
        const minute = timePart.substring(10, 12);
        const second = timePart.substring(12, 14);
        return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
      }
      
      // Handle ISO format or other standard formats
      const parsed = new Date(epgTime);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    }
    
    // Handle Date objects
    if (epgTime instanceof Date) {
      return epgTime;
    }
    
    return null;
  } catch {
    return null;
  }
}

function formatTime(date) {
  try {
    if (!date) return "";
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  } catch {
    return "";
  }
}

function computePrograms(programs, programmeIndex) {
  const now = Date.now();
  const normalized = Array.isArray(programs) ? programs : [];
  
  const withTimes = normalized.map((p) => {
    const start = parseEpgTime(p._start || p.start || p.startTime);
    const end = parseEpgTime(p._stop || p.stop || p.endTime);
    return { raw: p, start, end };
  });

  let baseIndex = 0;
  for (let i = 0; i < withTimes.length; i++) {
    const t = withTimes[i];
    if (t.start && t.start.getTime() <= now) {
      baseIndex = i;
    } else {
      break;
    }
  }
  const maxIndex = Math.max(0, withTimes.length - 1);
  const targetIndex = Math.min(Math.max(baseIndex + (programmeIndex || 0), 0), maxIndex);

  const nowProg = withTimes[targetIndex] || null;
  const nextProg = withTimes[targetIndex + 1] || null;

  return { nowProg, nextProg };
}

function computeProgress(start, end) {
  if (!start || !end) return { progressPct: 0, minutesLeft: null };
  const now = Date.now();
  const startMs = start.getTime();
  const endMs = end.getTime();
  if (endMs <= startMs) return { progressPct: 0, minutesLeft: null };
  const duration = Math.max(1, endMs - startMs);
  const elapsed = Math.min(Math.max(0, now - startMs), duration);
  const remainingMin = Math.max(0, Math.ceil((endMs - now) / 60000));
  return { progressPct: Math.round((elapsed / duration) * 100), minutesLeft: remainingMin };
}

const PlayerOverlay = ({
  visible,
  channelNumber,
  channelTitle,
  channelLogo,
  bgGradient,
  programmes = [],
  programmeIndex = 0,
  currentProgramTitle = null,
  nextProgramTitle = null,
  currentStartTime = null,
  currentEndTime = null,
  onFavorite,
  fallbackBanner,
}) => {
  const [nowTick, setNowTick] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  const { nowProg, nextProg } = useMemo(
    () => {
      const result = computePrograms(programmes, programmeIndex);
      return result;
    },
    [programmes, programmeIndex, nowTick]
  );

  // Allow external overrides for timing
  const overrideStart = useMemo(() => parseEpgTime(currentStartTime), [currentStartTime]);
  const overrideEnd = useMemo(() => parseEpgTime(currentEndTime), [currentEndTime]);
  const startDate = nowProg?.start || overrideStart || null;
  const endDate = nowProg?.end || overrideEnd || null;

  const { progressPct, minutesLeft } = useMemo(() => {
    return computeProgress(startDate, endDate);
  }, [startDate, endDate, nowTick]);

  const logoBgStyle = useMemo(() => {
    const style = getGradientStyle(bgGradient);
    if (!style || !style.background) {
      return { background: "#2A3139" };
    }
    return style;
  }, [bgGradient]);

  if (!visible) return null;

  const programTitle =
    (nowProg?.raw?.title ||
      nowProg?.raw?.name ||
      nowProg?.raw?.programmeTitle ||
      nowProg?.raw?.showTitle ||
      nowProg?.raw?.eventTitle ||
      (currentProgramTitle && String(currentProgramTitle).trim())) ||
    "No information available";
  const startText = formatTime(startDate);
  const endText = formatTime(endDate);
  const imageUrl =
    (nowProg?.raw?.imageUrl && (nowProg.raw.imageUrl[0]?.name || nowProg.raw.imageUrl[0])) ||
    nowProg?.raw?.image ||
    null;

  const nextTitle =
    (nextProgramTitle && String(nextProgramTitle).trim()) ||
    nextProg?.raw?.title ||
    nextProg?.raw?.name ||
    nextProg?.raw?.programmeTitle ||
    nextProg?.raw?.showTitle ||
    nextProg?.raw?.eventTitle ||
    null;

  const hasNextProgramInfo = !!nextTitle;

  return (
    <div className="player-overlay-root" aria-hidden={!visible}>
      <div className="player-overlay-bg" />
      <div className="player-overlay-content">
        <div className="overlay-grid">
          <div className="logo-card" style={logoBgStyle}>
            {channelLogo ? (
              <img className="logo-img" src={channelLogo} alt={channelTitle || ""} />
            ) : null}
          </div>

          <div className="info-col">
            <div className="channel-line">
              <span className="channel-no">{channelNumber ?? "--"}</span>
              <span className="sep">:</span>
              <span className="channel-title">{channelTitle || ""}</span>
            </div>

            <div className="program-title">{programTitle}</div>

            {startDate && endDate ? (
              <div className="time-progress-row">
                <span className="time-window">{startText} – {endText}</span>
                <span className="divider" />
                <span className="left-text">{minutesLeft ?? 0}m left</span>
                <div className="progress">
                  <div className="progress-fill" style={{ width: `${progressPct}%` }} />
                </div>
              </div>
            ) : null}

            {programTitle !== "No information available" && hasNextProgramInfo ? (
              <div className="next-program-row">
                <FeatherIcon icon="chevron-down" size={14} className="next-icon" />
                <span className="next-text">Next: {nextTitle}</span>
              </div>
            ) : null}
          </div>

          <div className="options-row">
            <FeatherIcon icon="chevron-up" size={18} className="opt-icon" />
            <span className="opt-divider" />
            <span className="opt-label">Options :</span>
            <button className="opt-btn" onClick={onFavorite} aria-label="Favorite">
              <FeatherIcon icon="heart" size={18} />
            </button>
          </div>

          <div className="banner-card">
            {imageUrl ? (
              <img className="banner-img" src={imageUrl} alt="banner" />
            ) : (
              <img className="banner-img" src={fallbackBanner || appLogoSplash} alt="banner" />
            )}
          </div>
        </div>

        {/* Removed duplicate bottom "Next" row to avoid showing it twice; kept the one inside info column */}
      </div>
    </div>
  );
};

export default PlayerOverlay;


