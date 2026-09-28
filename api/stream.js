// Vercel Serverless Function: /api/stream
// CineStream Direct Native HLS Stream Resolver (Zero Ads, Zero Popups)

import { resolveStream } from './stream-resolver.js';

export default async function handler(req, res) {
  // CORS Headers for Web & Mobile
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Parse parameters from query or URL
  const query = req.query || {};
  let tmdbId = query.tmdbId || query.id;
  let type = query.type || 'movie';
  let season = query.season || 1;
  let episode = query.episode || 1;
  let imdbId = query.imdbId || query.imdb;

  // Support URL path parsing if query is empty
  if (!tmdbId && req.url) {
    const urlObj = new URL(req.url, 'http://localhost');
    tmdbId = urlObj.searchParams.get('tmdbId') || urlObj.searchParams.get('id');
    type = urlObj.searchParams.get('type') || 'movie';
    season = urlObj.searchParams.get('season') || 1;
    episode = urlObj.searchParams.get('episode') || 1;
    imdbId = urlObj.searchParams.get('imdbId') || urlObj.searchParams.get('imdb');
  }

  if (!tmdbId && !imdbId) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameter: tmdbId or imdbId'
    });
  }

  try {
    const streamData = await resolveStream({
      tmdbId,
      type,
      season,
      episode,
      imdbId
    });

    if (!streamData.success) {
      return res.status(404).json(streamData);
    }

    // Set cache control for performance
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
    return res.status(200).json(streamData);
  } catch (error) {
    console.error('[API Stream Handler] Unhandled error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal streaming resolver error',
      fallback: true
    });
  }
}
