export const OPEN_INSTALL_EVENT = "bizmanager-open-install";

export function openInstallPrompt() {
  window.dispatchEvent(new Event(OPEN_INSTALL_EVENT));
}

export function isInstalledApp() {
  return window.matchMedia("(display-mode: standalone)").matches
    || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}