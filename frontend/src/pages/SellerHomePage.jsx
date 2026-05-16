import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, PackagePlus } from "lucide-react";
import { SellerHeader } from "../components/AppHeader.jsx";
import { sellerProducts, sellerReservations } from "../data/mockData.js";

function SellerHomePage() {
  const [products, setProducts] = useState(sellerProducts);

  const updateReservableStock = (productId, value) => {
    const nextValue = Math.max(Number(value) || 0, 0);
    setProducts((currentProducts) =>
      currentProducts.map((product) =>
        product.id === productId
          ? { ...product, reservable: Math.min(nextValue, product.total - product.reserved) }
          : product
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
            <article><span>등록 상품</span><strong>{products.length}</strong></article>
            <article><span>예약 가능 재고</span><strong>{products.reduce((sum, product) => sum + product.reservable, 0)}</strong></article>
            <article><span>오늘 예약</span><strong>{sellerReservations.length}</strong></article>
            <article><span>수령 대기</span><strong>1</strong></article>
          </section>

          <section className="table-section">
            <h2>등록된 상품 및 재고</h2>
            <table>
              <thead>
                <tr><th>상품</th><th>카테고리</th><th>현재 재고</th><th>예약 가능 재고</th><th>예약된 재고</th><th>상태</th></tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id}>
                    <td>{product.name}</td>
                    <td>{product.category}</td>
                    <td>{product.total}</td>
                    <td><input className="table-input" type="number" value={product.reservable} onChange={(event) => updateReservableStock(product.id, event.target.value)} /></td>
                    <td>{product.reserved}</td>
                    <td><span className={`status-chip ${product.status === "재고부족" ? "warning" : ""}`}>{product.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="queue-section">
            <h2>예약 관리</h2>
            {sellerReservations.map((reservation) => (
              <article className="queue-card" key={reservation.id}>
                <span>{reservation.product} · {reservation.customer} · {reservation.quantity}개 · {reservation.visitTime}</span>
                <div><button className="ghost-button">예약 승인</button><button className="ghost-button"><Check size={16} /> 수령 완료</button></div>
              </article>
            ))}
          </section>
        </main>
      </div>
    </div>
  );
}

export default SellerHomePage;
