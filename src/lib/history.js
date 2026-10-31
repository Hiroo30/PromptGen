const HISTORY_KEY = 'promptgen.history.v1';
const HISTORY_LIMIT = 30;
const MEDIA_DATABASE = 'promptgen-media';
const MEDIA_STORE = 'history-media';

function isHistoryItem(item) {
  return item
    && typeof item.id === 'string'
    && typeof item.createdAt === 'string'
    && typeof item.englishText === 'string'
    && typeof item.jsonText === 'string';
}

export function getPromptHistory() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(HISTORY_KEY) || '[]');
    return Array.isArray(stored) ? stored.filter(isHistoryItem).slice(0, HISTORY_LIMIT) : [];
  } catch {
    return [];
  }
}

export function createHistoryItem({ source, aspectRatio, customInstruction, englishText, jsonText }) {
  return {
    id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    createdAt: new Date().toISOString(),
    source,
    aspectRatio,
    customInstruction: customInstruction.trim(),
    englishText,
    jsonText,
  };
}

export function savePromptHistory(items) {
  const next = items.slice(0, HISTORY_LIMIT);
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    return next;
  } catch {
    throw new Error('Riwayat penuh atau tidak dapat disimpan di browser ini.');
  }
}

function openMediaDatabase() {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(MEDIA_DATABASE, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(MEDIA_STORE)) {
        request.result.createObjectStore(MEDIA_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Tidak dapat membuka penyimpanan media.'));
  });
}

function mediaTransaction(mode, run) {
  return openMediaDatabase().then((database) => new Promise((resolve, reject) => {
    const transaction = database.transaction(MEDIA_STORE, mode);
    const store = transaction.objectStore(MEDIA_STORE);
    run(store, resolve, reject);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error || new Error('Penyimpanan media gagal.'));
    transaction.onabort = () => reject(transaction.error || new Error('Penyimpanan media dibatalkan.'));
  }));
}

export function savePromptMedia(id, files) {
  if (!files?.length) return Promise.resolve();
  const entries = files.map((file) => ({ name: file.name, type: file.type, blob: file }));
  return mediaTransaction('readwrite', (store) => store.put({ id, entries }));
}

export function getPromptMedia(id) {
  return mediaTransaction('readonly', (store, resolve) => {
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result?.entries || []);
    request.onerror = () => resolve([]);
  });
}

export function deletePromptMedia(id) {
  return mediaTransaction('readwrite', (store) => store.delete(id));
}

export function clearPromptMedia() {
  return mediaTransaction('readwrite', (store) => store.clear());
}
