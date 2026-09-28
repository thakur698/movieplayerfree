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
    this.currentServerId = Storage.getSelectedServer() || 'vidlink';
    this.currentSeason = 1;
    this.currentEpisode = 1;
    this.seasonsData = [];
    this.episodesCache = new Map();
    this.hlsInstance = null;
    this.directStreamUrl = null;
    this.subtitles = [];
    this.isResolvingDirect = false;
    this.blockPopups = Storage.getAdShieldEnabled();
    this.activeBlobUrls = [];
    this.isLangPanelOpen = false;
    this.selectedSubtitleUrl = null;
    this.selectedSubtitleLabel = 'Off';
    this.availableSubtitles = [];
    this.isLoadingSubtitles = false;
  }

  async open({ media, season = 1, episode = 1 }) {
    this.currentMedia = media;
    this.currentSeason = Number(season) || 1;
    this.currentEpisode = Number(episode) || 1;
    this.currentServerId = Storage.getSelectedServer() || 'vidlink';
    this.directStreamUrl = null;
    this.subtitles = [];
    this.isResolvingDirect = false;
    this.selectedSubtitleUrl = null;
    this.selectedSubtitleLabel = 'Off';
    this.availableSubtitles = [];
    this.loadAvailableSubtitles();
    if (this.blockPopups) {
      this.enablePopupTrap();
    }

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

    if (this.currentServerId === 'direct-hls') {
      this.render();
      if (isTv) {
        this.loadSeasonEpisodes(this.currentSeason);
      }
      await this.resolveDirectStream();
    } else {
      this.render();
      if (isTv) {
        await this.loadSeasonEpisodes(this.currentSeason);
      }
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

    let url = isTv
      ? server.getTvUrl(tmdbId, imdbId, this.currentSeason, this.currentEpisode)
      : server.getMovieUrl(tmdbId, imdbId);

    // If a subtitle track is selected and server supports subtitle parameter
    if (this.selectedSubtitleUrl && this.currentServerId === 'vidlink') {
      const sep = url.includes('?') ? '&' : '?';
      url += `${sep}subtitles=${encodeURIComponent(this.selectedSubtitleUrl)}`;
    }

    return url;
  }

  async resolveDirectStream() {
    this.isResolvingDirect = true;
    this.render();

    const isTv = this.currentMedia.media_type === 'tv';
    const tmdbId = this.currentMedia.id;
    const imdbId = this.currentMedia.external_ids?.imdb_id || this.currentMedia.imdb_id || '';

    let url = `/api/stream?tmdbId=${tmdbId}&type=${isTv ? 'tv' : 'movie'}`;
    if (isTv) {
      url += `&season=${this.currentSeason}&episode=${this.currentEpisode}`;
    }
    if (imdbId) {
      url += `&imdbId=${imdbId}`;
    }

    try {
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.streamUrl) {
          this.directStreamUrl = data.streamUrl;
          this.subtitles = data.subtitles || [];
          this.isResolvingDirect = false;
          this.render();
          this.showToast('✨ Direct Ad-Free Stream Loaded (1080p HLS)');
          return;
        }
      }
    } catch (err) {
      console.warn('[Player] Direct stream resolution error:', err);
    }

    // Direct resolution unavailable for this title -> fallback to VidSrc.pm
    this.isResolvingDirect = false;
    this.directStreamUrl = null;
    this.currentServerId = 'vidsrc-pm';
    this.render();
    this.showToast('Direct stream not indexed for this title — switched to VidSrc mirror');
  }

  async attachSubtitles(videoEl, subtitles) {
    if (!subtitles || !subtitles.length) return;
    const oldTracks = videoEl.querySelectorAll('track');
    oldTracks.forEach(t => t.remove());

    for (const sub of subtitles.slice(0, 8)) {
      try {
        const res = await fetch(sub.url);
        if (res.ok) {
          const srtText = await res.text();
          // Convert SRT to WebVTT
          const vttText = 'WEBVTT\n\n' + srtText
            .replace(/\r\n|\r/g, '\n')
            .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
          const blob = new Blob([vttText], { type: 'text/vtt' });
          const trackUrl = URL.createObjectURL(blob);
          this.activeBlobUrls.push(trackUrl);

          const track = document.createElement('track');
          track.kind = 'subtitles';
          track.label = sub.label || (sub.lang || 'en').toUpperCase();
          track.srclang = sub.lang || 'en';
          track.src = trackUrl;
          if (sub.lang === 'en' || sub.lang === 'eng') {
            track.default = true;
          }
          videoEl.appendChild(track);
        }
      } catch (err) {
        console.warn('Could not load subtitle track:', sub.lang, err);
      }
    }
  }

  render() {
    const isTv = this.currentMedia.media_type === 'tv';
    const title = this.currentMedia.title || this.currentMedia.name;
    const year = (this.currentMedia.release_date || this.currentMedia.first_air_date || '').substring(0, 4);
    const shouldSandbox = this.blockPopups && this.currentServerId !== 'vidlink';
    const isDirectActive = this.currentServerId === 'direct-hls';

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
                <span class="badge ${isDirectActive ? 'badge-direct' : 'badge-quality'}">${isDirectActive ? '✨ DIRECT AD-FREE' : 'STREAMING ACTIVE'}</span>
              </div>
              ${isTv ? `<div class="player-ep-subtitle" id="player-ep-subtitle">Season ${this.currentSeason} • Episode ${this.currentEpisode}</div>` : ''}
            </div>
          </div>

          <div class="player-header-actions">
            <button class="btn btn-sm ${this.isLangPanelOpen ? 'btn-active-purple' : 'btn-secondary'}" id="player-lang-btn" title="Audio Language & Subtitles">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
              <span class="btn-action-label">Audio & Subtitles</span>
            </button>
            <button class="btn btn-sm ${this.blockPopups ? 'btn-adshield-active' : 'btn-secondary'}" id="player-sandbox-toggle" title="${this.blockPopups ? 'Ad Shield is ON (Popups & Redirects Blocked)' : 'Ad Shield is OFF'}">
              ${Icons.shield} <span class="btn-action-label">${this.blockPopups ? 'Ad Shield: ON' : 'Ad Shield: OFF'}</span>
            </button>
            <button class="btn btn-secondary btn-sm" id="player-refresh-btn" title="Reload Video Stream">
              ${Icons.refresh} <span class="btn-action-label">Reload</span>
            </button>
            <button class="btn btn-secondary btn-sm" id="player-fullscreen-btn" title="Theater / Fullscreen">
              ${Icons.maximize} <span class="btn-action-label">Fullscreen</span>
            </button>
            <button class="btn btn-danger-soft btn-sm" id="player-close-btn" title="Close Player">
              ${Icons.close}
            </button>
          </div>
        </div>

        <!-- Audio Language & Subtitles Dropdown Drawer -->
        <div class="player-language-drawer ${this.isLangPanelOpen ? 'open' : ''}" id="player-language-drawer">
          <div class="lang-drawer-inner">
            <div class="lang-section">
              <div class="lang-section-title">
                <span class="lang-badge">🗣️ AUDIO TRACKS / DUBBED SERVERS</span>
                <span class="lang-hint">Select a streaming server configured for your preferred audio language:</span>
              </div>
              <div class="audio-options-grid">
                <button class="audio-opt-btn ${this.currentServerId === 'vidlink' ? 'active' : ''}" data-server-id="vidlink">
                  <span class="flag">🇺🇸</span>
                  <div class="audio-info">
                    <span class="name">VidLink (Ad-Free HD)</span>
                    <span class="meta">Original Audio • Multi-Subtitles [CC] • 0 Ads</span>
                  </div>
                  ${this.currentServerId === 'vidlink' ? '<span class="check-icon">✓</span>' : ''}
                </button>
                <button class="audio-opt-btn ${this.currentServerId === 'superembed' ? 'active' : ''}" data-server-id="superembed">
                  <span class="flag">🌍</span>
                  <div class="audio-info">
                    <span class="name">SuperEmbed (Multi-Audio & Dubs)</span>
                    <span class="meta">Multi-Server Aggregator • Regional Audio & Dub Mirrors</span>
                  </div>
                  ${this.currentServerId === 'superembed' ? '<span class="check-icon">✓</span>' : ''}
                </button>
                <button class="audio-opt-btn ${this.currentServerId === 'vidsrc-pm' ? 'active' : ''}" data-server-id="vidsrc-pm">
                  <span class="flag">⚡</span>
                  <div class="audio-info">
                    <span class="name">VidSrc.pm (Ultra Fast)</span>
                    <span class="meta">High Bitrate • Low Buffer Mirror</span>
                  </div>
                  ${this.currentServerId === 'vidsrc-pm' ? '<span class="check-icon">✓</span>' : ''}
                </button>
                <button class="audio-opt-btn ${this.currentServerId === 'vidsrc-su' ? 'active' : ''}" data-server-id="vidsrc-su">
                  <span class="flag">🌐</span>
                  <div class="audio-info">
                    <span class="name">VidSrc.su (Active HD)</span>
                    <span class="meta">Alternative High-Quality Mirror</span>
                  </div>
                  ${this.currentServerId === 'vidsrc-su' ? '<span class="check-icon">✓</span>' : ''}
                </button>
                <button class="audio-opt-btn ${this.currentServerId === 'vidsrc-to' ? 'active' : ''}" data-server-id="vidsrc-to">
                  <span class="flag">🎬</span>
                  <div class="audio-info">
                    <span class="name">VidSrc.to (Mirror 1)</span>
                    <span class="meta">Multi-CDN Backup Stream</span>
                  </div>
                  ${this.currentServerId === 'vidsrc-to' ? '<span class="check-icon">✓</span>' : ''}
                </button>
              </div>
            </div>

            <div class="lang-section">
              <div class="lang-section-title">
                <span class="lang-badge">💬 SUBTITLES & CLOSED CAPTIONS</span>
                <span class="lang-hint">Choose a subtitle language track or use the in-player controls:</span>
              </div>
              <div class="subtitles-quick-row" id="subtitles-chips-container">
                ${this.renderSubtitleChips()}
              </div>
              <div class="subtitles-help-tip">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                <span><strong>How to Switch Subtitles:</strong> Hover over the video stream and click the <strong>[CC]</strong> icon at the bottom-right corner (next to the gear icon) to select from 30+ languages (English, Hindi, Spanish, French, German, Arabic, Italian, etc.).</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Main Video Area & Server Selection -->
        <div class="player-content-layout">
          <div class="player-video-section">
            <div class="player-iframe-wrapper" id="player-iframe-wrapper">
              ${this.isResolvingDirect ? `
                <div class="player-resolving-loader">
                  <div class="loader-pulse-ring"></div>
                  <div class="loader-text-group">
                    <span class="loader-badge">⚡ ZERO-ADS STREAM RESOLVER</span>
                    <h3>Resolving Direct 1080p Stream...</h3>
                    <p>Extracting high-speed CDN master manifest & multi-language subtitles</p>
                  </div>
                </div>
              ` : this.directStreamUrl ? `
                <video id="native-hls-video" controls autoplay playsinline class="native-video-el"></video>
              ` : `
                <iframe
                  id="streaming-iframe"
                  src="${this.getEmbedUrl()}"
                  title="${title} Player"
                  allowfullscreen="true"
                  webkitallowfullscreen="true"
                  mozallowfullscreen="true"
                  allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                  ${shouldSandbox ? 'sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"' : ''}
                  frameborder="0"
                  scrolling="no">
                </iframe>
              `}
            </div>

            <!-- Ad Shield Status & Tip Notification Bar -->
            <div class="ad-shield-status-bar ${isDirectActive ? 'shield-on' : (this.blockPopups ? 'shield-on' : 'shield-off')}">
              <div class="shield-status-info">
                ${Icons.shield}
                <span>${isDirectActive
                  ? '<strong>Direct Player Active:</strong> Native HTML5 video engine playing direct master stream with <strong>ZERO ADS</strong>, ZERO popups, and multi-language captions.'
                  : (this.blockPopups
                    ? '<strong>Ad Shield Active:</strong> Popups & new-tab redirects are blocked natively. If a stream buffers, click another server below.'
                    : '<strong>Ad Shield OFF:</strong> Standard mode active. Third-party video ads and popups are not filtered.')}</span>
              </div>
              <button class="btn-shield-quick-toggle" id="player-shield-banner-btn">
                ${this.blockPopups ? 'Turn OFF' : 'Turn ON'}
              </button>
            </div>

            <!-- Server Switcher Toolbar -->
            <div class="player-server-panel">
              <div class="server-panel-header">
                <div class="server-label">
                  ${Icons.server}
                  <span>Fast Stream Servers:</span>
                </div>
                <div class="server-tip">
                  ${Icons.shield}
                  <span>Direct Player provides zero-ad 1080p HLS streaming</span>
                </div>
              </div>
              <div class="server-pills-row">
                ${STREAM_SERVERS.map(srv => `
                  <button class="server-pill ${srv.isDirect ? 'server-direct' : ''} ${srv.id === this.currentServerId ? 'active' : ''}" data-server-id="${srv.id}">
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

    if (isTv) {
      this.loadSeasonEpisodes(this.currentSeason);
    }

    if (this.directStreamUrl) {
      this.attachHls(this.directStreamUrl);
    }
  }

  attachHls(m3u8Url) {
    const video = this.containerEl.querySelector('#native-hls-video');
    if (!video) return;

    if (this.subtitles && this.subtitles.length) {
      this.attachSubtitles(video, this.subtitles);
    }

    let retryCount = 0;
    const fallbackToVidLink = (reason) => {
      console.warn(`[DirectPlayer] ${reason} - Falling back to VidLink (Clean Ad-Free HD)`);
      if (this.hlsInstance) {
        this.hlsInstance.destroy();
        this.hlsInstance = null;
      }
      this.directStreamUrl = null;
      this.currentServerId = 'vidlink';
      Storage.setSelectedServer('vidlink');
      this.render();
      this.showToast('Switched to VidLink (Clean Ad-Free HD)');
    };

    // Stalled watchdog: if video is paused at 0s and doesn't progress within 6s
    const watchdogTimer = setTimeout(() => {
      if (video.currentTime === 0 && !video.ended && this.currentServerId === 'direct-hls') {
        fallbackToVidLink('Stream playback stalled');
      }
    }, 6000);

    video.addEventListener('timeupdate', () => {
      if (video.currentTime > 0) clearTimeout(watchdogTimer);
    }, { once: true });

    if (Hls.isSupported()) {
      if (this.hlsInstance) {
        this.hlsInstance.destroy();
      }
      this.hlsInstance = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90
      });
      this.hlsInstance.loadSource(m3u8Url);
      this.hlsInstance.attachMedia(video);
      this.hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(e => console.log('Autoplay prevented:', e));
      });
      this.hlsInstance.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              retryCount++;
              if (retryCount > 2) {
                clearTimeout(watchdogTimer);
                fallbackToVidLink('Network error (upstream CDN cross-origin blocked)');
              } else {
                console.warn('Network error, attempting recovery...');
                this.hlsInstance.startLoad();
              }
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.warn('Media error, attempting recovery...');
              this.hlsInstance.recoverMediaError();
              break;
            default:
              console.error('Fatal HLS error:', data);
              clearTimeout(watchdogTimer);
              fallbackToVidLink('Fatal HLS decoding error');
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = m3u8Url;
      video.addEventListener('loadedmetadata', () => {
        video.play().catch(e => console.log('Autoplay prevented:', e));
      });
      video.addEventListener('error', () => {
        clearTimeout(watchdogTimer);
        fallbackToVidLink('Native video playback error');
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
      refreshBtn.addEventListener('click', async () => {
        if (this.currentServerId === 'direct-hls') {
          if (this.hlsInstance) {
            this.hlsInstance.destroy();
            this.hlsInstance = null;
          }
          this.directStreamUrl = null;
          await this.resolveDirectStream();
        } else {
          const iframe = this.containerEl.querySelector('#streaming-iframe');
          if (iframe) {
            iframe.src = this.getEmbedUrl();
            this.showToast('Reloaded video stream');
          }
        }
      });
    }

    // Ad Shield (Popup & Redirect Blocker) Toggle
    const toggleAdShield = () => {
      this.blockPopups = !this.blockPopups;
      Storage.setAdShieldEnabled(this.blockPopups);
      if (this.blockPopups) {
        this.enablePopupTrap();
        this.showToast('🛡️ Ad Shield Enabled (Popups & Redirects Blocked)');
      } else {
        this.disablePopupTrap();
        this.showToast('⚠️ Ad Shield Disabled (Standard Mode)');
      }
      this.render();
    };

    const sandboxToggle = this.containerEl.querySelector('#player-sandbox-toggle');
    if (sandboxToggle) {
      sandboxToggle.addEventListener('click', toggleAdShield);
    }

    const bannerToggle = this.containerEl.querySelector('#player-shield-banner-btn');
    if (bannerToggle) {
      bannerToggle.addEventListener('click', toggleAdShield);
    }

    // Audio Language & Subtitles Drawer Toggle
    const langBtn = this.containerEl.querySelector('#player-lang-btn');
    if (langBtn) {
      langBtn.addEventListener('click', () => {
        this.isLangPanelOpen = !this.isLangPanelOpen;
        const drawer = this.containerEl.querySelector('#player-language-drawer');
        if (drawer) drawer.classList.toggle('open', this.isLangPanelOpen);
        langBtn.classList.toggle('btn-active-purple', this.isLangPanelOpen);
      });
    }

    // Audio Option Buttons in Language Drawer
    const audioOptBtns = this.containerEl.querySelectorAll('.audio-opt-btn');
    audioOptBtns.forEach(btn => {
      btn.addEventListener('click', async () => {
        const srvId = btn.dataset.serverId;
        await this.switchServer(srvId);
      });
    });

    this.bindSubtitleChips();

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
      pill.addEventListener('click', async () => {
        await this.switchServer(pill.dataset.serverId);
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
        if (this.currentServerId === 'direct-hls') {
          await this.resolveDirectStream();
        } else {
          this.updateStreamUrl();
        }
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

  async switchEpisode(epNum) {
    this.currentEpisode = epNum;

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

    if (this.currentServerId === 'direct-hls') {
      if (this.hlsInstance) {
        this.hlsInstance.destroy();
        this.hlsInstance = null;
      }
      this.directStreamUrl = null;
      await this.resolveDirectStream();
    } else {
      this.updateStreamUrl();
      this.showToast(`Playing Season ${this.currentSeason} Episode ${epNum}`);
    }
  }

  async switchServer(srvId) {
    if (srvId === this.currentServerId && !this.isResolvingDirect) return;
    this.currentServerId = srvId;
    Storage.setSelectedServer(srvId);

    if (this.hlsInstance) {
      this.hlsInstance.destroy();
      this.hlsInstance = null;
    }

    if (srvId === 'direct-hls') {
      this.directStreamUrl = null;
      await this.resolveDirectStream();
    } else {
      this.directStreamUrl = null;
      this.render();
      const srvObj = STREAM_SERVERS.find(s => s.id === srvId);
      this.showToast(`Switched to ${srvObj ? srvObj.name : srvId}`);
    }
  }

  bindSubtitleChips() {
    const chips = this.containerEl.querySelectorAll('.sub-chip');
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        const rawUrl = chip.dataset.subUrl;
        const label = chip.dataset.subLabel || chip.textContent.trim();

        chips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');

        if (!rawUrl) {
          this.selectedSubtitleUrl = null;
          this.selectedSubtitleLabel = 'Off';
          this.showToast('Subtitles Off: Tap [CC] inside player controls to turn off');
          return;
        }

        this.selectedSubtitleLabel = label;
        this.showToast(`💬 To view ${label} captions, hover over the video and click the [CC] icon at the bottom-right!`);

        // If on production public URL, we can also pass the external subtitle parameter
        if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
          const vttUrl = `${window.location.origin}/api/subtitles?url=${encodeURIComponent(rawUrl)}`;
          this.selectedSubtitleUrl = vttUrl;
          this.updateStreamUrl();
        }
      });
    });
  }

  async loadAvailableSubtitles() {
    if (!this.currentMedia) return;
    this.isLoadingSubtitles = true;
    try {
      const tmdbId = this.currentMedia.id;
      const isTv = this.currentMedia.media_type === 'tv';
      const imdbId = this.currentMedia.external_ids?.imdb_id || this.currentMedia.imdb_id || '';
      let url = `/api/stream?tmdbId=${tmdbId}&type=${isTv ? 'tv' : 'movie'}`;
      if (isTv) url += `&season=${this.currentSeason}&episode=${this.currentEpisode}`;
      if (imdbId) url += `&imdbId=${imdbId}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.subtitles && Array.isArray(data.subtitles) && data.subtitles.length > 0) {
          this.availableSubtitles = data.subtitles;
          const container = this.containerEl.querySelector('#subtitles-chips-container');
          if (container) {
            container.innerHTML = this.renderSubtitleChips();
            this.bindSubtitleChips();
          }
        }
      }
    } catch (e) {
      console.warn('Subtitles fetch error:', e);
    } finally {
      this.isLoadingSubtitles = false;
    }
  }

  renderSubtitleChips() {
    const isOff = !this.selectedSubtitleUrl;
    let html = `
      <button class="sub-chip ${isOff ? 'active' : ''}" data-sub-url="">
        ✕ Subtitles Off
      </button>
    `;

    // Standard high-demand languages as default presets
    const presets = [
      { lang: 'en', label: 'English (EN)' },
      { lang: 'hi', label: 'Hindi (HI)' },
      { lang: 'es', label: 'Spanish (ES)' },
      { lang: 'fr', label: 'French (FR)' },
      { lang: 'de', label: 'German (DE)' },
      { lang: 'ar', label: 'Arabic (AR)' },
      { lang: 'it', label: 'Italian (IT)' },
      { lang: 'pt', label: 'Portuguese (PT)' },
      { lang: 'ru', label: 'Russian (RU)' },
    ];

    if (this.availableSubtitles && this.availableSubtitles.length) {
      this.availableSubtitles.forEach(sub => {
        const isActive = this.selectedSubtitleUrl && this.selectedSubtitleUrl.includes(encodeURIComponent(sub.url));
        const label = sub.label || (sub.lang || 'SUB').toUpperCase();
        html += `
          <button class="sub-chip ${isActive ? 'active' : ''}" data-sub-url="${sub.url}" data-sub-label="${label}">
            ${label}
          </button>
        `;
      });
    } else {
      presets.forEach(p => {
        html += `
          <button class="sub-chip" data-sub-lang="${p.lang}" data-sub-label="${p.label}">
            ${p.label}
          </button>
        `;
      });
    }

    return html;
  }

  updateStreamUrl() {
    const iframe = this.containerEl.querySelector('#streaming-iframe');
    if (iframe) {
      iframe.src = this.getEmbedUrl();
    }
  }

  enablePopupTrap() {
    try {
      if (!window._origWindowOpen) {
        window._origWindowOpen = window.open;
      }
      window.open = function(...args) {
        console.warn('[AdShield] Blocked popup window.open attempt:', args);
        return null;
      };
    } catch (e) {
      console.warn('Could not hook window.open:', e);
    }
  }

  disablePopupTrap() {
    try {
      if (window._origWindowOpen) {
        window.open = window._origWindowOpen;
        delete window._origWindowOpen;
      }
    } catch (e) {
      console.warn('Could not restore window.open:', e);
    }
  }

  close() {
    this.disablePopupTrap();
    if (this.hlsInstance) {
      this.hlsInstance.destroy();
      this.hlsInstance = null;
    }
    for (const url of this.activeBlobUrls) {
      try { URL.revokeObjectURL(url); } catch (e) {}
    }
    this.activeBlobUrls = [];
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
