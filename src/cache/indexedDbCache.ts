const DB = 'MangaVizCache', VER = 1, STORE = 'api';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, VER);
    r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, {keyPath:'key'}); };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export async function cacheGet<T>(key: string, ttlMs = 3600000): Promise<T|null> {
  try {
    const db = await openDB();
    return new Promise(resolve => {
      const r = db.transaction(STORE,'readonly').objectStore(STORE).get(key);
      r.onsuccess = () => { const e = r.result; if (!e) { resolve(null); return; } if (Date.now()-e.ts > e.ttl) { db.transaction(STORE,'readwrite').objectStore(STORE).delete(key); resolve(null); } else resolve(e.data as T); };
      r.onerror = () => resolve(null);
    });
  } catch { return null; }
}

export async function cacheSet(key: string, data: unknown, ttlMs = 3600000): Promise<void> {
  try { const db = await openDB(); await new Promise<void>((res,rej) => { const t = db.transaction(STORE,'readwrite'); t.objectStore(STORE).put({key,data,ts:Date.now(),ttl:ttlMs}); t.oncomplete = () => res(); t.onerror = () => rej(t.error); }); } catch {}
}

export async function clearAllCache(): Promise<void> {
  try { const db = await openDB(); db.transaction(STORE,'readwrite').objectStore(STORE).clear(); } catch {}
}
