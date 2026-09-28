import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile
} from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { getFirestore } from 'firebase/firestore';

export const firebaseConfig = {
  projectId: "cinestream-app-2026",
  appId: "1:303069902209:web:f300b27dea4f98977ea480",
  storageBucket: "cinestream-app-2026.firebasestorage.app",
  apiKey: "AIzaSyBe870jdO8fz1NBAgL0JY8yD3hXz0G8xsM",
  authDomain: "cinestream-app-2026.firebaseapp.com",
  messagingSenderId: "303069902209",
  projectNumber: "303069902209"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

export const AuthService = {
  // Current user state
  getCurrentUser() {
    return auth.currentUser;
  },

  // Listen to auth state changes
  onAuthChange(callback) {
    return onAuthStateChanged(auth, callback);
  },

  // Sign in with Email and Password
  async signInWithEmail(email, password) {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  },

  // Register new user with Email, Password & Display Name
  async signUpWithEmail(email, password, displayName) {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName && userCredential.user) {
      await updateProfile(userCredential.user, { displayName });
    }
    return userCredential.user;
  },

  // Sign in with Google Popup
  async signInWithGoogle() {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  },

  // Sign out
  async logout() {
    return signOut(auth);
  }
};
