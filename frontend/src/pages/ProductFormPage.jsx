import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, CheckCircle2, ImagePlus, Save } from "lucide-react";
import { SellerHeader } from "../components/AppHeader.jsx";
import {
  createSellerProduct,
  getProductCategories,
  getSellerInventories,
  getSellerStores,
  updateSellerProduct,
  uploadProductImage,
} from "../api/client.js";
import { getCurrentUser } from "../auth/session.js";

const initialForm = {
  name: "",
  categoryId: "",
  description: "",
  price: "",
  totalStock: 0,
  reservableStock: 0,
};

function resolveImageSrc(imageUrl) {
  if (!imageUrl) return "";
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api";
  const assetBaseUrl = apiBaseUrl.replace(/\/api\/?$/, "");
  return `${assetBaseUrl}${imageUrl.startsWith("/") ? imageUrl : `/${imageUrl}`}`;
}

function ProductFormPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedStoreId = searchParams.get("storeId");
  const requestedProductId = searchParams.get("productId");
  const requestedInventoryId = searchParams.get("inventoryId");
  const isEditMode = Boolean(requestedProductId || requestedInventoryId);

  const [currentUser] = useState(() => getCurrentUser());
  const [stores, setStores] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedStoreId, setSelectedStoreId] = useState(requestedStoreId ?? "");
  const [targetInventory, setTargetInventory] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [previewUrl, setPreviewUrl] = useState("");
  const [imageFileName, setImageFileName] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [existingImageUrl, setExistingImageUrl] = useState("");
  const [formError, setFormError] = useState("");
  const [submitResult, setSubmitResult] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalStock = Number(form.totalStock) || 0;
  const reservableStock = Number(form.reservableStock) || 0;
  const price = Number(form.price) || 0;
  const selectedStore = stores.find((store) => String(store.store_id) === String(selectedStoreId));
  const reservedStock = Number(targetInventory?.reserved_stock ?? 0);
  const maxReservable = useMemo(() => Math.max(totalStock - reservedStock, 0), [reservedStock, totalStock]);
  const displayImageUrl = previewUrl || resolveImageSrc(existingImageUrl);

  useEffect(() => {
    if (!currentUser || currentUser.role !== "SELLER") {
      navigate("/login", { replace: true });
      return undefined;
    }

    let cancelled = false;

    async function loadFormData() {
      setIsLoading(true);
      setFormError("");

      try {
        const [storeRows, categoryRows] = await Promise.all([
          getSellerStores(currentUser.user_id),
          getProductCategories(),
        ]);

        if (cancelled) return;

        const nextStoreId = requestedStoreId && storeRows.some((store) => String(store.store_id) === String(requestedStoreId))
          ? requestedStoreId
          : storeRows[0]?.store_id || "";

        setStores(storeRows);
        setCategories(categoryRows);
        setSelectedStoreId(nextStoreId);

        if (isEditMode && nextStoreId) {
          const inventoryRows = await getSellerInventories(nextStoreId, currentUser.user_id);
          if (cancelled) return;
          const target = inventoryRows.find((item) =>
            String(item.inventory_id) === String(requestedInventoryId)
            || String(item.product_id) === String(requestedProductId)
          );

          if (!target) {
            setFormError("수정할 상품을 찾지 못했습니다.");
          } else {
            setTargetInventory(target);
            setExistingImageUrl(target.image_url ?? "");
            setForm({
              name: target.product_name ?? "",
              categoryId: target.category_id || categoryRows.find((category) => category.name === target.category_name)?.category_id || "",
              description: target.description ?? "",
              price: target.price ?? "",
              totalStock: target.total_stock ?? 0,
              reservableStock: target.reservable_stock ?? 0,
            });
          }
        } else {
          setForm((current) => ({
            ...current,
            categoryId: current.categoryId || categoryRows[0]?.category_id || "",
          }));
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

    loadFormData();

    return () => {
      cancelled = true;
    };
  }, [currentUser, isEditMode, navigate, requestedInventoryId, requestedProductId, requestedStoreId]);

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
    const reader = new FileReader();
    reader.onload = () => setImageDataUrl(String(reader.result ?? ""));
    reader.readAsDataURL(file);
    setSubmitResult(null);
  };

  const handleTotalStockChange = (value) => {
    const nextTotal = Math.max(Number(value) || 0, 0);
    setForm((current) => ({
      ...current,
      totalStock: nextTotal,
      reservableStock: Math.min(Number(current.reservableStock) || 0, Math.max(nextTotal - reservedStock, 0)),
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
    if (!selectedStoreId) return "상품을 등록할 가게를 선택해주세요.";
    if (!form.name.trim()) return "상품명을 입력해주세요.";
    if (!form.categoryId) return "카테고리를 선택해주세요.";
    if (price < 0) return "판매 가격은 0원 이상이어야 합니다.";
    if (totalStock < reservedStock) return `전체 재고는 이미 예약된 재고 ${reservedStock}개보다 작을 수 없습니다.`;
    if (reservableStock < 0) return "예약 가능 재고는 0개 이상이어야 합니다.";
    if (reservableStock > maxReservable) return `예약 가능 재고는 최대 ${maxReservable}개까지 설정할 수 있습니다.`;
    return "";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const error = validateForm();
    if (error) {
      setFormError(error);
      return;
    }

    setIsSubmitting(true);
    setFormError("");
    setSubmitResult(null);

    try {
      const uploadedImage = imageDataUrl
        ? await uploadProductImage({
          file_name: imageFileName,
          data_url: imageDataUrl,
        })
        : null;

      const payload = {
        seller_id: currentUser.user_id,
        name: form.name.trim(),
        category_id: Number(form.categoryId),
        description: form.description.trim(),
        price,
        image_url: uploadedImage?.image_url ?? existingImageUrl,
        total_stock: totalStock,
        reservable_stock: reservableStock,
      };

      const result = isEditMode && targetInventory
        ? await updateSellerProduct(selectedStoreId, targetInventory.product_id, payload)
        : await createSellerProduct(selectedStoreId, payload);

      setSubmitResult(result);
      setExistingImageUrl(result.image_url ?? "");
      setPreviewUrl("");
      setImageDataUrl("");
      setImageFileName("");
      if (isEditMode) {
        setTargetInventory((current) => current ? { ...current, ...result } : current);
      }
    } catch (submitError) {
      setFormError(submitError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setForm({
      ...initialForm,
      categoryId: categories[0]?.category_id || "",
    });
    setPreviewUrl("");
    setImageFileName("");
    setImageDataUrl("");
    setExistingImageUrl("");
    setFormError("");
    setSubmitResult(null);
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
              <p className="eyebrow">판매 상품</p>
              <h1>{isEditMode ? "상품 수정" : "상품 등록"}</h1>
            </div>
            <span className="inline-feedback">{isEditMode ? "products + inventories 수정" : "products + inventories 저장"}</span>
          </div>

          {isLoading && <div className="warning-message">상품 정보를 불러오는 중입니다.</div>}

          <form className="form-grid" onSubmit={handleSubmit}>
            <div className="form-card">
              <label>
                가게
                <select value={selectedStoreId} onChange={(event) => setSelectedStoreId(event.target.value)} disabled={isEditMode}>
                  {stores.map((store) => (
                    <option key={store.store_id} value={store.store_id}>{store.name}</option>
                  ))}
                </select>
              </label>
              {selectedStore && <p className="helper-text">선택 가게: {selectedStore.address} · {selectedStore.approval_status}</p>}
              <label>
                상품명
                <input value={form.name} onChange={(event) => updateField("name", event.target.value)} placeholder="예: 버터떡" />
              </label>
              <label>
                카테고리
                <select value={form.categoryId} onChange={(event) => updateField("categoryId", event.target.value)}>
                  {categories.map((category) => (
                    <option key={category.category_id} value={category.category_id}>{category.name}</option>
                  ))}
                </select>
              </label>
              <label>
                상품 설명
                <textarea value={form.description} onChange={(event) => updateField("description", event.target.value)} placeholder="상품 설명 입력" />
              </label>
              <label>
                대표 이미지
                <input type="file" accept="image/*" onChange={handleImageChange} />
              </label>
              <div className="image-preview">
                {displayImageUrl ? <img src={displayImageUrl} alt="상품 대표 이미지 미리보기" /> : <><ImagePlus size={28} /><span>대표 이미지 미리보기</span></>}
              </div>
              {imageFileName && <p className="helper-text">선택한 이미지: {imageFileName}</p>}
              <label>
                판매 가격
                <input type="number" min="0" value={form.price} onChange={(event) => updateField("price", event.target.value)} placeholder="0" />
              </label>
            </div>
            <div className="form-card">
              <h2>재고 설정</h2>
              <label>
                전체 재고
                <input type="number" min={reservedStock} value={form.totalStock} onChange={(event) => handleTotalStockChange(event.target.value)} />
              </label>
              {isEditMode && <p className="helper-text">이미 예약된 재고: {reservedStock}개</p>}
              <label>
                예약 가능 재고
                <input type="number" min="0" max={maxReservable} value={form.reservableStock} onChange={(event) => handleReservableStockChange(event.target.value)} />
              </label>
              <div className="stock-rule-box">
                <strong>재고 규칙</strong>
                <span>예약 가능 재고는 전체 재고에서 예약된 재고를 뺀 값보다 클 수 없습니다.</span>
                <span>상품 이미지는 파일을 서버에 저장하고 DB에는 image_url만 저장합니다.</span>
              </div>
              <p className="helper-text">카테고리는 관리자/DB가 관리하는 활성 카테고리 목록에서 선택합니다.</p>
              {formError && <div className="error-message"><AlertCircle size={18} /> {formError}</div>}
              <button className="primary-button" disabled={isSubmitting || isLoading || stores.length === 0 || categories.length === 0} type="submit">
                <Save size={18} /> {isSubmitting ? "저장 중" : isEditMode ? "수정 저장" : "상품 등록"}
              </button>
            </div>
          </form>

          {submitResult && (
            <section className="submit-summary-card">
              <div className="success-message"><CheckCircle2 size={18} /> 상품 정보가 DB에 저장되었습니다.</div>
              <dl className="info-list compact">
                <div><dt>재고번호</dt><dd>{submitResult.inventory_id}</dd></div>
                <div><dt>상품번호</dt><dd>{submitResult.product_id}</dd></div>
                <div><dt>상품명</dt><dd>{submitResult.product_name}</dd></div>
                <div><dt>카테고리</dt><dd>{submitResult.category_name}</dd></div>
                <div><dt>판매 가격</dt><dd>{Number(submitResult.price ?? 0).toLocaleString()}원</dd></div>
                <div><dt>대표 이미지 URL</dt><dd>{submitResult.image_url ?? "없음"}</dd></div>
                <div><dt>전체 재고</dt><dd>{submitResult.total_stock}개</dd></div>
                <div><dt>예약 가능 재고</dt><dd>{submitResult.reservable_stock}개</dd></div>
              </dl>
              <div className="result-actions">
                <Link className="primary-button" to="/seller">판매자 메인으로 돌아가기</Link>
                {!isEditMode && <button className="ghost-button" onClick={resetForm} type="button">새 상품 계속 등록</button>}
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

export default ProductFormPage;
