import { GENRE_MAP } from '../config.js';
import { tmdbApi } from '../api.js';
import { createMediaCard } from '../components/MediaCard.js';
import { Icons } from '../icons.js';

export class GenresView {
  constructor(containerEl, { onPlay, onDetails }) {
    this.containerEl = containerEl;
    this.onPlay = onPlay;
    this.onDetails = onDetails;
    this.selectedGenre = null;
    this.selectedType = 'movie'; // 'movie' | 'tv'
  }

  async render() {
    this.containerEl.innerHTML = `
      <div class="genres-view">
        <div class="genres-header">
          <div class="genres-header-title">
            <h1>Browse by Genres</h1>
            <p>Explore cinematic universes across your favorite categories</p>
          </div>
          
          <div class="genre-type-toggle">
            <button class="toggle-btn ${this.selectedType === 'movie' ? 'active' : ''}" data-type="movie">
              ${Icons.film} Movies
            </button>
            <button class="toggle-btn ${this.selectedType === 'tv' ? 'active' : ''}" data-type="tv">
              ${Icons.tv} Web Series
            </button>
          </div>
        </div>

        <!-- Genre Tiles Grid -->
        <div class="genre-tiles-grid" id="genre-tiles-grid">
          ${this.getGenresList().map(g => `
            <div class="genre-tile-card ${this.selectedGenre?.id === g.id ? 'active' : ''}" data-id="${g.id}" data-name="${g.name}">
              <div class="genre-tile-glow"></div>
              <span class="genre-tile-name">${g.name}</span>
              <span class="genre-tile-explore">Explore &rarr;</span>
            </div>
          `).join('')}
        </div>

        <!-- Selected Genre Titles Section -->
        <div class="genre-results-container" id="genre-results-container"></div>
      </div>
    `;

    this.bindEvents();

    // Default to the first genre if none selected
    const firstGenre = this.getGenresList()[0];
    if (firstGenre) {
      this.selectGenre(firstGenre);
    }
  }

  getGenresList() {
    return this.selectedType === 'movie' ? GENRE_MAP.movie : GENRE_MAP.tv;
  }

  bindEvents() {
    // Type toggle
    const toggleBtns = this.containerEl.querySelectorAll('.toggle-btn');
    toggleBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectedType = btn.dataset.type;
        this.selectedGenre = null;
        this.render();
      });
    });

    // Genre tiles click
    const tiles = this.containerEl.querySelectorAll('.genre-tile-card');
    tiles.forEach(tile => {
      tile.addEventListener('click', () => {
        tiles.forEach(t => t.classList.remove('active'));
        tile.classList.add('active');
        const id = Number(tile.dataset.id);
        const name = tile.dataset.name;
        this.selectGenre({ id, name });
      });
    });
  }

  async selectGenre(genre) {
    this.selectedGenre = genre;
    const resultsContainer = this.containerEl.querySelector('#genre-results-container');
    if (!resultsContainer) return;

    resultsContainer.innerHTML = `
      <div class="genre-results-header">
        <h2>Top ${genre.name} ${this.selectedType === 'movie' ? 'Movies' : 'Web Series'}</h2>
      </div>
      <div class="catalog-grid" id="genre-grid">
        <div class="catalog-loading">
          <div class="spinner"></div>
          <span>Fetching ${genre.name} titles...</span>
        </div>
      </div>
    `;

    try {
      const data = await tmdbApi.getByGenre(this.selectedType, genre.id);
      const grid = resultsContainer.querySelector('#genre-grid');
      const items = (data.results || []).filter(i => i.poster_path).map(i => ({ ...i, media_type: this.selectedType }));

      if (items.length === 0) {
        grid.innerHTML = `<div class="empty-state">No titles found for ${genre.name}.</div>`;
        return;
      }

      grid.innerHTML = '';
      items.forEach(item => {
        grid.appendChild(createMediaCard(item));
      });
    } catch (err) {
      console.error('Error fetching genre items:', err);
    }
  }
}
