// In production (Render), set VITE_API_URL to the API server's full origin,
// e.g. https://qr-asset-manager-api.onrender.com
// In development, leave unset — Vite's proxy forwards /api calls to localhost.
export const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');
