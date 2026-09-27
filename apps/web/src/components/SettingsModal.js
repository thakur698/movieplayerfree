import { Icons } from '../icons.js';
import { CONFIG, STREAM_SERVERS } from '../config.js';
import { Storage } from '../storage.js';
import { tmdbApi } from '../api.js';

export class SettingsModal {
  constructor(containerEl, onUpdated) {
    this.containerEl = containerEl;
    this.onUpdated = onUpdated;
  }

  open() {
    const currentCustomKey = localStorage.getItem('cinestream_custom_api_key') || '';
    const activeServer = Storage.getSelectedServer();

    this.containerEl.innerHTML = `
      <div class="modal-backdrop" id="settings-backdrop">
        <div class="modal-card settings-modal-card">
          <div class="settings-modal-header">
            <div class="settings-header-title">
              <span class="settings-icon">${Icons.settings}</span>
              <h2>Streaming & API Settings</h2>
            </div>
            <button class="modal-close-btn" id="settings-close-btn">${Icons.close}</button>
          </div>

          <div class="settings-modal-body">
            <!-- TMDB API Section -->
            <div class="settings-group">
              <label class="settings-label">
                <span>TheMovieDB (TMDB) API Key</span>
                <span class="status-pill status-active" id="api-status-badge">Connected</span>
              </label>
              <p class="settings-desc">Pre-configured with your active TMDB API credentials. You can enter an alternative key if desired.</p>
              <div class="input-with-action">
                <input
                  type="text"
                  id="settings-api-key-input"
                  class="settings-input"
                  placeholder="${CONFIG.TMDB_API_KEY ? '••••••••••••••••' : 'Enter your TMDB API Key'}"
                  value="${currentCustomKey}"
                />
                <button class="btn btn-secondary btn-sm" id="settings-test-api-btn">Test Connection</button>
              </div>
              <div class="settings-api-test-msg" id="settings-api-test-msg"></div>
            </div>

            <!-- Default Stream Server Section -->
            <div class="settings-group">
              <label class="settings-label">
                <span>Preferred Streaming Server</span>
              </label>
              <p class="settings-desc">Choose which VidSrc mirror or backup provider to load initially.</p>
              <select id="settings-server-select" class="settings-select">
                ${STREAM_SERVERS.map(s => `
                  <option value="${s.id}" ${s.id === activeServer ? 'selected' : ''}>
                    ${s.name} (${s.badge})
                  </option>
                `).join('')}
              </select>
            </div>

            <!-- Storage & History Section -->
            <div class="settings-group">
              <label class="settings-label">
                <span>Watch History & Cache</span>
              </label>
              <p class="settings-desc">Clear your stored 'Continue Watching' records and local cache.</p>
              <button class="btn btn-danger-soft btn-sm" id="settings-clear-data-btn">
                ${Icons.trash} Clear Watch History
              </button>
            </div>
          </div>

          <div class="settings-modal-footer">
            <button class="btn btn-secondary" id="settings-cancel-btn">Cancel</button>
            <button class="btn btn-primary" id="settings-save-btn">Save Changes</button>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const backdrop = this.containerEl.querySelector('#settings-backdrop');
    const closeBtn = this.containerEl.querySelector('#settings-close-btn');
    const cancelBtn = this.containerEl.querySelector('#settings-cancel-btn');
    const saveBtn = this.containerEl.querySelector('#settings-save-btn');
    const testBtn = this.containerEl.querySelector('#settings-test-api-btn');
    const clearBtn = this.containerEl.querySelector('#settings-clear-data-btn');

    const close = () => { this.containerEl.innerHTML = ''; };

    if (closeBtn) closeBtn.addEventListener('click', close);
    if (cancelBtn) cancelBtn.addEventListener('click', close);
    if (backdrop) {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) close();
      });
    }

    if (testBtn) {
      testBtn.addEventListener('click', async () => {
        const inputVal = this.containerEl.querySelector('#settings-api-key-input').value.trim();
        const testKey = inputVal || CONFIG.TMDB_API_KEY;
        const msgEl = this.containerEl.querySelector('#settings-api-test-msg');
        msgEl.innerHTML = `<span class="text-muted">Testing TMDB API connection...</span>`;

        try {
          const res = await fetch(`https://api.themoviedb.org/3/authentication?api_key=${testKey}`);
          const data = await res.json();
          if (data.success) {
            msgEl.innerHTML = `<span class="text-success">${Icons.check} Valid TMDB Key! Connected successfully.</span>`;
          } else {
            msgEl.innerHTML = `<span class="text-danger">Invalid API Key: ${data.status_message}</span>`;
          }
        } catch (e) {
          msgEl.innerHTML = `<span class="text-danger">Connection error: ${e.message}</span>`;
        }
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear your Continue Watching history and Watchlist?')) {
          Storage.clearAllData();
          alert('Data cleared successfully.');
          if (this.onUpdated) this.onUpdated();
        }
      });
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        const inputVal = this.containerEl.querySelector('#settings-api-key-input').value.trim();
        const selectedServer = this.containerEl.querySelector('#settings-server-select').value;

        Storage.setApiKey(inputVal);
        Storage.setSelectedServer(selectedServer);
        close();
        if (this.onUpdated) this.onUpdated();
      });
    }
  }
}
