# Bugfix — Module Toggles Not Working

**Root cause (most likely):** `settings.enabledModules` is `undefined` for existing vaults because
`useSettings` loaded previously-saved settings from IndexedDB without merging in the new
`enabledModules` defaults added in H07. The toggle reads `settings.enabledModules?.[mod] ?? true`
which silently returns `true` without ever writing, and the Sidebar condition evaluates against
`undefined` so it always renders all sections regardless of the stored value.

---

## Pre-flight — confirm the actual cause

Open browser DevTools → Application → IndexedDB → find the MemoStack settings store.
Read the stored settings object. Check whether `enabledModules` is present as a key.

- **If missing** → the merge fix below is the cause. Apply Fix 1.
- **If present but toggles still don't update the UI** → the Sidebar isn't receiving updated
  settings. Apply Fix 2.
- **If both** → apply both.

---

## Fix 1 — useSettings.js: merge defaults on load

Open `src/hooks/useSettings.js`. Find where settings are loaded from IndexedDB (the `get()` call
on mount). Currently it probably does:

```js
// CURRENT — replaces entirely, new fields get dropped for existing users:
const stored = await get('memostack:settings')
if (stored) setSettings(stored)
```

Replace with a merge that fills in missing fields from defaults:

```js
const DEFAULT_SETTINGS = {
  apiKey:   '',
  model:    'meta-llama/llama-3.3-70b-instruct',
  provider: 'openrouter',
  enabledModules: {
    projects: true,
    people:   true,
    ideas:    true,
  },
}

// FIXED — merge stored over defaults so new fields always have a value:
const stored = await get('memostack:settings')
const merged = { ...DEFAULT_SETTINGS, ...(stored ?? {}), enabledModules: {
  ...DEFAULT_SETTINGS.enabledModules,
  ...(stored?.enabledModules ?? {}),
}}
setSettings(merged)
```

The double-spread on `enabledModules` is important — a shallow merge would drop the nested
object entirely if `stored.enabledModules` is undefined.

> If `DEFAULT_SETTINGS` already exists in the file, update it to include `enabledModules` and
> replace the load logic. Do not add a second copy.

---

## Fix 2 — SettingsPage.jsx: defensive toggle handler

Open `src/core/SettingsPage.jsx`. Find the toggle `onClick`. Make it defensive against
`settings.enabledModules` being undefined:

```js
// CURRENT (fragile if enabledModules is undefined):
saveSettings({
  ...settings,
  enabledModules: {
    ...settings.enabledModules,
    [mod]: !(settings.enabledModules?.[mod] ?? true),
  }
})

// FIXED — always spread from a known object:
const current = settings.enabledModules ?? { projects: true, people: true, ideas: true }
saveSettings({
  ...settings,
  enabledModules: {
    ...current,
    [mod]: !( current[mod] ?? true ),
  }
})
```

---

## Fix 3 — Sidebar.jsx: defensive section guard

Open `src/components/Sidebar.jsx`. Find the three module section guards. Make each one
defensive so it renders by default if the value is missing:

```js
// Projects
{(settings?.enabledModules?.projects ?? true) && ( /* PROJECTS section */ )}

// People
{(settings?.enabledModules?.people ?? true) && ( /* PEOPLE section */ )}

// Ideas
{(settings?.enabledModules?.ideas ?? true) && ( /* IDEAS section */ )}
```

The `settings?.` outer guard also handles the case where settings hasn't loaded yet.

---

## Verify

1. Open Settings → all three toggles show as ON (blue/amber)
2. Toggle Projects OFF → PROJECTS section disappears from sidebar immediately
3. Toggle Projects back ON → section reappears
4. Reload the page → toggle state persists (stored in IndexedDB)
5. Process a note with People module OFF → no people routing in RoutingReview
