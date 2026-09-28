// LocalStorage state management for Watchlist, Continue Watching, and Settings

const KEYS = {
  WATCHLIST: 'cinestream_watchlist',
  CONTINUE_WATCHING: 'cinestream_continue_watching',
  SELECTED_SERVER: 'cinestream_selected_server',
  CUSTOM_API_KEY: 'cinestream_custom_api_key',
  AD_SHIELD: 'cinestream_ad_shield',
};

export const Storage = {
  // Watchlist methods
  getWatchlist() {
    try {
      const data = localStorage.getItem(KEYS.WATCHLIST);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Failed to parse watchlist from storage:', e);
      return [];
    }
  },

  isInWatchlist(id, mediaType = 'movie') {
    const list = this.getWatchlist();
    return list.some(item => String(item.id) === String(id) && item.media_type === mediaType);
  },

  toggleWatchlist(item) {
    let list = this.getWatchlist();
    const mediaType = item.media_type || (item.first_air_date ? 'tv' : 'movie');
    const index = list.findIndex(i => String(i.id) === String(item.id) && i.media_type === mediaType);

    if (index >= 0) {
      list.splice(index, 1);
      localStorage.setItem(KEYS.WATCHLIST, JSON.stringify(list));
      return { added: false, item };
    } else {
      const newItem = {
        id: item.id,
        media_type: mediaType,
        title: item.title || item.name,
        poster_path: item.poster_path,
        backdrop_path: item.backdrop_path,
        vote_average: item.vote_average,
        release_date: item.release_date || item.first_air_date,
        overview: item.overview,
        addedAt: Date.now()
      };
      list.unshift(newItem);
      localStorage.setItem(KEYS.WATCHLIST, JSON.stringify(list));
      return { added: true, item: newItem };
    }
  },

  // Continue Watching methods
  getContinueWatching() {
    try {
      const data = localStorage.getItem(KEYS.CONTINUE_WATCHING);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  },

  saveProgress({ id, media_type, title, poster_path, backdrop_path, season = 1, episode = 1, episodeTitle = '', runtime = null }) {
    let list = this.getContinueWatching();
    list = list.filter(item => !(String(item.id) === String(id) && item.media_type === media_type));

    const entry = {
      id,
      media_type,
      title,
      poster_path,
      backdrop_path,
      season: Number(season),
      episode: Number(episode),
      episodeTitle,
      runtime,
      updatedAt: Date.now()
    };

    list.unshift(entry);
    // Keep max 20 entries
    if (list.length > 20) list.pop();
    localStorage.setItem(KEYS.CONTINUE_WATCHING, JSON.stringify(list));
  },

  removeProgress(id, media_type) {
    let list = this.getContinueWatching();
    list = list.filter(item => !(String(item.id) === String(id) && item.media_type === media_type));
    localStorage.setItem(KEYS.CONTINUE_WATCHING, JSON.stringify(list));
  },

  getProgress(id, media_type) {
    const list = this.getContinueWatching();
    return list.find(item => String(item.id) === String(id) && item.media_type === media_type) || null;
  },

  // Server preference
  getSelectedServer() {
    const srv = localStorage.getItem(KEYS.SELECTED_SERVER);
    if (!srv || srv === 'direct-hls') return 'vidlink';
    return srv;
  },

  setSelectedServer(serverId) {
    localStorage.setItem(KEYS.SELECTED_SERVER, serverId);
  },

  // Ad Shield preference (defaults to true for maximum ad & popup blocking)
  getAdShieldEnabled() {
    const val = localStorage.getItem(KEYS.AD_SHIELD);
    return val === null ? true : val === 'true';
  },

  setAdShieldEnabled(enabled) {
    localStorage.setItem(KEYS.AD_SHIELD, String(enabled));
  },

  // Custom API key override
  getApiKey(fallbackKey) {
    return localStorage.getItem(KEYS.CUSTOM_API_KEY) || fallbackKey;
  },

  setApiKey(key) {
    if (!key || key.trim() === '') {
      localStorage.removeItem(KEYS.CUSTOM_API_KEY);
    } else {
      localStorage.setItem(KEYS.CUSTOM_API_KEY, key.trim());
    }
  },

  clearAllData() {
    localStorage.removeItem(KEYS.WATCHLIST);
    localStorage.removeItem(KEYS.CONTINUE_WATCHING);
  }
};
