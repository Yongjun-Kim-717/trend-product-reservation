import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AlertCircle, CalendarClock, MapPin, Phone, ShoppingBag } from "lucide-react";
import { ConsumerHeader } from "../components/AppHeader.jsx";
import { getStore, getStoreInventories } from "../api/client.js";
import { getCurrentUser } from "../auth/session.js";

function resolveImageSrc(imageUrl) {
  if (!imageUrl) return "";
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api";
  const assetBaseUrl = apiBaseUrl.replace(/\/api\/?$/, "");
  return `${assetBaseUrl}${imageUrl.startsWith("/") ? imageUrl : `/${imageUrl}`}`;
}

function ProductImage({ imageUrl, name }) {
  const [hasImageError, setHasImageError] = useState(false);
  const imageSrc = hasImageError ? "" : resolveImageSrc(imageUrl);

  return (
    <div className="store-product-image">
      {imageSrc ? <img src={imageSrc} alt={name} onError={() => setHasImageError(true)} /> : <ShoppingBag size={28} />}
    </div>
  );
}

function ConsumerStorePage() {
  const { storeId } = useParams();
  const navigate = useNavigate();
  const [currentUser] = useState(() => getCurrentUser());
  const [store, setStore] = useState(null);
  const [inventories, setInventories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!currentUser || currentUser.role !== "CONSUMER") {
      navigate("/login", { replace: true });
      return undefined;
    }

    let cancelled = false;

    async function loadStore() {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const [storeData, inventoryRows] = await Promise.all([
          getStore(storeId),
          getStoreInventories(storeId),
        ]);

        if (!cancelled) {
          setStore(storeData);
          setInventories(inventoryRows);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error.message);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadStore();

    return () => {
      cancelled = true;
    };
  }, [currentUser, navigate, storeId]);

  const metrics = useMemo(() => ({
    productCount: inventories.length,
    reservableStock: inventories.reduce((sum, item) => sum + Number(item.reservable_stock ?? 0), 0),
  }), [inventories]);

  return (
    <div className="page-shell">
      <ConsumerHeader />
      <main className="management-main">
        <div className="section-heading-row">
          <div>
            <p className="eyebrow">Store Detail</p>
            <h1>{store?.name ?? "매장 정보"}</h1>
          </div>
          <Link className="ghost-button" to="/consumer">지도에서 찾기</Link>
        </div>

        {isLoading && <div className="warning-message">매장 정보를 불러오는 중입니다.</div>}
        {errorMessage && <div className="error-message"><AlertCircle size={18} /> {errorMessage}</div>}

        {store && (
          <>
            <section className="store-detail-hero">
              <div>
                <h2>{store.name}</h2>
                <p><MapPin size={16} /> {store.address}</p>
                <p><CalendarClock size={16} /> {store.opening_hours ?? "영업시간 미등록"}</p>
                <p><Phone size={16} /> {store.phone ?? "전화번호 미등록"}</p>
              </div>
              <div className="store-detail-meta">
                <span>등록 상품 <strong>{metrics.productCount}</strong></span>
                <span>예약 가능 재고 <strong>{metrics.reservableStock}</strong></span>
              </div>
            </section>

            <section className="table-section">
              <div className="section-heading-row">
                <h2>예약 가능 상품</h2>
                <span className="inline-feedback">매장 재고 기준</span>
              </div>
              <div className="store-product-grid">
                {inventories.map((item) => {
                  const canReserve = Number(item.reservable_stock) > 0;

                  return (
                    <article className="store-product-card" key={item.inventory_id}>
                      <ProductImage imageUrl={item.image_url} name={item.product_name} />
                      <div>
                        <strong>{item.product_name}</strong>
                        <span>전체 {item.total_stock}개 · 예약 가능 {item.reservable_stock}개 · 예약됨 {item.reserved_stock}개</span>
                      </div>
                      <Link
                        className={`primary-button small ${canReserve ? "" : "disabled-link"}`}
                        to={canReserve ? `/consumer/reservations/new?storeId=${store.store_id}&productId=${item.product_id}&inventoryId=${item.inventory_id}` : "#"}
                        aria-disabled={!canReserve}
                      >
                        예약하기
                      </Link>
                    </article>
                  );
                })}
                {!isLoading && inventories.length === 0 && (
                  <div className="empty-state">현재 예약 가능한 상품이 없습니다.</div>
                )}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default ConsumerStorePage;
