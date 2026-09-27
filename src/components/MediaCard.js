import { tmdbApi } from '../api.js';
import { Icons } from '../icons.js';
import { Storage } from '../storage.js';

export function createMediaCard(item, options = {}) {
  const isTv = item.media_type === 'tv' || Boolean(item.first_air_date);
  const mediaType = isTv ? 'tv' : 'movie';
  const title = item.title || item.name || 'Untitled';
  const releaseDate = item.release_date || item.first_air_date || '';
  const year = releaseDate ? releaseDate.substring(0, 4) : '';
  const rating = item.vote_average ? item.vote_average.toFixed(1) : null;
  const matchPercent = Math.min(99, Math.floor((item.vote_average || 8) * 10) + 12);
  const posterUrl = tmdbApi.getPosterUrl(item.poster_path, 'w500');
  const inWatchlist = Storage.isInWatchlist(item.id, mediaType);

  const card = document.createElement('div');
  card.className = `media-card ${options.className || ''}`;
  card.dataset.id = item.id;
  card.dataset.type = mediaType;

  card.innerHTML = `
    <div class="card-poster-wrapper">
      <img src="${posterUrl}" alt="${title}" loading="lazy" class="card-poster-img" />
      
      <div class="card-badge-top">
        <span class="card-badge ${isTv ? 'badge-tv' : 'badge-movie'}">${isTv ? 'SERIES' : 'MOVIE'}</span>
        ${rating ? `<span class="card-badge badge-rating">${Icons.star} ${rating}</span>` : ''}
      </div>

      <!-- Quick Action Hover Overlay -->
      <div class="card-hover-overlay">
        <div class="hover-cta-buttons">
          <button class="btn btn-icon btn-primary card-quick-play-btn" title="Watch Now">
            ${Icons.play}
          </button>
          <button class="btn btn-icon btn-glass card-quick-info-btn" title="View Details">
            ${Icons.info}
          </button>
          <button class="btn btn-icon btn-glass card-quick-watchlist-btn ${inWatchlist ? 'is-active' : ''}" title="${inWatchlist ? 'Remove from List' : 'Add to List'}">
            ${inWatchlist ? Icons.check : Icons.plus}
          </button>
        </div>

        <div class="hover-info-snippet">
          <h4 class="hover-title">${title}</h4>
          <div class="hover-meta">
            <span class="badge badge-match">${matchPercent}% Match</span>
            ${year ? `<span>${year}</span>` : ''}
            <span>•</span>
            <span class="hover-hd">4K</span>
          </div>
        </div>
      </div>
    </div>
    
    <div class="card-meta-bottom">
      <h3 class="card-title" title="${title}">${title}</h3>
      <div class="card-sub-info">
        <span class="card-year">${year || (isTv ? 'Series' : 'Movie')}</span>
        ${rating ? `<span class="card-rating-text">${Icons.star} ${rating}</span>` : ''}
      </div>
    </div>
  `;

  // Attach card event handlers
  const playBtn = card.querySelector('.card-quick-play-btn');
  const infoBtn = card.querySelector('.card-quick-info-btn');
  const watchlistBtn = card.querySelector('.card-quick-watchlist-btn');

  if (playBtn) {
    playBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      card.dispatchEvent(new CustomEvent('play-media', { bubbles: true, detail: { media: { ...item, media_type: mediaType } } }));
    });
  }

  if (infoBtn) {
    infoBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      card.dispatchEvent(new CustomEvent('open-details', { bubbles: true, detail: { id: item.id, type: mediaType } }));
    });
  }

  if (watchlistBtn) {
    watchlistBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const res = Storage.toggleWatchlist({ ...item, media_type: mediaType });
      if (res.added) {
        watchlistBtn.classList.add('is-active');
        watchlistBtn.innerHTML = Icons.check;
        watchlistBtn.title = 'Remove from List';
      } else {
        watchlistBtn.classList.remove('is-active');
        watchlistBtn.innerHTML = Icons.plus;
        watchlistBtn.title = 'Add to List';
      }
      card.dispatchEvent(new CustomEvent('watchlist-updated', { bubbles: true }));
    });
  }

  // Clicking the card body opens details
  card.addEventListener('click', () => {
    card.dispatchEvent(new CustomEvent('open-details', { bubbles: true, detail: { id: item.id, type: mediaType } }));
  });

  return card;
}
