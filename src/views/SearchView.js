import { tmdbApi } from '../api.js';
import { createMediaCard } from '../components/MediaCard.js';

export class SearchView {
  constructor(containerEl, { onPlay, onDetails }) {
    this.containerEl = containerEl;
    this.onPlay = onPlay;
    this.onDetails = onDetails;
    this.query = '';
    this.filterType = 'all'; // 'all' | 'movie' | 'tv'
    this.results = [];
  }

  async search(query) {
    this.query = query;
    this.containerEl.innerHTML = `
      <div class="search-view">
        <div class="search-results-header">
          <div class="search-title-box">
            <h1>Search Results for "<span class="search-query-highlight">${query}</span>"</h1>
            <p id="search-count-label">Searching TMDB library...</p>
          </div>

          <div class="search-filter-pills">
            <button class="pill-btn ${this.filterType === 'all' ? 'active' : ''}" data-filter="all">All</button>
            <button class="pill-btn ${this.filterType === 'movie' ? 'active' : ''}" data-filter="movie">Movies</button>
            <button class="pill-btn ${this.filterType === 'tv' ? 'active' : ''}" data-filter="tv">Web Series</button>
          </div>
        </div>

        <div class="catalog-grid" id="search-results-grid">
          <div class="catalog-loading">
            <div class="spinner"></div>
            <span>Fetching search matches...</span>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();

    try {
      const data = await tmdbApi.searchMulti(query);
      this.results = (data.results || []).filter(item => (item.media_type === 'movie' || item.media_type === 'tv') && item.poster_path);
      this.renderGrid();
    } catch (err) {
      console.error('Search error:', err);
      const grid = this.containerEl.querySelector('#search-results-grid');
      if (grid) grid.innerHTML = `<div class="error-state">Search query failed. Please check your connection.</div>`;
    }
  }

  bindEvents() {
    const pills = this.containerEl.querySelectorAll('.pill-btn');
    pills.forEach(pill => {
      pill.addEventListener('click', () => {
        pills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.filterType = pill.dataset.filter;
        this.renderGrid();
      });
    });
  }

  renderGrid() {
    const grid = this.containerEl.querySelector('#search-results-grid');
    const countLabel = this.containerEl.querySelector('#search-count-label');
    if (!grid) return;

    const filtered = this.filterType === 'all'
      ? this.results
      : this.results.filter(i => i.media_type === this.filterType);

    if (countLabel) {
      countLabel.textContent = `Found ${filtered.length} title${filtered.length === 1 ? '' : 's'}`;
    }

    if (filtered.length === 0) {
      grid.innerHTML = `<div class="empty-state">No matching titles found. Try searching for another name or keyword.</div>`;
      return;
    }

    grid.innerHTML = '';
    filtered.forEach(item => {
      grid.appendChild(createMediaCard(item));
    });
  }
}
