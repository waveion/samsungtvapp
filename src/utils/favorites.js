// Lightweight favorites store with localStorage persistence and pub/sub

const listeners = new Set();

function getUserScopeKey() {
  try {
    const user = JSON.parse(sessionStorage.getItem('user') || '{}');
    const username = user?.username || 'guest';
    const macId = user?.macId || 'device';
    return `favorites:${username}:${macId}`;
  } catch {
    return 'favorites:guest:device';
  }
}

function loadSet() {
  try {
    const raw = localStorage.getItem(getUserScopeKey());
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return new Set(arr);
    return new Set();
  } catch {
    return new Set();
  }
}

function saveSet(set) {
  try {
    localStorage.setItem(getUserScopeKey(), JSON.stringify(Array.from(set)));
  } catch {}
}

let favSet = loadSet();

function notify() {
  listeners.forEach((fn) => {
    try { fn(getAll()); } catch {}
  });
}

export function getAll() {
  return Array.from(favSet);
}

export function has(channelId) {
  return favSet.has(String(channelId || ''));
}

export function add(channelId) {
  const id = String(channelId || '');
  if (!id) return;
  if (!favSet.has(id)) {
    favSet.add(id);
    saveSet(favSet);
    notify();
  }
}

export function remove(channelId) {
  const id = String(channelId || '');
  if (!id) return;
  if (favSet.delete(id)) {
    saveSet(favSet);
    notify();
  }
}

export function toggle(channelId) {
  const id = String(channelId || '');
  if (!id) return;
  if (favSet.has(id)) {
    favSet.delete(id);
  } else {
    favSet.add(id);
  }
  saveSet(favSet);
  notify();
}

export function subscribe(fn) {
  if (typeof fn !== 'function') return () => {};
  listeners.add(fn);
  return () => listeners.delete(fn);
}


