import { useState, useEffect } from 'react'
import { get, set } from 'idb-keyval'

const SETTINGS_KEY = 'memostack-settings'

const DEFAULT_SETTINGS = {
  apiKey:   '',
  model:    'meta-llama/llama-3.3-70b-instruct',
  provider: 'openrouter',
  enabledModules: {
    projects: true,
    people: true,
    ideas: true,
  },
}

export function useSettings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [loaded,   setLoaded]   = useState(false)

  useEffect(() => {
    get(SETTINGS_KEY)
      .then(stored => {
        if (stored) {
          const merged = {
            ...DEFAULT_SETTINGS,
            ...stored,
            enabledModules: {
              ...DEFAULT_SETTINGS.enabledModules,
              ...(stored.enabledModules || {}),
            },
          }
          setSettings(merged)
        }
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [])

  const saveSettings = async (updates) => {
    const next = {
      ...DEFAULT_SETTINGS,
      ...settings,
      ...updates,
      enabledModules: {
        ...DEFAULT_SETTINGS.enabledModules,
        ...(settings.enabledModules || {}),
        ...(updates.enabledModules || {}),
      },
    }
    setSettings(next)
    await set(SETTINGS_KEY, next)
  }

  return { settings, saveSettings, loaded }
}
