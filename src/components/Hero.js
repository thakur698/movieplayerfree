import { tmdbApi } from '../api.js';
import { Icons } from '../icons.js';
import { Storage } from '../storage.js';

export class HeroBanner {
  constructor(containerEl, onPlay, onDetails) {
    this.containerEl = containerEl;
    this.onPlay = onPlay;
    this.onDetails = onDetails;
    this.items = [];
    this.currentIndex = 0;
    this.intervalId = null;
  }

  setItems(items) {
    this.items = (items || []).filter(i => i.backdrop_path && i.overview).slice(0, 6);
    if (this.items.length === 0) return;
    this.currentIndex = 0;
    this.render();
    this.startAutoCycle();
  }

  render() {
    if (this.items.length === 0) {
      this.containerEl.innerHTML = '';
      return;
    }

    const item = this.items[this.currentIndex];
    const isTv = item.media_type === 'tv' || Boolean(item.first_air_date);
    const mediaType = isTv ? 'tv' : 'movie';
    const title = item.title || item.name;
    const year = (item.release_date || item.first_air_date || '').substring(0, 4);
    const rating = item.vote_average ? item.vote_average.toFixed(1) : '8.8';
    const matchPercent = Math.min(99, Math.floor((item.vote_average || 8) * 10) + 12);
    const backdropUrl = tmdbApi.getBackdropUrl(item.backdrop_path, 'original');
    const inWatchlist = Storage.isInWatchlist(item.id, mediaType);

    this.containerEl.innerHTML = `
      <div class="hero-banner" style="background-image: url('${backdropUrl}')">
        <div class="hero-vignette-overlay"></div>
        <div class="hero-bottom-fade"></div>

        <div class="hero-content-wrapper">
          <div class="hero-meta-badges">
            <span class="badge ${isTv ? 'badge-tv' : 'badge-movie'}">${isTv ? 'WEB SERIES' : 'MOVIE'}</span>
            <span class="badge badge-fire">${Icons.fire} TOP 10 PREMIERE</span>
            <span class="badge badge-match">${matchPercent}% Match</span>
            ${year ? `<span class="badge badge-year">${year}</span>` : ''}
            <span class="badge badge-rating">${Icons.star} ${rating}</span>
            <span class="badge badge-quality">4K UHD • DOLBY ATMOS</span>
          </div>

          <h1 class="hero-main-title">${title}</h1>
          <p class="hero-synopsis">${item.overview}</p>

          <div class="hero-actions-group">
            <button class="btn btn-primary btn-lg" id="hero-watch-btn">
              ${Icons.play} <span>Watch Now</span>
            </button>
            <button class="btn btn-glass btn-lg" id="hero-info-btn">
              ${Icons.info} <span>Details & Trailer</span>
            </button>
            <button class="btn btn-icon btn-glass btn-lg ${inWatchlist ? 'is-active' : ''}" id="hero-watchlist-btn" title="Add to Watchlist">
              ${inWatchlist ? Icons.check : Icons.plus}
            </button>
          </div>
        </div>

        <!-- Carousel navigation indicators -->
        <div class="hero-pagination-dots">
          ${this.items.map((_, idx) => `
            <button class="hero-dot ${idx === this.currentIndex ? 'active' : ''}" data-index="${idx}" aria-label="Slide ${idx + 1}"></button>
          `).join('')}
        </div>
      </div>
    `;

    this.bindEvents(item, mediaType);
  }

  bindEvents(item, mediaType) {
    const playBtn = this.containerEl.querySelector('#hero-watch-btn');
    const infoBtn = this.containerEl.querySelector('#hero-info-btn');
    const watchlistBtn = this.containerEl.querySelector('#hero-watchlist-btn');

    if (playBtn) {
      playBtn.addEventListener('click', () => {
        if (this.onPlay) this.onPlay({ ...item, media_type: mediaType });
      });
    }

    if (infoBtn) {
      infoBtn.addEventListener('click', () => {
        if (this.onDetails) this.onDetails(mediaType, item.id);
      });
    }

    if (watchlistBtn) {
      watchlistBtn.addEventListener('click', () => {
        const res = Storage.toggleWatchlist({ ...item, media_type: mediaType });
        if (res.added) {
          watchlistBtn.classList.add('is-active');
          watchlistBtn.innerHTML = Icons.check;
        } else {
          watchlistBtn.classList.remove('is-active');
          watchlistBtn.innerHTML = Icons.plus;
        }
      });
    }

    const dots = this.containerEl.querySelectorAll('.hero-dot');
    dots.forEach(dot => {
      dot.addEventListener('click', () => {
        this.currentIndex = Number(dot.dataset.index);
        this.render();
        this.resetAutoCycle();
      });
    });
  }

  startAutoCycle() {
    this.stopAutoCycle();
    this.intervalId = setInterval(() => {
      if (this.items.length > 1) {
        this.currentIndex = (this.currentIndex + 1) % this.items.length;
        this.render();
      }
    }, 8500);
  }

  stopAutoCycle() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  resetAutoCycle() {
    this.stopAutoCycle();
    this.startAutoCycle();
  }
}
