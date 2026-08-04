/**
 * Resolves a runtime asset path.
 *
 * - Normal build (Vite dev / Vercel / plain html folder on a server):
 *   returns a path relative to the page, so it works from any sub-directory.
 * - Single-file offline build: `window.ST_ASSETS` holds a map of
 *   '/sprites/x.png' -> 'data:image/png;base64,…', so the game runs from
 *   file:// with zero network requests.
 */
declare global {
  interface Window {
    ST_ASSETS?: Record<string, string>;
  }
}

export function asset(p: string): string {
  const map = typeof window !== 'undefined' ? window.ST_ASSETS : undefined;
  if (map && map[p]) return map[p];
  // strip the leading slash so relative hosting (file server sub-folder) works
  return p.replace(/^\//, '');
}
