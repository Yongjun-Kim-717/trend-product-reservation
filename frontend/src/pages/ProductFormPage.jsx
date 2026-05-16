import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ImagePlus, Save } from "lucide-react";
import { SellerHeader } from "../components/AppHeader.jsx";

function ProductFormPage() {
  const [previewUrl, setPreviewUrl] = useState("");
  const [totalStock, setTotalStock] = useState(0);
  const [reservableStock, setReservableStock] = useState(0);
  const reservedStock = 0;

  const maxReservable = useMemo(() => Math.max(totalStock - reservedStock, 0), [totalStock]);

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleTotalStockChange = (value) => {
    const nextTotal = Math.max(Number(value) || 0, 0);
    setTotalStock(nextTotal);
    setReservableStock((current) => Math.min(current, nextTotal));
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

        <main className="form-page">
          <Link className="text-link fit" to="/seller">뒤로가기</Link>
          <h1>상품 등록</h1>
          <section className="form-grid">
            <div className="form-card">
              <label>상품명<input placeholder="예: 버터떡" /></label>
              <label>카테고리<select><option>디저트</option><option>쿠키</option><option>음료</option></select></label>
              <label>상품 설명<textarea placeholder="상품 설명 입력" /></label>
              <label>
                상품 이미지
                <input type="file" accept="image/*" onChange={handleImageChange} />
              </label>
              <div className="image-preview">
                {previewUrl ? <img src={previewUrl} alt="상품 대표 이미지 미리보기" /> : <><ImagePlus size={28} /><span>대표 이미지 미리보기</span></>}
              </div>
              <label>판매 가격<input type="number" placeholder="0" /></label>
            </div>
            <div className="form-card">
              <h2>재고 설정</h2>
              <label>전체 재고<input type="number" value={totalStock} onChange={(event) => handleTotalStockChange(event.target.value)} /></label>
              <label>예약 가능 재고<input type="number" value={reservableStock} max={maxReservable} onChange={(event) => setReservableStock(Math.min(Number(event.target.value) || 0, maxReservable))} /></label>
              <label>예약된 재고<input type="number" value={reservedStock} readOnly /></label>
              <label>재고 부족 알림<input type="number" defaultValue="5" /></label>
              <p className="helper-text">대표 이미지는 파일 업로드 후 서버 경로를 `products.image_url`에 저장하는 방식으로 연결합니다.</p>
              <button className="primary-button"><Save size={18} /> 저장</button>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

export default ProductFormPage;
