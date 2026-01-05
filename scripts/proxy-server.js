const http = require('http');
const https = require('https');
const url = require('url');

const PROXY_PORT = 3001;
const CMS_API_BASE_URL = 'http://10.22.254.46:7443';
const DRM_API_BASE_URL = 'https://drm.panmetroconvergence.com:3443';
const DRM_LICENSE_BASE_URL = 'https://drm.panmetroconvergence.com:4443';

console.log('\n========================================');
console.log('🔄 CORS Proxy Server (Multi-Endpoint)');
console.log('========================================\n');
console.log(`Proxy: http://localhost:${PROXY_PORT}`);
console.log(`CMS API: ${CMS_API_BASE_URL}`);
console.log(`DRM API: ${DRM_API_BASE_URL}`);
console.log(`DRM License: ${DRM_LICENSE_BASE_URL}`);
console.log('\nThis proxy adds CORS headers for local testing');
console.log('Press Ctrl+C to stop\n');

const server = http.createServer((req, res) => {
  // Add CORS headers to all responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Parse the request URL
  const parsedUrl = url.parse(req.url);
  
  // Determine target based on path
  // If path starts with /drm-license/, route to DRM License server
  // If path starts with /drm/, route to DRM API
  // Otherwise, route to CMS API
  let targetBaseUrl = CMS_API_BASE_URL;
  let targetPath = parsedUrl.path;
  
  if (parsedUrl.path.startsWith('/drm-license/')) {
    targetBaseUrl = DRM_LICENSE_BASE_URL;
    targetPath = parsedUrl.path.replace('/drm-license', '');
  } else if (parsedUrl.path.startsWith('/drm/')) {
    targetBaseUrl = DRM_API_BASE_URL;
    targetPath = parsedUrl.path.replace('/drm', '');
  }
  
  const targetUrl = `${targetBaseUrl}${targetPath}`;

  console.log(`${req.method} ${req.url} → ${targetUrl}`);

  // Forward the request
  const options = {
    method: req.method,
    headers: {
      ...req.headers,
      host: url.parse(targetBaseUrl).host
    },
    // For HTTPS, ignore self-signed certificate errors (development only)
    rejectUnauthorized: false
  };

  const protocol = targetUrl.startsWith('https') ? https : http;
  
  const proxyReq = protocol.request(targetUrl, options, (proxyRes) => {
    // Forward status code
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    
    // Forward response body
    proxyRes.pipe(res);
    
    console.log(`  ← ${proxyRes.statusCode} ${proxyRes.statusMessage}`);
  });

  proxyReq.on('error', (err) => {
    console.error(`  ✗ Error: ${err.message}`);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      error: 'Proxy Error', 
      message: err.message,
      target: targetUrl
    }));
  });

  // Forward request body if present
  if (req.method === 'POST' || req.method === 'PUT') {
    req.pipe(proxyReq);
  } else {
    proxyReq.end();
  }
});

server.listen(PROXY_PORT, () => {
  console.log('========================================');
  console.log('✓ Proxy server ready!\n');
  console.log('Update your code to use:');
  console.log(`  const API_BASE_URL = 'http://localhost:${PROXY_PORT}/api';\n`);
  console.log('========================================\n');
});

