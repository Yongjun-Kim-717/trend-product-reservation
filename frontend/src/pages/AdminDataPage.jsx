import { useMemo, useState } from "react";
import { Check, Pause, Plus, Search, Tags, X } from "lucide-react";
import { AdminHeader } from "../components/AppHeader.jsx";
import { adminKeywords, adminSearchLogs, adminUnmappedSearches } from "../data/mockData.js";

const tabs = ["미매핑 검색어", "키워드 관리", "검색 로그", "판매자 승인", "매장 승인", "사용자 관리"];

const unmappedStatus = {
  REVIEW: { label: "검토 필요", className: "warning" },
  ALIAS_REGISTERED: { label: "별칭 등록", className: "success" },
  KEYWORD_CREATED: { label: "새 키워드", className: "info" },
  HOLD: { label: "보류", className: "warning" },
  REJECTED: { label: "반려", className: "danger" },
};

function AdminDataPage() {
  const [activeTab, setActiveTab] = useState("미매핑 검색어");
  const [query, setQuery] = useState("");
  const [keywords, setKeywords] = useState(adminKeywords);
  const [unmappedSearches, setUnmappedSearches] = useState(adminUnmappedSearches);
  const [selectedKeywordId, setSelectedKeywordId] = useState(adminKeywords[0].id);
  const [lastAction, setLastAction] = useState("");

  const normalizedQuery = query.trim();
  const filteredUnmapped = useMemo(
    () => unmappedSearches.filter((item) => !normalizedQuery || item.rawQuery.includes(normalizedQuery)),
    [normalizedQuery, unmappedSearches]
  );

  const filteredKeywords = useMemo(
    () => keywords.filter((keyword) => !normalizedQuery || keyword.name.includes(normalizedQuery) || keyword.aliases.some((alias) => alias.includes(normalizedQuery))),
    [normalizedQuery, keywords]
  );

  const filteredLogs = useMemo(
    () => adminSearchLogs.filter((log) => !normalizedQuery || log.rawQuery.includes(normalizedQuery) || log.keywordName.includes(normalizedQuery)),
    [normalizedQuery]
  );

  const metrics = {
    reviewCount: unmappedSearches.filter((item) => item.status === "REVIEW").length,
    activeKeywords: keywords.filter((keyword) => keyword.status === "ACTIVE").length,
    searchLogCount: adminSearchLogs.length,
    resolvedCount: unmappedSearches.filter((item) => item.status === "ALIAS_REGISTERED" || item.status === "KEYWORD_CREATED").length,
  };

  const registerAlias = (unmappedId) => {
    const target = unmappedSearches.find((item) => item.id === unmappedId);
    const selectedKeyword = keywords.find((keyword) => keyword.id === Number(selectedKeywordId));
    if (!target || !selectedKeyword) return;

    setKeywords((currentKeywords) => currentKeywords.map((keyword) => {
      if (keyword.id !== selectedKeyword.id || keyword.aliases.includes(target.rawQuery)) return keyword;
      return { ...keyword, aliases: [...keyword.aliases, target.rawQuery] };
    }));
    setUnmappedSearches((currentItems) => currentItems.map((item) => item.id === unmappedId ? { ...item, status: "ALIAS_REGISTERED" } : item));
    setLastAction(`"${target.rawQuery}"를 "${selectedKeyword.name}" 키워드의 별칭으로 등록했습니다.`);
  };

  const createKeyword = (unmappedId) => {
    const target = unmappedSearches.find((item) => item.id === unmappedId);
    if (!target) return;

    const nextKeyword = {
      id: Date.now(),
      name: target.rawQuery,
      trendScore: target.count,
      status: "ACTIVE",
      aliases: [target.rawQuery],
    };

    setKeywords((currentKeywords) => [nextKeyword, ...currentKeywords]);
    setUnmappedSearches((currentItems) => currentItems.map((item) => item.id === unmappedId ? { ...item, status: "KEYWORD_CREATED" } : item));
    setSelectedKeywordId(nextKeyword.id);
    setLastAction(`"${target.rawQuery}"를 새 기준 키워드로 생성했습니다.`);
  };

  const updateUnmappedStatus = (unmappedId, status) => {
    const target = unmappedSearches.find((item) => item.id === unmappedId);
    setUnmappedSearches((currentItems) => currentItems.map((item) => item.id === unmappedId ? { ...item, status } : item));
    setLastAction(target ? `"${target.rawQuery}" 상태를 ${unmappedStatus[status].label}(으)로 변경했습니다.` : "");
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
              <p>검색어, 별칭, 로그 데이터를 기준으로 유행 상품 운영 정책을 관리합니다.</p>
            </div>
            <label className="admin-search">
              <Search size={18} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="검색어 또는 키워드 검색" />
            </label>
          </section>

          <section className="metric-grid">
            <article><span>검토 필요</span><strong>{metrics.reviewCount}</strong></article>
            <article><span>활성 키워드</span><strong>{metrics.activeKeywords}</strong></article>
            <article><span>검색 로그</span><strong>{metrics.searchLogCount}</strong></article>
            <article><span>처리 완료</span><strong>{metrics.resolvedCount}</strong></article>
          </section>

          {lastAction && <div className="success-message"><Check size={18} /> {lastAction}</div>}

          {activeTab === "미매핑 검색어" && (
            <section className="admin-grid-section">
              <article className="table-section">
                <div className="section-heading-row">
                  <h2>미매핑 검색어 검토</h2>
                  <label className="compact-field">
                    기준 키워드
                    <select value={selectedKeywordId} onChange={(event) => setSelectedKeywordId(Number(event.target.value))}>
                      {keywords.map((keyword) => <option key={keyword.id} value={keyword.id}>{keyword.name}</option>)}
                    </select>
                  </label>
                </div>
                <table>
                  <thead><tr><th>검색어</th><th>횟수</th><th>마지막 검색</th><th>상태</th><th>처리</th></tr></thead>
                  <tbody>
                    {filteredUnmapped.map((item) => {
                      const status = unmappedStatus[item.status];
                      const isProcessed = item.status === "ALIAS_REGISTERED" || item.status === "KEYWORD_CREATED" || item.status === "REJECTED";
                      return (
                        <tr key={item.id}>
                          <td>{item.rawQuery}</td>
                          <td>{item.count}</td>
                          <td>{item.lastSeenAt}</td>
                          <td><span className={`status-chip ${status.className}`}>{status.label}</span></td>
                          <td>
                            <div className="table-actions">
                              <button className="ghost-button" disabled={isProcessed} onClick={() => registerAlias(item.id)} type="button"><Tags size={16} /> 별칭 등록</button>
                              <button className="ghost-button" disabled={isProcessed} onClick={() => createKeyword(item.id)} type="button"><Plus size={16} /> 새 키워드</button>
                              <button className="ghost-button" disabled={isProcessed} onClick={() => updateUnmappedStatus(item.id, "HOLD")} type="button"><Pause size={16} /> 보류</button>
                              <button className="danger-button" disabled={isProcessed} onClick={() => updateUnmappedStatus(item.id, "REJECTED")} type="button"><X size={16} /> 반려</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </article>

              <article className="admin-side-panel">
                <h2>처리 흐름</h2>
                <ol>
                  <li>검색어를 KeywordAlias와 비교합니다.</li>
                  <li>매핑 실패 시 UnmappedSearch에 저장합니다.</li>
                  <li>관리자가 기존 키워드 별칭 또는 새 키워드로 전환합니다.</li>
                  <li>처리 결과는 이후 검색 로그와 유행 상품 점수에 반영됩니다.</li>
                </ol>
              </article>
            </section>
          )}

          {activeTab === "키워드 관리" && (
            <section className="table-section">
              <h2>유행 상품 키워드</h2>
              <table>
                <thead><tr><th>기준 키워드</th><th>Trend Score</th><th>상태</th><th>KeywordAlias</th></tr></thead>
                <tbody>
                  {filteredKeywords.map((keyword) => (
                    <tr key={keyword.id}>
                      <td>{keyword.name}</td>
                      <td>{keyword.trendScore}</td>
                      <td><span className="status-chip success">{keyword.status}</span></td>
                      <td><div className="alias-list">{keyword.aliases.map((alias) => <span key={alias}>{alias}</span>)}</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {activeTab === "검색 로그" && (
            <section className="table-section">
              <h2>SearchLog</h2>
              <table>
                <thead><tr><th>Raw Query</th><th>매핑 키워드</th><th>검색 시각</th></tr></thead>
                <tbody>
                  {filteredLogs.map((log) => (
                    <tr key={log.id}>
                      <td>{log.rawQuery}</td>
                      <td>{log.keywordName}</td>
                      <td>{log.createdAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {!['미매핑 검색어', '키워드 관리', '검색 로그'].includes(activeTab) && (
            <section className="table-section empty-admin-section">
              <h2>{activeTab}</h2>
              <p>이 메뉴는 이후 세부 페이지로 분리할 예정입니다. 현재 단계에서는 관리자 메인에서 키워드, 별칭, 검색 로그 흐름을 우선 구현합니다.</p>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

export default AdminDataPage;
