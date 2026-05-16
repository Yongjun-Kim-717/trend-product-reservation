import { Link, useSearchParams } from "react-router-dom";
import { Minus, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { ConsumerHeader } from "../components/AppHeader.jsx";
import { getInventory, getProduct, getStore } from "../data/mockData.js";

function ReservationPage() {
  const [searchParams] = useSearchParams();
  const storeId = searchParams.get("storeId") ?? "1";
  const productId = searchParams.get("productId") ?? "1";
  const store = getStore(storeId) ?? getStore(1);
  const product = getProduct(productId) ?? getProduct(1);
  const inventory = getInventory(store.id, product.id) ?? store.inventories[0];
  const [quantity, setQuantity] = useState(1);
  const [isReserved, setIsReserved] = useState(false);

  const remainingAfterReservation = useMemo(
    () => Math.max(inventory.reservableStock - quantity, 0),
    [inventory.reservableStock, quantity]
  );

  const increase = () => setQuantity((current) => Math.min(current + 1, inventory.reservableStock));
  const decrease = () => setQuantity((current) => Math.max(current - 1, 1));

  return (
    <div className="page-shell">
      <ConsumerHeader />
      <main className="detail-layout">
        <section className="product-detail-card">
          <Link className="text-link fit" to="/consumer">뒤로가기</Link>
          <div className="product-image-placeholder">{product.name}</div>
          <h1>{product.name}</h1>
          <p>{product.description}</p>
          <dl className="info-list">
            <div><dt>매장</dt><dd>{store.name}</dd></div>
            <div><dt>매장 주소</dt><dd>{store.address}</dd></div>
            <div><dt>영업시간</dt><dd>{store.openingHours}</dd></div>
          </dl>
        </section>

        <section className="reservation-card">
          <h2>상품 예약</h2>
          <div className="stock-summary">
            <span>전체 재고 <strong>{inventory.totalStock}</strong></span>
            <span>예약 가능 재고 <strong>{inventory.reservableStock}</strong></span>
            <span>예약된 재고 <strong>{inventory.reservedStock}</strong></span>
          </div>
          <div className="quantity-control">
            <span>수량</span>
            <div>
              <button className="icon-button" onClick={decrease} type="button" aria-label="수량 감소"><Minus size={16} /></button>
              <strong>{quantity}</strong>
              <button className="icon-button" onClick={increase} type="button" aria-label="수량 증가"><Plus size={16} /></button>
            </div>
          </div>
          <label>
            방문 예정 시간
            <input type="datetime-local" />
          </label>
          <label>
            요청사항
            <textarea placeholder="매장에 전달할 요청사항" />
          </label>
          <button className="primary-button" onClick={() => setIsReserved(true)} type="button">예약하기</button>
          {isReserved && (
            <div className="success-message">
              예약 요청이 완료되었습니다. 예약 후 예약 가능 재고는 {remainingAfterReservation}개로 표시됩니다.
            </div>
          )}
          <p className="helper-text">예약 취소는 방문 예정 시간 전까지 가능합니다.</p>
        </section>
      </main>
    </div>
  );
}

export default ReservationPage;
