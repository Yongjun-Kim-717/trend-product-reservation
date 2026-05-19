import { useEffect, useState } from "react";
import { AlertCircle, CalendarClock } from "lucide-react";
import { Link } from "react-router-dom";
import { ConsumerHeader } from "../components/AppHeader.jsx";
import { getUserReservations } from "../api/client.js";

const DEMO_USER_ID = 2;

function formatDateTime(value) {
  if (!value) return "방문 시간 미정";
  return String(value).replace("T", " ").slice(0, 16);
}

function MyReservationsPage() {
  const [reservations, setReservations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    getUserReservations(DEMO_USER_ID)
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
  }, []);

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

        {!isLoading && !errorMessage && reservations.length === 0 && (
          <section className="table-section empty-admin-section">
            <p>아직 예약 내역이 없습니다.</p>
          </section>
        )}

        <section className="reservation-list">
          {reservations.map((reservation) => (
            <article className="reservation-card-row" key={reservation.reservation_id}>
              <div className="reservation-main-info">
                <strong>{reservation.product_name}</strong>
                <span>{reservation.store_name}</span>
                <span><CalendarClock size={14} /> {formatDateTime(reservation.visit_time)}</span>
              </div>
              <span className="status-chip info">{reservation.status}</span>
              <div className="seller-action-row">
                <span className="stock-pill">{reservation.quantity}개</span>
              </div>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}

export default MyReservationsPage;
