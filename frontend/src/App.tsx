import { useState } from "react";
import "./App.css";
import AiSvgPipelinePage from "./pages/AiSvgPipelinePage";
import ComparisonPage from "./pages/ComparisonPage";
import ImagePipelinePage from "./pages/ImagePipelinePage";
import LoginPage from "./pages/LoginPage";
import { logout } from "./api";

type Tab = "image" | "svg" | "compare";

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("image");
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!sessionStorage.getItem("auth_token"));

  const handleLogin = () => setIsLoggedIn(true);

  const handleLogout = async () => {
    await logout();
    setIsLoggedIn(false);
  };

  if (!isLoggedIn) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="app">
      <header className="page-header">
        <span className="app-title">Davinci Maker</span>
        <nav className="tab-nav">
          <button
            className={`tab-btn${activeTab === "image" ? " active" : ""}`}
            onClick={() => setActiveTab("image")}
          >
            이미지 파이프라인
          </button>
          <button
            className={`tab-btn${activeTab === "svg" ? " active" : ""}`}
            onClick={() => setActiveTab("svg")}
          >
            AI SVG 파이프라인
          </button>
          <button
            className={`tab-btn${activeTab === "compare" ? " active" : ""}`}
            onClick={() => setActiveTab("compare")}
          >
            비교
          </button>
        </nav>
        <button className="logout-btn" onClick={handleLogout}>
          로그아웃
        </button>
      </header>

      <div className="page">
        {activeTab === "image" && <ImagePipelinePage />}
        {activeTab === "svg" && <AiSvgPipelinePage />}
        {activeTab === "compare" && <ComparisonPage />}
      </div>
    </div>
  );
}
