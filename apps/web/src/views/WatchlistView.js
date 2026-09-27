import { Storage } from '../storage.js';
import { createMediaCard } from '../components/MediaCard.js';
import { Icons } from '../icons.js';

export class WatchlistView {
  constructor(containerEl, { onPlay, onDetails, onNavigate }) {
    this.containerEl = containerEl;
    this.onPlay = onPlay;
    this.onDetails = onDetails;
    this.onNavigate = onNavigate;
    this.filterType = 'all'; // 'all' | 'movie' | 'tv'
  }

  render() {
    const allItems = Storage.getWatchlist();
    const filteredItems = this.filterType === 'all'
      ? allItems
      : allItems.filter(i => i.media_type === this.filterType);

    this.containerEl.innerHTML = `
      <div class="watchlist-view">
        <div class="watchlist-header">
          <div class="watchlist-title-box">
            <h1>My Watchlist</h1>
            <p>Saved titles ready for your next movie night</p>
          </div>

          <div class="watchlist-filter-tabs">
            <button class="tab-btn ${this.filterType === 'all' ? 'active' : ''}" data-filter="all">
              All (${allItems.length})
            </button>
            <button class="tab-btn ${this.filterType === 'movie' ? 'active' : ''}" data-filter="movie">
              Movies (${allItems.filter(i => i.media_type === 'movie').length})
            </button>
            <button class="tab-btn ${this.filterType === 'tv' ? 'active' : ''}" data-filter="tv">
              Web Series (${allItems.filter(i => i.media_type === 'tv').length})
            </button>
          </div>
        </div>

        <div class="watchlist-content" id="watchlist-content">
          ${filteredItems.length === 0 ? `
            <div class="watchlist-empty-state">
              <div class="empty-icon">${Icons.bookmark}</div>
              <h3>Your Watchlist is empty</h3>
              <p>Explore thousands of movies and web series and click the "+" button to save them here.</p>
              <button class="btn btn-primary btn-lg" id="explore-trending-btn">
                Discover Trending Titles
              </button>
            </div>
          ` : `
            <div class="catalog-grid" id="watchlist-grid"></div>
          `}
        </div>
      </div>
    `;

    this.bindEvents(filteredItems);
  }

  bindEvents(items) {
    // Filter tabs
    const tabs = this.containerEl.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        this.filterType = tab.dataset.filter;
        this.render();
      });
    });

    // Empty state CTA
    const exploreBtn = this.containerEl.querySelector('#explore-trending-btn');
    if (exploreBtn) {
      exploreBtn.addEventListener('click', () => {
        if (this.onNavigate) this.onNavigate('trending');
      });
    }

    // Populate grid
    const grid = this.containerEl.querySelector('#watchlist-grid');
    if (grid && items.length > 0) {
      items.forEach(item => {
        const card = createMediaCard(item);
        grid.appendChild(card);
      });
    }

    // Listen to changes in watchlist to auto-refresh view
    this.containerEl.addEventListener('watchlist-updated', () => {
      this.render();
    });
  }
}
