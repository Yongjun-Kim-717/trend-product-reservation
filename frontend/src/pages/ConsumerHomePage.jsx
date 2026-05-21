import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, LocateFixed, Navigation, Search, X } from "lucide-react";
import { ConsumerHeader } from "../components/AppHeader.jsx";
import KakaoMap from "../components/KakaoMap.jsx";
import { getNearbyStores, getTrendingKeywords, searchStores } from "../api/client.js";
import { getCurrentUser } from "../auth/session.js";

const DEFAULT_LOCATION = {
  label: "부평역",
  latitude: 37.4904,
  longitude: 126.7248,
};
const DEFAULT_SEARCH_RADIUS_KM = 10;

function resolveImageSrc(imageUrl) {
  if (!imageUrl) return "";
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api";
  const assetBaseUrl = apiBaseUrl.replace(/\/api\/?$/, "");
  return `${assetBaseUrl}${imageUrl.startsWith("/") ? imageUrl : `/${imageUrl}`}`;
}

function ProductThumb({ name, imageUrl }) {
  const [hasImageError, setHasImageError] = useState(false);
  const imageSrc = !hasImageError ? resolveImageSrc(imageUrl) : "";

  return (
    <div className="product-thumb" aria-hidden="true">
      {imageSrc ? <img src={imageSrc} alt="" onError={() => setHasImageError(true)} /> : name.slice(0, 1)}
    </div>
  );
}

function getStoreMatch(store, selectedProductId) {
  const inventory = selectedProductId
    ? store.inventories.find((item) => item.productId === selectedProductId)
    : store.inventories[0];
  const product = inventory?.product ?? store.products?.find((item) => item.id === inventory?.productId);
  return { inventory, product };
}

function calculateDistanceKm(from, to) {
  if (!from) return null;
  const earthRadiusKm = 6371;
  const latDistance = ((to.latitude - from.latitude) * Math.PI) / 180;
  const lngDistance = ((to.longitude - from.longitude) * Math.PI) / 180;
  const fromLat = (from.latitude * Math.PI) / 180;
  const toLat = (to.latitude * Math.PI) / 180;
  const a = Math.sin(latDistance / 2) ** 2 + Math.cos(fromLat) * Math.cos(toLat) * Math.sin(lngDistance / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(distanceKm, fallbackDistance) {
  if (distanceKm === null) return fallbackDistance;
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)}m`;
  return `${distanceKm.toFixed(1)}km`;
}

function toTrendingKeywordModel(keyword) {
  return {
    id: keyword.keyword_id,
    name: keyword.keyword_name,
    searchCount: keyword.search_count ?? 0,
    rankBasis: keyword.rank_basis,
    trendBadge: keyword.rank_basis === "SEARCH_LOG_7D" ? `${keyword.search_count}회` : "추천",
  };
}

function toStoreModel(store) {
  const product = {
    id: store.inventory.product_id,
    name: store.inventory.product_name,
    category: "유행 상품",
    description: `${store.inventory.product_name} 예약 가능 매장입니다.`,
    imageUrl: store.inventory.image_url ?? "",
    trendBadge: "검색",
  };

  return {
    id: store.store_id,
    name: store.name,
    address: store.address,
    distance: store.distance_km === null
      ? "거리 정보 없음"
      : store.distance_km < 1
        ? `${Math.round(store.distance_km * 1000)}m`
        : `${store.distance_km.toFixed(1)}km`,
    latitude: store.latitude,
    longitude: store.longitude,
    phone: store.phone ?? "",
    openingHours: store.opening_hours ?? "매장 정보 확인 필요",
    products: [product],
    inventories: [
      {
        inventoryId: store.inventory.inventory_id,
        productId: store.inventory.product_id,
        totalStock: store.inventory.total_stock,
        reservableStock: store.inventory.reservable_stock,
        reservedStock: store.inventory.reserved_stock,
        product,
      },
    ],
  };
}

function toStoreModels(storeRows) {
  const storeMap = new Map();

  storeRows.forEach((storeRow) => {
    const nextStore = toStoreModel(storeRow);
    const existingStore = storeMap.get(nextStore.id);

    if (!existingStore) {
      storeMap.set(nextStore.id, nextStore);
      return;
    }

    existingStore.products.push(...nextStore.products);
    existingStore.inventories.push(...nextStore.inventories);
  });

  return Array.from(storeMap.values());
}

function ConsumerHomePage() {
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState([]);
  const [nearbyStores, setNearbyStores] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [activeKeywordName, setActiveKeywordName] = useState(null);
  const [selectedStoreId, setSelectedStoreId] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [locationMessage, setLocationMessage] = useState("기본 위치 기준 주변 매장을 표시합니다. 내 위치 버튼을 누르거나 검색어를 입력해 기준을 바꿀 수 있습니다.");
  const [mapFocusTarget, setMapFocusTarget] = useState(null);
  const [searchContext, setSearchContext] = useState({
    locationLabel: DEFAULT_LOCATION.label,
    productLabel: "전체 상품",
    source: "기본 위치",
  });
  const currentUser = getCurrentUser();

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return products;
    return products.filter((product) => normalizedQuery.includes(product.name.toLowerCase()) || product.name.toLowerCase().includes(normalizedQuery));
  }, [products, query]);
  const displayedKeywords = query.trim() ? filteredProducts : products;

  const activeProductId = selectedProductId;
  const activeProduct = activeProductId ? { name: searchContext.productLabel } : null;

  const matchedStores = useMemo(() => {
    const baseStores = activeProductId
      ? nearbyStores
        .map((store) => ({ ...store, match: getStoreMatch(store, activeProductId) }))
        .filter((store) => store.match.inventory)
      : nearbyStores.map((store) => ({ ...store, match: getStoreMatch(store, null) }));

    return baseStores
      .map((store) => {
        const distanceKm = calculateDistanceKm(userLocation, store);
        return {
          ...store,
          distanceKm,
          displayDistance: formatDistance(distanceKm, store.distance),
        };
      })
      .sort((a, b) => {
        if (a.distanceKm === null || b.distanceKm === null) return 0;
        return a.distanceKm - b.distanceKm;
      });
  }, [activeProductId, nearbyStores, userLocation]);

  const visibleStores = matchedStores;

  useEffect(() => {
    if (visibleStores.length > 0 && !visibleStores.some((store) => store.id === selectedStoreId)) {
      setSelectedStoreId(visibleStores[0].id);
      setMapFocusTarget({ type: "store", id: visibleStores[0].id });
    }
  }, [visibleStores, selectedStoreId]);

  const selectedStore = visibleStores.find((store) => store.id === selectedStoreId) ?? visibleStores[0];
  const selectedInventory = selectedStore?.match?.inventory ?? selectedStore?.inventories[0];
  const selectedProduct = selectedStore?.match?.product ?? selectedInventory?.product;

  const handleSelectStore = useCallback((storeId) => {
    setSelectedStoreId(storeId);
    setMapFocusTarget({ type: "store", id: storeId });
  }, []);

  const applyStoreResult = useCallback((result, sourceLabel, productLabel = "전체 상품", nextActiveProductId = null) => {
    const nextStores = toStoreModels(result.stores);

    setNearbyStores(nextStores);
    setSelectedProductId(nextActiveProductId);
    setSelectedStoreId(nextStores[0]?.id ?? null);
    setUserLocation(result.location ? { latitude: result.location.latitude, longitude: result.location.longitude } : null);
    setMapFocusTarget(result.location ? { type: "user", id: `${result.location.query}-${Date.now()}` } : null);
    setSearchContext({
      locationLabel: result.location?.query ?? DEFAULT_LOCATION.label,
      productLabel,
      source: sourceLabel,
    });
    setLocationMessage(`${result.location?.query ?? DEFAULT_LOCATION.label} 기준으로 등록 매장 ${nextStores.length}곳을 조회했습니다.`);
  }, []);

  const loadNearbyStores = useCallback(async ({ location = DEFAULT_LOCATION, productId = null, sourceLabel = "기본 위치" } = {}) => {
    setIsSearching(true);
    setSearchError("");

    try {
      const result = await getNearbyStores({
        lat: location.latitude,
        lng: location.longitude,
        productId,
        radiusKm: DEFAULT_SEARCH_RADIUS_KM,
      });
      const productLabel = productId ? products.find((product) => product.id === productId)?.name ?? "선택 상품" : "전체 상품";
      applyStoreResult({
        ...result,
        location: {
          query: location.label,
          latitude: location.latitude,
          longitude: location.longitude,
          source: sourceLabel,
        },
      }, sourceLabel, productLabel);
    } catch (error) {
      setNearbyStores([]);
      setSelectedStoreId(null);
      setSearchError(error.message);
      setLocationMessage("주변 매장 조회에 실패했습니다. 서버와 DB 실행 상태를 확인해주세요.");
    } finally {
      setIsSearching(false);
    }
  }, [applyStoreResult, products]);

  const runSearch = useCallback(async (nextQuery) => {
    const searchQuery = nextQuery.trim();
    setActiveKeywordName(searchQuery || null);
    if (!searchQuery) {
      await loadNearbyStores();
      return;
    }

    setIsSearching(true);
    setSearchError("");

    try {
      const baseLocation = userLocation ?? DEFAULT_LOCATION;
      const result = await searchStores(searchQuery, {
        lat: baseLocation.latitude,
        lng: baseLocation.longitude,
        locationLabel: baseLocation.label ?? "내 위치",
        radiusKm: DEFAULT_SEARCH_RADIUS_KM,
        userId: currentUser?.user_id,
      });
      // Keyword/category searches are name-based, so product_id filtering would hide
      // the same product name registered as different product rows per store.
      const activeProduct = null;
      const productLabel = result.keyword?.keyword_name ?? result.product?.name ?? result.category?.name ?? "전체 상품";
      applyStoreResult(result, result.location ? "검색어 위치" : "기본 위치 + 상품 검색", productLabel, activeProduct);
    } catch (error) {
      setNearbyStores([]);
      setSelectedStoreId(null);
      setSearchError(error.message);
      setLocationMessage("백엔드 API 조회에 실패했습니다. 서버와 DB 실행 상태를 확인해주세요.");
    } finally {
      setIsSearching(false);
    }
  }, [applyStoreResult, currentUser?.user_id, loadNearbyStores, userLocation]);

  useEffect(() => {
    getTrendingKeywords()
      .then((rows) => setProducts(rows.map(toTrendingKeywordModel)))
      .catch((error) => setSearchError(error.message));
  }, []);

  useEffect(() => {
    loadNearbyStores();
  }, [loadNearbyStores]);

  const handleSelectProduct = (product) => {
    setSelectedProductId(null);
    setActiveKeywordName(product.name);
    setQuery(product.name);
    runSearch(product.name);
  };

  const clearProductFilter = () => {
    setSelectedProductId(null);
    setActiveKeywordName(null);
    setQuery("");
    loadNearbyStores();
  };

  const submitSearch = (event) => {
    event.preventDefault();
    runSearch(query);
  };

  const requestCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationMessage("이 브라우저에서는 위치 정보를 사용할 수 없습니다.");
      return;
    }

    setIsLocating(true);
    setLocationMessage("브라우저 위치 권한을 확인하고 있습니다.");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLocation = {
          label: "내 위치",
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setUserLocation(nextLocation);
        setIsLocating(false);
        setLocationMessage(`현재 위치 기준으로 주변 매장을 거리순 정렬했습니다. (${nextLocation.latitude.toFixed(4)}, ${nextLocation.longitude.toFixed(4)})`);
        setSearchContext((current) => ({ ...current, locationLabel: "현재 위치", source: "내 위치" }));
        setMapFocusTarget({ type: "user", id: Date.now() });
        loadNearbyStores({ location: { ...nextLocation, label: "현재 위치" }, sourceLabel: "내 위치" });
      },
      () => {
        setIsLocating(false);
        setLocationMessage("위치 권한을 허용하면 현재 위치 기준 주변 매장을 확인할 수 있습니다.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  return (
    <div className="page-shell">
      <ConsumerHeader onRequestLocation={requestCurrentLocation} isLocating={isLocating} />
      <main className="consumer-layout">
        <aside className="consumer-panel">
          <form className="search-box" onSubmit={submitSearch}>
            상품 검색
            <div className="input-with-icon">
              <Search size={18} />
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSelectedProductId(null);
                }}
                placeholder="상품명 또는 장소명 검색"
              />
              <button className="search-submit-button" type="submit" disabled={isSearching}>
                {isSearching ? "조회 중" : "검색"}
              </button>
            </div>
          </form>

          <div className="location-feedback">
            <Navigation size={16} />
            <span>{locationMessage}</span>
          </div>

          {searchError && <div className="error-message"><AlertCircle size={18} /> {searchError}</div>}

          <div className="search-context-card">
            <strong>검색 기준</strong>
            <span>위치: {searchContext.locationLabel}</span>
            <span>상품: {searchContext.productLabel}</span>
            <em>{searchContext.source}</em>
          </div>

          <section>
            <div className="section-title-row">
              <h2>최근 7일 인기 검색어</h2>
              {activeProduct && (
                <button className="clear-filter-button" onClick={clearProductFilter} type="button">
                  <X size={14} /> 전체
                </button>
              )}
            </div>
            <div className="chip-list">
              {displayedKeywords.map((product) => (
                <button
                  className={`trend-chip ${activeKeywordName === product.name ? "selected" : ""}`}
                  key={product.id}
                  onClick={() => handleSelectProduct(product)}
                  type="button"
                >
                  <span>{product.name}</span>
                  <em>{product.trendBadge}</em>
                </button>
              ))}
            </div>
          </section>

          <section>
            <div className="section-title-row">
              <h2>검색 결과 매장</h2>
              <span className="result-count">{visibleStores.length}곳</span>
            </div>
            <div className="store-list">
              {visibleStores.length === 0 && (
                <div className="warning-message">
                  <AlertCircle size={18} /> 기준 위치 주변 {DEFAULT_SEARCH_RADIUS_KM}km 안에 예약 가능한 매장이 없습니다.
                </div>
              )}
              {visibleStores.map((store) => {
                const inventory = store.match.inventory;
                const product = store.match.product;
                return (
                  <button
                    className={`store-card ${selectedStoreId === store.id ? "selected" : ""}`}
                    key={`${store.id}-${inventory?.inventoryId}`}
                    onClick={() => handleSelectStore(store.id)}
                    type="button"
                  >
                    <div>
                      <strong>{store.name}</strong>
                      <span>{store.displayDistance} · {product?.name}</span>
                    </div>
                    <span className="stock-pill">예약 가능 {inventory?.reservableStock ?? 0}</span>
                  </button>
                );
              })}
            </div>
          </section>
        </aside>

        <div className="map-stage">
          <KakaoMap stores={visibleStores} selectedStoreId={selectedStoreId} onSelectStore={handleSelectStore} userLocation={userLocation} focusTarget={mapFocusTarget} />
          {selectedStore && selectedInventory && selectedProduct && (
            <div className="map-overlay-layer">
              <article className="selected-store-panel">
                <div className="popup-title-row">
                  <strong>{selectedStore.name}</strong>
                  <span><LocateFixed size={14} /> {selectedStore.displayDistance}</span>
                </div>
                <div className="selected-store-product">
                  <div>
                    <strong>{selectedProduct.name}</strong>
                    <span>예약 가능 {selectedInventory.reservableStock}개</span>
                  </div>
                </div>
                <span className="selected-store-address">{selectedStore.address}</span>
                <div className="selected-store-meta">
                  <span>영업시간 {selectedStore.openingHours}</span>
                  {selectedStore.phone && <span>전화 {selectedStore.phone}</span>}
                </div>
                <div className="result-actions compact-actions">
                  <Link className="ghost-button small" to={`/consumer/stores/${selectedStore.id}`}>
                    가게 정보
                  </Link>
                  <Link
                    className="primary-button small"
                    to={`/consumer/reservations/new?storeId=${selectedStore.id}&productId=${selectedProduct.id}&inventoryId=${selectedInventory.inventoryId}`}
                  >
                    이 매장에서 예약하기
                  </Link>
                </div>
              </article>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default ConsumerHomePage;
