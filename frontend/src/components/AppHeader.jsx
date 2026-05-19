import { Link, NavLink } from "react-router-dom";

function AppHeader({ role, children }) {
  return (
    <header className="app-header">
      <Link className="brand" to="/login">
        <span className="brand-mark">T</span>
        <span>트렌드 상품 예약</span>
      </Link>
      <div className="header-actions">
        {children}
        {role && <span className="role-badge">{role}</span>}
      </div>
    </header>
  );
}

export function ConsumerHeader({ onRequestLocation, isLocating }) {
  return (
    <AppHeader role="소비자">
      <button className="ghost-button" onClick={onRequestLocation} disabled={isLocating} type="button">
        {isLocating ? "위치 확인 중" : "내 위치"}
      </button>
      <NavLink className="text-link" to="/consumer/reservations">내 예약</NavLink>
    </AppHeader>
  );
}

export function SellerHeader() {
  return (
    <AppHeader role="판매자">
      <NavLink className="text-link" to="/seller">가게 관리</NavLink>
    </AppHeader>
  );
}

export function AdminHeader() {
  return (
    <AppHeader role="관리자">
      <input className="header-search" placeholder="데이터 검색" />
    </AppHeader>
  );
}

export default AppHeader;
