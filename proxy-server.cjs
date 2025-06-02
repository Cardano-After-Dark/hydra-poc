const http = require('http');
const httpProxy = require('http-proxy');

const proxy = httpProxy.createProxyServer({});

const server = http.createServer((req, res) => {
  console.log(`\n=== Incoming Request ===`);
  console.log(`Method: ${req.method}`);
  console.log(`URL: ${req.url}`);
  console.log(`Headers:`, req.headers);
  
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  
  if (req.method === 'OPTIONS') {
    console.log('✅ Handling OPTIONS preflight');
    res.writeHead(200);
    res.end();
    return;
  }

  console.log('🔄 Proxying to Hydra node...');
  proxy.web(req, res, { 
    target: 'http://127.0.0.1:4002',
    changeOrigin: true
  });
});

// Handle WebSocket upgrades
server.on('upgrade', (req, socket, head) => {
  console.log(`\n=== WebSocket Upgrade ===`);
  console.log(`URL: ${req.url}`);
  console.log(`Headers:`, req.headers);
  console.log('🔄 Proxying WebSocket to Hydra node...');
  
  proxy.ws(req, socket, head, {
    target: 'ws://127.0.0.1:4002',
    changeOrigin: true
  });
});

// Handle proxy errors
proxy.on('error', (err, req, res) => {
  console.error('❌ Proxy error:', err);
  if (res && !res.headersSent) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Proxy error');  
  }
});

server.listen(4001, '127.0.0.1', () => {
  console.log('🚀 CORS proxy running on http://127.0.0.1:4001');
  console.log('🔌 WebSocket support enabled');
});
