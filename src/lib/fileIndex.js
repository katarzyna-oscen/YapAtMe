import { get, set } from 'idb-keyval'

const CACHE_KEY = 'memostack:fileIndex'
const CACHE_VERSION = 1

export async function getFileIndex(listTree, buildAllowedFiles, forceRefresh = false) {
  if (!forceRefresh) {
    try {
      const cached = await get(CACHE_KEY)
      if (cached?.version === CACHE_VERSION && Array.isArray(cached.files)) {
        return cached.files
      }
    } catch {}
  }

  const files = await buildAllowedFiles(listTree)
  await set(CACHE_KEY, { version: CACHE_VERSION, files, updatedAt: Date.now() })
  return files
}

export async function invalidateFileIndex() {
  try {
    await set(CACHE_KEY, null)
  } catch {}
}
