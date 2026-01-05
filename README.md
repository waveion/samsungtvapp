# PAN METRO CONVERGENCE - TV Application

Advanced IPTV streaming platform for Samsung Tizen and LG webOS Smart TVs with dual API endpoint support and automatic environment detection.

## 🎯 Platform Support

- ✅ **Samsung Tizen TV** (5.5 - 10.0) - 2018 and newer models
- ✅ **LG webOS TV** (4.0+)
- ✅ **Web Browser** (Desktop/Mobile) - Chrome, Safari, Firefox

## 🚀 Quick Start

### Prerequisites

- Node.js v18+
- npm
- **Tizen Studio CLI** (for Samsung TV deployment)

### Install Tizen Studio CLI

```bash
# Download from: https://developer.tizen.org/development/tizen-studio/download
# Or install via package manager (macOS):
brew install --cask tizen-studio

# Add to PATH:
export PATH=$PATH:~/tizen-studio/tools:~/tizen-studio/tools/ide/bin
```

### Development & Testing

#### Test in Browser (with CORS proxy)

```bash
# Install dependencies (first time only)
npm install

# Run development servers
npm run dev
```

This starts **both**:
- 🌐 Web server on `http://localhost:8080`
- 🔄 Proxy server on `http://localhost:3001` (handles CORS)

**Then open:** `http://localhost:8080` in Chrome

✅ **No CORS errors** - Proxy automatically adds CORS headers  
✅ **Full API functionality** - Login, EPG, categories, channels  
✅ **Console logging** - See all API requests/responses

#### Deploy to Samsung Tizen TV

```bash
# Connect to TV
sdb connect <TV_IP>

# One-command deployment
npm run deploy:cert

# Watch TV logs (optional)
npm run debug:tv
```

✅ Production-ready with certificate signing  
✅ ES5 compatible (Tizen 5.5+)  
✅ Automatic build, sign, install, launch  
⏱️ Takes ~2 minutes

---

## 📡 API Configuration

### Dual API Endpoint Support

The app supports **two API endpoints** with automatic API key handling:

#### Primary API (Default)
- **URL:** `http://10.22.254.46:7443/api`
- **API Key:** `BUAA8JJkzfMI56y4BhEhU`
- **Header:** `x-api-key: BUAA8JJkzfMI56y4BhEhU`
- **Used for:** All standard endpoints (login, EPG, categories, channels, banners)

#### Secondary API
- **URL:** `https://10.22.254.46:3443`
- **API Key:** `wmo3iTxhwMxm37F7Sex3v`
- **Header:** `x-api-key: wmo3iTxhwMxm37F7Sex3v`
- **Used for:** Special endpoints (if needed)

### Automatic Environment Detection

The app **automatically** detects where it's running and adjusts API endpoints:

| Environment | API URL | CORS |
|------------|---------|------|
| **Browser (localhost)** | `http://localhost:3001/api` | ✅ Proxied (no CORS) |
| **TV** | `http://10.22.254.46:7443/api` | ✅ Direct (no CORS on TV) |

### API Key Selection

The correct API key is **automatically** selected based on the endpoint URL:

```javascript
// Automatically uses correct API key
API.get('/app/health')          // → Primary API key
API.get('/banners')             // → Primary API key
API.get('/epg-files/all-publish') // → Primary API key
API.requestSecondary('/endpoint') // → Secondary API key
```

### Console Logging

All API requests are logged for debugging:

```javascript
[API] Environment: Browser (via proxy)
[API] Primary API: http://localhost:3001/api
[API] Request: GET http://localhost:3001/api/app/health
[API] Headers: {x-api-key: "BUAA8JJkzfMI56y4BhEhU", Content-Type: "application/json"}
[API] Response: 200 OK
[API] Success: {status: "ok", timestamp: "..."}
```

---

## 🛠️ Technology Stack

- **Framework:** React 19 + React Router v6
- **Build Tool:** Webpack 4 + Babel (ES5 compatible)
- **Video Player:** Shaka Player 4.15
- **DRM:** Widevine, PlayReady
- **UI:** Material-UI + Custom TV Components
- **State:** React Query (TanStack Query)
- **API:** Dual endpoint with automatic key selection

---

## 📋 Key Features

- 📺 Live TV streaming with EPG
- 🎬 VOD content library
- 🔐 DRM-protected content (Widevine/PlayReady)
- 👤 Multi-profile support
- ⭐ Favorites management
- 🔍 Search functionality
- 🎮 Full D-pad navigation (TV remote)
- 📱 Responsive design (TV/Browser)
- 🔄 Real-time updates (SSE)
- 🎨 Beautiful modern UI
- 🌐 Dual API endpoint support
- ✅ Auto environment detection
- 🔑 Automatic API key selection

---

## 🔧 Development Scripts

### Recommended Commands

```bash
# 🌐 BROWSER TESTING (with CORS proxy)
npm run dev                    # Start web + proxy servers

# 🚀 TV DEPLOYMENT (with certificate)
npm run deploy:cert            # Build + Sign + Install + Launch

# 🐛 TV DEBUGGING
npm run debug:tv               # Watch TV logs in real-time
```

### All Available Scripts

```bash
# Development
npm run dev                    # Run web + proxy servers (localhost:8080)
npm run serve                  # Run web server only
npm run proxy                  # Run proxy server only

# Build
npm run build                  # Standard build (Webpack)
npm run build:tizen            # Build + copy Tizen files + verify
npm run clean                  # Clean build artifacts

# Tizen Deployment - With Certificate (RECOMMENDED)
npm run deploy:cert            # Full deployment with author.p12 certificate
npm run package:tizen:signed   # Package signed .wgt

# Tizen Deployment - Developer Mode (No Certificate)
npm run deploy:tizen           # Full dev deployment (unsigned)
npm run package:tizen:dev      # Package unsigned .wgt
npm run install:tizen:dev      # Install unsigned package

# Device Management
npm run get-tv-duid            # Get TV DUID automatically
npm run add-duid               # Add DUID to certificate (interactive)

# Run & Control
npm run run:tizen              # Launch app on TV
```

---

## 📦 Build Output

After running `npm run build:tizen`:

```
dist/
├── bundle.js          # Single ES5-compatible JavaScript bundle (~3 MB)
├── styles.css         # Extracted CSS (211 KB)
├── index.html         # Main app entry
├── config.xml         # Tizen configuration
├── icon.png           # App icon
├── tizen.js           # Tizen API helper
├── webOSTV.js         # webOS API helper
└── assets/            # Images (logos, banners, icons)
    ├── app_logo_splash.png
    ├── banner.jpg
    ├── logo.png
    ├── panmetro_brand.png
    └── ...
```

**Build size:** ~3.9 MB total (acceptable for TV apps)

---

## 🎮 TV Remote Controls

| Key | Action |
|-----|--------|
| Arrow Keys | Navigate menu/channels |
| Enter/OK | Select/Play |
| Back | Go back/Exit |
| 0-9 | Direct channel input |
| Play/Pause | Control playback |
| Red/Green/Yellow/Blue | Quick actions |

---

## 🐛 Debugging & Troubleshooting

### Browser Testing Issues

#### CORS Errors
**Symptom:** `Access-Control-Allow-Origin` errors in console

**Solution:**
```bash
# Make sure both servers are running
npm run dev

# If ports are in use, clear them first
lsof -ti:8080 | xargs kill
lsof -ti:3001 | xargs kill

# Then run again
npm run dev
```

#### API Not Responding
**Symptom:** Network timeout or 401 errors

**Check API server:**
```bash
curl http://10.22.254.46:7443/api/app/health \
  -H "x-api-key: BUAA8JJkzfMI56y4BhEhU"
```

**Expected response:**
```json
{"status":"ok","timestamp":"2025-12-29T...","mongodb":{"status":"connected"}}
```

### TV Debugging

#### View Real-time Logs

```bash
# Filtered logs (RECOMMENDED)
npm run debug:tv

# Raw logs
sdb dlog | grep PanMetro
```

#### Check App Status

```bash
# List installed apps
sdb shell 0 applist

# Check if running
sdb shell 0 processlist | grep PanMetro
```

#### Remote Debugging

```bash
# Enable debugging
sdb shell 0 debug BtRWLGTTAm.PanMetroApp

# Then open in Chrome:
chrome://inspect
```

#### Common TV Issues

| Issue | Solution |
|-------|----------|
| App won't launch | Check TV is in developer mode |
| Black screen | Check console logs for errors |
| CORS errors on TV | Shouldn't happen - contact support |
| DRM playback fails | Check DRM licenses are valid |
| Remote not working | Ensure focus management is correct |

### Debug Mode

Enable verbose logging:
```javascript
// In browser console or TV webinspector
localStorage.setItem('DEBUG', 'true');
```

View stored logs:
```javascript
console.log(JSON.parse(localStorage.getItem('tv_debug_logs')));
```

---

## 📱 Supported Resolutions

- 1920x1080 (Full HD) - Primary target
- 1280x720 (HD) - Supported
- 3840x2160 (4K) - Optimized

---

## 🔒 DRM Support

- **Widevine L3** - Supported on all platforms
- **PlayReady** - Tizen 6.0+
- **FairPlay** - Future support

---

## 🔐 Security

- HTTPS enforced for API calls
- DRM license validation
- Secure certificate storage
- User authentication via OTP
- API keys automatically managed
- No hardcoded credentials

---

## 🌟 Best Practices

### 1. Performance

- Bundle size optimized (~3 MB)
- ES5 compatible for older TVs
- Optimized images (WebP when possible)
- Single bundle (no code splitting for Tizen 5.5)
- Lazy loading for routes

### 2. Memory Management

- Clean up event listeners
- Dispose video players properly
- Clear intervals/timeouts
- Remove event handlers on unmount

### 3. TV UX

- Design for 10-foot experience
- Large fonts (24px minimum)
- High contrast colors
- Focus states (not hover)
- D-pad navigation support
- Clear visual feedback

### 4. API Usage

```javascript
import API from '../services/api';

// Primary API (default)
const health = await API.get('/app/health');
const banners = await API.get('/banners');
const categories = await API.get('/homescreenCategory');
const epg = await API.get('/epg-files/all-publish');

// With caching (5 minutes default)
const cachedCategories = await API.getWithCache('/homescreenCategory');

// Secondary API (if needed)
const data = await API.requestSecondary('/endpoint');

// Error handling
try {
  const result = await API.post('/v1/logincheck', {
    username: 'user@example.com',
    password: 'password123'
  });
  console.log('Login success:', result);
} catch (error) {
  console.error('Login failed:', error.message);
  if (error.status === 401) {
    // Handle unauthorized
  }
}
```

---

## ⚠️ Known Issues & Limitations

### Build Warnings

- `@tanstack/react-query` export warnings are **harmless**
- Babel plugin "loose" mode warnings can be **ignored**
- These don't affect functionality

### Requirements

- Tizen CLI must be installed for TV deployment
- TV must be in developer mode
- TV and computer must be on same network
- Certificate must include TV's DUID

### Compatibility

- React Router downgraded to v6 (Webpack 4 compatibility)
- No code splitting (Tizen 5.5 limitation)
- ES5 only (older TV compatibility)

---

## 📚 Project Structure

```
TizenGitTVApp/
├── src/
│   ├── components/          # React components
│   │   ├── SplashScreen.jsx
│   │   ├── VideoPlayer.jsx
│   │   ├── SearchBar.jsx
│   │   └── ...
│   ├── pages/               # Route pages
│   │   ├── LandingPage.jsx
│   │   ├── login/
│   │   │   └── PanmetroLoginScreen.jsx
│   │   └── ...
│   ├── services/            # API & utilities
│   │   ├── api.js          # ⭐ Dual API service
│   │   ├── drm.js
│   │   └── ...
│   ├── utils/               # Helper functions
│   ├── App.jsx              # Main app component
│   └── index.js             # Entry point
├── scripts/                 # Build & deployment scripts
│   ├── deploy-with-cert.js # Auto deployment
│   ├── debug-tv-app.js     # TV log monitoring
│   ├── proxy-server.js     # ⭐ CORS proxy
│   ├── serve-local.js      # Local web server
│   └── ...
├── tizen/                   # Tizen-specific files
│   ├── config.xml
│   ├── icon.png
│   ├── tizen.js
│   └── webOSTV.js
├── webpack.config.js        # Webpack configuration
├── babel.config.js          # Babel configuration
├── package.json             # Dependencies & scripts
└── README.md               # This file
```

---

## 🚀 Deployment Workflow

### For Browser Testing

```bash
# 1. Run development servers
npm run dev

# 2. Open browser
open http://localhost:8080

# 3. Test all features
# - Login
# - Browse categories
# - Play videos
# - Search
# - Favorites

# 4. Check console for errors
# Press F12 → Console tab
```

### For TV Deployment

```bash
# 1. Connect to TV
sdb connect 192.168.1.100  # Replace with your TV IP

# 2. Verify connection
sdb devices

# 3. Deploy (one command)
npm run deploy:cert

# 4. Monitor logs
npm run debug:tv

# 5. Test on TV
# Use TV remote to navigate and test
```

---

## 🎯 Testing Checklist

Before deploying to production, verify:

### Browser Testing
- [ ] App loads without errors
- [ ] Login works
- [ ] Categories load
- [ ] EPG data loads
- [ ] Video playback works
- [ ] Search works
- [ ] Navigation works (arrow keys)
- [ ] No CORS errors
- [ ] Console logs show proper API keys

### TV Testing
- [ ] App installs successfully
- [ ] App launches without errors
- [ ] Login works with remote
- [ ] D-pad navigation works
- [ ] Video plays smoothly
- [ ] DRM content works
- [ ] Back button works
- [ ] Exit/Return to TV works
- [ ] No memory leaks
- [ ] Performance is smooth

---

## 📞 Support & Contact

For issues or questions:

1. **Check console logs** - Most issues show in console
2. **Check TV logs** - Run `npm run debug:tv`
3. **Test API manually** - Use curl to verify API is working
4. **Review this README** - Most common issues are documented
5. **Contact development team** - If issue persists

---

## 📄 License

Proprietary - PAN METRO CONVERGENCE

All rights reserved.

---

## 🎉 Credits

Developed by **PAN METRO CONVERGENCE Development Team**

### Technologies Used

- React 19
- Webpack 4
- Babel 7
- Shaka Player
- Material-UI
- React Query
- React Router

---

## 📊 Version Information

| Info | Value |
|------|-------|
| **Version** | 1.0.0 |
| **Last Updated** | December 2025 |
| **Tizen Support** | 5.5 - 10.0 |
| **webOS Support** | 4.0+ |
| **Build System** | Webpack 4 + Babel (ES5) |
| **Bundle Size** | ~3 MB |
| **API Endpoints** | Dual (Primary + Secondary) |

---

## 🔗 Quick Links

### Commands
```bash
npm run dev          # Test in browser
npm run deploy:cert  # Deploy to TV
npm run debug:tv     # Watch TV logs
```

### URLs
- **Browser:** `http://localhost:8080`
- **Primary API:** `http://10.22.254.46:7443/api`
- **Secondary API:** `https://10.22.254.46:3443`

### Files
- **API Service:** `src/services/api.js`
- **Main App:** `src/App.jsx`
- **Landing Page:** `src/pages/LandingPage.jsx`
- **Login:** `src/pages/login/PanmetroLoginScreen.jsx`

---

**🚀 Ready to start? Run `npm run dev` and open `http://localhost:8080`**
