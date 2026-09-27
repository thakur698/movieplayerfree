import { STREAM_SERVERS } from './config.js';
import { Storage } from './storage.js';
import { tmdbApi } from './api.js';
import { Icons } from './icons.js';
import Hls from 'hls.js';

export class StreamingPlayer {
  constructor(containerEl, onBackCallback) {
    this.containerEl = containerEl;
    this.onBack = onBackCallback;
    this.currentMedia = null;
    this.currentServerId = Storage.getSelectedServer() || 'vidsrc-su';
    this.currentSeason = 1;
    this.currentEpisode = 1;
    this.seasonsData = [];
    this.episodesCache = new Map();
    this.hlsInstance = null;
    this.directStreamUrl = null;
    this.blockPopups = false;
  }

  async open({ media, season = 1, episode = 1 }) {
    this.currentMedia = media;
    this.currentSeason = Number(season) || 1;
    this.currentEpisode = Number(episode) || 1;
    this.currentServerId = Storage.getSelectedServer() || 'vidsrc-su';
    this.directStreamUrl = null;

    // Fetch full details if external_ids or seasons are needed
    let fullDetails = media;
    try {
      if (!media.external_ids || (media.media_type === 'tv' && !media.seasons)) {
        fullDetails = await tmdbApi.getDetails(media.media_type || (media.first_air_date ? 'tv' : 'movie'), media.id);
        this.currentMedia = { ...media, ...fullDetails, media_type: media.media_type || (media.first_air_date ? 'tv' : 'movie') };
      }
    } catch (err) {
      console.warn('Could not fetch extra details for player, using basic data:', err);
    }

    const isTv = (this.currentMedia.media_type === 'tv') || Boolean(this.currentMedia.first_air_date) || Boolean(this.currentMedia.number_of_seasons);
    this.currentMedia.media_type = isTv ? 'tv' : 'movie';

    // If TV show, prepare seasons
    if (isTv) {
      this.seasonsData = (this.currentMedia.seasons || []).filter(s => s.season_number > 0);
      if (this.seasonsData.length === 0 && this.currentMedia.number_of_seasons) {
        for (let i = 1; i <= this.currentMedia.number_of_seasons; i++) {
          this.seasonsData.push({ season_number: i, name: `Season ${i}` });
        }
      }
      if (this.seasonsData.length === 0) {
        this.seasonsData.push({ season_number: 1, name: 'Season 1' });
      }
    }

    this.render();
    if (isTv) {
      await this.loadSeasonEpisodes(this.currentSeason);
    }

    this.saveWatchHistory();
  }

  saveWatchHistory() {
    if (!this.currentMedia) return;
    const isTv = this.currentMedia.media_type === 'tv';
    let epTitle = '';
    if (isTv && this.episodesCache.has(this.currentSeason)) {
      const eps = this.episodesCache.get(this.currentSeason);
      const ep = eps.find(e => e.episode_number === this.currentEpisode);
      if (ep) epTitle = ep.name;
    }

    Storage.saveProgress({
      id: this.currentMedia.id,
      media_type: this.currentMedia.media_type,
      title: this.currentMedia.title || this.currentMedia.name,
      poster_path: this.currentMedia.poster_path,
      backdrop_path: this.currentMedia.backdrop_path,
      season: isTv ? this.currentSeason : 1,
      episode: isTv ? this.currentEpisode : 1,
      episodeTitle: epTitle
    });
  }

  getEmbedUrl() {
    const server = STREAM_SERVERS.find(s => s.id === this.currentServerId) || STREAM_SERVERS[0];
    const isTv = this.currentMedia.media_type === 'tv';
    const tmdbId = this.currentMedia.id;
    const imdbId = this.currentMedia.external_ids?.imdb_id || this.currentMedia.imdb_id || '';

    if (isTv) {
      return server.getTvUrl(tmdbId, imdbId, this.currentSeason, this.currentEpisode);
    } else {
      return server.getMovieUrl(tmdbId, imdbId);
    }
  }

  render() {
    const isTv = this.currentMedia.media_type === 'tv';
    const title = this.currentMedia.title || this.currentMedia.name;
    const year = (this.currentMedia.release_date || this.currentMedia.first_air_date || '').substring(0, 4);

    this.containerEl.innerHTML = `
      <div class="player-view-container" id="player-view-container">
        <!-- Top Navigation Bar inside Player -->
        <div class="player-header-bar">
          <div class="player-header-left">
            <button class="btn btn-icon btn-glass" id="player-back-btn" title="Back to browsing">
              ${Icons.arrowLeft}
            </button>
            <div class="player-title-info">
              <div class="player-title-heading">
                <h2>${title}</h2>
                <span class="badge badge-year">${year}</span>
                <span class="badge ${isTv ? 'badge-tv' : 'badge-movie'}">${isTv ? 'WEB SERIES' : 'MOVIE'}</span>
                <span class="badge badge-quality">STREAMING ACTIVE</span>
              </div>
              ${isTv ? `<div class="player-ep-subtitle" id="player-ep-subtitle">Season ${this.currentSeason} • Episode ${this.currentEpisode}</div>` : ''}
            </div>
          </div>

          <div class="player-header-actions">
            <button class="btn btn-secondary btn-sm ${this.blockPopups ? 'btn-primary' : ''}" id="player-sandbox-toggle" title="Toggle Popup Blocker">
              ${Icons.shield} <span>${this.blockPopups ? 'Popup Blocker: ON' : 'Popup Blocker: OFF'}</span>
            </button>
            <button class="btn btn-secondary btn-sm" id="player-refresh-btn" title="Reload Video Stream">
              ${Icons.refresh} <span>Reload</span>
            </button>
            <button class="btn btn-secondary btn-sm" id="player-fullscreen-btn" title="Theater / Fullscreen">
              ${Icons.maximize} <span>Fullscreen</span>
            </button>
            <button class="btn btn-danger-soft btn-sm" id="player-close-btn" title="Close Player">
              ${Icons.close}
            </button>
          </div>
        </div>

        <!-- Main Video Area & Server Selection -->
        <div class="player-content-layout">
          <div class="player-video-section">
            <div class="player-iframe-wrapper" id="player-iframe-wrapper">
              ${this.directStreamUrl ? `
                <video id="native-hls-video" controls autoplay class="native-video-el"></video>
              ` : `
                <iframe
                  id="streaming-iframe"
                  src="${this.getEmbedUrl()}"
                  title="${title} Player"
                  allowfullscreen="true"
                  webkitallowfullscreen="true"
                  mozallowfullscreen="true"
                  allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                  ${this.blockPopups ? 'sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"' : ''}
                  frameborder="0"
                  scrolling="no">
                </iframe>
              `}
            </div>

            <!-- Server Switcher Toolbar -->
            <div class="player-server-panel">
              <div class="server-panel-header">
                <div class="server-label">
                  ${Icons.server}
                  <span>VidSrc Stream Mirrors:</span>
                </div>
                <div class="server-tip">
                  ${Icons.shield}
                  <span>If a server buffers, click another mirror below for instant switch</span>
                </div>
              </div>
              <div class="server-pills-row">
                ${STREAM_SERVERS.map(srv => `
                  <button class="server-pill ${srv.id === this.currentServerId ? 'active' : ''}" data-server-id="${srv.id}">
                    <span class="server-dot"></span>
                    <span class="server-name">${srv.name}</span>
                    <span class="server-badge">${srv.badge}</span>
                  </button>
                `).join('')}
              </div>
            </div>

            <!-- TV Episode Fast Navigation -->
            ${isTv ? `
              <div class="player-nav-controls">
                <button class="btn btn-secondary" id="player-prev-ep-btn" ${this.currentEpisode <= 1 ? 'disabled' : ''}>
                  ${Icons.prev} Previous Episode
                </button>
                <div class="current-ep-pill">
                  Season ${this.currentSeason} : Episode ${this.currentEpisode}
                </div>
                <button class="btn btn-primary" id="player-next-ep-btn">
                  Next Episode ${Icons.next}
                </button>
              </div>
            ` : ''}
          </div>

          <!-- TV Shows Episode Directory Sidebar -->
          ${isTv ? `
            <div class="player-episodes-sidebar">
              <div class="episodes-sidebar-header">
                <h3>Episodes</h3>
                <div class="season-select-wrapper">
                  <select id="season-selector" class="season-dropdown">
                    ${this.seasonsData.map(s => `
                      <option value="${s.season_number}" ${s.season_number === this.currentSeason ? 'selected' : ''}>
                        ${s.name || `Season ${s.season_number}`} (${s.episode_count || 'Episodes'})
                      </option>
                    `).join('')}
                  </select>
                </div>
              </div>

              <div class="episodes-list-scroll" id="episodes-list-scroll">
                <div class="episodes-loading">Loading episodes...</div>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    this.bindEvents();

    if (this.directStreamUrl) {
      this.attachHls(this.directStreamUrl);
    }
  }

  attachHls(m3u8Url) {
    const video = this.containerEl.querySelector('#native-hls-video');
    if (!video) return;

    if (Hls.isSupported()) {
      if (this.hlsInstance) {
        this.hlsInstance.destroy();
      }
      this.hlsInstance = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
      });
      this.hlsInstance.loadSource(m3u8Url);
      this.hlsInstance.attachMedia(video);
      this.hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(e => console.log('Autoplay prevented:', e));
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = m3u8Url;
      video.addEventListener('loadedmetadata', () => {
        video.play().catch(e => console.log('Autoplay prevented:', e));
      });
    }
  }

  bindEvents() {
    // Back and Close
    const backBtn = this.containerEl.querySelector('#player-back-btn');
    const closeBtn = this.containerEl.querySelector('#player-close-btn');
    if (backBtn) backBtn.addEventListener('click', () => this.close());
    if (closeBtn) closeBtn.addEventListener('click', () => this.close());

    // Refresh
    const refreshBtn = this.containerEl.querySelector('#player-refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        const iframe = this.containerEl.querySelector('#streaming-iframe');
        if (iframe) {
          iframe.src = this.getEmbedUrl();
          this.showToast('Reloaded video stream');
        }
      });
    }

    // Popup Blocker (Sandbox) Toggle
    const sandboxToggle = this.containerEl.querySelector('#player-sandbox-toggle');
    if (sandboxToggle) {
      sandboxToggle.addEventListener('click', () => {
        this.blockPopups = !this.blockPopups;
        this.showToast(this.blockPopups ? 'Popup Blocker Enabled (Sandbox active)' : 'Standard Player Mode Enabled');
        this.render();
      });
    }

    // Fullscreen
    const fullscreenBtn = this.containerEl.querySelector('#player-fullscreen-btn');
    if (fullscreenBtn) {
      fullscreenBtn.addEventListener('click', () => {
        const wrapper = this.containerEl.querySelector('#player-iframe-wrapper');
        if (!document.fullscreenElement) {
          wrapper.requestFullscreen().catch(err => {
            console.warn('Fullscreen request failed:', err);
          });
        } else {
          document.exitFullscreen();
        }
      });
    }

    // Server Switcher
    const serverPills = this.containerEl.querySelectorAll('.server-pill');
    serverPills.forEach(pill => {
      pill.addEventListener('click', () => {
        const srvId = pill.dataset.serverId;
        if (srvId === this.currentServerId) return;
        this.currentServerId = srvId;
        this.directStreamUrl = null;
        Storage.setSelectedServer(srvId);

        serverPills.forEach(p => p.classList.toggle('active', p.dataset.serverId === srvId));
        const iframe = this.containerEl.querySelector('#streaming-iframe');
        if (iframe) {
          iframe.src = this.getEmbedUrl();
        } else {
          this.render();
        }
        this.showToast(`Switched to ${STREAM_SERVERS.find(s => s.id === srvId)?.name}`);
      });
    });

    // Season Selector
    const seasonSelect = this.containerEl.querySelector('#season-selector');
    if (seasonSelect) {
      seasonSelect.addEventListener('change', async (e) => {
        const newSeason = Number(e.target.value);
        this.currentSeason = newSeason;
        this.currentEpisode = 1;
        await this.loadSeasonEpisodes(newSeason);
        this.updateStreamUrl();
      });
    }

    // Prev / Next Episode buttons
    const prevBtn = this.containerEl.querySelector('#player-prev-ep-btn');
    const nextBtn = this.containerEl.querySelector('#player-next-ep-btn');

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (this.currentEpisode > 1) {
          this.switchEpisode(this.currentEpisode - 1);
        }
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        this.switchEpisode(this.currentEpisode + 1);
      });
    }
  }

  async loadSeasonEpisodes(seasonNumber) {
    const listEl = this.containerEl.querySelector('#episodes-list-scroll');
    if (!listEl) return;

    listEl.innerHTML = `<div class="episodes-loading"><div class="spinner"></div><span>Fetching Season ${seasonNumber} episodes...</span></div>`;

    try {
      let episodes = [];
      if (this.episodesCache.has(seasonNumber)) {
        episodes = this.episodesCache.get(seasonNumber);
      } else {
        const data = await tmdbApi.getSeason(this.currentMedia.id, seasonNumber);
        episodes = data.episodes || [];
        this.episodesCache.set(seasonNumber, episodes);
      }

      if (episodes.length === 0) {
        listEl.innerHTML = `<div class="empty-state">No episode details found for Season ${seasonNumber}.</div>`;
        return;
      }

      listEl.innerHTML = episodes.map(ep => {
        const isCurrent = ep.episode_number === this.currentEpisode;
        const stillUrl = ep.still_path
          ? tmdbApi.getStillUrl(ep.still_path, 'w300')
          : tmdbApi.getPosterUrl(this.currentMedia.poster_path, 'w300');
        const runtime = ep.runtime ? `${ep.runtime}m` : '';

        return `
          <div class="episode-item-card ${isCurrent ? 'active-episode' : ''}" data-episode-num="${ep.episode_number}">
            <div class="ep-thumbnail-box">
              <img src="${stillUrl}" alt="${ep.name}" loading="lazy" />
              <div class="ep-play-overlay">${Icons.play}</div>
              <span class="ep-badge">E${ep.episode_number}</span>
            </div>
            <div class="ep-details-box">
              <div class="ep-top-row">
                <span class="ep-title">${ep.episode_number}. ${ep.name || `Episode ${ep.episode_number}`}</span>
                ${runtime ? `<span class="ep-runtime">${runtime}</span>` : ''}
              </div>
              <p class="ep-overview">${ep.overview ? ep.overview.slice(0, 110) + '...' : 'No overview available.'}</p>
            </div>
          </div>
        `;
      }).join('');

      // Bind episode click events
      const epCards = listEl.querySelectorAll('.episode-item-card');
      epCards.forEach(card => {
        card.addEventListener('click', () => {
          const epNum = Number(card.dataset.episodeNum);
          this.switchEpisode(epNum);
        });
      });

      // Update subtitle if current episode is in list
      const currentEpObj = episodes.find(e => e.episode_number === this.currentEpisode);
      const subtitleEl = this.containerEl.querySelector('#player-ep-subtitle');
      if (subtitleEl && currentEpObj) {
        subtitleEl.textContent = `S${seasonNumber} E${this.currentEpisode}: ${currentEpObj.name}`;
      }

      // Update Prev / Next buttons status
      const prevBtn = this.containerEl.querySelector('#player-prev-ep-btn');
      const nextBtn = this.containerEl.querySelector('#player-next-ep-btn');
      if (prevBtn) prevBtn.disabled = this.currentEpisode <= 1;
      if (nextBtn) nextBtn.disabled = this.currentEpisode >= episodes.length;

    } catch (err) {
      console.error('Failed to load season episodes:', err);
      listEl.innerHTML = `<div class="error-state">Failed to load episodes. You can still use the Next/Prev buttons.</div>`;
    }
  }

  switchEpisode(epNum) {
    this.currentEpisode = epNum;
    this.updateStreamUrl();

    // Update active highlight in episode list
    const epCards = this.containerEl.querySelectorAll('.episode-item-card');
    epCards.forEach(card => {
      card.classList.toggle('active-episode', Number(card.dataset.episodeNum) === epNum);
    });

    // Update buttons
    const prevBtn = this.containerEl.querySelector('#player-prev-ep-btn');
    const nextBtn = this.containerEl.querySelector('#player-next-ep-btn');
    if (prevBtn) prevBtn.disabled = epNum <= 1;

    const episodes = this.episodesCache.get(this.currentSeason) || [];
    if (nextBtn && episodes.length) {
      nextBtn.disabled = epNum >= episodes.length;
    }

    // Update subtitle
    const currentEpObj = episodes.find(e => e.episode_number === epNum);
    const subtitleEl = this.containerEl.querySelector('#player-ep-subtitle');
    if (subtitleEl) {
      subtitleEl.textContent = currentEpObj
        ? `S${this.currentSeason} E${epNum}: ${currentEpObj.name}`
        : `Season ${this.currentSeason} • Episode ${epNum}`;
    }

    const currentPill = this.containerEl.querySelector('.current-ep-pill');
    if (currentPill) {
      currentPill.textContent = `Season ${this.currentSeason} : Episode ${epNum}`;
    }

    this.saveWatchHistory();
    this.showToast(`Playing Season ${this.currentSeason} Episode ${epNum}`);
  }

  updateStreamUrl() {
    const iframe = this.containerEl.querySelector('#streaming-iframe');
    if (iframe) {
      iframe.src = this.getEmbedUrl();
    }
  }

  close() {
    if (this.hlsInstance) {
      this.hlsInstance.destroy();
      this.hlsInstance = null;
    }
    this.containerEl.innerHTML = '';
    if (this.onBack) this.onBack();
  }

  showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast-alert';
    toast.innerHTML = `<span>${message}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 20);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 400);
    }, 3000);
  }
}
