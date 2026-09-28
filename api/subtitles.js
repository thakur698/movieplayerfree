// Vercel Serverless Function & Vite dev route: /api/subtitles
// Fetches SRT subtitles and returns WebVTT with CORS

function sendResponse(res, statusCode, body) {
  if (typeof res.status === 'function') {
    return res.status(statusCode).send(body);
  }
  res.statusCode = statusCode;
  return res.end(body);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  const query = req.query || {};
  let subUrl = query.url;

  if (!subUrl && req.url) {
    const urlObj = new URL(req.url, 'http://localhost');
    subUrl = urlObj.searchParams.get('url');
  }

  if (!subUrl) {
    return sendResponse(res, 400, 'WEBVTT\n\n');
  }

  try {
    const response = await fetch(subUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      },
      signal: AbortSignal.timeout(6000)
    });

    if (!response.ok) {
      return sendResponse(res, response.status, 'WEBVTT\n\n');
    }

    const srtText = await response.text();
    // Convert SRT to WebVTT
    const vttText = 'WEBVTT\n\n' + srtText
      .replace(/\r\n|\r/g, '\n')
      .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');

    return sendResponse(res, 200, vttText);
  } catch (err) {
    console.error('[Subtitles API] Fetch error:', err.message);
    return sendResponse(res, 500, 'WEBVTT\n\n');
  }
}
