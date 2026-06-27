import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";

/**
 * After a new deploy, the cached index.html may reference old lazy chunk hashes
 * that no longer exist on the CDN. Vite throws a dynamic-import / chunk-load
 * error in that case. Reload once (with a guard) to fetch the fresh manifest
 * instead of leaving the user on a blank/error screen until they manually
 * clear the tab.
 */
const CHUNK_RELOAD_KEY = "karadev:chunk-reload";
function isChunkLoadError(reason: unknown): boolean {
  const msg =
    (reason as { message?: string })?.message ??
    (typeof reason === "string" ? reason : "");
  return (
    /Loading chunk [\w-]+ failed/i.test(msg) ||
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /ChunkLoadError/i.test(msg)
  );
}
function tryReloadOnce() {
  try {
    if (sessionStorage.getItem(CHUNK_RELOAD_KEY)) return;
    sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
    window.location.reload();
  } catch {
    window.location.reload();
  }
}
window.addEventListener("error", (e) => {
  if (isChunkLoadError(e.error ?? e.message)) tryReloadOnce();
});
window.addEventListener("unhandledrejection", (e) => {
  if (isChunkLoadError(e.reason)) tryReloadOnce();
});
// Clear the guard once the app successfully mounts.
queueMicrotask(() => {
  try { sessionStorage.removeItem(CHUNK_RELOAD_KEY); } catch { /* noop */ }
});

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);
