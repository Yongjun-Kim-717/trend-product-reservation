import { Link, useSearchParams } from "react-router-dom";
import { AlertCircle, CheckCircle2, Minus, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { ConsumerHeader } from "../components/AppHeader.jsx";
import { getInventory, getProduct, getStore } from "../data/mockData.js";

function toDateTimeLocalValue(date) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 16);
}

function ReservationPage() {
  const [searchParams] = useSearchParams();
  const requestedStoreId = searchParams.get("storeId");
  const requestedProductId = searchParams.get("productId");
  const store = getStore(requestedStoreId) ?? getStore(1);
  const product = getProduct(requestedProductId) ?? getProduct(1);
  const inventory = getInventory(store.id, product.id) ?? store.inventories[0];
  const hasInvalidParams = !getStore(requestedStoreId) || !getProduct(requestedProductId) || !getInventory(store.id, product.id);
  const minVisitTime = useMemo(() => toDateTimeLocalValue(new Date(Date.now() + 30 * 60 * 1000)), []);

  const [quantity, setQuantity] = useState(inventory.reservableStock > 0 ? 1 : 0);
  const [visitTime, setVisitTime] = useState("");
  const [requestNote, setRequestNote] = useState("");
  const [formError, setFormError] = useState("");
  const [reservationResult, setReservationResult] = useState(null);

  const isSoldOut = inventory.reservableStock <= 0;
  const remainingAfterReservation = Math.max(inventory.reservableStock - quantity, 0);

  const increase = () => setQuantity((current) => Math.min(current + 1, inventory.reservableStock));
  const decrease = () => setQuantity((current) => Math.max(current - 1, isSoldOut ? 0 : 1));

  const handleQuantityInput = (value) => {
    const nextQuantity = Number(value);
    if (!Number.isFinite(nextQuantity)) return;
    setQuantity(Math.min(Math.max(nextQuantity, isSoldOut ? 0 : 1), inventory.reservableStock));
  };

  const createMockReservation = () => ({
    reservationId: `R-${Date.now().toString().slice(-6)}`,
    storeName: store.name,
    productName: product.name,
    quantity,
    visitTime,
    remainingStock: remainingAfterReservation,
    status: "예약 요청 완료",
  });

  const handleSubmit = () => {
    setFormError("");

    if (isSoldOut) {
      setFormError("현재 예약 가능한 재고가 없습니다.");
      return;
    }

    if (quantity < 1 || quantity > inventory.reservableStock) {
      setFormError(`예약 수량은 1개 이상 ${inventory.reservableStock}개 이하로 선택해야 합니다.`);
      return;
    }

    if (!visitTime) {
      setFormError("방문 예정 시간을 선택해주세요.");
      return;
    }

    if (visitTime < minVisitTime) {
      setFormError("방문 예정 시간은 현재 시각보다 최소 30분 이후로 선택해주세요.");
      return;
    }

    setReservationResult(createMockReservation());
  };

  return (
    <div className="page-shell">
      <ConsumerHeader />
      <main className="detail-layout">
        <section className="product-detail-card">
          <Link className="text-link fit" to="/consumer">뒤로가기</Link>
          {hasInvalidParams && (
            <div className="warning-message">
              <AlertCircle size={18} /> 요청한 상품 또는 매장을 찾지 못해 기본 예약 정보로 표시합니다.
            </div>
          )}
          <div className="product-image-placeholder">{product.name}</div>
          <div>
            <p className="eyebrow">{product.category}</p>
            <h1>{product.name}</h1>
            <p>{product.description}</p>
          </div>
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
              <button className="icon-button" onClick={decrease} type="button" aria-label="수량 감소" disabled={quantity <= 1 || isSoldOut}><Minus size={16} /></button>
              <input className="quantity-input" type="number" min={isSoldOut ? 0 : 1} max={inventory.reservableStock} value={quantity} onChange={(event) => handleQuantityInput(event.target.value)} disabled={isSoldOut} />
              <button className="icon-button" onClick={increase} type="button" aria-label="수량 증가" disabled={quantity >= inventory.reservableStock || isSoldOut}><Plus size={16} /></button>
            </div>
          </div>

          <label>
            방문 예정 시간
            <input type="datetime-local" min={minVisitTime} value={visitTime} onChange={(event) => setVisitTime(event.target.value)} />
          </label>
          <label>
            요청사항
            <textarea value={requestNote} onChange={(event) => setRequestNote(event.target.value)} placeholder="매장에 전달할 요청사항" />
          </label>

          {formError && <div className="error-message"><AlertCircle size={18} /> {formError}</div>}
          <button className="primary-button" onClick={handleSubmit} type="button" disabled={isSoldOut}>예약하기</button>
          <p className="helper-text">예약 취소는 방문 예정 시간 전까지 가능합니다.</p>

          {reservationResult && (
            <div className="reservation-result">
              <div className="success-message">
                <CheckCircle2 size={18} /> {reservationResult.status}
              </div>
              <dl className="info-list compact">
                <div><dt>예약번호</dt><dd>{reservationResult.reservationId}</dd></div>
                <div><dt>상품</dt><dd>{reservationResult.productName}</dd></div>
                <div><dt>매장</dt><dd>{reservationResult.storeName}</dd></div>
                <div><dt>수량</dt><dd>{reservationResult.quantity}개</dd></div>
                <div><dt>방문 예정</dt><dd>{reservationResult.visitTime.replace("T", " ")}</dd></div>
                <div><dt>예약 후 가능 재고</dt><dd>{reservationResult.remainingStock}개</dd></div>
              </dl>
              <div className="result-actions">
                <Link className="ghost-button" to="/consumer">계속 둘러보기</Link>
                <button className="ghost-button" type="button">내 예약 보기</button>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default ReservationPage;
