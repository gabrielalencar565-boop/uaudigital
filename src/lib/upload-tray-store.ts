import { useSyncExternalStore } from "react";

// Global, component-lifecycle-independent upload tracking — the actual upload
// (XHR/fetch) already survives navigating away or closing the task dialog, since
// nothing aborts it on unmount; this store just keeps its progress visible
// (via GlobalUploadTray) instead of the indicator disappearing with the component
// that started it, the same way Google Drive's upload tray works.
export interface GlobalUploadItem {
  id: string;
  taskId: string;
  fileName: string;
  fileSize: number;
  progress: number;
  status: "uploading" | "success" | "error";
  errorMessage?: string;
}

type Listener = () => void;

let items: GlobalUploadItem[] = [];
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l();
}

export function addGlobalUpload(item: GlobalUploadItem) {
  items = [...items, item];
  emit();
}

export function updateGlobalUpload(id: string, patch: Partial<GlobalUploadItem>) {
  items = items.map((i) => (i.id === id ? { ...i, ...patch } : i));
  emit();
}

export function removeGlobalUpload(id: string) {
  items = items.filter((i) => i.id !== id);
  emit();
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return items;
}

export function useGlobalUploads() {
  return useSyncExternalStore(subscribe, getSnapshot);
}
