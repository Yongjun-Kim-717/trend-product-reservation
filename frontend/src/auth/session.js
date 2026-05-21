const CURRENT_USER_KEY = "trend_product_current_user";

function getStorage() {
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

export function setCurrentUser(user) {
  const storage = getStorage();
  if (storage) {
    storage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  }
  window.dispatchEvent(new Event("authchange"));
}

export function clearCurrentUser() {
  const storage = getStorage();
  if (storage) {
    storage.removeItem(CURRENT_USER_KEY);
  }
  window.dispatchEvent(new Event("authchange"));
}

export function getRoleHome(role) {
  if (role === "SELLER") return "/seller";
  if (role === "ADMIN") return "/admin";
  return "/consumer";
}
