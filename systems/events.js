const listeners = new Map();

export function on(event, cb) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(cb);
}

export function off(event, cb) {
  listeners.get(event)?.delete(cb);
}

export function emit(event, payload) {
  listeners.get(event)?.forEach(cb => {
    try { cb(payload); } catch (e) { console.error(`[events] ${event}:`, e); }
  });
}