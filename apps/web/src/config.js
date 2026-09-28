const _DEFAULT_KEY = typeof atob !== 'undefined' ? atob('OTllNjI4M2UzNDhlY2JkNzdjMjcwNzc1NzBjOWJmODQ=') : '';

export const CONFIG = {
  TMDB_API_KEY: import.meta.env.VITE_TMDB_API_KEY || _DEFAULT_KEY,
  TMDB_READ_TOKEN: import.meta.env.VITE_TMDB_READ_TOKEN || '',
  TMDB_BASE_URL: 'https://api.tmdb.org/3',
  TMDB_FALLBACK_URL: 'https://api.themoviedb.org/3',
  TMDB_IMAGE_ORIGINAL: 'https://image.tmdb.org/t/p/original',
  TMDB_IMAGE_W500: 'https://image.tmdb.org/t/p/w500',
  TMDB_IMAGE_W300: 'https://image.tmdb.org/t/p/w300',
  TMDB_IMAGE_W185: 'https://image.tmdb.org/t/p/w185',
  TMDB_IMAGE_W780: 'https://image.tmdb.org/t/p/w780',
  PLACEHOLDER_POSTER: 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=500&auto=format&fit=crop&q=80',
  PLACEHOLDER_BACKDROP: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=1280&auto=format&fit=crop&q=80',
  DEFAULT_SERVER: 'direct-hls',
};

// Streaming Servers configuration supporting both Movies & Web Series (TV shows)
// Prioritized by verified working status, ad-blocking compatibility, and stream speed
export const STREAM_SERVERS = [
  {
    id: 'direct-hls',
    name: 'Direct Player',
    badge: '0 Ads • 1080p',
    isDirect: true,
    isPrimary: true,
    getMovieUrl: (tmdbId, imdbId) => `/api/stream?tmdbId=${tmdbId}&type=movie${imdbId ? `&imdbId=${imdbId}` : ''}`,
    getTvUrl: (tmdbId, imdbId, season, episode) => `/api/stream?tmdbId=${tmdbId}&type=tv&season=${season}&episode=${episode}${imdbId ? `&imdbId=${imdbId}` : ''}`
  },
  {
    id: 'vidsrc-pm',
    name: 'VidSrc.pm',
    badge: 'Ultra Fast',
    isPrimary: false,
    getMovieUrl: (tmdbId, imdbId) => `https://vidsrc.pm/embed/movie?tmdb=${tmdbId}`,
    getTvUrl: (tmdbId, imdbId, season, episode) => `https://vidsrc.pm/embed/tv?tmdb=${tmdbId}&season=${season}&episode=${episode}`
  },
  {
    id: 'vidlink',
    name: 'VidLink (Ad-Free HD)',
    badge: 'Cleanest Stream',
    isPrimary: false,
    getMovieUrl: (tmdbId, imdbId) => `https://vidlink.pro/movie/${tmdbId}`,
    getTvUrl: (tmdbId, imdbId, season, episode) => `https://vidlink.pro/tv/${tmdbId}/${season}/${episode}`
  },
  {
    id: 'vidsrc-su',
    name: 'VidSrc.su',
    badge: 'Active HD',
    isPrimary: false,
    getMovieUrl: (tmdbId, imdbId) => `https://vidsrc.su/embed/movie/${tmdbId}`,
    getTvUrl: (tmdbId, imdbId, season, episode) => `https://vidsrc.su/embed/tv/${tmdbId}/${season}/${episode}`
  },
  {
    id: 'vidsrc-cc',
    name: 'VidSrc.cc',
    badge: 'Multi-Res',
    isPrimary: false,
    getMovieUrl: (tmdbId, imdbId) => `https://vidsrc.cc/v2/embed/movie/${imdbId || tmdbId}`,
    getTvUrl: (tmdbId, imdbId, season, episode) => `https://vidsrc.cc/v2/embed/tv/${imdbId || tmdbId}/${season}/${episode}`
  },
  {
    id: 'vidsrc-to',
    name: 'VidSrc.to',
    badge: 'Mirror 1',
    isPrimary: false,
    getMovieUrl: (tmdbId, imdbId) => `https://vidsrc.to/embed/movie/${imdbId || tmdbId}`,
    getTvUrl: (tmdbId, imdbId, season, episode) => `https://vidsrc.to/embed/tv/${imdbId || tmdbId}/${season}/${episode}`
  },
  {
    id: '2embed',
    name: '2Embed',
    badge: 'Stable Mirror',
    isPrimary: false,
    getMovieUrl: (tmdbId) => `https://www.2embed.cc/embed/${tmdbId}`,
    getTvUrl: (tmdbId, imdbId, season, episode) => `https://www.2embed.cc/embedtv/${tmdbId}&s=${season}&e=${episode}`
  },
  {
    id: 'vidsrc-me',
    name: 'VidSrc.me',
    badge: 'Mirror 2',
    isPrimary: false,
    getMovieUrl: (tmdbId, imdbId) => `https://vidsrc.me/embed/movie?tmdb=${tmdbId}${imdbId ? `&imdb=${imdbId}` : ''}`,
    getTvUrl: (tmdbId, imdbId, season, episode) => `https://vidsrc.me/embed/tv?tmdb=${tmdbId}&season=${season}&episode=${episode}`
  },
  {
    id: 'superembed',
    name: 'SuperEmbed',
    badge: 'Backup',
    isPrimary: false,
    getMovieUrl: (tmdbId) => `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1`,
    getTvUrl: (tmdbId, imdbId, season, episode) => `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1&s=${season}&e=${episode}`
  }
];

export const GENRE_MAP = {
  movie: [
    { id: 28, name: 'Action' },
    { id: 12, name: 'Adventure' },
    { id: 16, name: 'Animation' },
    { id: 35, name: 'Comedy' },
    { id: 80, name: 'Crime' },
    { id: 99, name: 'Documentary' },
    { id: 18, name: 'Drama' },
    { id: 10751, name: 'Family' },
    { id: 14, name: 'Fantasy' },
    { id: 36, name: 'History' },
    { id: 27, name: 'Horror' },
    { id: 10402, name: 'Music' },
    { id: 9648, name: 'Mystery' },
    { id: 10749, name: 'Romance' },
    { id: 878, name: 'Sci-Fi' },
    { id: 53, name: 'Thriller' },
    { id: 10752, name: 'War' },
    { id: 37, name: 'Western' }
  ],
  tv: [
    { id: 10759, name: 'Action & Adventure' },
    { id: 16, name: 'Animation' },
    { id: 35, name: 'Comedy' },
    { id: 80, name: 'Crime' },
    { id: 99, name: 'Documentary' },
    { id: 18, name: 'Drama' },
    { id: 10751, name: 'Family' },
    { id: 10762, name: 'Kids' },
    { id: 9648, name: 'Mystery' },
    { id: 10763, name: 'News' },
    { id: 10764, name: 'Reality' },
    { id: 10765, name: 'Sci-Fi & Fantasy' },
    { id: 10766, name: 'Soap' },
    { id: 10767, name: 'Talk' },
    { id: 10768, name: 'War & Politics' },
    { id: 37, name: 'Western' }
  ]
};
