import { get, set, setMany, del, createStore, UseStore } from 'idb-keyval';

let customStore: UseStore | null = null;
function getStore(): UseStore | undefined {
    if (!customStore && typeof indexedDB !== 'undefined') {
        try {
            customStore = createStore('resume-tailor-db', 'resume-tailor-store');
        } catch (e) {
            console.warn('Could not create IndexedDB store:', e);
        }
    }
    return customStore || undefined;
}

// Also try reading from the legacy default store if the item isn't in our new custom store,
// so users don't lose their data!
async function getLegacy<T>(key: string): Promise<T | undefined> {
    if (typeof indexedDB === 'undefined') return undefined;
    try {
        return await get<T>(key); // read from global default store
    } catch(e) {
        return undefined;
    }
}

export async function safeGet<T>(key: string): Promise<T | undefined> {
    if (typeof indexedDB === 'undefined') return undefined;
    try {
        const store = getStore();
        if (!store) return undefined;
        let val = await get<T>(key, store);
        if (val === undefined) {
            // Check legacy default store just in case
            val = await getLegacy<T>(key);
            // If we found it in legacy, migrate it to the new store asynchronously
            if (val !== undefined) {
                safeSet(key, val).catch(console.error);
            }
        }
        return val;
    } catch (e: any) {
        if (e.message?.includes('closing') || e.name === 'InvalidStateError') {
            console.warn('IDB connection closed, recreating store for safeGet...');
            const store = getStore();
            if (!store) return undefined;
            let val = await get<T>(key, store);
            if (val === undefined) {
                val = await getLegacy<T>(key);
                if (val !== undefined) safeSet(key, val).catch(console.error);
            }
            return val;
        }
        throw e;
    }
}

export async function safeSet(key: string, val: any): Promise<void> {
    if (typeof indexedDB === 'undefined') return;
    try {
        const store = getStore();
        if (store) await set(key, val, store);
    } catch (e: any) {
        if (e.message?.includes('closing') || e.name === 'InvalidStateError') {
            console.warn('IDB connection closed, recreating store for safeSet...');
            customStore = createStore('resume-tailor-db', 'resume-tailor-store');
            return await set(key, val, customStore);
        }
        throw e;
    }
}

export async function safeSetMany(entries: [string, any][]): Promise<void> {
    if (typeof indexedDB === 'undefined') return;
    try {
        const store = getStore();
        if (store) await setMany(entries, store);
    } catch (e: any) {
        if (e.message?.includes('closing') || e.name === 'InvalidStateError') {
            console.warn('IDB connection closed, recreating store for safeSetMany...');
            customStore = createStore('resume-tailor-db', 'resume-tailor-store');
            return await setMany(entries, customStore);
        }
        throw e;
    }
}

export async function safeDel(key: string): Promise<void> {
    if (typeof indexedDB === 'undefined') return;
    try {
        const store = getStore();
        if (store) await del(key, store);
    } catch (e: any) {
        if (e.message?.includes('closing') || e.name === 'InvalidStateError') {
            console.warn('IDB connection closed, recreating store for safeDel...');
            customStore = createStore('resume-tailor-db', 'resume-tailor-store');
            return await del(key, customStore);
        }
        throw e;
    }
}
