import { useMemo, useState } from "react";
import { Check, Search, X } from "lucide-react";
import { AdminHeader } from "../components/AppHeader.jsx";
import { adminRows } from "../data/mockData.js";

const tabs = ["사용자 관리", "판매자 승인", "매장 승인", "상품 카테고리", "키워드 관리", "미매핑 검색어", "검색 로그"];

function AdminDataPage() {
  const [activeTab, setActiveTab] = useState("미매핑 검색어");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState(adminRows);

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim();
    return rows.filter((row) => {
      const matchesQuery = !normalizedQuery || row.title.includes(normalizedQuery) || row.type.includes(normalizedQuery);
      const matchesTab = activeTab === "미매핑 검색어" ? row.type === "미매핑 검색어" : true;
      return matchesQuery && matchesTab;
    });
  }, [activeTab, query, rows]);

  const updateStatus = (id, status) => {
    setRows((currentRows) => currentRows.map((row) => (row.id === id ? { ...row, status } : row)));
  };

  return (
    <div className="page-shell dashboard-shell">
      <AdminHeader />
      <div className="management-layout">
        <aside className="side-nav admin-nav">
          <strong>데이터 관리</strong>
          {tabs.map((tab) => (
            <button className={activeTab === tab ? "active-nav" : ""} key={tab} onClick={() => setActiveTab(tab)} type="button">
              {tab}
            </button>
          ))}
        </aside>

        <main className="management-main">
          <section className="store-overview admin-overview">
            <div>
              <p className="eyebrow">관리자</p>
              <h1>{activeTab}</h1>
              <p>서비스 운영 데이터를 검토하고 처리합니다.</p>
            </div>
            <label className="admin-search">
              <Search size={18} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="검색" />
            </label>
          </section>

          <section className="metric-grid">
            <article><span>검토 필요</span><strong>{rows.filter((row) => row.status.includes("검토") || row.status.includes("대기")).length}</strong></article>
            <article><span>활성 키워드</span><strong>12</strong></article>
            <article><span>오늘 검색 로그</span><strong>148</strong></article>
            <article><span>처리 완료</span><strong>{rows.filter((row) => row.status === "승인 완료").length}</strong></article>
          </section>

          <section className="table-section">
            <h2>검토 항목</h2>
            <table>
              <thead><tr><th>유형</th><th>이름</th><th>상태</th><th>처리</th></tr></thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.type}</td>
                    <td>{row.title}</td>
                    <td><span className="status-chip warning">{row.status}</span></td>
                    <td>
                      <div className="table-actions">
                        <button className="ghost-button" onClick={() => updateStatus(row.id, "승인 완료")} type="button"><Check size={16} /> 승인</button>
                        <button className="danger-button" onClick={() => updateStatus(row.id, "반려")} type="button"><X size={16} /> 반려</button>
                        {row.type === "미매핑 검색어" && <button className="ghost-button" onClick={() => updateStatus(row.id, "별칭 등록")} type="button">별칭 등록</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </main>
      </div>
    </div>
  );
}

export default AdminDataPage;
