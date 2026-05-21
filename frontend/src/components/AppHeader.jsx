import { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { clearCurrentUser, getCurrentUser, getRoleHome } from "../auth/session.js";

function AppHeader({ role, children }) {
  const navigate = useNavigate();
  const [currentUser, setCurrentUserState] = useState(() => getCurrentUser());

  useEffect(() => {
    const syncUser = () => setCurrentUserState(getCurrentUser());
    window.addEventListener("authchange", syncUser);
    window.addEventListener("storage", syncUser);
    return () => {
      window.removeEventListener("authchange", syncUser);
      window.removeEventListener("storage", syncUser);
    };
  }, []);

  const handleLogout = () => {
    clearCurrentUser();
    navigate("/login", { replace: true });
  };

  const homePath = currentUser ? getRoleHome(currentUser.role) : "/login";

  return (
    <header className="app-header">
      <Link className="brand" to={homePath}>
        <span className="brand-mark">T</span>
        <span>트렌드 상품 예약</span>
      </Link>
      <div className="header-actions">
        {children}
        {currentUser && <span className="current-user">{currentUser.name}</span>}
        {role && <span className="role-badge">{role}</span>}
        {currentUser && <button className="link-button compact-button" onClick={handleLogout} type="button">로그아웃</button>}
      </div>
    </header>
  );
}

export function ConsumerHeader({ onRequestLocation, isLocating }) {
  return (
    <AppHeader role="소비자">
      {onRequestLocation && (
        <button className="ghost-button" onClick={onRequestLocation} disabled={isLocating} type="button">
          {isLocating ? "위치 확인 중" : "내 위치"}
        </button>
      )}
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
