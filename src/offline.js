/** Optional first-party cache; updates must never discard an unsaved session. */
const status = document.getElementById("offline-status");
let refreshing = false;
function canReload() {
  const request = new CustomEvent("before-app-update", {
    cancelable: true,
    detail: { saved: false },
  });
  window.dispatchEvent(request);
  const saved = request.detail.saved && !request.defaultPrevented;
  if (!saved) {
    if (status)
      status.textContent =
        "Update paused: session not saved. Export a backup or retry saving before reload.";
    showDiscardChoice();
  }
  return saved;
}
function showDiscardChoice() {
  if (document.getElementById("discard-for-update")) return;
  const b = document.createElement("button");
  b.id = "discard-for-update";
  b.className = "button secondary";
  b.textContent = "Reload after export / discard unsaved session";
  b.onclick = () => {
    if (
      confirm(
        "Reload and discard unsaved session changes? Export a backup first if you need to keep them.",
      )
    )
      location.reload();
  };
  status?.after(b);
}
function showUpdate(reg) {
  if (document.getElementById("apply-update")) return;
  const b = document.createElement("button");
  b.id = "apply-update";
  b.textContent = "Update available — save and reload";
  b.className = "button secondary";
  b.onclick = () => {
    if (!canReload()) return;
    if (reg.waiting) reg.waiting.postMessage({ type: "APPLY_UPDATE" });
    else location.reload();
  };
  status?.after(b);
}
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("./sw.js")
    .then((reg) => {
      const announce = () => {
        reg.active?.postMessage({ type: "READINESS" });
        if (reg.waiting) showUpdate(reg);
      };
      navigator.serviceWorker.addEventListener("message", (e) => {
        if (e.data?.type === "OFFLINE_READY" && status)
          status.textContent =
            "Notes and practice ready offline · videos need internet";
      });
      reg.addEventListener("updatefound", () => {
        const w = reg.installing;
        if (w)
          w.addEventListener("statechange", () => {
            if (w.state === "installed") announce();
          });
      });
      navigator.serviceWorker.ready.then(announce);
      announce();
    })
    .catch(() => {
      if (status)
        status.textContent =
          "Offline cache unavailable; use online or keep a backup.";
    });
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    if (!canReload()) return;
    refreshing = true;
    location.reload();
  });
} else if (status)
  status.textContent = "Offline caching is unavailable in this browser.";
