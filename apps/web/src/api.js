import { CONFIG } from './config.js';
import { Storage } from './storage.js';

class TmdbApiClient {
  constructor() {
    this.cache = new Map();
  }

  getApiKey() {
    return Storage.getApiKey(CONFIG.TMDB_API_KEY);
  }

  async request(endpoint, params = {}) {
    const apiKey = this.getApiKey();
    const queryParams = new URLSearchParams({
      api_key: apiKey,
      language: 'en-US',
      ...params
    });

    const baseUrls = [
      CONFIG.TMDB_BASE_URL || 'https://api.tmdb.org/3',
      CONFIG.TMDB_FALLBACK_URL || 'https://api.themoviedb.org/3'
    ];

    const cacheKey = `${endpoint}?${queryParams.toString()}`;
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < 120000) {
        return cached.data;
      }
    }

    let lastError = null;
    for (const baseUrl of baseUrls) {
      const url = `${baseUrl}${endpoint}?${queryParams.toString()}`;
      try {
        const response = await fetch(url, {
          headers: {
            'Accept': 'application/json'
          }
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`TMDB API Error [${response.status}]: ${errorText}`);
        }

        const data = await response.json();
        this.cache.set(cacheKey, { timestamp: Date.now(), data });
        return data;
      } catch (error) {
        lastError = error;
        console.warn(`Request to ${baseUrl} failed, trying fallback:`, error.message);
      }
    }

    console.error('All TMDB API endpoints failed:', lastError);
    throw lastError;
  }

  // Trending
  async getTrending(mediaType = 'all', timeWindow = 'week') {
    return this.request(`/trending/${mediaType}/${timeWindow}`);
  }

  // Popular
  async getPopular(mediaType = 'movie', page = 1) {
    return this.request(`/${mediaType}/popular`, { page });
  }

  // Top Rated
  async getTopRated(mediaType = 'movie', page = 1) {
    return this.request(`/${mediaType}/top_rated`, { page });
  }

  // Now Playing (movies) or On The Air (TV)
  async getNowPlaying(mediaType = 'movie', page = 1) {
    const endpoint = mediaType === 'movie' ? '/movie/now_playing' : '/tv/on_the_air';
    return this.request(endpoint, { page });
  }

  // Discover by genre
  async getByGenre(mediaType = 'movie', genreId, page = 1, sortBy = 'popularity.desc') {
    return this.request(`/discover/${mediaType}`, {
      with_genres: genreId,
      sort_by: sortBy,
      page
    });
  }

  // Comprehensive details with appended sub-resources
  async getDetails(mediaType = 'movie', id) {
    return this.request(`/${mediaType}/${id}`, {
      append_to_response: 'external_ids,videos,credits,similar,recommendations'
    });
  }

  // TV Season details (all episodes)
  async getSeason(tvId, seasonNumber) {
    return this.request(`/tv/${tvId}/season/${seasonNumber}`);
  }

  // Multi search
  async searchMulti(query, page = 1) {
    if (!query || !query.trim()) return { results: [] };
    return this.request('/search/multi', {
      query: query.trim(),
      page,
      include_adult: false
    });
  }

  // Dedicated Movie search
  async searchMovies(query, page = 1) {
    return this.request('/search/movie', {
      query: query.trim(),
      page,
      include_adult: false
    });
  }

  // Dedicated TV search
  async searchTv(query, page = 1) {
    return this.request('/search/tv', {
      query: query.trim(),
      page,
      include_adult: false
    });
  }

  // Image helpers
  getPosterUrl(path, size = 'w500') {
    if (!path) return CONFIG.PLACEHOLDER_POSTER;
    return `https://image.tmdb.org/t/p/${size}${path}`;
  }

  getBackdropUrl(path, size = 'original') {
    if (!path) return CONFIG.PLACEHOLDER_BACKDROP;
    return `https://image.tmdb.org/t/p/${size}${path}`;
  }

  getStillUrl(path, size = 'w300') {
    if (!path) return CONFIG.PLACEHOLDER_BACKDROP;
    return `https://image.tmdb.org/t/p/${size}${path}`;
  }

  getProfileUrl(path, size = 'w185') {
    if (!path) return 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80';
    return `https://image.tmdb.org/t/p/${size}${path}`;
  }
}

export const tmdbApi = new TmdbApiClient();
