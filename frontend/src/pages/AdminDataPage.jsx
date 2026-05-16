import { useMemo, useState } from "react";
import { Check, Pause, Plus, RotateCcw, Search, Tags, X } from "lucide-react";
import { AdminHeader } from "../components/AppHeader.jsx";
import { adminKeywords, adminSearchLogs, adminUnmappedSearches } from "../data/mockData.js";

const tabs = ["미매핑 검색어", "키워드 관리", "검색 로그", "판매자 승인", "매장 승인", "사용자 관리"];
const blockedKeywordTerms = ["맛집", "예약", "파는곳", "추천", "근처", "요즘", "신상", "핫플", "어디", "매장"];

const unmappedStatus = {
  REVIEW: { label: "검토 필요", className: "warning" },
  ALIAS_REGISTERED: { label: "별칭 등록", className: "success" },
  KEYWORD_CREATED: { label: "새 키워드", className: "info" },
  HOLD: { label: "보류", className: "warning" },
  REJECTED: { label: "반려", className: "danger" },
};

function validateKeywordName(name, keywords) {
  const trimmedName = name.trim();
  if (trimmedName.length < 2 || trimmedName.length > 20) return "기준 키워드는 2자 이상 20자 이하로 입력해주세요.";
  if (/\s/.test(trimmedName)) return "기준 키워드는 대표 상품명 중심으로 입력하며 공백을 포함할 수 없습니다.";
  if (blockedKeywordTerms.some((term) => trimmedName.includes(term))) return "맛집, 예약, 파는곳, 추천 등 검색 의도 단어는 기준 키워드에 사용할 수 없습니다.";
  if (keywords.some((keyword) => keyword.name === trimmedName)) return "이미 존재하는 기준 키워드입니다.";
  return "";
}

function AdminDataPage() {
  const [activeTab, setActiveTab] = useState("미매핑 검색어");
  const [query, setQuery] = useState("");
  const [keywords, setKeywords] = useState(adminKeywords);
  const [unmappedSearches, setUnmappedSearches] = useState(adminUnmappedSearches);
  const [selectedKeywordId, setSelectedKeywordId] = useState(adminKeywords[0].id);
  const [newKeywordName, setNewKeywordName] = useState("");
  const [lastAction, setLastAction] = useState("");
  const [adminError, setAdminError] = useState("");

  const normalizedQuery = query.trim();
  const filteredUnmapped = useMemo(
    () => unmappedSearches.filter((item) => !normalizedQuery || item.rawQuery.includes(normalizedQuery) || item.resolution?.includes(normalizedQuery)),
    [normalizedQuery, unmappedSearches]
  );

  const filteredKeywords = useMemo(
    () => keywords.filter((keyword) => !normalizedQuery || keyword.name.includes(normalizedQuery) || keyword.aliases.some((alias) => alias.includes(normalizedQuery))),
    [normalizedQuery, keywords]
  );

  const filteredLogs = useMemo(
    () => adminSearchLogs.filter((log) => !normalizedQuery || log.rawQuery.includes(normalizedQuery) || log.keywordName.includes(normalizedQuery) || log.location.includes(normalizedQuery)),
    [normalizedQuery]
  );

  const mappingSuccessCount = adminSearchLogs.filter((log) => log.mappingStatus === "매핑 성공").length;
  const metrics = {
    reviewCount: unmappedSearches.filter((item) => item.status === "REVIEW").length,
    activeKeywords: keywords.filter((keyword) => keyword.status === "ACTIVE").length,
    searchLogCount: adminSearchLogs.length,
    resolvedCount: unmappedSearches.filter((item) => item.status === "ALIAS_REGISTERED" || item.status === "KEYWORD_CREATED").length,
    mappingRate: Math.round((mappingSuccessCount / adminSearchLogs.length) * 100),
  };

  const setActionMessage = (message) => {
    setLastAction(message);
    setAdminError("");
  };

  const registerAlias = (unmappedId) => {
    const target = unmappedSearches.find((item) => item.id === unmappedId);
    const selectedKeyword = keywords.find((keyword) => keyword.id === Number(selectedKeywordId));
    if (!target || !selectedKeyword) return;

    setKeywords((currentKeywords) => currentKeywords.map((keyword) => {
      if (keyword.id !== selectedKeyword.id || keyword.aliases.includes(target.rawQuery)) return keyword;
      return { ...keyword, aliases: [...keyword.aliases, target.rawQuery] };
    }));
    setUnmappedSearches((currentItems) => currentItems.map((item) => item.id === unmappedId ? {
      ...item,
      status: "ALIAS_REGISTERED",
      resolution: `"${selectedKeyword.name}"의 별칭으로 등록`,
      resolvedKeywordId: selectedKeyword.id,
      createdKeywordId: null,
    } : item));
    setActionMessage(`"${target.rawQuery}"를 "${selectedKeyword.name}" 키워드의 별칭으로 등록했습니다.`);
  };

  const createKeyword = (unmappedId) => {
    const target = unmappedSearches.find((item) => item.id === unmappedId);
    if (!target) return;

    const validationError = validateKeywordName(newKeywordName, keywords);
    if (validationError) {
      setAdminError(validationError);
      setLastAction("");
      return;
    }

    const nextKeyword = {
      id: Date.now(),
      name: newKeywordName.trim(),
      trendScore: target.count,
      status: "ACTIVE",
      aliases: [target.rawQuery],
    };

    setKeywords((currentKeywords) => [nextKeyword, ...currentKeywords]);
    setUnmappedSearches((currentItems) => currentItems.map((item) => item.id === unmappedId ? {
      ...item,
      status: "KEYWORD_CREATED",
      resolution: `새 키워드 "${nextKeyword.name}" 생성, 원 검색어는 첫 별칭으로 등록`,
      createdKeywordId: nextKeyword.id,
      resolvedKeywordId: null,
    } : item));
    setSelectedKeywordId(nextKeyword.id);
    setNewKeywordName("");
    setActionMessage(`"${nextKeyword.name}"를 새 기준 키워드로 생성하고 "${target.rawQuery}"를 별칭으로 등록했습니다.`);
  };

  const updateUnmappedStatus = (unmappedId, status) => {
    const target = unmappedSearches.find((item) => item.id === unmappedId);
    const resolution = status === "HOLD" ? "검색량 증가 또는 상품성 확인 후 재검토" : status === "REJECTED" ? "상품 키워드로 부적절하여 반려" : null;
    setUnmappedSearches((currentItems) => currentItems.map((item) => item.id === unmappedId ? { ...item, status, resolution } : item));
    setActionMessage(target ? `"${target.rawQuery}" 상태를 ${unmappedStatus[status].label}(으)로 변경했습니다.` : "");
  };

  const undoUnmappedAction = (unmappedId) => {
    const target = unmappedSearches.find((item) => item.id === unmappedId);
    if (!target) return;

    if (target.status === "ALIAS_REGISTERED" && target.resolvedKeywordId) {
      setKeywords((currentKeywords) => currentKeywords.map((keyword) => keyword.id === target.resolvedKeywordId ? {
        ...keyword,
        aliases: keyword.aliases.filter((alias) => alias !== target.rawQuery),
      } : keyword));
    }

    if (target.status === "KEYWORD_CREATED" && target.createdKeywordId) {
      setKeywords((currentKeywords) => currentKeywords.filter((keyword) => keyword.id !== target.createdKeywordId));
      if (Number(selectedKeywordId) === target.createdKeywordId) setSelectedKeywordId(adminKeywords[0].id);
    }

    setUnmappedSearches((currentItems) => currentItems.map((item) => item.id === unmappedId ? {
      ...item,
      status: "REVIEW",
      resolution: null,
      resolvedKeywordId: null,
      createdKeywordId: null,
    } : item));
    setActionMessage(`"${target.rawQuery}" 처리 결과를 취소하고 검토 필요 상태로 복구했습니다.`);
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
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="검색어, 키워드, 위치 검색" />
            </label>
          </section>

          <section className="metric-grid">
            <article><span>검토 필요</span><strong>{metrics.reviewCount}</strong></article>
            <article><span>활성 키워드</span><strong>{metrics.activeKeywords}</strong></article>
            <article><span>매핑 성공률</span><strong>{metrics.mappingRate}%</strong></article>
            <article><span>처리 완료</span><strong>{metrics.resolvedCount}</strong></article>
          </section>

          {lastAction && <div className="success-message"><Check size={18} /> {lastAction}</div>}
          {adminError && <div className="error-message"><X size={18} /> {adminError}</div>}

          {activeTab === "미매핑 검색어" && (
            <section className="admin-grid-section">
              <article className="table-section">
                <div className="section-heading-row admin-controls-row">
                  <h2>미매핑 검색어 검토</h2>
                  <div className="admin-control-group">
                    <label className="compact-field">
                      기준 키워드
                      <select value={selectedKeywordId} onChange={(event) => setSelectedKeywordId(Number(event.target.value))}>
                        {keywords.map((keyword) => <option key={keyword.id} value={keyword.id}>{keyword.name}</option>)}
                      </select>
                    </label>
                    <label className="compact-field">
                      새 기준 키워드
                      <input value={newKeywordName} onChange={(event) => setNewKeywordName(event.target.value)} placeholder="예: 크림떡" />
                    </label>
                  </div>
                </div>
                <table>
                  <thead><tr><th>검색어</th><th>횟수</th><th>마지막 검색</th><th>상태</th><th>처리 결과</th><th>처리</th></tr></thead>
                  <tbody>
                    {filteredUnmapped.map((item) => {
                      const status = unmappedStatus[item.status];
                      const isResolved = item.status === "ALIAS_REGISTERED" || item.status === "KEYWORD_CREATED";
                      const isRejected = item.status === "REJECTED";
                      return (
                        <tr key={item.id}>
                          <td>{item.rawQuery}</td>
                          <td>{item.count}</td>
                          <td>{item.lastSeenAt}</td>
                          <td><span className={`status-chip ${status.className}`}>{status.label}</span></td>
                          <td className="resolution-cell">{item.resolution ?? "-"}</td>
                          <td>
                            <div className="table-actions">
                              <button className="ghost-button" disabled={isResolved || isRejected} onClick={() => registerAlias(item.id)} type="button"><Tags size={16} /> 별칭 등록</button>
                              <button className="ghost-button" disabled={isResolved || isRejected} onClick={() => createKeyword(item.id)} type="button"><Plus size={16} /> 새 키워드</button>
                              <button className="ghost-button" disabled={isResolved || isRejected} onClick={() => updateUnmappedStatus(item.id, "HOLD")} type="button"><Pause size={16} /> 보류</button>
                              <button className="danger-button" disabled={isResolved || isRejected} onClick={() => updateUnmappedStatus(item.id, "REJECTED")} type="button"><X size={16} /> 반려</button>
                              {(isResolved || item.status === "HOLD" || isRejected) && <button className="ghost-button" onClick={() => undoUnmappedAction(item.id)} type="button"><RotateCcw size={16} /> 처리 취소</button>}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </article>

              <article className="admin-side-panel">
                <h2>상태 기준</h2>
                <div className="admin-rule-list">
                  <div><strong>보류</strong><span>아직 판단하지 않고 검색량 증가 또는 상품성 확인 후 다시 검토합니다.</span></div>
                  <div><strong>반려</strong><span>상품 키워드로 부적절하다고 판단해 기본 검토 흐름에서 제외합니다.</span></div>
                  <div><strong>새 키워드</strong><span>대표 상품명만 허용합니다. 맛집, 예약, 파는곳 같은 검색 의도 단어는 별칭에만 사용합니다.</span></div>
                </div>
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
              <div className="section-heading-row">
                <h2>SearchLog</h2>
                <span className="inline-feedback">매핑 성공 {mappingSuccessCount}건 · 미매핑 {adminSearchLogs.length - mappingSuccessCount}건</span>
              </div>
              <table>
                <thead><tr><th>Raw Query</th><th>매핑 상태</th><th>기준 키워드</th><th>사용자 유형</th><th>검색 위치</th><th>결과 수</th><th>검색 시각</th></tr></thead>
                <tbody>
                  {filteredLogs.map((log) => (
                    <tr key={log.id}>
                      <td>{log.rawQuery}</td>
                      <td><span className={`status-chip ${log.mappingStatus === "매핑 성공" ? "success" : "warning"}`}>{log.mappingStatus}</span></td>
                      <td>{log.keywordName}</td>
                      <td>{log.userRole}</td>
                      <td>{log.location}</td>
                      <td>{log.resultCount}</td>
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
