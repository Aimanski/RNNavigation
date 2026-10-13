// Startup
import { useSyncExternalStore } from "react";

let pageReady = false;
const listeners = new Set<() => void>();

export function markPageReady() {
  if (pageReady) return;
  pageReady = true;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function usePageReady(): boolean {
  return useSyncExternalStore(subscribe, () => pageReady, () => pageReady);
}
