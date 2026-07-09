/**
 * Service Worker — Offline-first (M10+).
 * Cacheia o shell do app e sincroniza learning_events quando offline.
 */
const CACHE = 'eduforge-v2';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache.addAll(['/']).catch(() => {}),
    ),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

// Network-first com fallback para cache
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        const cloned = res.clone();
        caches.open(CACHE).then((cache) => cache.put(req, cloned));
        return res;
      })
      .catch(() => caches.match(req) as Promise<Response>),
  );
});

// Sincronização offline de learning_events
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-learning-events') {
    event.waitUntil(syncPendingEvents());
  }
});

async function syncPendingEvents() {
  const dbReq = indexedDB.open('eduforge-offline', 1);
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    dbReq.onupgradeneeded = () => {
      dbReq.result.createObjectStore('events', { keyPath: 'id', autoIncrement: true });
    };
    dbReq.onsuccess = () => resolve(dbReq.result);
    dbReq.onerror = () => reject(dbReq.error);
  });

  const tx = db.transaction('events', 'readwrite');
  const store = tx.objectStore('events');
  const events = await new Promise<any[]>((resolve) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
  });

  for (const ev of events) {
    try {
      const res = await fetch('/v1/public/enrollments/' + ev.enrollmentId + '/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ev),
        credentials: 'include',
      });
      if (res.ok) store.delete(ev.id);
    } catch {
      break; // para de tentar se a rede caiu
    }
  }

  await new Promise<void>((resolve) => {
    tx.oncomplete = () => resolve();
  });
}

// Armazena evento offline para sincronização futura
export function queueOfflineEvent(event: any) {
  const dbReq = indexedDB.open('eduforge-offline', 1);
  dbReq.onsuccess = () => {
    const db = dbReq.result;
    const tx = db.transaction('events', 'readwrite');
    tx.objectStore('events').add(event);
  };
  // Registra sync quando disponível
  if ('serviceWorker' in navigator && 'sync' in navigator.serviceWorker) {
    navigator.serviceWorker.ready.then((reg) => reg.sync.register('sync-learning-events'));
  }
}
