// Shared IndexedDB layer for Memory OS.
// Stores: 'handles' (FileSystemDirectoryHandle), 'settings' (AI config)

const DB_NAME = 'memory-os'
const DB_VERSION = 2

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = e => {
      const db = e.target.result
      if (!db.objectStoreNames.contains('handles'))  db.createObjectStore('handles')
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings')
    }
    req.onsuccess = e => resolve(e.target.result)
    req.onerror  = e => reject(e.target.error)
  })
}

export async function dbGet(store, key) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readonly').objectStore(store).get(key)
    req.onsuccess = e => resolve(e.target.result)
    req.onerror  = e => reject(e.target.error)
  })
}

export async function dbPut(store, key, value) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readwrite').objectStore(store).put(value, key)
    req.onsuccess = () => resolve()
    req.onerror  = e => reject(e.target.error)
  })
}
