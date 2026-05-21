import { useEffect, useState } from "react";
import { AlertCircle, CalendarClock, MapPin, RotateCcw } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { ConsumerHeader } from "../components/AppHeader.jsx";
import { cancelReservation, getUserReservations } from "../api/client.js";
import { getCurrentUser } from "../auth/session.js";

function formatDateTime(value) {
  if (!value) return "방문 시간 미정";
  return String(value).replace("T", " ").slice(0, 16);
}

const statusView = {
  PENDING: { label: "예약 대기", className: "info" },
  APPROVED: { label: "예약 승인", className: "success" },
  CANCELED: { label: "예약 취소", className: "danger" },
  PICKED_UP: { label: "수령 완료", className: "success" },
};

function MyReservationsPage() {
  const navigate = useNavigate();
  const [currentUser] = useState(() => getCurrentUser());
  const [reservations, setReservations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [cancelingId, setCancelingId] = useState(null);

  useEffect(() => {
    if (!currentUser || currentUser.role !== "CONSUMER") {
      navigate("/login", { replace: true });
      return undefined;
    }

    let cancelled = false;

    getUserReservations(currentUser.user_id)
      .then((rows) => {
        if (!cancelled) {
          setReservations(rows);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setErrorMessage(error.message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentUser, navigate]);

  const handleCancelReservation = async (reservation) => {
    const canCancel = ["PENDING", "APPROVED"].includes(reservation.status);
    if (!canCancel || cancelingId) return;

    setErrorMessage("");
    setActionMessage("");
    setCancelingId(reservation.reservation_id);

    try {
      const result = await cancelReservation(reservation.reservation_id, { user_id: currentUser.user_id });
      setReservations((currentRows) =>
        currentRows.map((item) =>
          item.reservation_id === reservation.reservation_id
            ? { ...item, status: result.status, canceled_at: new Date().toISOString() }
            : item
        )
      );
      setActionMessage(`${reservation.product_name} 예약을 취소했습니다.`);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setCancelingId(null);
    }
  };

  return (
    <div className="page-shell">
      <ConsumerHeader />
      <main className="management-main">
        <div className="section-heading-row">
          <div>
            <p className="eyebrow">My Reservations</p>
            <h1>내 예약</h1>
          </div>
          <Link className="ghost-button" to="/consumer">상품 찾기</Link>
        </div>

        {isLoading && <div className="warning-message">DB에서 예약 내역을 불러오는 중입니다.</div>}
        {errorMessage && <div className="error-message"><AlertCircle size={18} /> {errorMessage}</div>}
        {actionMessage && <div className="success-message">{actionMessage}</div>}

        {!isLoading && !errorMessage && reservations.length === 0 && (
          <section className="table-section empty-admin-section">
            <p>아직 예약 내역이 없습니다.</p>
          </section>
        )}

        <section className="reservation-list">
          {reservations.map((reservation) => {
            const status = statusView[reservation.status] ?? { label: reservation.status, className: "info" };
            const canCancel = ["PENDING", "APPROVED"].includes(reservation.status);

            return (
              <article className="reservation-card-row" key={reservation.reservation_id}>
                <div className="reservation-main-info">
                  <strong>{reservation.product_name}</strong>
                  <span>{reservation.store_name}</span>
                  <span><CalendarClock size={14} /> {formatDateTime(reservation.visit_time)}</span>
                </div>
                <span className={`status-chip ${status.className}`}>{status.label}</span>
                <div className="seller-action-row">
                  <span className="stock-pill">{reservation.quantity}개</span>
                  <Link className="ghost-button" to={`/consumer/stores/${reservation.store_id}`}>
                    <MapPin size={16} /> 가게 정보
                  </Link>
                  {canCancel ? (
                    <button
                      className="danger-button"
                      disabled={cancelingId === reservation.reservation_id}
                      onClick={() => handleCancelReservation(reservation)}
                      type="button"
                    >
                      <RotateCcw size={16} /> {cancelingId === reservation.reservation_id ? "취소 중" : "예약 취소"}
                    </button>
                  ) : (
                    <span className="helper-text compact">처리 완료</span>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      </main>
    </div>
  );
}

export default MyReservationsPage;
