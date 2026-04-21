import { Injectable, inject } from '@angular/core';
import { safeGet, safeSet } from './idb-wrapper';
import { OptimizationResult, HistoryItem } from '../types';
import { AuthService, db } from './auth.service';
import { collection, doc, getDocs, setDoc, deleteDoc, query, orderBy, getDoc, serverTimestamp } from 'firebase/firestore';

@Injectable({
  providedIn: 'root'
})
export class HistoryService {
  private readonly KEY = 'resume_app_history';
  private auth = inject(AuthService);

  private async ensureUserDoc(userId: string, email: string) {
    const userRef = doc(db, 'users', userId);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
        await setDoc(userRef, {
            email: email,
            createdAt: serverTimestamp()
        });
    }
  }

  async getHistory(): Promise<HistoryItem[]> {
    const user = this.auth.user();
    if (user) {
        try {
            await this.ensureUserDoc(user.uid, user.email || '');
            const q = query(collection(db, 'users', user.uid, 'history'), orderBy('timestamp', 'desc'));
            const querySnapshot = await getDocs(q);
            const items: HistoryItem[] = [];
            querySnapshot.forEach((doc) => {
                items.push(doc.data() as HistoryItem);
            });
            return items;
        } catch (e) {
            console.error('Failed to get history from Firestore', e);
        }
    }
    
    // Fallback or unauthenticated
    try {
        return (await safeGet<HistoryItem[]>(this.KEY)) || [];
    } catch (e) {
        console.warn('Failed to get history from IndexedDB', e);
        return [];
    }
  }

  async save(result: OptimizationResult, jobDescription: string) {
    const user = this.auth.user();
    
    const newItem: HistoryItem = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      company: result.targetJob.company || 'Unknown Company',
      role: result.targetJob.role || 'Unknown Role',
      score: result.atsAnalysis.score || 0,
      jobDescription: jobDescription,
      result
    };
    
    if (user) {
        try {
            await this.ensureUserDoc(user.uid, user.email || '');
            const itemToSave = { ...newItem, userId: user.uid };
            await setDoc(doc(db, 'users', user.uid, 'history', newItem.id), itemToSave);
            return;
        } catch (e) {
            console.error('Failed to save to Firestore', e);
        }
    }

    // Fallback to IndexedDB
    const history = await this.getHistory();
    history.unshift(newItem);
    
    let retries = 3;
    while (retries > 0) {
        try {
            await safeSet(this.KEY, history);
            break;
        } catch (e) {
            console.warn(`Failed to save history to IndexedDB (retries left: ${retries - 1})`, e);
            retries--;
            if (retries === 0) throw e;
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
  }

  async saveConfigToDrive(config: { customInstructions?: string }) {
     // Drive functionality removed.
     return;
  }

  async delete(id: string): Promise<HistoryItem[]> {
    const user = this.auth.user();
    if (user) {
        try {
            await deleteDoc(doc(db, 'users', user.uid, 'history', id));
            return await this.getHistory();
        } catch(e) {
            console.error('Failed to delete from Firestore', e);
        }
    }

    const history = await this.getHistory();
    const filtered = history.filter(h => h.id !== id);
    try {
        await safeSet(this.KEY, filtered);
    } catch (e) {
        console.warn('Failed to delete history from IndexedDB', e);
    }
    return filtered;
  }
  
  async syncWithDrive(currentHistory?: HistoryItem[]) {
      // Drive functionality removed.
      return;
  }

  async clear(): Promise<void> {
    const user = this.auth.user();
    if (user) {
        try {
            const h = await this.getHistory();
            for (const item of h) {
                await deleteDoc(doc(db, 'users', user.uid, 'history', item.id));
            }
            return;
        } catch(e) {
            console.error('Failed to clear Firestore history', e);
        }
    }

    try {
        await safeSet(this.KEY, []);
    } catch (e) {
        console.warn('Failed to clear history from IndexedDB', e);
    }
  }
}