const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    ...options,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = payload.message ?? "API 요청에 실패했습니다.";
    throw new Error(message);
  }

  return payload.data ?? payload;
}

export function getProducts() {
  return request("/products");
}

export function getTrendingProducts() {
  return request("/products/trending");
}

export function getTrendingKeywords() {
  return request("/keywords/trending");
}

export function searchStores(query, { lat, lng, radiusKm = 5 } = {}) {
  const params = new URLSearchParams();
  params.set("query", query);
  if (lat) params.set("lat", lat);
  if (lng) params.set("lng", lng);
  params.set("radiusKm", radiusKm);
  return request(`/search?${params.toString()}`);
}

export function getNearbyStores({ lat, lng, productId, radiusKm = 5 } = {}) {
  const params = new URLSearchParams();
  if (lat) params.set("lat", lat);
  if (lng) params.set("lng", lng);
  if (productId) params.set("productId", productId);
  params.set("radiusKm", radiusKm);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return request(`/stores/nearby${suffix}`);
}

export function getStore(storeId) {
  return request(`/stores/${storeId}`);
}

export function getStoreInventories(storeId) {
  return request(`/stores/${storeId}/inventories`);
}

export function createReservation(payload) {
  return request("/reservations", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getUserReservations(userId) {
  return request(`/users/${userId}/reservations`);
}

export function cancelReservation(reservationId, payload = {}) {
  return request(`/reservations/${reservationId}/cancel`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function getSellerStores(sellerId) {
  return request(`/seller/stores?sellerId=${sellerId}`);
}

export function getSellerInventories(storeId, sellerId) {
  return request(`/seller/stores/${storeId}/inventories?sellerId=${sellerId}`);
}

export function updateSellerInventory(inventoryId, payload = {}) {
  return request(`/seller/inventories/${inventoryId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function getSellerReservations(storeId, sellerId) {
  return request(`/seller/stores/${storeId}/reservations?sellerId=${sellerId}`);
}

export function updateSellerReservationStatus(reservationId, payload = {}) {
  return request(`/seller/reservations/${reservationId}/status`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
