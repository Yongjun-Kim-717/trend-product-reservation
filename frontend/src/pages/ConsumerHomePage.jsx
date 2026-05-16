import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { ConsumerHeader } from "../components/AppHeader.jsx";
import KakaoMap from "../components/KakaoMap.jsx";
import { nearbyStores, products } from "../data/mockData.js";

function ProductThumb({ name }) {
  return <div className="product-thumb" aria-hidden="true">{name.slice(0, 1)}</div>;
}

function ConsumerHomePage() {
  const [query, setQuery] = useState("");
  const [selectedStoreId, setSelectedStoreId] = useState(nearbyStores[0].id);
  const selectedStore = nearbyStores.find((store) => store.id === selectedStoreId) ?? nearbyStores[0];

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return products;
    return products.filter((product) => product.name.toLowerCase().includes(normalizedQuery));
  }, [query]);

  const filteredStores = useMemo(() => {
    const productIds = new Set(filteredProducts.map((product) => product.id));
    return nearbyStores.filter((store) => store.inventories.some((inventory) => productIds.has(inventory.productId)));
  }, [filteredProducts]);

  const handleSelectStore = useCallback((storeId) => {
    setSelectedStoreId(storeId);
  }, []);

  const selectedInventory = selectedStore.inventories[0];
  const selectedProduct = products.find((product) => product.id === selectedInventory.productId);

  return (
    <div className="page-shell">
      <ConsumerHeader />
      <main className="consumer-layout">
        <aside className="consumer-panel">
          <label className="search-box">
            상품 검색
            <div className="input-with-icon">
              <Search size={18} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="버터떡, 두쫀쿠 검색" />
            </div>
          </label>

          <section>
            <div className="section-title-row">
              <h2>유행 상품</h2>
            </div>
            <div className="chip-list">
              {products.map((product) => (
                <button className="trend-chip" key={product.id} onClick={() => setQuery(product.name)} type="button">
                  <span>{product.name}</span>
                  <em>{product.trendBadge}</em>
                </button>
              ))}
            </div>
          </section>

          <section>
            <h2>내 주변 매장</h2>
            <div className="store-list">
              {filteredStores.map((store) => {
                const inventory = store.inventories[0];
                const product = products.find((item) => item.id === inventory.productId);
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
                    <span className="stock-pill">예약 가능 {inventory.reservableStock}</span>
                  </button>
                );
              })}
            </div>
          </section>
        </aside>

        <div className="map-stage">
          <KakaoMap stores={filteredStores.length ? filteredStores : nearbyStores} selectedStoreId={selectedStoreId} onSelectStore={handleSelectStore} />
          <article className="map-store-popup">
            <strong>{selectedStore.name}</strong>
            <span>{selectedStore.distance} · {selectedProduct?.name} 예약 가능 {selectedInventory.reservableStock}개</span>
            <Link className="primary-button small" to={`/consumer/reservations/new?storeId=${selectedStore.id}&productId=${selectedProduct?.id ?? 1}`}>
              상세 보기
            </Link>
          </article>
        </div>
      </main>
    </div>
  );
}

export default ConsumerHomePage;
