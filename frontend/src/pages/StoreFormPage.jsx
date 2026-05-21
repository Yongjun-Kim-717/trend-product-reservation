import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, CheckCircle2, Save } from "lucide-react";
import { SellerHeader } from "../components/AppHeader.jsx";
import { createSellerStore, getSellerStores, updateSellerStore } from "../api/client.js";
import { getCurrentUser } from "../auth/session.js";

const initialForm = {
  name: "",
  address: "",
  phone: "",
  openingHours: "",
};

function StoreFormPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedStoreId = searchParams.get("storeId");
  const [currentUser] = useState(() => getCurrentUser());
  const [form, setForm] = useState(initialForm);
  const [isLoading, setIsLoading] = useState(Boolean(requestedStoreId));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [submitResult, setSubmitResult] = useState(null);

  const isEditMode = Boolean(requestedStoreId);

  useEffect(() => {
    if (!currentUser || currentUser.role !== "SELLER") {
      navigate("/login", { replace: true });
      return undefined;
    }

    if (!requestedStoreId) return undefined;

    let cancelled = false;

    async function loadStore() {
      setIsLoading(true);
      setFormError("");

      try {
        const stores = await getSellerStores(currentUser.user_id);
        const targetStore = stores.find((store) => String(store.store_id) === String(requestedStoreId));

        if (!targetStore) {
          throw new Error("수정할 매장을 찾지 못했습니다.");
        }

        if (!cancelled) {
          setForm({
            name: targetStore.name ?? "",
            address: targetStore.address ?? "",
            phone: targetStore.phone ?? "",
            openingHours: targetStore.opening_hours ?? "",
          });
        }
      } catch (error) {
        if (!cancelled) {
          setFormError(error.message);
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
  }, [currentUser, navigate, requestedStoreId]);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFormError("");
    setSubmitResult(null);
  };

  const validateForm = () => {
    if (!form.name.trim()) return "매장명을 입력해주세요.";
    if (!form.address.trim()) return "주소를 입력해주세요.";
    if (form.name.trim().length > 100) return "매장명은 100자 이하여야 합니다.";
    if (form.address.trim().length > 255) return "주소는 255자 이하여야 합니다.";
    if (form.phone.trim().length > 30) return "연락처는 30자 이하여야 합니다.";
    if (form.openingHours.trim().length > 100) return "영업시간은 100자 이하여야 합니다.";
    return "";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validationMessage = validateForm();

    if (validationMessage) {
      setFormError(validationMessage);
      return;
    }

    setIsSubmitting(true);
    setFormError("");
    setSubmitResult(null);

    try {
      const payload = {
        seller_id: currentUser.user_id,
        name: form.name.trim(),
        address: form.address.trim(),
        phone: form.phone.trim(),
        opening_hours: form.openingHours.trim(),
      };
      const result = isEditMode
        ? await updateSellerStore(requestedStoreId, payload)
        : await createSellerStore(payload);

      setSubmitResult(result);
    } catch (error) {
      setFormError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-shell dashboard-shell">
      <SellerHeader />
      <div className="management-layout">
        <aside className="side-nav">
          <strong>가게 관리</strong>
          <Link to="/seller">가게 목록</Link>
          <Link to="/seller/stores/new">가게 등록</Link>
          <Link to="/seller/products/new">상품 등록</Link>
        </aside>

        <main className="form-page">
          <Link className="text-link fit" to="/seller">뒤로가기</Link>
          <div className="section-heading-row product-form-heading">
            <div>
              <p className="eyebrow">판매자 매장</p>
              <h1>{isEditMode ? "가게 정보 수정" : "가게 등록"}</h1>
            </div>
            <span className="inline-feedback">주소 기반 좌표 자동 조회</span>
          </div>

          {isLoading && <div className="warning-message">매장 정보를 불러오는 중입니다.</div>}

          <form className="form-grid single-form-grid" onSubmit={handleSubmit}>
            <section className="form-card">
              <label>
                매장명
                <input value={form.name} onChange={(event) => updateField("name", event.target.value)} placeholder="예: 부평 버터떡 팝업스토어" />
              </label>
              <label>
                주소
                <input value={form.address} onChange={(event) => updateField("address", event.target.value)} placeholder="예: 인천 부평구 부평대로 1" />
              </label>
              <label>
                매장 연락처
                <input value={form.phone} onChange={(event) => updateField("phone", event.target.value)} placeholder="032-000-0000" />
              </label>
              <label>
                영업시간
                <input value={form.openingHours} onChange={(event) => updateField("openingHours", event.target.value)} placeholder="예: 10:00-20:00" />
              </label>

              <div className="stock-rule-box">
                <strong>등록 정책</strong>
                <span>판매자 한 명은 여러 매장을 등록할 수 있습니다.</span>
                <span>새 매장은 관리자 승인 전까지 소비자 검색 결과에 노출되지 않습니다.</span>
                <span>좌표는 카카오 Local REST API로 주소를 변환해 저장합니다.</span>
              </div>

              {formError && <div className="error-message"><AlertCircle size={18} /> {formError}</div>}
              <button className="primary-button" disabled={isSubmitting || isLoading} type="submit">
                <Save size={18} /> {isSubmitting ? "저장 중" : "저장"}
              </button>
            </section>
          </form>

          {submitResult && (
            <section className="submit-summary-card">
              <div className="success-message"><CheckCircle2 size={18} /> 매장 정보가 저장되었습니다.</div>
              <dl className="info-list compact">
                <div><dt>매장번호</dt><dd>{submitResult.store_id}</dd></div>
                <div><dt>매장명</dt><dd>{submitResult.name}</dd></div>
                <div><dt>주소</dt><dd>{submitResult.address}</dd></div>
                <div><dt>위도</dt><dd>{submitResult.latitude}</dd></div>
                <div><dt>경도</dt><dd>{submitResult.longitude}</dd></div>
                <div><dt>승인 상태</dt><dd>{submitResult.approval_status}</dd></div>
              </dl>
              <div className="result-actions">
                <Link className="primary-button" to="/seller">판매자 메인으로 돌아가기</Link>
                {!isEditMode && <button className="ghost-button" onClick={() => setForm(initialForm)} type="button">새 매장 계속 등록</button>}
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

export default StoreFormPage;
