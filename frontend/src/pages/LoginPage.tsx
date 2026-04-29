import { useState } from "react";
import { login } from "../api";

interface Props {
  onLogin: () => void;
}

export default function LoginPage({ onLogin }: Props) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const token = await login(password);
      sessionStorage.setItem("auth_token", token);
      onLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : "로그인 실패");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-box">
        <h1 className="login-title">Davinci Maker</h1>
        <form onSubmit={handleSubmit} className="login-form">
          <input
            type="password"
            className="login-input"
            placeholder="관리자 비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
          {error && <p className="login-error">{error}</p>}
          <button
            type="submit"
            className="run-btn login-btn"
            disabled={loading || !password}
          >
            {loading ? "확인 중..." : "로그인"}
          </button>
        </form>
      </div>
    </div>
  );
}
