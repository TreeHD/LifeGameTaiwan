// Persisted-state plugin: any store with `persist: true` (or `persist: { key, paths }`)
// gets auto-loaded on init and auto-saved on every mutation.
//
// Why hand-rolled instead of pinia-plugin-persistedstate: zero extra dep, and
// the plugin gives us exactly what we need — namespaced keys under `tlg:`,
// graceful failure when localStorage is full / disabled (Safari private mode),
// and selective `paths` so we don't persist ephemeral UI flags.

const NS = 'tlg:'

const safeParse = (raw) => {
  try { return JSON.parse(raw) } catch { return null }
}

const pickPaths = (state, paths) => {
  if (!paths || paths.length === 0) return state
  const out = {}
  for (const p of paths) if (p in state) out[p] = state[p]
  return out
}

export function persistPlugin({ store, options }) {
  const cfg = options.persist
  if (!cfg) return

  const key = NS + (typeof cfg === 'object' && cfg.key ? cfg.key : store.$id)
  const paths = typeof cfg === 'object' ? cfg.paths : null

  // Hydrate on init
  try {
    const raw = localStorage.getItem(key)
    if (raw) {
      const saved = safeParse(raw)
      if (saved && typeof saved === 'object') store.$patch(saved)
    }
  } catch (e) {
    console.warn(`[persist] failed to hydrate ${key}:`, e)
  }

  // Subscribe — fires on any mutation
  store.$subscribe((_mutation, state) => {
    try {
      localStorage.setItem(key, JSON.stringify(pickPaths(state, paths)))
    } catch (e) {
      // QuotaExceeded or disabled storage — game still runs in-memory
      console.warn(`[persist] failed to save ${key}:`, e)
    }
  }, { detached: true })
}
