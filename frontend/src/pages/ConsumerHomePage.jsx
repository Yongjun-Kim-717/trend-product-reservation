import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, LocateFixed, Navigation, Search, X } from "lucide-react";
import { ConsumerHeader } from "../components/AppHeader.jsx";
import KakaoMap from "../components/KakaoMap.jsx";
import { getNearbyStores, getProducts, searchStores } from "../api/client.js";

const DEFAULT_LOCATION = {
  label: "부평역",
  latitude: 37.4904,
  longitude: 126.7248,
};

function ProductThumb({ name }) {
  return <div className="product-thumb" aria-hidden="true">{name.slice(0, 1)}</div>;
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

function toProductModel(product) {
  return {
    id: product.product_id,
    name: product.name,
    category: product.category ?? "기타",
    description: product.description ?? "",
    imageUrl: product.image_url ?? "",
    trendBadge: "DB",
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
    openingHours: "매장 정보 확인 필요",
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

function ConsumerHomePage() {
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState([]);
  const [nearbyStores, setNearbyStores] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState(null);
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
    source: "기본 위치 + DB",
  });

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return products;
    return products.filter((product) => normalizedQuery.includes(product.name.toLowerCase()) || product.name.toLowerCase().includes(normalizedQuery));
  }, [products, query]);

  const activeProductId = selectedProductId;
  const activeProduct = products.find((product) => product.id === activeProductId);

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
    const nextStores = result.stores.map(toStoreModel);

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
    setLocationMessage(`${result.location?.query ?? DEFAULT_LOCATION.label} 기준으로 실제 DB 매장 ${nextStores.length}곳을 조회했습니다.`);
  }, []);

  const loadNearbyStores = useCallback(async ({ location = DEFAULT_LOCATION, productId = null, sourceLabel = "기본 위치 + DB" } = {}) => {
    setIsSearching(true);
    setSearchError("");

    try {
      const result = await getNearbyStores({
        lat: location.latitude,
        lng: location.longitude,
        productId,
        radiusKm: 5,
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
        radiusKm: 5,
      });
      const activeProduct = result.stores[0]?.inventory?.product_id ?? null;
      applyStoreResult(result, result.location ? "검색어 위치 + DB" : "기본 위치 + 상품 검색", result.keyword?.keyword_name ?? "전체 상품", activeProduct);
    } catch (error) {
      setNearbyStores([]);
      setSelectedStoreId(null);
      setSearchError(error.message);
      setLocationMessage("백엔드 API 조회에 실패했습니다. 서버와 DB 실행 상태를 확인해주세요.");
    } finally {
      setIsSearching(false);
    }
  }, [applyStoreResult, loadNearbyStores, userLocation]);

  useEffect(() => {
    getProducts()
      .then((rows) => setProducts(rows.map(toProductModel)))
      .catch((error) => setSearchError(error.message));
  }, []);

  useEffect(() => {
    loadNearbyStores();
  }, [loadNearbyStores]);

  const handleSelectProduct = (product) => {
    setSelectedProductId(product.id);
    setQuery(product.name);
    runSearch(product.name);
  };

  const clearProductFilter = () => {
    setSelectedProductId(null);
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
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setUserLocation(nextLocation);
        setIsLocating(false);
        setLocationMessage(`현재 위치 기준으로 주변 매장을 거리순 정렬했습니다. (${nextLocation.latitude.toFixed(4)}, ${nextLocation.longitude.toFixed(4)})`);
        setSearchContext((current) => ({ ...current, locationLabel: "현재 위치", source: "내 위치" }));
        setMapFocusTarget({ type: "user", id: Date.now() });
        loadNearbyStores({ location: { ...nextLocation, label: "현재 위치" }, sourceLabel: "내 위치 + DB" });
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
              <h2>유행 상품</h2>
              {activeProduct && (
                <button className="clear-filter-button" onClick={clearProductFilter} type="button">
                  <X size={14} /> 전체
                </button>
              )}
            </div>
            <div className="chip-list">
              {(products.length ? products : filteredProducts).map((product) => (
                <button
                  className={`trend-chip ${activeProductId === product.id ? "selected" : ""}`}
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
                  <AlertCircle size={18} /> 기준 위치 주변 5km 안에 예약 가능한 매장이 없습니다.
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
                    <ProductThumb name={product?.name ?? "상"} />
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
                  <ProductThumb name={selectedProduct.name} />
                  <div>
                    <strong>{selectedProduct.name}</strong>
                    <span>예약 가능 {selectedInventory.reservableStock}개</span>
                  </div>
                </div>
                <span className="selected-store-address">{selectedStore.address}</span>
                <Link
                  className="primary-button small"
                  to={`/consumer/reservations/new?storeId=${selectedStore.id}&productId=${selectedProduct.id}&inventoryId=${selectedInventory.inventoryId}`}
                >
                  이 매장에서 예약하기
                </Link>
              </article>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default ConsumerHomePage;
