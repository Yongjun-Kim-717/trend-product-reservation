import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { LocateFixed, Search, X } from "lucide-react";
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

function ConsumerHomePage() {
  const [query, setQuery] = useState("");
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [selectedStoreId, setSelectedStoreId] = useState(nearbyStores[0].id);

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return products;
    return products.filter((product) => product.name.toLowerCase().includes(normalizedQuery));
  }, [query]);

  const activeProductId = selectedProductId ?? filteredProducts[0]?.id ?? null;
  const activeProduct = products.find((product) => product.id === activeProductId);

  const matchedStores = useMemo(() => {
    if (!activeProductId) return nearbyStores;
    return nearbyStores
      .map((store) => ({ ...store, match: getStoreMatch(store, activeProductId) }))
      .filter((store) => store.match.inventory);
  }, [activeProductId]);

  const visibleStores = matchedStores.length ? matchedStores : nearbyStores.map((store) => ({ ...store, match: getStoreMatch(store, null) }));

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
  }, []);

  const handleSelectProduct = (product) => {
    setSelectedProductId(product.id);
    setQuery(product.name);
  };

  const clearProductFilter = () => {
    setSelectedProductId(null);
    setQuery("");
  };

  return (
    <div className="page-shell">
      <ConsumerHeader />
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
                    onClick={() => setSelectedStoreId(store.id)}
                    type="button"
                  >
                    <ProductThumb name={product?.name ?? "상"} />
                    <div>
                      <strong>{store.name}</strong>
                      <span>{store.distance} · {product?.name}</span>
                    </div>
                    <span className="stock-pill">예약 가능 {inventory?.reservableStock ?? 0}</span>
                  </button>
                );
              })}
            </div>
          </section>
        </aside>

        <div className="map-stage">
          <KakaoMap stores={visibleStores} selectedStoreId={selectedStoreId} onSelectStore={handleSelectStore} />
          {selectedStore && selectedInventory && selectedProduct && (
            <div className="map-overlay-layer">
              <article className="selected-store-panel">
                <div className="popup-title-row">
                  <strong>{selectedStore.name}</strong>
                  <span><LocateFixed size={14} /> {selectedStore.distance}</span>
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
