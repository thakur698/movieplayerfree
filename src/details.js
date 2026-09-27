import { tmdbApi } from './api.js';
import { Storage } from './storage.js';
import { Icons } from './icons.js';

export class DetailsModal {
  constructor(containerEl, onPlayMediaCallback, onOpenMediaCallback) {
    this.containerEl = containerEl;
    this.onPlay = onPlayMediaCallback;
    this.onOpen = onOpenMediaCallback;
    this.currentData = null;
  }

  async open(mediaType, id) {
    this.containerEl.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal-loading-box">
          <div class="spinner"></div>
          <span>Loading cinematic details...</span>
        </div>
      </div>
    `;

    try {
      const type = mediaType || 'movie';
      const details = await tmdbApi.getDetails(type, id);
      this.currentData = { ...details, media_type: type };
      this.render();
    } catch (err) {
      console.error('Error fetching details:', err);
      this.containerEl.innerHTML = `
        <div class="modal-backdrop">
          <div class="modal-error-box">
            <p>Failed to load title details.</p>
            <button class="btn btn-secondary" id="modal-err-close">Close</button>
          </div>
        </div>
      `;
      this.containerEl.querySelector('#modal-err-close')?.addEventListener('click', () => this.close());
    }
  }

  render() {
    const data = this.currentData;
    const isTv = data.media_type === 'tv' || Boolean(data.first_air_date);
    const title = data.title || data.name;
    const releaseDate = data.release_date || data.first_air_date || '';
    const year = releaseDate ? releaseDate.substring(0, 4) : 'N/A';
    const rating = data.vote_average ? data.vote_average.toFixed(1) : 'NR';
    const runtime = data.runtime ? `${Math.floor(data.runtime / 60)}h ${data.runtime % 60}m` : (data.number_of_seasons ? `${data.number_of_seasons} Season${data.number_of_seasons > 1 ? 's' : ''}` : '');
    const genres = (data.genres || []).map(g => `<span class="genre-tag">${g.name}</span>`).join('');
    const inWatchlist = Storage.isInWatchlist(data.id, data.media_type);

    // Find YouTube trailer
    const videos = data.videos?.results || [];
    const trailer = videos.find(v => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser')) || videos[0];

    // Cast members
    const cast = (data.credits?.cast || []).slice(0, 8);

    // Similar / Recommendations
    const similar = (data.recommendations?.results || data.similar?.results || []).slice(0, 8);

    const backdropUrl = tmdbApi.getBackdropUrl(data.backdrop_path, 'original');
    const posterUrl = tmdbApi.getPosterUrl(data.poster_path, 'w500');

    this.containerEl.innerHTML = `
      <div class="modal-backdrop" id="details-backdrop">
        <div class="modal-card detail-modal-card" id="details-card">
          <!-- Close Button -->
          <button class="modal-close-btn" id="modal-close-btn" title="Close">
            ${Icons.close}
          </button>

          <!-- Backdrop Header Banner -->
          <div class="detail-hero-banner" style="background-image: url('${backdropUrl}')">
            <div class="detail-hero-overlay"></div>
            <div class="detail-hero-content">
              <div class="detail-poster-wrapper">
                <img src="${posterUrl}" alt="${title}" class="detail-poster-img" />
              </div>
              <div class="detail-hero-info">
                <div class="detail-badge-row">
                  <span class="badge ${isTv ? 'badge-tv' : 'badge-movie'}">${isTv ? 'WEB SERIES' : 'MOVIE'}</span>
                  <span class="badge badge-year">${year}</span>
                  ${runtime ? `<span class="badge badge-runtime">${runtime}</span>` : ''}
                  <span class="badge badge-rating">${Icons.star} ${rating}</span>
                  <span class="badge badge-quality">4K ULTRA HD</span>
                </div>

                <h1 class="detail-title">${title}</h1>
                ${data.tagline ? `<p class="detail-tagline">"${data.tagline}"</p>` : ''}

                <div class="detail-genres-row">
                  ${genres}
                </div>

                <!-- Action CTA Buttons -->
                <div class="detail-cta-row">
                  <button class="btn btn-primary btn-lg" id="detail-play-btn">
                    ${Icons.play} <span>Watch Now</span>
                  </button>

                  ${trailer ? `
                    <button class="btn btn-secondary btn-lg" id="detail-trailer-btn" data-key="${trailer.key}">
                      ${Icons.film} <span>Trailer</span>
                    </button>
                  ` : ''}

                  <button class="btn btn-glass btn-lg ${inWatchlist ? 'active-watchlist' : ''}" id="detail-watchlist-btn">
                    ${inWatchlist ? Icons.check : Icons.plus}
                    <span id="watchlist-btn-text">${inWatchlist ? 'In Watchlist' : 'Add to List'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Body Content: Overview, Cast, Similar -->
          <div class="detail-body-container">
            <div class="detail-section">
              <h3 class="section-subheading">Storyline</h3>
              <p class="detail-overview-text">${data.overview || 'No storyline summary available.'}</p>
            </div>

            ${cast.length > 0 ? `
              <div class="detail-section">
                <h3 class="section-subheading">Top Cast</h3>
                <div class="cast-grid">
                  ${cast.map(c => `
                    <div class="cast-card">
                      <div class="cast-photo-box">
                        <img src="${tmdbApi.getProfileUrl(c.profile_path)}" alt="${c.name}" loading="lazy" />
                      </div>
                      <div class="cast-info">
                        <span class="cast-name">${c.name}</span>
                        <span class="cast-character">${c.character || 'Cast'}</span>
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}

            ${similar.length > 0 ? `
              <div class="detail-section">
                <h3 class="section-subheading">More Like This</h3>
                <div class="similar-grid">
                  ${similar.map(item => `
                    <div class="similar-card" data-id="${item.id}" data-type="${item.media_type || (item.first_air_date ? 'tv' : 'movie')}">
                      <div class="similar-poster-box">
                        <img src="${tmdbApi.getPosterUrl(item.poster_path, 'w300')}" alt="${item.title || item.name}" loading="lazy" />
                        <div class="similar-hover-overlay">
                          <button class="btn btn-icon btn-primary btn-sm">${Icons.play}</button>
                        </div>
                      </div>
                      <span class="similar-title">${item.title || item.name}</span>
                      <span class="similar-meta">${(item.release_date || item.first_air_date || '').substring(0, 4)} • ⭐ ${item.vote_average ? item.vote_average.toFixed(1) : ''}</span>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    // Close modal triggers
    const closeBtn = this.containerEl.querySelector('#modal-close-btn');
    const backdrop = this.containerEl.querySelector('#details-backdrop');

    if (closeBtn) closeBtn.addEventListener('click', () => this.close());
    if (backdrop) {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) this.close();
      });
    }

    // Play Now button
    const playBtn = this.containerEl.querySelector('#detail-play-btn');
    if (playBtn) {
      playBtn.addEventListener('click', () => {
        const media = this.currentData;
        this.close();
        if (this.onPlay) this.onPlay(media);
      });
    }

    // Trailer button
    const trailerBtn = this.containerEl.querySelector('#detail-trailer-btn');
    if (trailerBtn) {
      trailerBtn.addEventListener('click', () => {
        const key = trailerBtn.dataset.key;
        this.openTrailer(key);
      });
    }

    // Watchlist toggle
    const watchlistBtn = this.containerEl.querySelector('#detail-watchlist-btn');
    const watchlistText = this.containerEl.querySelector('#watchlist-btn-text');

    if (watchlistBtn) {
      watchlistBtn.addEventListener('click', () => {
        const res = Storage.toggleWatchlist(this.currentData);
        if (res.added) {
          watchlistBtn.classList.add('active-watchlist');
          watchlistBtn.innerHTML = `${Icons.check} <span id="watchlist-btn-text">In Watchlist</span>`;
        } else {
          watchlistBtn.classList.remove('active-watchlist');
          watchlistBtn.innerHTML = `${Icons.plus} <span id="watchlist-btn-text">Add to List</span>`;
        }
      });
    }

    // Similar cards click
    const similarCards = this.containerEl.querySelectorAll('.similar-card');
    similarCards.forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        const type = card.dataset.type;
        this.open(type, id);
      });
    });
  }

  openTrailer(youtubeKey) {
    const trailerOverlay = document.createElement('div');
    trailerOverlay.className = 'trailer-modal-backdrop';
    trailerOverlay.innerHTML = `
      <div class="trailer-modal-content">
        <button class="trailer-close-btn" id="trailer-close-btn">${Icons.close}</button>
        <div class="trailer-iframe-box">
          <iframe
            src="https://www.youtube-nocookie.com/embed/${youtubeKey}?autoplay=1&rel=0"
            title="Official Trailer"
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen>
          </iframe>
        </div>
      </div>
    `;

    document.body.appendChild(trailerOverlay);

    const close = () => trailerOverlay.remove();
    trailerOverlay.querySelector('#trailer-close-btn').addEventListener('click', close);
    trailerOverlay.addEventListener('click', (e) => {
      if (e.target === trailerOverlay) close();
    });
  }

  close() {
    this.containerEl.innerHTML = '';
  }
}
