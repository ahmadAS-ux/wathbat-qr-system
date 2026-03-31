import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Patch global fetch to inject auth token for all /api/ calls
const _origFetch = globalThis.fetch;
globalThis.fetch = function (input: RequestInfo | URL, init: RequestInit = {}) {
  const url = input instanceof Request ? input.url : String(input);
  if (url.includes('/api/')) {
    const token = localStorage.getItem('auth_token');
    if (token) {
      const headers = new Headers(init.headers);
      if (!headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return _origFetch(input, { ...init, headers });
    }
  }
  return _origFetch(input, init);
};

createRoot(document.getElementById("root")!).render(<App />);
