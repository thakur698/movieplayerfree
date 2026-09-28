// Serverless sync backup API for CineStream user data
// Stores and retrieves synced watchlist, watch history, and user preferences

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = process.env.VERCEL ? '/tmp/cinestream-data' : path.join(__dirname, 'data');

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (e) {
    // Ignore in read-only environments
  }
}

function getUserFilePath(uid) {
  const safeUid = String(uid).replace(/[^a-zA-Z0-9_-]/g, '');
  return path.join(DATA_DIR, `user_${safeUid}.json`);
}

export default async function syncHandler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  ensureDataDir();

  // GET: Retrieve user sync data
  if (req.method === 'GET') {
    const urlObj = new URL(req.url, 'http://localhost');
    const uid = urlObj.searchParams.get('uid');

    if (!uid) {
      res.statusCode = 400;
      res.end(JSON.stringify({ success: false, error: 'Missing uid parameter' }));
      return;
    }

    const filePath = getUserFilePath(uid);
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(raw);
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, data }));
        return;
      }
    } catch (e) {
      console.warn(`[Sync API] Could not read user file for ${uid}:`, e.message);
    }

    // Default empty data if not yet created
    res.statusCode = 200;
    res.end(JSON.stringify({
      success: true,
      data: {
        watchlist: [],
        continueWatching: [],
        settings: {},
        updatedAt: null
      }
    }));
    return;
  }

  // POST: Save user sync data
  if (req.method === 'POST') {
    let body = {};
    try {
      if (typeof req.body === 'object' && req.body !== null) {
        body = req.body;
      } else {
        const raw = await new Promise((resolve, reject) => {
          let chunks = '';
          req.on('data', chunk => chunks += chunk);
          req.on('end', () => resolve(chunks));
          req.on('error', reject);
        });
        if (raw) body = JSON.parse(raw);
      }
    } catch (e) {
      res.statusCode = 400;
      res.end(JSON.stringify({ success: false, error: 'Invalid JSON body' }));
      return;
    }

    const { uid, watchlist, continueWatching, settings } = body;
    if (!uid) {
      res.statusCode = 400;
      res.end(JSON.stringify({ success: false, error: 'Missing uid' }));
      return;
    }

    const payload = {
      uid,
      watchlist: Array.isArray(watchlist) ? watchlist : [],
      continueWatching: Array.isArray(continueWatching) ? continueWatching : [],
      settings: typeof settings === 'object' && settings !== null ? settings : {},
      updatedAt: Date.now()
    };

    const filePath = getUserFilePath(uid);
    try {
      fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8');
      res.statusCode = 200;
      res.end(JSON.stringify({ success: true, updatedAt: payload.updatedAt }));
    } catch (e) {
      console.error(`[Sync API] Could not write user file for ${uid}:`, e.message);
      res.statusCode = 500;
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
  }
}
