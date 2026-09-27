import { tmdbApi } from '../api.js';
import { Storage } from '../storage.js';
import { Icons } from '../icons.js';
import { HeroBanner } from '../components/Hero.js';
import { createMediaRow } from '../components/MediaRow.js';
import { createMediaCard } from '../components/MediaCard.js';

export class HomeView {
  constructor(containerEl, { onPlay, onDetails, onNavigate }) {
    this.containerEl = containerEl;
    this.onPlay = onPlay;
    this.onDetails = onDetails;
    this.onNavigate = onNavigate;
    this.hero = null;
  }

  async render() {
    this.containerEl.innerHTML = `
      <div class="home-view">
        <!-- Hero Section Container -->
        <div id="home-hero-container" class="home-hero-container">
          <div class="hero-skeleton-loader">
            <div class="spinner"></div>
            <span>Loading trending premieres...</span>
          </div>
        </div>

        <!-- Continue Watching Section -->
        <div id="home-continue-watching" class="home-section-container"></div>

        <!-- Main Curated Carousels Container -->
        <div id="home-carousels-container" class="home-carousels-container">
          <div class="carousels-skeleton-loader">
            <div class="skeleton-row"></div>
            <div class="skeleton-row"></div>
          </div>
        </div>
      </div>
    `;

    // Render continue watching if exists
    this.renderContinueWatching();

    // Fetch and populate data
    try {
      const [
        trendingRes,
        popularMoviesRes,
        popularTvRes,
        topRatedMoviesRes,
        actionMoviesRes,
        scifiTvRes,
        animationRes
      ] = await Promise.all([
        tmdbApi.getTrending('all', 'week'),
        tmdbApi.getPopular('movie'),
        tmdbApi.getPopular('tv'),
        tmdbApi.getTopRated('movie'),
        tmdbApi.getByGenre('movie', 28), // Action
        tmdbApi.getByGenre('tv', 10765), // Sci-Fi & Fantasy
        tmdbApi.getByGenre('movie', 16)  // Animation
      ]);

      // Initialize Hero
      const heroContainer = this.containerEl.querySelector('#home-hero-container');
      this.hero = new HeroBanner(heroContainer, this.onPlay, this.onDetails);
      this.hero.setItems(trendingRes.results);

      // Populate Carousels
      const carouselsContainer = this.containerEl.querySelector('#home-carousels-container');
      carouselsContainer.innerHTML = '';

      // 1. Trending This Week
      carouselsContainer.appendChild(createMediaRow({
        title: 'Trending This Week',
        icon: Icons.fire,
        items: trendingRes.results,
        onSeeAll: () => this.onNavigate('trending')
      }));

      // 2. Popular Movies
      carouselsContainer.appendChild(createMediaRow({
        title: 'Popular Movies',
        icon: Icons.film,
        items: popularMoviesRes.results.map(i => ({ ...i, media_type: 'movie' })),
        onSeeAll: () => this.onNavigate('movies')
      }));

      // 3. Binge-Worthy Web Series
      carouselsContainer.appendChild(createMediaRow({
        title: 'Trending Web Series & TV',
        icon: Icons.tv,
        items: popularTvRes.results.map(i => ({ ...i, media_type: 'tv' })),
        onSeeAll: () => this.onNavigate('series')
      }));

      // 4. Critically Acclaimed Top Rated
      carouselsContainer.appendChild(createMediaRow({
        title: 'Top Rated Masterpieces',
        icon: Icons.star,
        items: topRatedMoviesRes.results.map(i => ({ ...i, media_type: 'movie' }))
      }));

      // 5. Action & High Adrenaline
      carouselsContainer.appendChild(createMediaRow({
        title: 'Action & High-Octane Thrillers',
        icon: Icons.sparkles,
        items: actionMoviesRes.results.map(i => ({ ...i, media_type: 'movie' }))
      }));

      // 6. Sci-Fi & Fantasy Series
      carouselsContainer.appendChild(createMediaRow({
        title: 'Sci-Fi & Other Worlds',
        icon: Icons.layers,
        items: scifiTvRes.results.map(i => ({ ...i, media_type: 'tv' }))
      }));

      // 7. Animated Favorites
      carouselsContainer.appendChild(createMediaRow({
        title: 'Animation & Anime Cinema',
        icon: Icons.film,
        items: animationRes.results.map(i => ({ ...i, media_type: 'movie' }))
      }));

    } catch (err) {
      console.error('Error loading home content:', err);
      const carouselsContainer = this.containerEl.querySelector('#home-carousels-container');
      if (carouselsContainer) {
        carouselsContainer.innerHTML = `
          <div class="error-banner">
            <p>Could not load catalogs from TMDB. Please check your internet connection or API settings.</p>
          </div>
        `;
      }
    }
  }

  renderContinueWatching() {
    const history = Storage.getContinueWatching();
    const contContainer = this.containerEl.querySelector('#home-continue-watching');
    if (!contContainer) return;

    if (history.length === 0) {
      contContainer.innerHTML = '';
      return;
    }

    contContainer.innerHTML = `
      <section class="media-row-section continue-watching-section">
        <div class="row-header">
          <div class="row-header-title">
            <span class="row-icon">${Icons.play}</span>
            <h2>Continue Watching</h2>
          </div>
        </div>

        <div class="continue-watching-grid">
          ${history.slice(0, 6).map(item => {
            const isTv = item.media_type === 'tv';
            const poster = tmdbApi.getPosterUrl(item.poster_path, 'w500');
            const epText = isTv ? `S${item.season} E${item.episode}${item.episodeTitle ? `: ${item.episodeTitle}` : ''}` : 'Resume Movie';

            return `
              <div class="cw-card" data-id="${item.id}" data-type="${item.media_type}" data-season="${item.season || 1}" data-episode="${item.episode || 1}">
                <div class="cw-poster-box">
                  <img src="${poster}" alt="${item.title}" loading="lazy" />
                  <div class="cw-play-overlay">
                    <button class="btn btn-icon btn-primary">${Icons.play}</button>
                  </div>
                  <div class="cw-progress-bar"><div class="cw-progress-fill" style="width: 70%"></div></div>
                </div>
                <div class="cw-meta">
                  <div class="cw-title-row">
                    <span class="cw-title">${item.title}</span>
                    <button class="cw-remove-btn" title="Remove from history" data-id="${item.id}" data-type="${item.media_type}">
                      ${Icons.close}
                    </button>
                  </div>
                  <span class="cw-subtext">${epText}</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </section>
    `;

    // Bind continue watching clicks
    const cwCards = contContainer.querySelectorAll('.cw-card');
    cwCards.forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.cw-remove-btn')) return;
        const id = card.dataset.id;
        const type = card.dataset.type;
        const season = Number(card.dataset.season) || 1;
        const episode = Number(card.dataset.episode) || 1;

        if (this.onPlay) {
          this.onPlay({ id, media_type: type, title: card.querySelector('.cw-title')?.textContent }, season, episode);
        }
      });
    });

    const removeBtns = contContainer.querySelectorAll('.cw-remove-btn');
    removeBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const type = btn.dataset.type;
        Storage.removeProgress(id, type);
        this.renderContinueWatching();
      });
    });
  }

  destroy() {
    if (this.hero) {
      this.hero.stopAutoCycle();
    }
  }
}
