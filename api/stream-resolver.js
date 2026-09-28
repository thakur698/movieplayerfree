// CineStream Direct Stream & Subtitle Resolver Engine
// Resolves ad-free native HLS (.m3u8) video streams and multi-language subtitles

const TMDB_KEY = '99e6283e348ecbd77c27077570c9bf84';
const TMDB_DOMAINS = ['https://api.tmdb.org/3', 'https://api.themoviedb.org/3'];
const PLAYER_ORIGIN = 'https://nextgencloudfabric.com';
const VAPLAYER_API = 'https://streamdata.vaplayer.ru/api.php';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

// 30-minute in-memory cache for fast repeat requests
const streamCache = new Map();
const CACHE_TTL = 30 * 60 * 1000;

/**
 * Resolves IMDB ID from TMDB using dual-domain failover
 */
export async function resolveImdbId(type, tmdbId) {
  for (const domain of TMDB_DOMAINS) {
    try {
      const url = `${domain}/${type}/${tmdbId}/external_ids?api_key=${TMDB_KEY}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const data = await res.json();
        if (data.imdb_id) return data.imdb_id;
      }
    } catch (e) {
      // Try fallback domain
    }
  }
  return null;
}

/**
 * Fetches multi-language subtitles from OpenSubtitles v3
 */
export async function fetchSubtitles(imdbId, type, season = 1, episode = 1) {
  if (!imdbId) return [];
  try {
    const subUrl = type === 'tv'
      ? `https://opensubtitles-v3.strem.io/subtitles/series/${imdbId}:${season}:${episode}.json`
      : `https://opensubtitles-v3.strem.io/subtitles/movie/${imdbId}.json`;

    const res = await fetch(subUrl, { signal: AbortSignal.timeout(3500) });
    if (!res.ok) return [];

    const data = await res.json();
    const rawSubs = data.subtitles || [];
    const subtitles = [];
    const seenLangs = new Set();

    // Prioritize English, Spanish, French, German, Hindi, etc.
    for (const sub of rawSubs) {
      const lang = (sub.lang || 'en').toLowerCase();
      if (!seenLangs.has(lang)) {
        seenLangs.add(lang);
        subtitles.push({
          id: sub.id,
          lang: sub.lang,
          label: (sub.lang || 'en').toUpperCase(),
          url: sub.url
        });
      }
    }
    return subtitles;
  } catch (err) {
    console.warn('[Resolver] Subtitles non-blocking error:', err.message);
    return [];
  }
}

/**
 * Main stream resolution function
 */
export async function resolveStream({ tmdbId, type = 'movie', season = 1, episode = 1, imdbId = null }) {
  const normType = type === 'tv' || type === 'series' ? 'tv' : 'movie';
  const normSeason = Number(season) || 1;
  const normEpisode = Number(episode) || 1;
  const cacheKey = `${normType}:${tmdbId}:${normSeason}:${normEpisode}`;

  // Check cache
  const cached = streamCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return cached.data;
  }

  // 1. Resolve IMDB ID
  let activeImdbId = imdbId;
  if (!activeImdbId || !activeImdbId.startsWith('tt')) {
    activeImdbId = await resolveImdbId(normType, tmdbId);
  }

  if (!activeImdbId) {
    return {
      success: false,
      error: 'Could not resolve IMDB ID for title',
      fallback: true
    };
  }

  // 2. Fetch direct HLS streams
  const params = new URLSearchParams({ imdb: activeImdbId, type: normType });
  if (normType === 'tv') {
    params.set('season', String(normSeason));
    params.set('episode', String(normEpisode));
  }

  const streamApiUrl = `${VAPLAYER_API}?${params.toString()}`;
  const referer = normType === 'tv'
    ? `${PLAYER_ORIGIN}/embed/tv/${activeImdbId}/${normSeason}/${normEpisode}`
    : `${PLAYER_ORIGIN}/embed/movie/${activeImdbId}`;

  let streamUrls = [];
  let streamTitle = '';

  try {
    const res = await fetch(streamApiUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Referer': referer,
        'Origin': PLAYER_ORIGIN
      },
      signal: AbortSignal.timeout(6000)
    });

    if (res.ok) {
      const json = await res.json();
      if ((json.status_code === 200 || json.status_code === '200') && json.data) {
        streamUrls = json.data.stream_urls || [];
        streamTitle = json.data.title || '';
      }
    }
  } catch (err) {
    console.warn('[Resolver] Upstream fetch error:', err.message);
  }

  if (!streamUrls || streamUrls.length === 0) {
    return {
      success: false,
      error: 'Direct stream currently unavailable for this title',
      fallback: true
    };
  }

  // 3. Fetch subtitles in parallel
  const subtitles = await fetchSubtitles(activeImdbId, normType, normSeason, normEpisode);

  const result = {
    success: true,
    title: streamTitle,
    type: normType,
    tmdbId,
    imdbId: activeImdbId,
    season: normType === 'tv' ? normSeason : undefined,
    episode: normType === 'tv' ? normEpisode : undefined,
    streamUrl: streamUrls[0],
    streamUrls,
    quality: '1080p Multi-Res HLS',
    subtitles,
    provider: 'CineStream Native Engine',
    hasAds: false,
    timestamp: Date.now()
  };

  // Cache successful result
  streamCache.set(cacheKey, { data: result, timestamp: Date.now() });

  return result;
}
