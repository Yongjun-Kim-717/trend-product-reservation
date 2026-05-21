import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login, register } from "../api/client.js";
import { getRoleHome, setCurrentUser } from "../auth/session.js";

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [registerRole, setRegisterRole] = useState("CONSUMER");
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isRegisterMode = mode === "register";

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const payload = isRegisterMode
        ? { role: registerRole, login_id: loginId, password, name, phone }
        : { login_id: loginId, password };
      const result = isRegisterMode ? await register(payload) : await login(payload);
      setCurrentUser(result.user);
      navigate(getRoleHome(result.user.role), { replace: true });
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-card login-card-simple">
        <div className="login-copy">
          <p className="eyebrow">Trend Product Reservation</p>
          <h1>트렌드 상품 예약</h1>
          <p>아이디로 로그인하면 계정 권한에 따라 소비자, 판매자, 관리자 화면으로 이동합니다.</p>
          <p className="helper-text compact">시연 계정: consumer1/pw_1, seller1/pw_6, admin1/pw_11</p>
        </div>

        <form className="login-form login-form-simple" onSubmit={handleSubmit}>
          <div className="auth-mode-row">
            <button className={mode === "login" ? "active-mode" : ""} onClick={() => setMode("login")} type="button">
              로그인
            </button>
            <button className={mode === "register" ? "active-mode" : ""} onClick={() => setMode("register")} type="button">
              회원가입
            </button>
          </div>

          {isRegisterMode && (
            <label>
              계정 유형
              <select value={registerRole} onChange={(event) => setRegisterRole(event.target.value)}>
                <option value="CONSUMER">소비자</option>
                <option value="SELLER">판매자</option>
              </select>
            </label>
          )}

          <label>
            아이디
            <input value={loginId} onChange={(event) => setLoginId(event.target.value)} placeholder="아이디 입력" />
          </label>
          <label>
            비밀번호
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="비밀번호 입력" />
          </label>

          {isRegisterMode && (
            <>
              <label>
                이름
                <input value={name} onChange={(event) => setName(event.target.value)} placeholder="이름 입력" />
              </label>
              <label>
                연락처
                <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="010-0000-0000" />
              </label>
            </>
          )}

          {errorMessage && <div className="error-message full-width">{errorMessage}</div>}
          <button className="primary-button" disabled={isSubmitting} type="submit">
            {isSubmitting ? "처리 중" : isRegisterMode ? "회원가입" : "로그인"}
          </button>
        </form>
      </section>
    </main>
  );
}

export default LoginPage;
