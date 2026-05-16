import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { LocateFixed, Navigation, Search, X } from "lucide-react";
import { ConsumerHeader } from "../components/AppHeader.jsx";
import KakaoMap from "../components/KakaoMap.jsx";
import { nearbyStores, products } from "../data/mockData.js";

function ProductThumb({ name }) {
  return <div className="product-thumb" aria-hidden="true">{name.slice(0, 1)}</div>;
}

function getStoreMatch(store, selectedProductId) {
  const inventory = selectedProductId
    ? store.inventories.find((item) => item.productId === selectedProductId)
    : store.inventories[0];
  const product = products.find((item) => item.id === inventory?.productId);
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

function ConsumerHomePage() {
  const [query, setQuery] = useState("");
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [selectedStoreId, setSelectedStoreId] = useState(nearbyStores[0].id);
  const [userLocation, setUserLocation] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState("내 위치를 설정하면 주변 매장이 거리순으로 정렬됩니다.");
  const [mapFocusTarget, setMapFocusTarget] = useState({ type: "store", id: nearbyStores[0].id });

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return products;
    return products.filter((product) => product.name.toLowerCase().includes(normalizedQuery));
  }, [query]);

  const activeProductId = selectedProductId ?? filteredProducts[0]?.id ?? null;
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
  }, [activeProductId, userLocation]);

  const visibleStores = matchedStores.length ? matchedStores : nearbyStores.map((store) => ({ ...store, match: getStoreMatch(store, null), distanceKm: null, displayDistance: store.distance }));

  useEffect(() => {
    if (!visibleStores.some((store) => store.id === selectedStoreId)) {
      setSelectedStoreId(visibleStores[0]?.id ?? nearbyStores[0].id);
    }
  }, [visibleStores, selectedStoreId]);

  const selectedStore = visibleStores.find((store) => store.id === selectedStoreId) ?? visibleStores[0];
  const selectedInventory = selectedStore?.match?.inventory ?? selectedStore?.inventories[0];
  const selectedProduct = selectedStore?.match?.product ?? products.find((product) => product.id === selectedInventory?.productId);

  const handleSelectStore = useCallback((storeId) => {
    setSelectedStoreId(storeId);
    setMapFocusTarget({ type: "store", id: storeId });
  }, []);

  const handleSelectProduct = (product) => {
    setSelectedProductId(product.id);
    setQuery(product.name);
  };

  const clearProductFilter = () => {
    setSelectedProductId(null);
    setQuery("");
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
        setMapFocusTarget({ type: "user", id: Date.now() });
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
          <label className="search-box">
            상품 검색
            <div className="input-with-icon">
              <Search size={18} />
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSelectedProductId(null);
                }}
                placeholder="버터떡, 두쫀쿠 검색"
              />
            </div>
          </label>

          <div className="location-feedback">
            <Navigation size={16} />
            <span>{locationMessage}</span>
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
              {products.map((product) => (
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
              <h2>내 주변 매장</h2>
              <span className="result-count">{visibleStores.length}곳</span>
            </div>
            <div className="store-list">
              {visibleStores.map((store) => {
                const inventory = store.match.inventory;
                const product = store.match.product;
                return (
                  <button
                    className={`store-card ${selectedStoreId === store.id ? "selected" : ""}`}
                    key={store.id}
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
                <Link className="primary-button small" to={`/consumer/reservations/new?storeId=${selectedStore.id}&productId=${selectedProduct.id}`}>
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
