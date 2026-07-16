// Minimal service worker — its job is to make the kiosk installable as a real
// standalone app (no browser chrome) and to survive a brief network blip.
// Product data is always fetched live; we never serve stale prices or stock.

const SHELL = "ne-kiosk-shell-v1";

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(SHELL).then((c) => c.addAll(["/", "/manifest.json"])).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== SHELL).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // Never cache the API — stock and prices must be live.
  if (url.pathname.startsWith("/api/")) return;

  // Shopify product images: cache-first, they're immutable (versioned URLs).
  if (url.hostname === "cdn.shopify.com") {
    e.respondWith(
      caches.open("ne-kiosk-img-v1").then(async (cache) => {
        const hit = await cache.match(e.request);
        if (hit) return hit;
        try {
          const res = await fetch(e.request);
          if (res.ok) cache.put(e.request, res.clone());
          return res;
        } catch {
          return hit || Response.error();
        }
      })
    );
    return;
  }

  // App shell: network-first, fall back to cache if offline.
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request).catch(() => caches.match("/").then((r) => r || Response.error()))
    );
  }
});
