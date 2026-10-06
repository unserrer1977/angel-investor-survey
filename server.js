/**
 * Angel Investor Survey — backend
 *
 * Serves the static frontend and exposes a single POST /api/surveys endpoint
 * that persists submissions to SQLite.
 *
 * Railway: the web service port is injected as the PORT env var (Railway
 * opens the container on the PORT you configure; for a plain container
 * build we default to 3000).
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'survey.db');
const MAX_BODY_BYTES = 64 * 1024; // 64 KB — plenty for a survey submission

// ---------------------------------------------------------------------------
// SQLite initialisation
// ---------------------------------------------------------------------------

function openDb() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec(`
    CREATE TABLE IF NOT EXISTS responses (
      id        TEXT PRIMARY KEY,
      answers   TEXT NOT NULL,
      completed_at TEXT NOT NULL,
      traffic_source TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_responses_created ON responses(created_at DESC);
  `);
  return db;
}

const db = openDb();

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let bytes = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      bytes += chunk.length;
      if (bytes > MAX_BODY_BYTES) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// Static file serving
// ---------------------------------------------------------------------------

const PUBLIC_DIR = path.join(__dirname, 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
};

const server = http.createServer(async (req, res) => {
  // Normalize the path.
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';

  // API route
  if (urlPath === '/api/surveys') {
    if (req.method === 'POST') {
      try {
        const raw = await readBody(req);
        const body = JSON.parse(raw);
        const payload = body.answers || body;
        const now = new Date().toISOString();

        // Minimal schema validation before persisting.
        // Q1-Q5 required; Q6 (short text) and Q7 (email) optional.
        const required = ['q1', 'q2', 'q3', 'q4', 'q5'];
        for (const key of required) {
          if (!(key in payload) || payload[key] === undefined) {
            return sendJson(res, 400, { error: `Missing required field: ${key}` });
          }
        }
        if (!Array.isArray(payload.q5)) {
          return sendJson(res, 400, { error: 'q5 must be an array' });
        }
        if (typeof body.traffic_source !== 'string') body.traffic_source = null;

        const id = randomUUID();
        db.prepare(
          'INSERT INTO responses (id, answers, completed_at, traffic_source, created_at) VALUES (?, ?, ?, ?, ?)'
        ).run(
          id,
          JSON.stringify(payload),
          payload.q7 ? now : null, // completion timestamp (only for completers)
          body.traffic_source,
          now
        );

        return sendJson(res, 201, { success: true, id });
      } catch (err) {
        if (err instanceof SyntaxError) return sendJson(res, 400, { error: 'Invalid JSON body' });
        console.error('[survey] POST /api/surveys error:', err);
        return sendJson(res, 500, { error: 'Internal server error' });
      }
    }
    return sendJson(res, 405, { error: 'Method Not Allowed' });
  }

  // Static file route
  let filePath = path.join(PUBLIC_DIR, urlPath);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    return sendJson(res, 403, { error: 'Forbidden' });
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      return sendJson(res, 404, { error: 'Not found' });
    }
    const ext = path.extname(filePath).toLowerCase();
    fs.createReadStream(filePath).pipe(res);
    res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
  });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

server.listen(PORT, () => {
  console.log(`[survey] listening on http://0.0.0.0:${PORT}`);
});
