import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, Check, PackagePlus, Pencil, Plus, Save, X } from "lucide-react";
import { SellerHeader } from "../components/AppHeader.jsx";
import {
  getSellerInventories,
  getSellerReservations,
  getSellerStores,
  updateSellerInventory,
  updateSellerReservationStatus,
} from "../api/client.js";
import { getCurrentUser } from "../auth/session.js";

const reservationStatus = {
  PENDING: { label: "승인 대기", className: "warning" },
  APPROVED: { label: "수령 대기", className: "info" },
  PICKED_UP: { label: "수령 완료", className: "success" },
  CANCELED: { label: "취소됨", className: "danger" },
};

function toInventoryModel(row) {
  return {
    id: row.inventory_id,
    storeId: row.store_id,
    productId: row.product_id,
    name: row.product_name,
    category: row.category_name ?? "기타",
    price: row.price ?? 0,
    imageUrl: row.image_url ?? "",
    total: row.total_stock,
    reservable: row.reservable_stock,
    reserved: row.reserved_stock,
    status: row.reservable_stock <= 3 ? "재고부족" : "판매중",
  };
}

function toReservationModel(row) {
  return {
    id: row.reservation_id,
    product: row.product_name,
    customer: row.customer_name ?? `사용자 ${row.user_id}`,
    quantity: row.quantity,
    visitTime: row.visit_time ? String(row.visit_time).replace("T", " ").slice(0, 16) : "방문 시간 미정",
    requestNote: row.request_note ?? "",
    createdAt: row.created_at ? String(row.created_at).replace("T", " ").slice(0, 16) : "",
    status: row.status,
  };
}

function SellerHomePage() {
  const navigate = useNavigate();
  const [currentUser] = useState(() => getCurrentUser());
  const [stores, setStores] = useState([]);
  const [selectedStoreId, setSelectedStoreId] = useState(null);
  const [products, setProducts] = useState([]);
  const [stockDrafts, setStockDrafts] = useState({});
  const [reservations, setReservations] = useState([]);
  const [inventoryMessage, setInventoryMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [updatingInventoryId, setUpdatingInventoryId] = useState(null);
  const [updatingReservationId, setUpdatingReservationId] = useState(null);

  const selectedStore = stores.find((store) => store.store_id === selectedStoreId) ?? stores[0];

  useEffect(() => {
    if (!currentUser || currentUser.role !== "SELLER") {
      navigate("/login", { replace: true });
      return undefined;
    }

    let cancelled = false;

    async function loadStores() {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const rows = await getSellerStores(currentUser.user_id);
        if (!cancelled) {
          setStores(rows);
          setSelectedStoreId(rows[0]?.store_id ?? null);
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

    loadStores();

    return () => {
      cancelled = true;
    };
  }, [currentUser, navigate]);

  useEffect(() => {
    if (!selectedStoreId || !currentUser) {
      setProducts([]);
      setStockDrafts({});
      setReservations([]);
      return undefined;
    }

    let cancelled = false;

    async function loadStoreData() {
      setIsLoading(true);
      setErrorMessage("");
      setInventoryMessage("");

      try {
        const [inventoryRows, reservationRows] = await Promise.all([
          getSellerInventories(selectedStoreId, currentUser.user_id),
          getSellerReservations(selectedStoreId, currentUser.user_id),
        ]);

        if (!cancelled) {
          const inventoryModels = inventoryRows.map(toInventoryModel);
          setProducts(inventoryModels);
          setStockDrafts(Object.fromEntries(inventoryModels.map((product) => [product.id, String(product.reservable)])));
          setReservations(reservationRows.map(toReservationModel));
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

    loadStoreData();

    return () => {
      cancelled = true;
    };
  }, [currentUser, selectedStoreId]);

  const metrics = useMemo(() => {
    const pendingCount = reservations.filter((reservation) => reservation.status === "PENDING").length;
    const approvedCount = reservations.filter((reservation) => reservation.status === "APPROVED").length;

    return {
      productCount: products.length,
      reservableStock: products.reduce((sum, product) => sum + product.reservable, 0),
      reservationCount: reservations.length,
      waitingPickup: approvedCount,
      pendingCount,
    };
  }, [products, reservations]);

  const updateStockDraft = (productId, value) => {
    setStockDrafts((current) => ({ ...current, [productId]: value }));
    setInventoryMessage("");
  };

  const confirmReservableStock = async (productId) => {
    const targetProduct = products.find((product) => product.id === productId);
    if (!targetProduct || updatingInventoryId || !currentUser) return;

    const draftValue = stockDrafts[productId];
    const nextValue = Math.max(Number(draftValue) || 0, 0);
    const maxReservable = Math.max(targetProduct.total - targetProduct.reserved, 0);
    const nextReservable = Math.min(nextValue, maxReservable);

    setUpdatingInventoryId(productId);
    setErrorMessage("");

    try {
      const result = await updateSellerInventory(productId, {
        seller_id: currentUser.user_id,
        total_stock: targetProduct.total,
        reservable_stock: nextReservable,
      });

      setProducts((currentProducts) =>
        currentProducts.map((product) =>
          product.id === productId
            ? {
              ...product,
              reservable: result.reservable_stock,
              reserved: result.reserved_stock,
              status: result.reservable_stock <= 3 ? "재고부족" : "판매중",
            }
            : product
        )
      );
      setStockDrafts((current) => ({ ...current, [productId]: String(result.reservable_stock) }));
      setInventoryMessage(`${targetProduct.name} 예약 가능 재고를 ${result.reservable_stock}개로 수정했습니다.`);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setUpdatingInventoryId(null);
    }
  };

  const updateReservationStatus = async (reservationId, status) => {
    if (updatingReservationId || !currentUser) return;

    setUpdatingReservationId(reservationId);
    setErrorMessage("");
    setInventoryMessage("");

    try {
      const result = await updateSellerReservationStatus(reservationId, {
        seller_id: currentUser.user_id,
        status,
      });

      setReservations((currentReservations) =>
        currentReservations.map((reservation) =>
          reservation.id === reservationId ? { ...reservation, status: result.status } : reservation
        )
      );

      if (selectedStoreId) {
        const inventoryRows = await getSellerInventories(selectedStoreId, currentUser.user_id);
        const inventoryModels = inventoryRows.map(toInventoryModel);
        setProducts(inventoryModels);
        setStockDrafts(Object.fromEntries(inventoryModels.map((product) => [product.id, String(product.reservable)])));
      }

      setInventoryMessage(`예약 상태를 ${reservationStatus[result.status]?.label ?? result.status}(으)로 변경했습니다.`);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setUpdatingReservationId(null);
    }
  };

  return (
    <div className="page-shell dashboard-shell">
      <SellerHeader />
      <div className="management-layout">
        <aside className="side-nav">
          <strong>가게 관리</strong>
          <Link className="side-nav-action" to="/seller/stores/new"><Plus size={15} /> 가게 등록</Link>
          {stores.map((store) => (
            <button
              className={selectedStore?.store_id === store.store_id ? "active-nav" : ""}
              key={store.store_id}
              onClick={() => setSelectedStoreId(store.store_id)}
              type="button"
            >
              {store.name}
            </button>
          ))}
        </aside>

        <main className="management-main">
          {isLoading && <div className="warning-message">판매자 데이터를 불러오는 중입니다.</div>}
          {errorMessage && <div className="error-message"><AlertCircle size={18} /> {errorMessage}</div>}

          <section className="store-overview">
            <div>
              <p className="eyebrow">판매자</p>
              <h1>{selectedStore?.name ?? "등록된 가게 없음"}</h1>
              <p>
                {selectedStore
                  ? `${selectedStore.address} · 영업시간 ${selectedStore.opening_hours ?? "미등록"} · ${selectedStore.approval_status}`
                  : "가게를 등록하면 상품과 예약을 관리할 수 있습니다."}
              </p>
            </div>
            <div className="seller-overview-actions">
              {selectedStore && (
                <Link className="ghost-button" to={`/seller/stores/edit?storeId=${selectedStore.store_id}`}>
                  <Pencil size={17} /> 가게 정보 수정
                </Link>
              )}
              {selectedStore ? (
                <Link className="primary-button" to={`/seller/products/new?storeId=${selectedStore.store_id}`}>
                  <PackagePlus size={18} /> 상품 등록
                </Link>
              ) : (
                <Link className="primary-button" to="/seller/stores/new">
                  <PackagePlus size={18} /> 가게 먼저 등록
                </Link>
              )}
            </div>
          </section>

          <section className="metric-grid">
            <article><span>등록 상품</span><strong>{metrics.productCount}</strong></article>
            <article><span>예약 가능 재고</span><strong>{metrics.reservableStock}</strong></article>
            <article><span>예약 건수</span><strong>{metrics.reservationCount}</strong></article>
            <article><span>수령 대기</span><strong>{metrics.waitingPickup}</strong></article>
          </section>

          <section className="table-section">
            <div className="section-heading-row">
              <h2>등록 상품 및 재고</h2>
              {inventoryMessage && <span className="inline-feedback">{inventoryMessage}</span>}
            </div>
            <table>
              <thead>
                <tr>
                  <th>상품</th>
                  <th>카테고리</th>
                  <th>현재 재고</th>
                  <th>예약 가능 재고</th>
                  <th>예약된 재고</th>
                  <th>최대 예약 가능</th>
                  <th>수정</th>
                  <th>상태</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => {
                  const maxReservable = Math.max(product.total - product.reserved, 0);
                  const draftValue = stockDrafts[product.id] ?? String(product.reservable);
                  const isChanged = Number(draftValue) !== Number(product.reservable);
                  return (
                    <tr key={product.id}>
                      <td>{product.name}</td>
                      <td>{product.category}</td>
                      <td>{product.total}</td>
                      <td>
                        <input
                          className="table-input"
                          disabled={updatingInventoryId === product.id}
                          max={maxReservable}
                          min="0"
                          onChange={(event) => updateStockDraft(product.id, event.target.value)}
                          type="number"
                          value={draftValue}
                        />
                      </td>
                      <td>{product.reserved}</td>
                      <td>{maxReservable}</td>
                      <td>
                        <div className="seller-action-row compact-actions">
                          <button
                            className="ghost-button small"
                            disabled={!isChanged || updatingInventoryId === product.id}
                            onClick={() => confirmReservableStock(product.id)}
                            type="button"
                          >
                            <Save size={15} /> 재고 수정
                          </button>
                          <Link
                            className="ghost-button small"
                            to={`/seller/products/new?storeId=${selectedStore.store_id}&productId=${product.productId}&inventoryId=${product.id}`}
                          >
                            <Pencil size={15} /> 상품 수정
                          </Link>
                        </div>
                      </td>
                      <td>
                        <span className={`status-chip ${product.status === "재고부족" ? "warning" : "success"}`}>
                          {product.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {!isLoading && products.length === 0 && (
                  <tr>
                    <td colSpan="8">등록된 상품이 없습니다.</td>
                  </tr>
                )}
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
                const status = reservationStatus[reservation.status] ?? { label: reservation.status, className: "info" };
                const canApprove = reservation.status === "PENDING";
                const canPickup = reservation.status === "APPROVED";
                const canCancel = reservation.status === "PENDING" || reservation.status === "APPROVED";
                const isUpdating = updatingReservationId === reservation.id;

                return (
                  <article className="reservation-card-row" key={reservation.id}>
                    <div className="reservation-main-info">
                      <strong>{reservation.product}</strong>
                      <span>{reservation.customer} · {reservation.quantity}개 · {reservation.visitTime}</span>
                      {reservation.requestNote && <small>요청사항: {reservation.requestNote}</small>}
                    </div>
                    <span className={`status-chip ${status.className}`}>{status.label}</span>
                    <div className="seller-action-row">
                      <button
                        className="ghost-button"
                        disabled={!canApprove || isUpdating}
                        onClick={() => updateReservationStatus(reservation.id, "APPROVED")}
                        type="button"
                      >
                        예약 승인
                      </button>
                      <button
                        className="ghost-button"
                        disabled={!canPickup || isUpdating}
                        onClick={() => updateReservationStatus(reservation.id, "PICKED_UP")}
                        type="button"
                      >
                        <Check size={16} /> 수령 완료
                      </button>
                      <button
                        className="danger-button"
                        disabled={!canCancel || isUpdating}
                        onClick={() => updateReservationStatus(reservation.id, "CANCELED")}
                        type="button"
                      >
                        <X size={16} /> 예약 취소
                      </button>
                    </div>
                  </article>
                );
              })}
              {!isLoading && reservations.length === 0 && (
                <div className="empty-state">현재 선택한 가게의 예약 내역이 없습니다.</div>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

export default SellerHomePage;
