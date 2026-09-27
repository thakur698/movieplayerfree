import './style.css';
import { Navbar } from './components/Navbar.js';
import { HomeView } from './views/HomeView.js';
import { CatalogView } from './views/CatalogView.js';
import { GenresView } from './views/GenresView.js';
import { WatchlistView } from './views/WatchlistView.js';
import { SearchView } from './views/SearchView.js';
import { DetailsModal } from './details.js';
import { StreamingPlayer } from './player.js';
import { SettingsModal } from './components/SettingsModal.js';
import { Icons } from './icons.js';
import { tmdbApi } from './api.js';

class CineStreamApp {
  constructor() {
    this.headerEl = document.getElementById('site-header');
    this.mainEl = document.getElementById('main-content');
    this.footerEl = document.getElementById('site-footer');
    this.modalEl = document.getElementById('modal-container');

    this.currentView = null;
    this.currentRoute = 'home';

    // Sub-modules
    this.detailsModal = new DetailsModal(
      this.modalEl,
      (media) => this.playMedia(media),
      (type, id) => this.openDetails(type, id)
    );

    this.player = new StreamingPlayer(
      this.mainEl,
      () => this.navigate(this.currentRoute)
    );

    this.settingsModal = new SettingsModal(
      this.modalEl,
      () => this.handleSettingsUpdated()
    );

    this.init();
  }

  init() {
    // 1. Initialize Navbar
    this.navbar = new Navbar(this.headerEl, {
      onNavigate: (route) => this.navigate(route),
      onSearch: (query) => this.handleSearch(query),
      onOpenDetails: (type, id) => this.openDetails(type, id),
      onOpenSettings: () => this.settingsModal.open(),
      onSurpriseMe: () => this.handleSurpriseMe()
    });

    // 2. Render Footer
    this.renderFooter();

    // 3. Global Event Delegation
    document.addEventListener('play-media', (e) => {
      const { media, season, episode } = e.detail;
      this.playMedia(media, season, episode);
    });

    document.addEventListener('open-details', (e) => {
      const { id, type } = e.detail;
      this.openDetails(type, id);
    });

    document.addEventListener('watchlist-updated', () => {
      this.navbar.updateWatchlistBadge();
    });

    // Keyboard shortcut Escape closes details modal
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.detailsModal.close();
      }
    });

    // 4. Initial route load
    this.navigate('home');
  }

  async handleSurpriseMe() {
    try {
      const trending = await tmdbApi.getTrending('all', 'week');
      const items = (trending.results || []).filter(i => i.backdrop_path && i.poster_path);
      if (items.length > 0) {
        const randomItem = items[Math.floor(Math.random() * items.length)];
        const mediaType = randomItem.media_type || (randomItem.first_air_date ? 'tv' : 'movie');
        this.openDetails(mediaType, randomItem.id);
      }
    } catch (e) {
      console.warn('Surprise Me failed:', e);
    }
  }

  navigate(route) {
    if (this.currentView && typeof this.currentView.destroy === 'function') {
      this.currentView.destroy();
    }

    this.currentRoute = route;
    this.navbar.setRoute(route);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    switch (route) {
      case 'home':
        this.currentView = new HomeView(this.mainEl, {
          onPlay: (media, season, episode) => this.playMedia(media, season, episode),
          onDetails: (type, id) => this.openDetails(type, id),
          onNavigate: (r) => this.navigate(r)
        });
        this.currentView.render();
        break;

      case 'movies':
        this.currentView = new CatalogView(this.mainEl, {
          type: 'movie',
          onPlay: (media) => this.playMedia(media),
          onDetails: (type, id) => this.openDetails(type, id)
        });
        this.currentView.render();
        break;

      case 'series':
        this.currentView = new CatalogView(this.mainEl, {
          type: 'tv',
          onPlay: (media) => this.playMedia(media),
          onDetails: (type, id) => this.openDetails(type, id)
        });
        this.currentView.render();
        break;

      case 'trending':
        this.currentView = new CatalogView(this.mainEl, {
          type: 'trending',
          onPlay: (media) => this.playMedia(media),
          onDetails: (type, id) => this.openDetails(type, id)
        });
        this.currentView.render();
        break;

      case 'genres':
        this.currentView = new GenresView(this.mainEl, {
          onPlay: (media) => this.playMedia(media),
          onDetails: (type, id) => this.openDetails(type, id)
        });
        this.currentView.render();
        break;

      case 'watchlist':
        this.currentView = new WatchlistView(this.mainEl, {
          onPlay: (media) => this.playMedia(media),
          onDetails: (type, id) => this.openDetails(type, id),
          onNavigate: (r) => this.navigate(r)
        });
        this.currentView.render();
        break;

      default:
        this.navigate('home');
    }
  }

  handleSearch(query) {
    if (this.currentView && typeof this.currentView.destroy === 'function') {
      this.currentView.destroy();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });

    this.currentView = new SearchView(this.mainEl, {
      onPlay: (media) => this.playMedia(media),
      onDetails: (type, id) => this.openDetails(type, id)
    });
    this.currentView.search(query);
  }

  openDetails(mediaType, id) {
    this.detailsModal.open(mediaType, id);
  }

  playMedia(media, season = 1, episode = 1) {
    if (this.currentView && typeof this.currentView.destroy === 'function') {
      this.currentView.destroy();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    this.player.open({ media, season, episode });
  }

  handleSettingsUpdated() {
    this.navigate(this.currentRoute);
  }

  renderFooter() {
    this.footerEl.innerHTML = `
      <div class="footer-content">
        <div class="footer-brand-meta">
          <div class="brand-logo">
            <span class="logo-icon">${Icons.play}</span>
            <span class="logo-text">Cine<span class="logo-accent">Stream</span></span>
          </div>
          <p class="footer-tech-note">
            Cinematic streaming platform powered by TheMovieDB (TMDB) API & VidSrc Embed Services.
          </p>
        </div>

        <div class="footer-links-row">
          <a href="#" class="footer-link" id="footer-home-btn">Home</a>
          <a href="#" class="footer-link" id="footer-movies-btn">Movies</a>
          <a href="#" class="footer-link" id="footer-series-btn">Web Series</a>
          <a href="#" class="footer-link" id="footer-settings-btn">Settings</a>
        </div>
      </div>
    `;

    this.footerEl.querySelector('#footer-home-btn')?.addEventListener('click', (e) => { e.preventDefault(); this.navigate('home'); });
    this.footerEl.querySelector('#footer-movies-btn')?.addEventListener('click', (e) => { e.preventDefault(); this.navigate('movies'); });
    this.footerEl.querySelector('#footer-series-btn')?.addEventListener('click', (e) => { e.preventDefault(); this.navigate('series'); });
    this.footerEl.querySelector('#footer-settings-btn')?.addEventListener('click', (e) => { e.preventDefault(); this.settingsModal.open(); });
  }
}

// Start application on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  new CineStreamApp();
});
