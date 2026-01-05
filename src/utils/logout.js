// Centralized logout/session reset helper
// Clears user auth plus any persisted UI state that should not survive logout.

export function performFullLogout() {
  // Auth user object
  try {
    sessionStorage.removeItem('user');
    localStorage.removeItem('user');
  } catch {
    // ignore storage errors
  }

  // Genre (channels) screen: filters + focus + landing flags
  try {
    sessionStorage.removeItem('genre:lastSelected');
    sessionStorage.removeItem('genre:lastFocusedChannel');
    sessionStorage.removeItem('genre:lastFocusedChannelId');
    sessionStorage.removeItem('genre:lastFocusedFromPlayer');
    sessionStorage.removeItem('landingFocusApplied');
    sessionStorage.removeItem('landingFindAttempts');
  } catch {
    // ignore
  }

  // Live EPG screen: filters + last channel
  try {
    sessionStorage.removeItem('live_screen_state_v1');
  } catch {
    // ignore
  }

  // User package/channel entitlement caches
  try {
    sessionStorage.removeItem('userPkgIds');
    localStorage.removeItem('userPkgIds');
    sessionStorage.removeItem('userPkgChannels');
    localStorage.removeItem('userPkgChannels');
  } catch {
    // ignore
  }
}


export function showToast(message, duration = 3000) {
  const toast = document.createElement("div");
  toast.innerText = message;

  Object.assign(toast.style, {
    position: "fixed",
    bottom: "40px",
    left: "50%",
    transform: "translateX(-50%)",
    background: "#333",
    color: "#fff",
    padding: "10px 16px",
    borderRadius: "4px",
    fontSize: "14px",
    zIndex: 9999,
    opacity: 0,
    transition: "opacity 0.3s ease"
  });

  document.body.appendChild(toast);
  requestAnimationFrame(() => (toast.style.opacity = 1));

  setTimeout(() => {
    toast.style.opacity = 0;
    setTimeout(() => document.body.removeChild(toast), 300);
  }, duration);
}
