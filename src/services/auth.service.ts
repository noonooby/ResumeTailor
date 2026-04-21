import { Injectable, signal } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, User, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  user = signal<User | null>(null);
  loading = signal<boolean>(true);

  constructor() {
    // Explicitly set persistence to ensure token survives reloads in the preview environment
    setPersistence(auth, browserLocalPersistence)
      .then(() => {
        onAuthStateChanged(auth, (user) => {
          this.user.set(user);
          this.loading.set(false);
        });
      })
      .catch((error) => {
        console.error("Auth persistence error:", error);
        // Fallback to regular listener
        onAuthStateChanged(auth, (user) => {
          this.user.set(user);
          this.loading.set(false);
        });
      });
  }

  async loginWithGoogle() {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: 'select_account'
    });
    try {
      const result = await signInWithPopup(auth, provider);
      this.user.set(result.user);
    } catch (error) {
      console.error('Google login failed', error);
      throw error;
    }
  }

  async logout() {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout failed', error);
      throw error;
    }
  }
}
