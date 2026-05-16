import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, CheckCircle2, ImagePlus, Save } from "lucide-react";
import { SellerHeader } from "../components/AppHeader.jsx";

const initialForm = {
  name: "",
  category: "디저트",
  description: "",
  price: "",
  totalStock: 0,
  reservableStock: 0,
  lowStockThreshold: 5,
};

function ProductFormPage() {
  const [form, setForm] = useState(initialForm);
  const [previewUrl, setPreviewUrl] = useState("");
  const [imageFileName, setImageFileName] = useState("");
  const [formError, setFormError] = useState("");
  const [submitResult, setSubmitResult] = useState(null);
  const reservedStock = 0;

  const totalStock = Number(form.totalStock) || 0;
  const reservableStock = Number(form.reservableStock) || 0;
  const price = Number(form.price) || 0;
  const maxReservable = useMemo(() => Math.max(totalStock - reservedStock, 0), [totalStock]);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFormError("");
    setSubmitResult(null);
  };

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setPreviewUrl(URL.createObjectURL(file));
    setImageFileName(file.name);
    setSubmitResult(null);
  };

  const handleTotalStockChange = (value) => {
    const nextTotal = Math.max(Number(value) || 0, 0);
    setForm((current) => ({
      ...current,
      totalStock: nextTotal,
      reservableStock: Math.min(Number(current.reservableStock) || 0, nextTotal),
    }));
    setFormError("");
    setSubmitResult(null);
  };

  const handleReservableStockChange = (value) => {
    const nextReservable = Math.max(Number(value) || 0, 0);
    setForm((current) => ({ ...current, reservableStock: Math.min(nextReservable, maxReservable) }));
    setFormError("");
    setSubmitResult(null);
  };

  const validateForm = () => {
    if (!form.name.trim()) return "상품명을 입력해주세요.";
    if (!form.category) return "카테고리를 선택해주세요.";
    if (price < 0) return "판매 가격은 0원 이상이어야 합니다.";
    if (totalStock < 0) return "전체 재고는 0개 이상이어야 합니다.";
    if (reservableStock < 0) return "예약 가능 재고는 0개 이상이어야 합니다.";
    if (reservableStock > maxReservable) return `예약 가능 재고는 최대 ${maxReservable}개까지 설정할 수 있습니다.`;
    if ((Number(form.lowStockThreshold) || 0) < 0) return "재고 부족 알림 기준은 0개 이상이어야 합니다.";
    return "";
  };

  const createMockProduct = () => ({
    productId: `P-${Date.now().toString().slice(-6)}`,
    name: form.name.trim(),
    category: form.category,
    price,
    imageUrl: imageFileName ? `/uploads/products/${imageFileName}` : "대표 이미지 없음",
    totalStock,
    reservableStock,
    reservedStock,
  });

  const handleSubmit = () => {
    const error = validateForm();
    if (error) {
      setFormError(error);
      return;
    }

    setFormError("");
    setSubmitResult(createMockProduct());
  };

  const resetForm = () => {
    setForm(initialForm);
    setPreviewUrl("");
    setImageFileName("");
    setFormError("");
    setSubmitResult(null);
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
          <div className="section-heading-row product-form-heading">
            <div>
              <p className="eyebrow">판매 상품</p>
              <h1>상품 등록</h1>
            </div>
            <span className="inline-feedback">대표 이미지 1개 · image_url 저장</span>
          </div>

          <section className="form-grid">
            <div className="form-card">
              <label>상품명<input value={form.name} onChange={(event) => updateField("name", event.target.value)} placeholder="예: 버터떡" /></label>
              <label>카테고리<select value={form.category} onChange={(event) => updateField("category", event.target.value)}><option>디저트</option><option>쿠키</option><option>음료</option></select></label>
              <label>상품 설명<textarea value={form.description} onChange={(event) => updateField("description", event.target.value)} placeholder="상품 설명 입력" /></label>
              <label>
                상품 이미지
                <input type="file" accept="image/*" onChange={handleImageChange} />
              </label>
              <div className="image-preview">
                {previewUrl ? <img src={previewUrl} alt="상품 대표 이미지 미리보기" /> : <><ImagePlus size={28} /><span>대표 이미지 미리보기</span></>}
              </div>
              {imageFileName && <p className="helper-text">선택된 이미지: {imageFileName}</p>}
              <label>판매 가격<input type="number" min="0" value={form.price} onChange={(event) => updateField("price", event.target.value)} placeholder="0" /></label>
            </div>
            <div className="form-card">
              <h2>재고 설정</h2>
              <label>전체 재고<input type="number" min="0" value={form.totalStock} onChange={(event) => handleTotalStockChange(event.target.value)} /></label>
              <label>예약 가능 재고<input type="number" min="0" max={maxReservable} value={form.reservableStock} onChange={(event) => handleReservableStockChange(event.target.value)} /></label>
              <label>예약된 재고<input type="number" value={reservedStock} readOnly /></label>
              <label>재고 부족 알림<input type="number" min="0" value={form.lowStockThreshold} onChange={(event) => updateField("lowStockThreshold", Math.max(Number(event.target.value) || 0, 0))} /></label>
              <div className="stock-rule-box">
                <strong>재고 규칙</strong>
                <span>예약 가능 재고는 최대 {maxReservable}개까지 설정할 수 있습니다.</span>
                <span>신규 상품의 예약된 재고는 0개로 시작합니다.</span>
              </div>
              <p className="helper-text">대표 이미지는 파일 업로드 후 서버 경로를 `products.image_url`에 저장하는 방식으로 연결합니다.</p>
              {formError && <div className="error-message"><AlertCircle size={18} /> {formError}</div>}
              <button className="primary-button" onClick={handleSubmit} type="button"><Save size={18} /> 저장</button>
            </div>
          </section>

          {submitResult && (
            <section className="submit-summary-card">
              <div className="success-message"><CheckCircle2 size={18} /> 상품 등록 정보가 준비되었습니다.</div>
              <dl className="info-list compact">
                <div><dt>상품번호</dt><dd>{submitResult.productId}</dd></div>
                <div><dt>상품명</dt><dd>{submitResult.name}</dd></div>
                <div><dt>카테고리</dt><dd>{submitResult.category}</dd></div>
                <div><dt>판매 가격</dt><dd>{submitResult.price.toLocaleString()}원</dd></div>
                <div><dt>대표 이미지 URL</dt><dd>{submitResult.imageUrl}</dd></div>
                <div><dt>전체 재고</dt><dd>{submitResult.totalStock}개</dd></div>
                <div><dt>예약 가능 재고</dt><dd>{submitResult.reservableStock}개</dd></div>
                <div><dt>예약된 재고</dt><dd>{submitResult.reservedStock}개</dd></div>
              </dl>
              <div className="result-actions">
                <Link className="primary-button" to="/seller">판매자 메인으로 돌아가기</Link>
                <button className="ghost-button" onClick={resetForm} type="button">새 상품 계속 등록</button>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

export default ProductFormPage;
