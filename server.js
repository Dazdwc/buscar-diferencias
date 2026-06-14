const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 80;
const DATA_DIR = path.join(__dirname, 'data');
const CUSTOM_LEVELS_FILE = path.join(DATA_DIR, 'custom_levels.json');
const DELETED_LEVELS_FILE = path.join(DATA_DIR, 'deleted_levels.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}

// Ensure files exist
if (!fs.existsSync(CUSTOM_LEVELS_FILE)) {
  fs.writeFileSync(CUSTOM_LEVELS_FILE, JSON.stringify([]));
}
if (!fs.existsSync(DELETED_LEVELS_FILE)) {
  fs.writeFileSync(DELETED_LEVELS_FILE, JSON.stringify([]));
}

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  // Parse URL
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  let pathname = parsedUrl.pathname;

  // Route API requests
  if (pathname === '/api/custom-levels' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    const data = fs.readFileSync(CUSTOM_LEVELS_FILE, 'utf8');
    res.end(data);
    return;
  }

  if (pathname === '/api/custom-levels' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const levels = JSON.parse(body);
        fs.writeFileSync(CUSTOM_LEVELS_FILE, JSON.stringify(levels, null, 2));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  if (pathname === '/api/deleted-levels' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    const data = fs.readFileSync(DELETED_LEVELS_FILE, 'utf8');
    res.end(data);
    return;
  }

  if (pathname === '/api/deleted-levels' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const levels = JSON.parse(body);
        fs.writeFileSync(DELETED_LEVELS_FILE, JSON.stringify(levels, null, 2));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  // Serve static files
  if (pathname === '/') {
    pathname = '/index.html';
  }

  const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(__dirname, safePath);

  // Check if file exists and is not a directory
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
