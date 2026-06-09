import { openDB } from './db'

const STORE = 'processedNotes'

export async function getProcessedState(filePath) {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).get(filePath)
      req.onsuccess = (event) => resolve(event.target.result || null)
      req.onerror = (event) => reject(event.target.error)
    })
  } catch {
    return null
  }
}

export async function setProcessedState(filePath, state) {
  try {
    const db = await openDB()
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      const req = tx.objectStore(STORE).put({ filePath, ...state })
      req.onsuccess = () => resolve()
      req.onerror = (event) => reject(event.target.error)
    })
  } catch (err) {
    console.warn('Failed to save processed state:', err?.message || err)
  }
}

export async function clearProcessedState(filePath) {
  try {
    const db = await openDB()
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      const req = tx.objectStore(STORE).delete(filePath)
      req.onsuccess = () => resolve()
      req.onerror = (event) => reject(event.target.error)
    })
  } catch (err) {
    console.warn('Failed to clear processed state:', err?.message || err)
  }
}
