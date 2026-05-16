import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Check, PackagePlus, X } from "lucide-react";
import { SellerHeader } from "../components/AppHeader.jsx";
import { sellerProducts, sellerReservations } from "../data/mockData.js";

const reservationStatus = {
  PENDING: { label: "승인 대기", className: "warning" },
  APPROVED: { label: "수령 대기", className: "info" },
  PICKED_UP: { label: "수령 완료", className: "success" },
  CANCELED: { label: "취소됨", className: "danger" },
};

function SellerHomePage() {
  const [products, setProducts] = useState(sellerProducts);
  const [reservations, setReservations] = useState(sellerReservations);
  const [inventoryMessage, setInventoryMessage] = useState("");

  const metrics = useMemo(() => {
    const pendingCount = reservations.filter((reservation) => reservation.status === "PENDING").length;
    const approvedCount = reservations.filter((reservation) => reservation.status === "APPROVED").length;

    return {
      productCount: products.length,
      reservableStock: products.reduce((sum, product) => sum + product.reservable, 0),
      todayReservations: reservations.length,
      waitingPickup: approvedCount,
      pendingCount,
    };
  }, [products, reservations]);

  const updateReservableStock = (productId, value) => {
    const nextValue = Math.max(Number(value) || 0, 0);

    setProducts((currentProducts) =>
      currentProducts.map((product) => {
        if (product.id !== productId) return product;

        const maxReservable = Math.max(product.total - product.reserved, 0);
        const nextReservable = Math.min(nextValue, maxReservable);

        if (nextValue > maxReservable) {
          setInventoryMessage(`${product.name}의 예약 가능 재고는 최대 ${maxReservable}개까지 설정할 수 있습니다.`);
        } else {
          setInventoryMessage(`${product.name} 예약 가능 재고를 ${nextReservable}개로 수정했습니다.`);
        }

        return {
          ...product,
          reservable: nextReservable,
          status: nextReservable <= 3 ? "재고부족" : "판매중",
        };
      })
    );
  };

  const updateReservationStatus = (reservationId, status) => {
    setReservations((currentReservations) =>
      currentReservations.map((reservation) =>
        reservation.id === reservationId ? { ...reservation, status } : reservation
      )
    );
  };

  return (
    <div className="page-shell dashboard-shell">
      <SellerHeader />
      <div className="management-layout">
        <aside className="side-nav">
          <strong>가게 관리</strong>
          <a>가게 정보</a>
          <a>등록된 상품</a>
          <a>재고 관리</a>
          <a>예약 관리</a>
        </aside>

        <main className="management-main">
          <section className="store-overview">
            <div>
              <p className="eyebrow">판매자</p>
              <h1>성수 디저트랩</h1>
              <p>서울 성동구 성수이로 10 · 영업시간 10:00 - 21:00</p>
            </div>
            <Link className="primary-button" to="/seller/products/new"><PackagePlus size={18} /> 상품 등록</Link>
          </section>

          <section className="metric-grid">
            <article><span>등록 상품</span><strong>{metrics.productCount}</strong></article>
            <article><span>예약 가능 재고</span><strong>{metrics.reservableStock}</strong></article>
            <article><span>오늘 예약</span><strong>{metrics.todayReservations}</strong></article>
            <article><span>수령 대기</span><strong>{metrics.waitingPickup}</strong></article>
          </section>

          <section className="table-section">
            <div className="section-heading-row">
              <h2>등록된 상품 및 재고</h2>
              {inventoryMessage && <span className="inline-feedback">{inventoryMessage}</span>}
            </div>
            <table>
              <thead>
                <tr><th>상품</th><th>카테고리</th><th>현재 재고</th><th>예약 가능 재고</th><th>예약된 재고</th><th>최대 예약 가능</th><th>상태</th></tr>
              </thead>
              <tbody>
                {products.map((product) => {
                  const maxReservable = Math.max(product.total - product.reserved, 0);
                  return (
                    <tr key={product.id}>
                      <td>{product.name}</td>
                      <td>{product.category}</td>
                      <td>{product.total}</td>
                      <td>
                        <input
                          className="table-input"
                          type="number"
                          min="0"
                          max={maxReservable}
                          value={product.reservable}
                          onChange={(event) => updateReservableStock(product.id, event.target.value)}
                        />
                      </td>
                      <td>{product.reserved}</td>
                      <td>{maxReservable}</td>
                      <td><span className={`status-chip ${product.status === "재고부족" ? "warning" : "success"}`}>{product.status}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <section className="queue-section">
            <div className="section-heading-row">
              <h2>예약 관리</h2>
              <span className="inline-feedback">승인 대기 {metrics.pendingCount}건</span>
            </div>
            <div className="reservation-list">
              {reservations.map((reservation) => {
                const status = reservationStatus[reservation.status];
                const canApprove = reservation.status === "PENDING";
                const canPickup = reservation.status === "APPROVED";
                const canCancel = reservation.status === "PENDING" || reservation.status === "APPROVED";

                return (
                  <article className="reservation-card-row" key={reservation.id}>
                    <div className="reservation-main-info">
                      <strong>{reservation.product}</strong>
                      <span>{reservation.customer} · {reservation.quantity}개 · {reservation.visitTime}</span>
                    </div>
                    <span className={`status-chip ${status.className}`}>{status.label}</span>
                    <div className="seller-action-row">
                      <button className="ghost-button" disabled={!canApprove} onClick={() => updateReservationStatus(reservation.id, "APPROVED")} type="button">
                        예약 승인
                      </button>
                      <button className="ghost-button" disabled={!canPickup} onClick={() => updateReservationStatus(reservation.id, "PICKED_UP")} type="button">
                        <Check size={16} /> 수령 완료
                      </button>
                      <button className="danger-button" disabled={!canCancel} onClick={() => updateReservationStatus(reservation.id, "CANCELED")} type="button">
                        <X size={16} /> 예약 취소
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

export default SellerHomePage;
