const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api";

function App() {
  return (
    <main className="app-shell">
      <section className="toolbar">
        <div>
          <p className="eyebrow">Trend Product Reservation</p>
          <h1>유행 상품 재고 예약 플랫폼</h1>
        </div>
        <span className="api-pill">API {API_BASE_URL}</span>
      </section>

      <section className="grid">
        <article>
          <h2>상품 검색</h2>
          <p>유행 상품 키워드를 검색하고 주변 취급 매장을 확인합니다.</p>
        </article>
        <article>
          <h2>매장 지도</h2>
          <p>Kakao Map API를 연동해 매장 위치와 상세 정보를 표시합니다.</p>
        </article>
        <article>
          <h2>재고 예약</h2>
          <p>예약 가능 재고를 기준으로 트랜잭션 예약을 처리합니다.</p>
        </article>
      </section>
    </main>
  );
}

export default App;
