const CURRENT_USER_KEY = "trend_product_current_user";
const CURRENT_SESSION_KEY = "trend_product_auth_session";

function getStorage() {
  try {
    if (typeof window === "undefined" || !window.sessionStorage) return null;
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function getLegacyStorage() {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getCurrentUser() {
  const storage = getStorage();
  if (!storage) return null;

  const stored = storage.getItem(CURRENT_USER_KEY);
  if (!stored) return null;

  try {
    return JSON.parse(stored);
  } catch {
    storage.removeItem(CURRENT_USER_KEY);
    return null;
  }
}

export function getAuthToken() {
  const storage = getStorage();
  if (!storage) return null;

  const storedSession = storage.getItem(CURRENT_SESSION_KEY);
  if (!storedSession) return null;

  try {
    return JSON.parse(storedSession)?.token ?? null;
  } catch {
    storage.removeItem(CURRENT_SESSION_KEY);
    return null;
  }
}

export function setCurrentSession({ user, session }) {
  const storage = getStorage();
  if (storage) {
    storage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    storage.setItem(CURRENT_SESSION_KEY, JSON.stringify(session));
  }
  getLegacyStorage()?.removeItem(CURRENT_USER_KEY);
  window.dispatchEvent(new Event("authchange"));
}

export function clearCurrentUser() {
  const storage = getStorage();
  if (storage) {
    storage.removeItem(CURRENT_USER_KEY);
    storage.removeItem(CURRENT_SESSION_KEY);
  }
  getLegacyStorage()?.removeItem(CURRENT_USER_KEY);
  window.dispatchEvent(new Event("authchange"));
}

export function getRoleHome(role) {
  if (role === "SELLER") return "/seller";
  if (role === "ADMIN") return "/admin";
  return "/consumer";
}
