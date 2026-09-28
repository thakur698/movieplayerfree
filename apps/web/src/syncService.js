// Cloud Sync Service for CineStream
// Synchronizes Watchlist, Streaming History, and Preferences across devices using Cloud Firestore & Firebase Storage

import { db, storage } from './firebase.js';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadString, getBytes } from 'firebase/storage';
import { Storage } from './storage.js';

let pushTimer = null;
let isSyncing = false;

// Helpers for smart two-way merging
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
  // 1. Fetch from Cloud Firestore (Primary Engine)
  async fetchFromFirestore(uid) {
    try {
      const userRef = doc(db, 'users', uid);
      const snap = await getDoc(userRef);
      return snap.exists() ? snap.data() : null;
    } catch (err) {
      console.warn('[SyncService] Firestore read notice:', err.message);
      return null;
    }
  },

  // 2. Save to Cloud Firestore (Primary Engine)
  async saveToFirestore(uid, payload) {
    try {
      const userRef = doc(db, 'users', uid);
      await setDoc(userRef, payload, { merge: true });
      return true;
    } catch (err) {
      console.warn('[SyncService] Firestore save notice:', err.message);
      return false;
    }
  },

  // 3. Fetch from Firebase Storage
  async fetchFromFirebaseStorage(uid) {
    try {
      const fileRef = ref(storage, `users/${uid}/userdata.json`);
      const bytes = await getBytes(fileRef);
      const text = new TextDecoder().decode(bytes);
      return JSON.parse(text);
    } catch (err) {
      return null;
    }
  },

  // 4. Save to Firebase Storage
  async saveToFirebaseStorage(uid, payload) {
    try {
      const fileRef = ref(storage, `users/${uid}/userdata.json`);
      const raw = JSON.stringify(payload);
      await uploadString(fileRef, raw, 'raw', {
        contentType: 'application/json'
      });
      return true;
    } catch (err) {
      return false;
    }
  },

  // 5. Fetch from Serverless Sync API (Fallback)
  async fetchFromApiSync(uid) {
    try {
      const res = await fetch(`/api/sync?uid=${encodeURIComponent(uid)}`);
      if (!res.ok) return null;
      const json = await res.json();
      return json.data || null;
    } catch (err) {
      return null;
    }
  },

  // 6. Save to Serverless Sync API (Fallback)
  async saveToApiSync(uid, payload) {
    try {
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
    } catch (err) {
      // Ignore network errors
    }
  },

  // Synchronize on user login (Two-Way Smart Merge)
  async syncOnLogin(user) {
    if (!user || !user.uid || isSyncing) return;
    isSyncing = true;
    console.log('[SyncService] Synchronizing user data across devices for:', user.email);

    let remoteData = null;

    // 1. Try Cloud Firestore
    remoteData = await this.fetchFromFirestore(user.uid);
    if (remoteData) {
      console.log('[SyncService] Loaded user snapshot from Cloud Firestore');
    }

    // 2. Try Firebase Storage if Firestore had no record
    if (!remoteData) {
      remoteData = await this.fetchFromFirebaseStorage(user.uid);
      if (remoteData) console.log('[SyncService] Loaded user snapshot from Firebase Storage');
    }

    // 3. Try Cloud API Fallback
    if (!remoteData) {
      remoteData = await this.fetchFromApiSync(user.uid);
      if (remoteData) console.log('[SyncService] Loaded user snapshot from Cloud Backup API');
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

    // Upload merged result back to Firestore & Cloud
    await this.pushToCloud(user.uid, {
      uid: user.uid,
      email: user.email,
      watchlist: mergedWatchlist,
      continueWatching: mergedContinueWatching,
      settings: {
        selectedServer: Storage.getSelectedServer(),
        adShield: Storage.getAdShieldEnabled()
      },
      updatedAt: Date.now()
    });

    isSyncing = false;
    console.log('[SyncService] Synchronization complete! Watchlist items:', mergedWatchlist.length, 'Continue Watching:', mergedContinueWatching.length);
  },

  // Push current state to Cloud (Firestore -> Storage -> Backup API)
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

    // 1. Primary: Save to Cloud Firestore
    await this.saveToFirestore(uid, payload);

    // 2. Secondary: Save to Firebase Storage
    this.saveToFirebaseStorage(uid, payload).catch(() => {});

    // 3. Fallback: Save to Backup API
    this.saveToApiSync(uid, payload).catch(() => {});
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
