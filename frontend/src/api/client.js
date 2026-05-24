import { clearCurrentUser, getAuthToken } from "../auth/session.js";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api";

async function request(path, options = {}) {
  const token = getAuthToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
    ...options,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401 && token) {
      clearCurrentUser();
    }
    const message = payload.message ?? "API 요청에 실패했습니다.";
    throw new Error(message);
  }

  return payload.data ?? payload;
}

export function getProducts() {
  return request("/products");
}

export function getProductCategories() {
  return request("/product-categories");
}

export function uploadProductImage(payload = {}) {
  return request("/uploads/products", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function login(payload) {
  return request("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function register(payload) {
  return request("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getTrendingProducts() {
  return request("/products/trending");
}

export function getTrendingKeywords() {
  return request("/keywords/trending");
}

export function searchStores(query, { lat, lng, locationLabel, radiusKm = 5, userId } = {}) {
  const params = new URLSearchParams();
  params.set("query", query);
  if (lat) params.set("lat", lat);
  if (lng) params.set("lng", lng);
  if (locationLabel) params.set("locationLabel", locationLabel);
  if (userId) params.set("userId", userId);
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

export function createSellerStore(payload = {}) {
  return request("/seller/stores", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateSellerStore(storeId, payload = {}) {
  return request(`/seller/stores/${storeId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function getSellerInventories(storeId, sellerId) {
  return request(`/seller/stores/${storeId}/inventories?sellerId=${sellerId}`);
}

export function createSellerProduct(storeId, payload = {}) {
  return request(`/seller/stores/${storeId}/products`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateSellerProduct(storeId, productId, payload = {}) {
  return request(`/seller/stores/${storeId}/products/${productId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
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

export function getPendingStores() {
  return request("/admin/stores/pending");
}

export function updateStoreApproval(storeId, payload = {}) {
  return request(`/admin/stores/${storeId}/approval`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function getAdminSellers() {
  return request("/admin/sellers");
}

export function updateSellerApproval(sellerId, payload = {}) {
  return request(`/admin/sellers/${sellerId}/approval`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function getAdminUsers() {
  return request("/admin/users");
}

export function updateAdminUserStatus(userId, payload = {}) {
  return request(`/admin/users/${userId}/status`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function getAdminSearchLogs({ page = 1, limit = 20, query = "" } = {}) {
  const params = new URLSearchParams();
  params.set("page", page);
  params.set("limit", limit);
  if (query.trim()) params.set("q", query.trim());
  return request(`/admin/search-logs?${params.toString()}`);
}

export function getAdminUnmappedSearches() {
  return request("/admin/unmapped-searches");
}

export function getAdminKeywords() {
  return request("/admin/keywords");
}

export function registerUnmappedAlias(unmappedId, payload = {}) {
  return request(`/admin/unmapped-searches/${unmappedId}/register-alias`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function createKeywordFromUnmapped(unmappedId, payload = {}) {
  return request(`/admin/unmapped-searches/${unmappedId}/create-keyword`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateUnmappedSearchStatus(unmappedId, payload = {}) {
  return request(`/admin/unmapped-searches/${unmappedId}/status`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteUnmappedSearch(unmappedId) {
  return request(`/admin/unmapped-searches/${unmappedId}`, {
    method: "DELETE",
  });
}

export function deleteKeywordAlias(aliasId) {
  return request(`/admin/keyword-aliases/${aliasId}`, {
    method: "DELETE",
  });
}
