import { v4 as uuidv4 } from 'uuid';

/** Generate a globally-unique id (safe for cross-device merge). */
export function newId(): string {
  return uuidv4();
}

const DEVICE_KEY = 'checklist_device_id';

/**
 * Stable per-device identifier, persisted in localStorage.
 * Used to tag forms created on this device for append-only sync.
 */
export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = uuidv4();
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    // localStorage unavailable (rare) — fall back to an ephemeral id.
    return 'device-unknown';
  }
}

export function nowIso(): string {
  return new Date().toISOString();
}
