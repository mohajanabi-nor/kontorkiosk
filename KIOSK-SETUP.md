# Kiosk-oppsett — hvordan bli kvitt nettleseren

Three ways to run this with no browser UI. They're not equivalent — pick based on
whether the screen is public.

---

## 1. Fully Kiosk Browser (Android) — **use this for the wall-mounted panel**

This is what real self-order kiosks run. It's not just "hide the toolbar": it
locks the device so a customer can't leave the app, and it brings the screen back
by itself after a power cut.

1. Play Store → install **Fully Kiosk Browser & App Lockdown** (free; the ~€12
   Plus licence unlocks the lockdown features — worth it here).
2. Open it → **Settings**.
3. **Web Content Settings → Start URL** → your Vercel URL.
4. **Web Content Settings → Enable Fullscreen Mode** → on.
5. **Device Management:**
   - *Load Start URL on Boot* → on (survives a power cut)
   - *Keep Screen On* → on
   - *Screen Orientation* → Portrait
6. **Kiosk Mode (Lockdown):**
   - *Enable Kiosk Mode* → on
   - *Disable Home Button / Disable Back Button* → on
   - Set a **Kiosk Exit PIN** — otherwise you'll be locked out too
7. **Advanced Web Settings → Enable Pull-to-Refresh** → off.
8. Optional: *Screensaver* → play a drop reel when idle; any touch wakes it into
   the attract screen.

Set Android's own **Screen Pinning** on as well (Settings → Security) for a second
layer.

## 2. PWA install (any device) — good for a phone or a spare tablet

The app ships a manifest + service worker, so it installs as a real standalone
app: own icon, no address bar.

- **Android/Chrome:** open the URL → menu → *Install app* / *Add to Home screen*.
- **iPad/iPhone Safari:** Share → *Add to Home Screen*. iOS ignores the
  Fullscreen API, so this is the **only** way to get fullscreen there.
- Launch from the home-screen icon (not from the browser) or you keep the chrome.

## 3. Fullscreen on tap — already built in

The kiosk calls the Fullscreen API on the first tap, so the browser bars drop away
by themselves. Fine for demos. **Not enough for a public screen** — a swipe or a
keyboard still gets out. Use option 1 for the real thing.

---

## Notes baked into the build

- `display: fullscreen` in the manifest, portrait-locked, charcoal splash.
- Icons are the Nordic Engros sun-and-mountain mark.
- Pinch-zoom, long-press menus, and pull-to-refresh are disabled — all of which
  otherwise let a customer break the layout.
- Safe-area insets respected, so notches/rounded corners don't clip the UI.
- The service worker **never caches `/api/`** — stock and prices are always live.
  It caches product images (their URLs are versioned, so they're safe) and the
  app shell, so a brief Wi-Fi drop doesn't blank the screen.
- 60-second idle → clears the basket and returns to the attract screen.
