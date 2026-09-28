import { tmdbApi } from '../api.js';
import { Storage } from '../storage.js';
import { CONFIG } from '../config.js';
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
      const results = await Promise.allSettled([
        tmdbApi.getTrending('all', 'week'),
        tmdbApi.getPopular('movie'),
        tmdbApi.getPopular('tv'),
        tmdbApi.getTopRated('movie'),
        tmdbApi.getByGenre('movie', 28), // Action
        tmdbApi.getByGenre('tv', 10765), // Sci-Fi & Fantasy
        tmdbApi.getByGenre('movie', 16)  // Animation
      ]);

      const [
        trendingRes,
        popularMoviesRes,
        popularTvRes,
        topRatedMoviesRes,
        actionMoviesRes,
        scifiTvRes,
        animationRes
      ] = results.map(r => (r.status === 'fulfilled' && r.value) ? r.value : { results: [] });

      // Initialize Hero
      const heroContainer = this.containerEl.querySelector('#home-hero-container');
      const heroItems = (trendingRes?.results?.length > 0)
        ? trendingRes.results
        : (popularMoviesRes?.results || []);
      if (heroContainer && heroItems.length > 0) {
        this.hero = new HeroBanner(heroContainer, this.onPlay, this.onDetails);
        this.hero.setItems(heroItems);
      }

      // Populate Carousels
      const carouselsContainer = this.containerEl.querySelector('#home-carousels-container');
      if (!carouselsContainer) return;
      carouselsContainer.innerHTML = '';

      // 1. Trending This Week
      if (trendingRes?.results?.length > 0) {
        carouselsContainer.appendChild(createMediaRow({
          title: 'Trending This Week',
          icon: Icons.fire,
          items: trendingRes.results,
          onSeeAll: () => this.onNavigate('trending')
        }));
      }

      // 2. Popular Movies
      if (popularMoviesRes?.results?.length > 0) {
        carouselsContainer.appendChild(createMediaRow({
          title: 'Popular Movies',
          icon: Icons.film,
          items: popularMoviesRes.results.map(i => ({ ...i, media_type: 'movie' })),
          onSeeAll: () => this.onNavigate('movies')
        }));
      }

      // 3. Binge-Worthy Web Series
      if (popularTvRes?.results?.length > 0) {
        carouselsContainer.appendChild(createMediaRow({
          title: 'Trending Web Series & TV',
          icon: Icons.tv,
          items: popularTvRes.results.map(i => ({ ...i, media_type: 'tv' })),
          onSeeAll: () => this.onNavigate('series')
        }));
      }

      // 4. Critically Acclaimed Top Rated
      if (topRatedMoviesRes?.results?.length > 0) {
        carouselsContainer.appendChild(createMediaRow({
          title: 'Top Rated Masterpieces',
          icon: Icons.star,
          items: topRatedMoviesRes.results.map(i => ({ ...i, media_type: 'movie' }))
        }));
      }

      // 5. Action & High Adrenaline
      if (actionMoviesRes?.results?.length > 0) {
        carouselsContainer.appendChild(createMediaRow({
          title: 'Action & High-Octane Thrillers',
          icon: Icons.sparkles,
          items: actionMoviesRes.results.map(i => ({ ...i, media_type: 'movie' }))
        }));
      }

      // 6. Sci-Fi & Fantasy Series
      if (scifiTvRes?.results?.length > 0) {
        carouselsContainer.appendChild(createMediaRow({
          title: 'Sci-Fi & Other Worlds',
          icon: Icons.layers,
          items: scifiTvRes.results.map(i => ({ ...i, media_type: 'tv' }))
        }));
      }

      // 7. Animated Favorites
      if (animationRes?.results?.length > 0) {
        carouselsContainer.appendChild(createMediaRow({
          title: 'Animation & Anime Cinema',
          icon: Icons.film,
          items: animationRes.results.map(i => ({ ...i, media_type: 'movie' }))
        }));
      }

    } catch (err) {
      console.error('Error loading home content:', err);
      const carouselsContainer = this.containerEl.querySelector('#home-carousels-container');
      if (carouselsContainer) {
        const hasKey = Boolean(Storage.getApiKey() || CONFIG.TMDB_API_KEY);
        if (!hasKey) {
          carouselsContainer.innerHTML = `
            <div class="error-banner" style="text-align: center; padding: 48px 24px; max-width: 580px; margin: 32px auto; background: var(--bg-card); border-radius: 16px; border: 1px solid var(--border-color); box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
              <div style="font-size: 2.5rem; margin-bottom: 12px;">🔑</div>
              <h3 style="font-size: 1.25rem; margin-bottom: 8px; color: var(--text-primary); font-weight: 700;">TMDB API Setup Required</h3>
              <p style="font-size: 0.95rem; margin-bottom: 20px; color: var(--text-secondary); line-height: 1.5;">
                To prevent credentials from leaking on GitHub, the app requires a free TMDB API key. Click below to enter your key or configure it in Vercel.
              </p>
              <button class="btn btn-primary" id="home-setup-api-key-btn" style="padding: 12px 24px; font-weight: 700; border-radius: 10px; cursor: pointer;">
                ⚙️ Enter API Key Now
              </button>
            </div>
          `;
          const setupBtn = carouselsContainer.querySelector('#home-setup-api-key-btn');
          if (setupBtn) {
            setupBtn.addEventListener('click', () => {
              document.dispatchEvent(new CustomEvent('open-settings'));
            });
          }
        } else {
          carouselsContainer.innerHTML = `
            <div class="error-banner" style="text-align: center; padding: 36px 20px; max-width: 520px; margin: 32px auto; background: var(--bg-card); border-radius: 16px; border: 1px solid var(--border-color);">
              <div style="font-size: 2rem; margin-bottom: 10px;">📡</div>
              <h3 style="font-size: 1.15rem; margin-bottom: 8px; color: var(--text-primary); font-weight: 700;">Network Connection Issue</h3>
              <p style="font-size: 0.9rem; margin-bottom: 18px; color: var(--text-secondary); line-height: 1.5;">
                Unable to load movie premieres from TMDB. Please check your internet connection and try again.
              </p>
              <button class="btn btn-primary" id="home-retry-btn" style="padding: 10px 20px; font-weight: 600; border-radius: 8px; cursor: pointer;">
                🔄 Retry Loading
              </button>
            </div>
          `;
          const retryBtn = carouselsContainer.querySelector('#home-retry-btn');
          if (retryBtn) {
            retryBtn.addEventListener('click', () => this.render());
          }
        }
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
