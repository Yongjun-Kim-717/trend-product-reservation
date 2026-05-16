import { Link } from "react-router-dom";

const roles = [
  { label: "소비자", path: "/consumer", description: "상품 검색과 예약" },
  { label: "판매자", path: "/seller", description: "가게와 재고 관리" },
  { label: "관리자", path: "/admin", description: "서비스 데이터 관리" },
];

function LoginPage() {
  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-copy">
          <p className="eyebrow">Trend Product Reservation</p>
          <h1>트렌드 상품 예약</h1>
          <p>역할을 선택하고 서비스 화면으로 이동합니다.</p>
        </div>

        <div className="role-grid" aria-label="역할 선택">
          {roles.map((role) => (
            <Link className="role-card" key={role.label} to={role.path}>
              <strong>{role.label}</strong>
              <span>{role.description}</span>
            </Link>
          ))}
        </div>

        <form className="login-form">
          <label>
            아이디
            <input placeholder="아이디 입력" />
          </label>
          <label>
            비밀번호
            <input type="password" placeholder="비밀번호 입력" />
          </label>
          <button className="primary-button" type="button">로그인</button>
          <button className="link-button" type="button">회원가입</button>
        </form>
      </section>
    </main>
  );
}

export default LoginPage;
