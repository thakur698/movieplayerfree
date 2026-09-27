import { tmdbApi } from '../api.js';
import { GENRE_MAP } from '../config.js';
import { createMediaCard } from '../components/MediaCard.js';
import { Icons } from '../icons.js';

export class CatalogView {
  constructor(containerEl, { type = 'movie', onPlay, onDetails }) {
    this.containerEl = containerEl;
    this.type = type; // 'movie' | 'tv' | 'trending'
    this.onPlay = onPlay;
    this.onDetails = onDetails;
    this.activeGenre = null;
    this.activeSort = 'popularity.desc';
    this.currentPage = 1;
    this.totalPages = 1;
    this.items = [];
    this.isLoading = false;
  }

  async render() {
    const isTv = this.type === 'tv';
    const isTrending = this.type === 'trending';
    const title = isTrending ? 'Trending Today & This Week' : (isTv ? 'Explore Web Series & TV Shows' : 'Explore Movies');
    const genres = isTrending ? [] : (isTv ? GENRE_MAP.tv : GENRE_MAP.movie);

    this.containerEl.innerHTML = `
      <div class="catalog-view">
        <div class="catalog-header-bar">
          <div class="catalog-title-box">
            <h1>${title}</h1>
            <p class="catalog-subtitle">Discover the most watched and highest rated content ready to stream.</p>
          </div>

          ${!isTrending ? `
            <div class="catalog-sort-box">
              <label for="catalog-sort-select">Sort by:</label>
              <select id="catalog-sort-select" class="catalog-sort-select">
                <option value="popularity.desc" ${this.activeSort === 'popularity.desc' ? 'selected' : ''}>Most Popular</option>
                <option value="vote_average.desc" ${this.activeSort === 'vote_average.desc' ? 'selected' : ''}>Highest Rated</option>
                <option value="primary_release_date.desc" ${this.activeSort === 'primary_release_date.desc' ? 'selected' : ''}>Latest Release</option>
              </select>
            </div>
          ` : ''}
        </div>

        <!-- Genre Filter Chips -->
        ${genres.length > 0 ? `
          <div class="genre-chips-scroll">
            <button class="genre-chip ${this.activeGenre === null ? 'active' : ''}" data-genre="all">
              All Genres
            </button>
            ${genres.map(g => `
              <button class="genre-chip ${this.activeGenre === g.id ? 'active' : ''}" data-genre="${g.id}">
                ${g.name}
              </button>
            `).join('')}
          </div>
        ` : ''}

        <!-- Grid Container -->
        <div class="catalog-grid" id="catalog-grid">
          <div class="catalog-loading">
            <div class="spinner"></div>
            <span>Fetching titles...</span>
          </div>
        </div>

        <!-- Load More Container -->
        <div class="catalog-load-more" id="catalog-load-more" style="display:none">
          <button class="btn btn-secondary btn-lg" id="load-more-btn">
            Load More Titles
          </button>
        </div>
      </div>
    `;

    this.bindEvents();
    this.currentPage = 1;
    this.items = [];
    await this.fetchData();
  }

  bindEvents() {
    // Sort change
    const sortSelect = this.containerEl.querySelector('#catalog-sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        this.activeSort = e.target.value;
        this.currentPage = 1;
        this.items = [];
        this.fetchData();
      });
    }

    // Genre chips click
    const chips = this.containerEl.querySelectorAll('.genre-chip');
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        chips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');

        const gId = chip.dataset.genre;
        this.activeGenre = gId === 'all' ? null : Number(gId);
        this.currentPage = 1;
        this.items = [];
        this.fetchData();
      });
    });

    // Load More button
    const loadMoreBtn = this.containerEl.querySelector('#load-more-btn');
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', () => {
        if (!this.isLoading && this.currentPage < this.totalPages) {
          this.currentPage++;
          this.fetchData(true);
        }
      });
    }
  }

  async fetchData(append = false) {
    this.isLoading = true;
    const grid = this.containerEl.querySelector('#catalog-grid');
    const loadMoreBox = this.containerEl.querySelector('#catalog-load-more');
    const loadMoreBtn = this.containerEl.querySelector('#load-more-btn');

    if (!append) {
      grid.innerHTML = `
        <div class="catalog-loading">
          <div class="spinner"></div>
          <span>Loading titles...</span>
        </div>
      `;
    } else if (loadMoreBtn) {
      loadMoreBtn.textContent = 'Loading more...';
      loadMoreBtn.disabled = true;
    }

    try {
      let data = null;
      if (this.type === 'trending') {
        data = await tmdbApi.getTrending('all', 'week');
      } else if (this.activeGenre) {
        data = await tmdbApi.getByGenre(this.type, this.activeGenre, this.currentPage, this.activeSort);
      } else {
        if (this.activeSort === 'vote_average.desc') {
          data = await tmdbApi.getTopRated(this.type, this.currentPage);
        } else {
          data = await tmdbApi.getPopular(this.type, this.currentPage);
        }
      }

      this.totalPages = data.total_pages || 1;
      const newItems = (data.results || []).filter(i => i.poster_path).map(i => ({
        ...i,
        media_type: this.type === 'trending' ? (i.media_type || (i.first_air_date ? 'tv' : 'movie')) : this.type
      }));

      if (!append) {
        this.items = newItems;
        grid.innerHTML = '';
      } else {
        this.items = [...this.items, ...newItems];
      }

      if (this.items.length === 0) {
        grid.innerHTML = `<div class="empty-state">No titles found for the selected filter.</div>`;
        loadMoreBox.style.display = 'none';
        return;
      }

      newItems.forEach(item => {
        const card = createMediaCard(item);
        grid.appendChild(card);
      });

      // Update Load More button
      if (this.currentPage < this.totalPages && this.type !== 'trending') {
        loadMoreBox.style.display = 'flex';
        if (loadMoreBtn) {
          loadMoreBtn.textContent = 'Load More Titles';
          loadMoreBtn.disabled = false;
        }
      } else {
        loadMoreBox.style.display = 'none';
      }

    } catch (err) {
      console.error('Failed to fetch catalog:', err);
      if (!append) {
        grid.innerHTML = `<div class="error-state">Failed to load content. Please verify your connection.</div>`;
      }
    } finally {
      this.isLoading = false;
    }
  }
}
