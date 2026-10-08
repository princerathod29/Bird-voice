/**
 * Resolves API endpoints against an optional backend base URL.
 * In dev (no VITE_API_BASE_URL), paths stay relative to the server.
 * In production, set VITE_API_BASE_URL to the hosted backend origin.
 */
export function apiUrl(path: string): string {
  const base = (import.meta.env.VITE_API_BASE_URL as string | undefined) || '';
  if (!base || !path.startsWith('/')) return path;
  return base.replace(/\/+$/, '') + path;
}
