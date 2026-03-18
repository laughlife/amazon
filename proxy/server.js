const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 3001);
const ROOT_DIR = path.resolve(__dirname, '..');
const CONF_PATH = path.resolve(__dirname, '..', 'config', 'conf.json');
const DEFAULT_ENDPOINT = 'https://api.sellersprite.com/v1/aba/research/weekly';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,secret-key,authorization'
};

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    ...CORS_HEADERS,
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.js') return 'application/javascript; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.ico') return 'image/x-icon';
  return 'application/octet-stream';
}

function resolveStaticFile(pathname) {
  let normalizedPath = pathname;
  if (normalizedPath === '/') normalizedPath = '/search.html';
  normalizedPath = decodeURIComponent(normalizedPath);
  const relativePath = normalizedPath.replace(/^[/\\]+/, '');
  const absolutePath = path.resolve(ROOT_DIR, relativePath);
  const rootWithSep = ROOT_DIR.endsWith(path.sep) ? ROOT_DIR : `${ROOT_DIR}${path.sep}`;
  if (!(absolutePath === ROOT_DIR || absolutePath.startsWith(rootWithSep))) {
    return null;
  }
  return absolutePath;
}

function sendFile(res, filePath, method = 'GET') {
  fs.stat(filePath, (statErr, stats) => {
    if (statErr || !stats.isFile()) {
      sendJson(res, 404, { code: 'NOT_FOUND', message: `未找到文件：${path.basename(filePath)}` });
      return;
    }
    const headers = {
      ...CORS_HEADERS,
      'Content-Type': getMimeType(filePath),
      'Content-Length': stats.size
    };
    if (method === 'HEAD') {
      res.writeHead(200, headers);
      res.end();
      return;
    }
    const stream = fs.createReadStream(filePath);
    res.writeHead(200, headers);
    stream.pipe(res);
    stream.on('error', () => {
      if (!res.headersSent) {
        sendJson(res, 500, { code: 'ERR', message: '读取文件失败' });
      } else {
        res.destroy();
      }
    });
  });
}

function getSellerSpriteConfig() {
  try {
    const raw = fs.readFileSync(CONF_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    const cfg = parsed?.sellerSprite || {};
    return {
      endpoint: String(cfg.endpoint || DEFAULT_ENDPOINT).trim() || DEFAULT_ENDPOINT,
      secretKey: String(cfg.secretKey || '').trim(),
      marketplace: String(cfg.marketplace || 'US').trim().toUpperCase() || 'US',
      date: String(cfg.date || '').trim(),
      page: Number.isFinite(Number(cfg.page)) ? Math.max(1, Math.floor(Number(cfg.page))) : 1,
      size: Number.isFinite(Number(cfg.size)) ? Math.max(1, Math.min(40, Math.floor(Number(cfg.size)))) : 10,
      searchModel: Number.isFinite(Number(cfg.searchModel)) ? Math.max(1, Math.min(6, Math.floor(Number(cfg.searchModel)))) : 1
    };
  } catch (error) {
    return {
      endpoint: DEFAULT_ENDPOINT,
      secretKey: '',
      marketplace: 'US',
      date: '',
      page: 1,
      size: 10,
      searchModel: 1,
      loadError: error.message
    };
  }
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => {
      chunks.push(chunk);
      const total = chunks.reduce((sum, buf) => sum + buf.length, 0);
      if (total > 1024 * 1024) {
        reject(new Error('请求体超过 1MB 限制'));
      }
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('请求体不是有效 JSON'));
      }
    });
    req.on('error', reject);
  });
}

async function postAbaWeekly({ endpoint, secretKey, payload }) {
  if (!secretKey) {
    return {
      ok: false,
      status: 400,
      data: {
        code: 'ERR',
        message: '未配置 sellerSprite.secretKey，请先在 config/conf.json 填写。'
      }
    };
  }
  const upstream = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'secret-key': secretKey
    },
    body: JSON.stringify(payload)
  });
  const text = await upstream.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = { code: 'ERR', message: '上游返回非 JSON', raw: text.slice(0, 500) };
  }
  return { ok: upstream.ok, status: upstream.status, data };
}

async function handleAbaWeekly(req, res) {
  try {
    const cfg = getSellerSpriteConfig();
    const incoming = req.method === 'POST' ? await parseJsonBody(req) : {};
    const payload = {
      marketplace: incoming.marketplace || cfg.marketplace,
      includeKeywords: incoming.includeKeywords || '',
      page: Number.isFinite(Number(incoming.page)) ? Number(incoming.page) : cfg.page,
      size: Number.isFinite(Number(incoming.size)) ? Number(incoming.size) : cfg.size,
      searchModel: Number.isFinite(Number(incoming.searchModel)) ? Number(incoming.searchModel) : cfg.searchModel
    };
    const date = String(incoming.date || cfg.date || '').trim();
    if (/^\d{8}$/.test(date)) payload.date = date;
    const headerSecret = String(req.headers['secret-key'] || '').trim();
    const secretKey = headerSecret || cfg.secretKey;
    const result = await postAbaWeekly({ endpoint: cfg.endpoint, secretKey, payload });
    return sendJson(res, result.status, result.data);
  } catch (error) {
    return sendJson(res, 500, { code: 'ERR', message: `代理转发失败：${error.message}` });
  }
}

async function handleTest(_req, res) {
  try {
    const cfg = getSellerSpriteConfig();
    const payload = {
      marketplace: cfg.marketplace,
      includeKeywords: 'screen protector',
      page: 1,
      size: 1,
      searchModel: cfg.searchModel
    };
    if (/^\d{8}$/.test(cfg.date)) payload.date = cfg.date;
    const result = await postAbaWeekly({
      endpoint: cfg.endpoint,
      secretKey: cfg.secretKey,
      payload
    });
    return sendJson(res, result.status, result.data);
  } catch (error) {
    return sendJson(res, 500, { code: 'ERR', message: `代理测试失败：${error.message}` });
  }
}

function createProxyServer(port = PORT) {
  return http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, CORS_HEADERS);
      res.end();
      return;
    }
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (req.method === 'GET' && url.pathname === '/api/sellersprite/test') {
      await handleTest(req, res);
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/sellersprite/aba-weekly') {
      await handleAbaWeekly(req, res);
      return;
    }
    if (req.method === 'GET' && url.pathname === '/health') {
      sendJson(res, 200, { ok: true, service: 'sellersprite-proxy', port });
      return;
    }

    if ((req.method === 'GET' || req.method === 'HEAD') && !url.pathname.startsWith('/api/')) {
      const target = resolveStaticFile(url.pathname);
      if (!target) {
        sendJson(res, 400, { code: 'BAD_REQUEST', message: '非法路径' });
        return;
      }
      sendFile(res, target, req.method);
      return;
    }

    sendJson(res, 404, { code: 'NOT_FOUND', message: `未找到路由：${req.method} ${url.pathname}` });
  });
}

function startProxyServer(port = PORT) {
  const server = createProxyServer(port);
  return new Promise(resolve => {
    server.listen(port, '0.0.0.0', () => {
      console.log(`[proxy] sellersprite proxy listening on http://localhost:${port}`);
      console.log('[proxy] routes: GET /, GET /health, GET /api/sellersprite/test, POST /api/sellersprite/aba-weekly');
      resolve(server);
    });
  });
}

if (require.main === module) {
  startProxyServer(PORT);
}

module.exports = {
  createProxyServer,
  startProxyServer,
  getSellerSpriteConfig
};
