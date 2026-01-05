const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const distDir = path.join(__dirname, '..', 'dist');

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  console.log(`${req.method} ${req.url}`);

  // Handle root path
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(distDir, filePath);

  const extname = String(path.extname(filePath)).toLowerCase();
  const contentType = mimeTypes[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        // File not found, try index.html for SPA routing
        fs.readFile(path.join(distDir, 'index.html'), (err, indexContent) => {
          if (err) {
            res.writeHead(404);
            res.end('404 Not Found');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(indexContent, 'utf-8');
          }
        });
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${error.code}`);
      }
    } else {
      res.writeHead(200, { 
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*'
      });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log('\n========================================');
  console.log('🚀 Local Test Server Running');
  console.log('========================================\n');
  console.log(`📂 Serving: ${distDir}`);
  console.log(`🌐 Open: http://localhost:${PORT}`);
  console.log('\n📋 Instructions:');
  console.log('  1. Open http://localhost:${PORT} in Chrome');
  console.log('  2. Press F12 to open DevTools');
  console.log('  3. Go to Console tab');
  console.log('  4. Look for [PANMETRO] logs\n');
  console.log('Press Ctrl+C to stop\n');
  console.log('========================================\n');
});

