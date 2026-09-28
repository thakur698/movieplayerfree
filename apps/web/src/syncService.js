// Cloud Sync Service for CineStream
// Synchronizes Watchlist, Streaming History, and Preferences across devices using Firebase Storage with resilient serverless fallback

import { storage } from './firebase.js';
import { ref, uploadString, getBytes } from 'firebase/storage';
import { Storage } from './storage.js';

let pushTimer = null;
let isSyncing = false;

// Helpers for smart merging
function mergeWatchlist(localList = [], remoteList = []) {
  const map = new Map();

  // 1. Add all remote items
  for (const item of remoteList) {
    if (!item || !item.id) continue;
    const key = `${item.id}_${item.media_type || 'movie'}`;
    map.set(key, item);
  }

  // 2. Merge local items (keep newer or local additions)
  for (const item of localList) {
    if (!item || !item.id) continue;
    const key = `${item.id}_${item.media_type || 'movie'}`;
    const existing = map.get(key);
    if (!existing || (item.addedAt && (!existing.addedAt || item.addedAt > existing.addedAt))) {
      map.set(key, item);
    }
  }

  // 3. Return sorted array (most recent first)
  return Array.from(map.values()).sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
}

function mergeContinueWatching(localList = [], remoteList = []) {
  const map = new Map();

  for (const item of remoteList) {
    if (!item || !item.id) continue;
    const key = `${item.id}_${item.media_type || 'movie'}`;
    map.set(key, item);
  }

  for (const item of localList) {
    if (!item || !item.id) continue;
    const key = `${item.id}_${item.media_type || 'movie'}`;
    const existing = map.get(key);
    if (!existing || (item.updatedAt && (!existing.updatedAt || item.updatedAt > existing.updatedAt))) {
      map.set(key, item);
    }
  }

  return Array.from(map.values())
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .slice(0, 20); // Keep max 20 entries
}

export const SyncService = {
  // 1. Fetch remote data from Firebase Storage (Tier 1)
  async fetchFromFirebaseStorage(uid) {
    try {
      const fileRef = ref(storage, `users/${uid}/userdata.json`);
      const bytes = await getBytes(fileRef);
      const text = new TextDecoder().decode(bytes);
      return JSON.parse(text);
    } catch (err) {
      if (err.code === 'storage/object-not-found') {
        return null; // First time user, no cloud record yet
      }
      throw err;
    }
  },

  // 2. Save remote data to Firebase Storage (Tier 1)
  async saveToFirebaseStorage(uid, payload) {
    const fileRef = ref(storage, `users/${uid}/userdata.json`);
    const raw = JSON.stringify(payload);
    await uploadString(fileRef, raw, 'raw', {
      contentType: 'application/json'
    });
  },

  // 3. Fetch from Serverless Sync API (Tier 2 Fallback)
  async fetchFromApiSync(uid) {
    const res = await fetch(`/api/sync?uid=${encodeURIComponent(uid)}`);
    if (!res.ok) throw new Error(`Sync API responded with ${res.status}`);
    const json = await res.json();
    return json.data || null;
  },

  // 4. Save to Serverless Sync API (Tier 2 Fallback)
  async saveToApiSync(uid, payload) {
    await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uid,
        watchlist: payload.watchlist,
        continueWatching: payload.continueWatching,
        settings: payload.settings
      })
    });
  },

  // Synchronize on user login (Two-Way Smart Merge)
  async syncOnLogin(user) {
    if (!user || !user.uid || isSyncing) return;
    isSyncing = true;
    console.log('[SyncService] Synchronizing user data across devices for:', user.email);

    let remoteData = null;

    // Try Tier 1: Firebase Storage
    try {
      remoteData = await this.fetchFromFirebaseStorage(user.uid);
      if (remoteData) console.log('[SyncService] Loaded user snapshot from Firebase Storage');
    } catch (storageErr) {
      console.warn('[SyncService] Firebase Storage note (checking cloud fallback):', storageErr.message);
      // Try Tier 2: Serverless Sync API Fallback
      try {
        remoteData = await this.fetchFromApiSync(user.uid);
        if (remoteData) console.log('[SyncService] Loaded user snapshot from Cloud Sync API');
      } catch (apiErr) {
        console.warn('[SyncService] Could not reach sync API:', apiErr.message);
      }
    }

    const localWatchlist = Storage.getWatchlist();
    const localContinueWatching = Storage.getContinueWatching();

    const mergedWatchlist = mergeWatchlist(localWatchlist, remoteData?.watchlist || []);
    const mergedContinueWatching = mergeContinueWatching(localContinueWatching, remoteData?.continueWatching || []);

    // Apply merged state to local storage
    localStorage.setItem('cinestream_watchlist', JSON.stringify(mergedWatchlist));
    localStorage.setItem('cinestream_continue_watching', JSON.stringify(mergedContinueWatching));

    // Apply remote preferences if present
    if (remoteData?.settings?.selectedServer) {
      Storage.setSelectedServer(remoteData.settings.selectedServer);
    }
    if (typeof remoteData?.settings?.adShield === 'boolean') {
      Storage.setAdShieldEnabled(remoteData.settings.adShield);
    }

    // Notify UI of synchronized state
    document.dispatchEvent(new CustomEvent('watchlist-updated'));
    document.dispatchEvent(new CustomEvent('continue-watching-updated'));

    // Upload merged result back to cloud
    await this.pushToCloud(user.uid, {
      watchlist: mergedWatchlist,
      continueWatching: mergedContinueWatching,
      settings: {
        selectedServer: Storage.getSelectedServer(),
        adShield: Storage.getAdShieldEnabled()
      }
    });

    isSyncing = false;
    console.log('[SyncService] Synchronization complete! Watchlist items:', mergedWatchlist.length, 'Continue Watching:', mergedContinueWatching.length);
  },

  // Push current state to Cloud (Tier 1 & Tier 2)
  async pushToCloud(uid, data = null) {
    if (!uid) return;

    const payload = data || {
      uid,
      watchlist: Storage.getWatchlist(),
      continueWatching: Storage.getContinueWatching(),
      settings: {
        selectedServer: Storage.getSelectedServer(),
        adShield: Storage.getAdShieldEnabled()
      },
      updatedAt: Date.now()
    };

    // Push to Firebase Storage
    try {
      await this.saveToFirebaseStorage(uid, payload);
    } catch (e) {
      // Ignore if storage rules or bucket are being initialized
    }

    // Always push to Serverless API fallback
    try {
      await this.saveToApiSync(uid, payload);
    } catch (e) {
      // Ignore network errors
    }
  },

  // Debounced push on user action (adding to watchlist, watching video)
  schedulePush(user) {
    if (!user || !user.uid) return;
    if (pushTimer) clearTimeout(pushTimer);

    pushTimer = setTimeout(() => {
      this.pushToCloud(user.uid);
    }, 1500);
  }
};
