import { Icons } from '../icons.js';
import { tmdbApi } from '../api.js';
import { Storage } from '../storage.js';
import { AuthService } from '../firebase.js';

export class Navbar {
  constructor(containerEl, { onNavigate, onSearch, onOpenDetails, onOpenSettings, onSurpriseMe, onOpenAuth }) {
    this.containerEl = containerEl;
    this.onNavigate = onNavigate;
    this.onSearch = onSearch;
    this.onOpenDetails = onOpenDetails;
    this.onOpenSettings = onOpenSettings;
    this.onSurpriseMe = onSurpriseMe;
    this.onOpenAuth = onOpenAuth;
    this.currentUser = null;
    this.dropdownOpen = false;
    this.activeRoute = 'home';
    this.debounceTimer = null;
    this.render();
    this.initAuth();
  }

  initAuth() {
    AuthService.onAuthChange((user) => {
      this.currentUser = user;
      this.updateAuthUI();
    });
  }

  setRoute(route) {
    this.activeRoute = route;
    const links = this.containerEl.querySelectorAll('.nav-link');
    links.forEach(l => {
      l.classList.toggle('active', l.dataset.route === route);
    });
    this.updateWatchlistBadge();
  }

  updateWatchlistBadge() {
    const badge = this.containerEl.querySelector('#nav-watchlist-count');
    if (badge) {
      const count = Storage.getWatchlist().length;
      badge.textContent = count > 0 ? count : '';
      badge.style.display = count > 0 ? 'inline-flex' : 'none';
    }
  }

  render() {
    this.containerEl.innerHTML = `
      <div class="navbar-wrapper">
        <div class="navbar-left">
          <a href="#" class="brand-logo" id="nav-brand-logo">
            <span class="logo-icon">${Icons.play}</span>
            <span class="logo-text">Cine<span class="logo-accent">Stream</span></span>
          </a>

          <nav class="nav-links-menu" id="nav-links-menu">
            <button class="nav-link ${this.activeRoute === 'home' ? 'active' : ''}" data-route="home">Home</button>
            <button class="nav-link ${this.activeRoute === 'movies' ? 'active' : ''}" data-route="movies">Movies</button>
            <button class="nav-link ${this.activeRoute === 'series' ? 'active' : ''}" data-route="series">Web Series</button>
            <button class="nav-link ${this.activeRoute === 'trending' ? 'active' : ''}" data-route="trending">Trending</button>
            <button class="nav-link ${this.activeRoute === 'genres' ? 'active' : ''}" data-route="genres">Genres</button>
            <button class="nav-link ${this.activeRoute === 'watchlist' ? 'active' : ''}" data-route="watchlist">
              Watchlist <span class="nav-badge" id="nav-watchlist-count" style="display:none"></span>
            </button>
            
            <div class="mobile-menu-divider"></div>
            <button class="nav-link mobile-only-link" id="mobile-surprise-btn">
              ${Icons.dice} <span>Surprise Me</span>
            </button>
            <button class="nav-link mobile-only-link" id="mobile-settings-btn">
              ${Icons.settings} <span>Settings & Servers</span>
            </button>
            <button class="nav-link mobile-only-link" id="mobile-auth-btn">
              ${Icons.user} <span id="mobile-auth-label">Sign In</span>
            </button>
          </nav>
        </div>

        <div class="navbar-right">
          <!-- Surprise Me / Roulette Button (Desktop) -->
          <button class="nav-surprise-btn" id="nav-surprise-btn" title="Pick a random top movie or series">
            ${Icons.dice} <span>Surprise Me</span>
          </button>

          <!-- Search box with instant flyout -->
          <div class="search-input-box" id="search-input-box">
            <span class="search-icon">${Icons.search}</span>
            <input
              type="text"
              id="global-search-input"
              class="search-input"
              placeholder="Search (Ctrl + K)"
              autocomplete="off"
            />
            <button class="search-clear-btn" id="search-clear-btn" style="display:none" title="Clear search">
              ${Icons.close}
            </button>

            <!-- Autocomplete Live Dropdown -->
            <div class="search-dropdown-results" id="search-dropdown-results" style="display:none"></div>
          </div>

          <!-- Settings Button -->
          <button class="btn btn-icon btn-glass" id="nav-settings-btn" title="Settings & Stream Servers">
            ${Icons.settings}
          </button>

          <!-- User Profile / Auth Slot -->
          <div class="nav-auth-slot" id="nav-auth-slot"></div>

          <!-- Mobile Menu Toggle -->
          <button class="mobile-menu-toggle" id="mobile-menu-toggle" aria-label="Toggle menu">
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
      </div>
    `;

    this.bindEvents();
    this.updateWatchlistBadge();
    this.updateAuthUI();
  }

  bindEvents() {
    // Brand click -> home
    const brand = this.containerEl.querySelector('#nav-brand-logo');
    brand.addEventListener('click', (e) => {
      e.preventDefault();
      this.onNavigate('home');
    });

    // Nav links click
    const links = this.containerEl.querySelectorAll('.nav-link');
    links.forEach(l => {
      l.addEventListener('click', () => {
        const route = l.dataset.route;
        this.setRoute(route);
        this.onNavigate(route);

        const menu = this.containerEl.querySelector('#nav-links-menu');
        menu.classList.remove('mobile-open');
      });
    });

    // Surprise Me
    const surpriseBtn = this.containerEl.querySelector('#nav-surprise-btn');
    if (surpriseBtn) {
      surpriseBtn.addEventListener('click', () => {
        if (this.onSurpriseMe) this.onSurpriseMe();
      });
    }

    // Keyboard shortcut Ctrl+K to search
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const searchInput = this.containerEl.querySelector('#global-search-input');
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      }
    });

    // Settings click
    const settingsBtn = this.containerEl.querySelector('#nav-settings-btn');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        if (this.onOpenSettings) this.onOpenSettings();
      });
    }

    // Mobile menu toggle
    const toggle = this.containerEl.querySelector('#mobile-menu-toggle');
    const menu = this.containerEl.querySelector('#nav-links-menu');
    if (toggle) {
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.classList.toggle('mobile-open');
        toggle.classList.toggle('is-active');
      });
    }

    // Mobile-only surprise button
    const mobileSurpriseBtn = this.containerEl.querySelector('#mobile-surprise-btn');
    if (mobileSurpriseBtn) {
      mobileSurpriseBtn.addEventListener('click', () => {
        menu.classList.remove('mobile-open');
        toggle?.classList.remove('is-active');
        if (this.onSurpriseMe) this.onSurpriseMe();
      });
    }

    // Mobile-only settings button
    const mobileSettingsBtn = this.containerEl.querySelector('#mobile-settings-btn');
    if (mobileSettingsBtn) {
      mobileSettingsBtn.addEventListener('click', () => {
        menu.classList.remove('mobile-open');
        toggle?.classList.remove('is-active');
        if (this.onOpenSettings) this.onOpenSettings();
      });
    }

    // Close mobile menu or user dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (menu && !menu.contains(e.target) && !toggle?.contains(e.target)) {
        menu.classList.remove('mobile-open');
        toggle?.classList.remove('is-active');
      }

      const wrapper = this.containerEl.querySelector('#user-profile-menu-wrapper');
      const dropdown = this.containerEl.querySelector('#user-dropdown-card');
      if (wrapper && dropdown && !wrapper.contains(e.target)) {
        this.dropdownOpen = false;
        dropdown.style.display = 'none';
      }
    });

    // Mobile auth button
    const mobileAuthBtn = this.containerEl.querySelector('#mobile-auth-btn');
    if (mobileAuthBtn) {
      mobileAuthBtn.addEventListener('click', async () => {
        menu.classList.remove('mobile-open');
        toggle?.classList.remove('is-active');
        if (this.currentUser) {
          try {
            await AuthService.logout();
          } catch (e) {
            console.error('Logout failed:', e);
          }
        } else {
          if (this.onOpenAuth) this.onOpenAuth('signin');
        }
      });
    }

    // Search input handling
    const searchInput = this.containerEl.querySelector('#global-search-input');
    const clearBtn = this.containerEl.querySelector('#search-clear-btn');
    const dropdown = this.containerEl.querySelector('#search-dropdown-results');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const q = e.target.value.trim();
        clearBtn.style.display = q ? 'block' : 'none';

        clearTimeout(this.debounceTimer);
        if (!q) {
          dropdown.style.display = 'none';
          dropdown.innerHTML = '';
          return;
        }

        this.debounceTimer = setTimeout(async () => {
          await this.performLiveSearch(q);
        }, 280);
      });

      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const q = searchInput.value.trim();
          if (q) {
            dropdown.style.display = 'none';
            if (this.onSearch) this.onSearch(q);
          }
        }
      });

      // Close dropdown when clicking outside
      document.addEventListener('click', (e) => {
        if (!this.containerEl.querySelector('#search-input-box').contains(e.target)) {
          dropdown.style.display = 'none';
        }
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        clearBtn.style.display = 'none';
        dropdown.style.display = 'none';
        searchInput.focus();
      });
    }
  }

  async performLiveSearch(query) {
    const dropdown = this.containerEl.querySelector('#search-dropdown-results');
    dropdown.innerHTML = `<div class="dropdown-spinner"><div class="spinner-sm"></div> Searching titles...</div>`;
    dropdown.style.display = 'block';

    try {
      const data = await tmdbApi.searchMulti(query);
      const items = (data.results || []).filter(item => (item.media_type === 'movie' || item.media_type === 'tv') && item.poster_path).slice(0, 6);

      if (items.length === 0) {
        dropdown.innerHTML = `<div class="dropdown-empty">No results found for "${query}"</div>`;
        return;
      }

      dropdown.innerHTML = `
        <div class="dropdown-list">
          ${items.map(item => {
            const isTv = item.media_type === 'tv';
            const title = item.title || item.name;
            const year = (item.release_date || item.first_air_date || '').substring(0, 4);
            const poster = tmdbApi.getPosterUrl(item.poster_path, 'w185');

            return `
              <div class="dropdown-item" data-id="${item.id}" data-type="${item.media_type}">
                <img src="${poster}" alt="${title}" class="dropdown-thumb" />
                <div class="dropdown-item-meta">
                  <span class="dropdown-item-title">${title}</span>
                  <div class="dropdown-sub">
                    <span class="badge ${isTv ? 'badge-tv' : 'badge-movie'}">${isTv ? 'SERIES' : 'MOVIE'}</span>
                    ${year ? `<span>${year}</span>` : ''}
                    ${item.vote_average ? `<span>⭐ ${item.vote_average.toFixed(1)}</span>` : ''}
                  </div>
                </div>
              </div>
            `;
          }).join('')}
          <div class="dropdown-footer">
            <button class="dropdown-see-all-btn" id="dropdown-see-all-btn">
              View all results for "${query}" &rarr;
            </button>
          </div>
        </div>
      `;

      // Item click
      const itemEls = dropdown.querySelectorAll('.dropdown-item');
      itemEls.forEach(el => {
        el.addEventListener('click', () => {
          const id = el.dataset.id;
          const type = el.dataset.type;
          dropdown.style.display = 'none';
          if (this.onOpenDetails) this.onOpenDetails(type, id);
        });
      });

      // View all button
      const seeAllBtn = dropdown.querySelector('#dropdown-see-all-btn');
      if (seeAllBtn) {
        seeAllBtn.addEventListener('click', () => {
          dropdown.style.display = 'none';
          if (this.onSearch) this.onSearch(query);
        });
      }
    } catch (err) {
      console.error('Autocomplete search failed:', err);
      dropdown.innerHTML = `<div class="dropdown-empty">Search temporarily unavailable</div>`;
    }
  }

  updateAuthUI() {
    const slot = this.containerEl.querySelector('#nav-auth-slot');
    const mobileAuthLabel = this.containerEl.querySelector('#mobile-auth-label');

    if (this.currentUser) {
      const initial = (this.currentUser.displayName || this.currentUser.email || 'U')[0].toUpperCase();
      const displayName = this.currentUser.displayName || this.currentUser.email?.split('@')[0] || 'User';

      if (slot) {
        slot.innerHTML = `
          <div class="user-profile-menu-wrapper" id="user-profile-menu-wrapper">
            <button class="user-avatar-btn" id="user-avatar-btn" title="${this.currentUser.email || 'Account'}">
              ${this.currentUser.photoURL ? `<img src="${this.currentUser.photoURL}" alt="Avatar" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" />` : initial}
            </button>
            <div class="user-dropdown-card" id="user-dropdown-card" style="display: ${this.dropdownOpen ? 'block' : 'none'};">
              <div class="user-dropdown-header">
                <div class="user-dropdown-name">${displayName}</div>
                <div class="user-dropdown-email">${this.currentUser.email || ''}</div>
              </div>
              <button class="user-dropdown-item" id="user-dropdown-watchlist">
                ${Icons.bookmark} My Watchlist
              </button>
              <button class="user-dropdown-item logout-item" id="user-dropdown-logout">
                ${Icons.close} Sign Out
              </button>
            </div>
          </div>
        `;
      }

      if (mobileAuthLabel) {
        mobileAuthLabel.textContent = `Sign Out (${displayName})`;
      }
    } else {
      if (slot) {
        slot.innerHTML = `
          <button class="btn btn-primary nav-auth-btn" id="nav-signin-btn" title="Sign In or Create Account">
            ${Icons.user} <span>Sign In</span>
          </button>
        `;
      }

      if (mobileAuthLabel) {
        mobileAuthLabel.textContent = 'Sign In';
      }
    }

    this.bindAuthEvents();
  }

  bindAuthEvents() {
    const slot = this.containerEl.querySelector('#nav-auth-slot');
    if (!slot) return;

    // Desktop Sign In
    const signinBtn = slot.querySelector('#nav-signin-btn');
    if (signinBtn) {
      signinBtn.addEventListener('click', () => {
        if (this.onOpenAuth) this.onOpenAuth('signin');
      });
    }

    // Avatar button toggle
    const avatarBtn = slot.querySelector('#user-avatar-btn');
    const dropdown = slot.querySelector('#user-dropdown-card');
    if (avatarBtn && dropdown) {
      avatarBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.dropdownOpen = !this.dropdownOpen;
        dropdown.style.display = this.dropdownOpen ? 'block' : 'none';
      });
    }

    // Dropdown watchlist
    const watchlistBtn = slot.querySelector('#user-dropdown-watchlist');
    if (watchlistBtn) {
      watchlistBtn.addEventListener('click', () => {
        this.dropdownOpen = false;
        if (dropdown) dropdown.style.display = 'none';
        this.setRoute('watchlist');
        if (this.onNavigate) this.onNavigate('watchlist');
      });
    }

    // Dropdown sign out
    const logoutBtn = slot.querySelector('#user-dropdown-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        this.dropdownOpen = false;
        if (dropdown) dropdown.style.display = 'none';
        try {
          await AuthService.logout();
        } catch (e) {
          console.error('Logout error:', e);
        }
      });
    }
  }
}

