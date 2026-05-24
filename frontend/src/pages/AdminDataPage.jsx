import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Pause, Plus, RotateCcw, Search, Tags, Trash2, X } from "lucide-react";
import { AdminHeader } from "../components/AppHeader.jsx";
import {
  createKeywordFromUnmapped,
  deleteKeywordAlias,
  deleteUnmappedSearch,
  getAdminKeywords,
  getAdminSearchLogs,
  getAdminSellers,
  getAdminUnmappedSearches,
  getAdminUsers,
  getPendingStores,
  registerUnmappedAlias,
  updateAdminUserStatus,
  updateSellerApproval,
  updateStoreApproval,
  updateUnmappedSearchStatus,
} from "../api/client.js";
import { getCurrentUser } from "../auth/session.js";

const tabs = ["미매핑 검색어", "키워드 관리", "검색 로그", "매장 승인", "판매자 승인", "사용자 관리"];
const searchLogLimitOptions = [10, 20, 50, 100];
const blockedKeywordTerms = ["맛집", "예약", "파는곳", "추천", "근처", "요즘", "신상", "팝업", "어디", "매장"];
const unmappedFilters = [
  { label: "검토 필요", value: "PENDING" },
  { label: "보류", value: "HOLD" },
  { label: "처리 완료", value: "RESOLVED" },
  { label: "반려", value: "REJECTED" },
  { label: "전체", value: "ALL" },
];

const unmappedStatus = {
  PENDING: { label: "검토 필요", className: "warning" },
  RESOLVED: { label: "처리 완료", className: "success" },
  HOLD: { label: "보류", className: "warning" },
  REJECTED: { label: "반려", className: "danger" },
};

function formatDateTime(value) {
  if (!value) return "-";
  return String(value).replace("T", " ").slice(0, 16);
}

function validateKeywordName(name, keywords) {
  const trimmedName = name.trim();
  if (trimmedName.length < 2 || trimmedName.length > 20) return "기준 키워드는 2자 이상 20자 이하로 입력해주세요.";
  if (/\s/.test(trimmedName)) return "기준 키워드는 대표 상품명 중심으로 입력하며 공백을 포함할 수 없습니다.";
  if (blockedKeywordTerms.some((term) => trimmedName.includes(term))) return "맛집, 예약, 파는곳, 추천 같은 검색 의도 단어는 기준 키워드에 사용할 수 없습니다.";
  if (keywords.some((keyword) => keyword.keyword_name === trimmedName)) return "이미 존재하는 기준 키워드입니다.";
  return "";
}

function AdminDataPage() {
  const [activeTab, setActiveTab] = useState("미매핑 검색어");
  const [query, setQuery] = useState("");
  const [keywords, setKeywords] = useState([]);
  const [unmappedSearches, setUnmappedSearches] = useState([]);
  const [searchLogs, setSearchLogs] = useState([]);
  const [searchLogPage, setSearchLogPage] = useState(1);
  const [searchLogLimit, setSearchLogLimit] = useState(20);
  const [searchLogPagination, setSearchLogPagination] = useState({
    page: 1,
    limit: 20,
    total_count: 0,
    total_pages: 1,
    mapped_count: 0,
    unmapped_count: 0,
  });
  const [pendingStores, setPendingStores] = useState([]);
  const [adminSellers, setAdminSellers] = useState([]);
  const [adminUsers, setAdminUsers] = useState([]);
  const [unmappedFilter, setUnmappedFilter] = useState("PENDING");
  const [selectedUnmappedId, setSelectedUnmappedId] = useState(null);
  const [selectedKeywordId, setSelectedKeywordId] = useState("");
  const [aliasInput, setAliasInput] = useState("");
  const [newKeywordName, setNewKeywordName] = useState("");
  const [lastAction, setLastAction] = useState("");
  const [adminError, setAdminError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const currentUser = getCurrentUser();

  const normalizedQuery = query.trim();

  const loadAdminData = useCallback(async () => {
    setIsLoading(true);
    setAdminError("");

    try {
      const [keywordRows, unmappedRows, storeRows, sellerRows, userRows] = await Promise.all([
        getAdminKeywords(),
        getAdminUnmappedSearches(),
        getPendingStores(),
        getAdminSellers(),
        getAdminUsers(),
      ]);

      setKeywords(keywordRows);
      setUnmappedSearches(unmappedRows);
      setPendingStores(storeRows);
      setAdminSellers(sellerRows);
      setAdminUsers(userRows);
      setSelectedKeywordId((current) => current || keywordRows[0]?.keyword_id || "");
      setSelectedUnmappedId((current) => current && unmappedRows.some((row) => row.unmapped_id === current)
        ? current
        : unmappedRows.find((row) => row.status === "PENDING")?.unmapped_id ?? unmappedRows[0]?.unmapped_id ?? null);
    } catch (error) {
      setAdminError(error.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  const loadSearchLogs = useCallback(async () => {
    try {
      const result = await getAdminSearchLogs({
        page: searchLogPage,
        limit: searchLogLimit,
        query: normalizedQuery,
      });
      setSearchLogs(result.items ?? []);
      setSearchLogPagination(result.pagination ?? {
        page: searchLogPage,
        limit: searchLogLimit,
        total_count: result.items?.length ?? 0,
        total_pages: 1,
        mapped_count: 0,
        unmapped_count: 0,
      });
    } catch (error) {
      setAdminError(error.message);
    }
  }, [normalizedQuery, searchLogLimit, searchLogPage]);

  useEffect(() => {
    loadSearchLogs();
  }, [loadSearchLogs]);

  useEffect(() => {
    setSearchLogPage(1);
  }, [normalizedQuery, searchLogLimit]);

  const filteredUnmapped = useMemo(
    () => unmappedSearches.filter((item) => {
      const matchesStatus = unmappedFilter === "ALL" || item.status === unmappedFilter;
      const matchesQuery = !normalizedQuery
        || item.raw_query.includes(normalizedQuery)
        || item.resolution_note?.includes(normalizedQuery)
        || item.resolved_keyword_name?.includes(normalizedQuery)
        || item.created_keyword_name?.includes(normalizedQuery);
      return matchesStatus && matchesQuery;
    }),
    [normalizedQuery, unmappedFilter, unmappedSearches]
  );

  const selectedUnmapped = unmappedSearches.find((item) => item.unmapped_id === selectedUnmappedId) ?? filteredUnmapped[0] ?? null;
  const selectedKeyword = keywords.find((keyword) => Number(keyword.keyword_id) === Number(selectedKeywordId));

  useEffect(() => {
    if (!selectedUnmapped) {
      setAliasInput("");
      return;
    }

    setAliasInput(selectedKeyword?.keyword_name ?? "");
  }, [selectedUnmapped?.unmapped_id, selectedKeyword?.keyword_name]);

  const filteredKeywords = useMemo(
    () => keywords.filter((keyword) =>
      !normalizedQuery
      || keyword.keyword_name.includes(normalizedQuery)
      || keyword.aliases.some((alias) => alias.alias.includes(normalizedQuery))
    ),
    [normalizedQuery, keywords]
  );

  const filteredLogs = useMemo(
    () => searchLogs.filter((log) =>
      !normalizedQuery
      || log.raw_query.includes(normalizedQuery)
      || log.keyword_name?.includes(normalizedQuery)
      || log.location_query?.includes(normalizedQuery)
      || log.user_name?.includes(normalizedQuery)
    ),
    [normalizedQuery, searchLogs]
  );

  const filteredStores = useMemo(
    () => pendingStores.filter((store) =>
      !normalizedQuery
      || store.name.includes(normalizedQuery)
      || store.address.includes(normalizedQuery)
      || store.seller_name?.includes(normalizedQuery)
      || store.business_name?.includes(normalizedQuery)
    ),
    [normalizedQuery, pendingStores]
  );

  const filteredSellers = useMemo(
    () => adminSellers.filter((seller) =>
      !normalizedQuery
      || seller.user_name.includes(normalizedQuery)
      || seller.login_id.includes(normalizedQuery)
      || seller.business_name.includes(normalizedQuery)
      || seller.representative_name.includes(normalizedQuery)
      || seller.approval_status.includes(normalizedQuery)
    ),
    [adminSellers, normalizedQuery]
  );

  const filteredUsers = useMemo(
    () => adminUsers.filter((user) =>
      !normalizedQuery
      || user.name.includes(normalizedQuery)
      || user.login_id.includes(normalizedQuery)
      || user.role.includes(normalizedQuery)
      || user.status.includes(normalizedQuery)
      || user.business_name?.includes(normalizedQuery)
    ),
    [adminUsers, normalizedQuery]
  );

  const mappingSuccessCount = searchLogPagination.mapped_count;
  const mappingTotalCount = searchLogPagination.total_count;
  const mappingRate = mappingTotalCount === 0 ? 0 : Math.round((mappingSuccessCount / mappingTotalCount) * 100);
  const searchLogStart = mappingTotalCount === 0 ? 0 : (searchLogPagination.page - 1) * searchLogPagination.limit + 1;
  const searchLogEnd = Math.min(searchLogPagination.page * searchLogPagination.limit, mappingTotalCount);
  const canMovePrevLogPage = searchLogPagination.page > 1;
  const canMoveNextLogPage = searchLogPagination.page < searchLogPagination.total_pages;
  const metrics = {
    reviewCount: unmappedSearches.filter((item) => item.status === "PENDING").length,
    activeKeywords: keywords.filter((keyword) => keyword.status === "ACTIVE").length,
    mappingRate,
    pendingStores: pendingStores.length,
    pendingSellers: adminSellers.filter((seller) => seller.approval_status === "PENDING").length,
  };

  const reloadAfterAction = async (message) => {
    await loadAdminData();
    setLastAction(message);
    setAdminError("");
  };

  const handleRegisterAlias = async () => {
    if (!selectedUnmapped || !selectedKeywordId || updatingId) return;
    const alias = aliasInput.trim();
    if (alias.length < 2 || alias.length > 20) {
      setAdminError("별칭은 장소명을 제외한 상품어로 2~20자 사이로 입력해주세요.");
      setLastAction("");
      return;
    }

    setUpdatingId(selectedUnmapped.unmapped_id);

    try {
      await registerUnmappedAlias(selectedUnmapped.unmapped_id, {
        keyword_id: Number(selectedKeywordId),
        alias,
        admin_user_id: currentUser?.user_id,
      });
      const keyword = keywords.find((row) => Number(row.keyword_id) === Number(selectedKeywordId));
      await reloadAfterAction(`"${selectedUnmapped.raw_query}"를 "${keyword?.keyword_name ?? "선택 키워드"}"의 별칭으로 등록했습니다.`);
    } catch (error) {
      setAdminError(error.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleCreateKeyword = async () => {
    if (!selectedUnmapped) return;
    const validationError = validateKeywordName(newKeywordName, keywords);
    if (validationError) {
      setAdminError(validationError);
      setLastAction("");
      return;
    }
    const alias = aliasInput.trim() || newKeywordName.trim();
    if (alias.length < 2 || alias.length > 20) {
      setAdminError("별칭은 장소명을 제외한 상품어로 2~20자 사이로 입력해주세요.");
      setLastAction("");
      return;
    }

    setUpdatingId(selectedUnmapped.unmapped_id);

    try {
      await createKeywordFromUnmapped(selectedUnmapped.unmapped_id, {
        keyword_name: newKeywordName.trim(),
        alias,
        admin_user_id: currentUser?.user_id,
      });
      const createdName = newKeywordName.trim();
      setNewKeywordName("");
      await reloadAfterAction(`"${createdName}" 기준 키워드를 만들고 "${selectedUnmapped.raw_query}"를 별칭으로 등록했습니다.`);
    } catch (error) {
      setAdminError(error.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleUnmappedStatus = async (item, status) => {
    setUpdatingId(item.unmapped_id);

    try {
      await updateUnmappedSearchStatus(item.unmapped_id, {
        status,
        admin_user_id: currentUser?.user_id,
      });
      await reloadAfterAction(`"${item.raw_query}" 상태를 ${unmappedStatus[status].label}(으)로 변경했습니다.`);
    } catch (error) {
      setAdminError(error.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteUnmapped = async (item) => {
    if (updatingId) return;
    const confirmed = window.confirm(`"${item.raw_query}" 미매핑 검색어를 삭제할까요? 처리 이력 큐에서만 제거됩니다.`);
    if (!confirmed) return;

    setUpdatingId(item.unmapped_id);
    try {
      await deleteUnmappedSearch(item.unmapped_id);
      await reloadAfterAction(`"${item.raw_query}" 미매핑 검색어를 삭제했습니다.`);
    } catch (error) {
      setAdminError(error.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteAlias = async (alias) => {
    if (updatingId) return;
    const confirmed = window.confirm(`"${alias.alias}" 별칭을 삭제할까요? 이미 저장된 검색 로그는 유지됩니다.`);
    if (!confirmed) return;

    setUpdatingId(`alias-${alias.alias_id}`);
    try {
      await deleteKeywordAlias(alias.alias_id);
      await reloadAfterAction(`"${alias.alias}" 별칭을 삭제했습니다.`);
    } catch (error) {
      setAdminError(error.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleStoreApproval = async (storeId, approvalStatus) => {
    const targetStore = pendingStores.find((store) => store.store_id === storeId);
    if (!targetStore || updatingId) return;

    setUpdatingId(storeId);
    try {
      const result = await updateStoreApproval(storeId, { approval_status: approvalStatus });
      await reloadAfterAction(`"${result.name}" 매장을 ${approvalStatus === "APPROVED" ? "승인" : "반려"}했습니다.`);
    } catch (error) {
      setAdminError(error.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSellerApproval = async (sellerId, approvalStatus) => {
    const targetSeller = adminSellers.find((seller) => seller.seller_id === sellerId);
    if (!targetSeller || updatingId) return;

    setUpdatingId(`seller-${sellerId}`);
    try {
      const result = await updateSellerApproval(sellerId, { approval_status: approvalStatus });
      await reloadAfterAction(`"${result.business_name}" 판매자를 ${approvalStatus === "APPROVED" ? "승인" : approvalStatus === "REJECTED" ? "반려" : "재검토 상태로 변경"}했습니다.`);
    } catch (error) {
      setAdminError(error.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleUserStatus = async (userId, status) => {
    const targetUser = adminUsers.find((user) => user.user_id === userId);
    if (!targetUser || updatingId) return;

    setUpdatingId(`user-${userId}`);
    try {
      const result = await updateAdminUserStatus(userId, { status });
      await reloadAfterAction(`"${result.name}" 계정을 ${status === "ACTIVE" ? "활성" : status === "SUSPENDED" ? "정지" : "대기"} 상태로 변경했습니다.`);
    } catch (error) {
      setAdminError(error.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const selectedClosed = !selectedUnmapped || selectedUnmapped.status === "RESOLVED" || selectedUnmapped.status === "REJECTED";

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
              <p>검색 로그, 미매핑 검색어, 키워드 별칭, 매장 승인 데이터를 실제 DB 기준으로 관리합니다.</p>
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
            <article><span>매장 승인 대기</span><strong>{metrics.pendingStores}</strong></article>
            <article><span>판매자 승인 대기</span><strong>{metrics.pendingSellers}</strong></article>
          </section>

          {isLoading && <div className="warning-message">관리자 데이터를 불러오는 중입니다.</div>}
          {lastAction && <div className="success-message"><Check size={18} /> {lastAction}</div>}
          {adminError && <div className="error-message"><X size={18} /> {adminError}</div>}

          {activeTab === "미매핑 검색어" && (
            <section className="admin-grid-section">
              <article className="table-section">
                <div className="section-heading-row admin-controls-row">
                  <h2>미매핑 검색어 큐</h2>
                  <div className="status-filter-row">
                    {unmappedFilters.map((filter) => (
                      <button
                        className={unmappedFilter === filter.value ? "active-mode" : ""}
                        key={filter.value}
                        onClick={() => setUnmappedFilter(filter.value)}
                        type="button"
                      >
                        {filter.label}
                      </button>
                    ))}
                  </div>
                </div>
                <table>
                  <thead><tr><th>선택</th><th>검색어</th><th>횟수</th><th>마지막 검색</th><th>상태</th><th>처리 결과</th><th>관리</th></tr></thead>
                  <tbody>
                    {filteredUnmapped.map((item) => {
                      const status = unmappedStatus[item.status] ?? { label: item.status, className: "info" };
                      const isUpdating = updatingId === item.unmapped_id;
                      const resultText = item.resolution_note
                        ?? item.resolved_keyword_name
                        ?? item.created_keyword_name
                        ?? "-";

                      return (
                        <tr className={selectedUnmapped?.unmapped_id === item.unmapped_id ? "selected-row" : ""} key={item.unmapped_id}>
                          <td>
                            <button className="ghost-button small" onClick={() => setSelectedUnmappedId(item.unmapped_id)} type="button">
                              선택
                            </button>
                          </td>
                          <td>{item.raw_query}</td>
                          <td>{item.count}</td>
                          <td>{formatDateTime(item.last_seen_at)}</td>
                          <td><span className={`status-chip ${status.className}`}>{status.label}</span></td>
                          <td className="resolution-cell">{resultText}</td>
                          <td>
                            <div className="table-actions">
                              {item.status !== "PENDING" && <button className="ghost-button" disabled={isUpdating} onClick={() => handleUnmappedStatus(item, "PENDING")} type="button"><RotateCcw size={16} /> 재검토</button>}
                              <button className="danger-button" disabled={isUpdating} onClick={() => handleDeleteUnmapped(item)} type="button"><Trash2 size={16} /> 삭제</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredUnmapped.length === 0 && <tr><td colSpan="7">현재 필터에 해당하는 미매핑 검색어가 없습니다.</td></tr>}
                  </tbody>
                </table>
              </article>

              <article className="admin-side-panel">
                <h2>선택 검색어 처리</h2>
                {selectedUnmapped ? (
                  <>
                    <div className="selected-admin-target">
                      <span>선택 검색어</span>
                      <strong>{selectedUnmapped.raw_query}</strong>
                      <em>{unmappedStatus[selectedUnmapped.status]?.label ?? selectedUnmapped.status} · {selectedUnmapped.count}회</em>
                    </div>
                    <label className="compact-field">
                      기존 기준 키워드에 별칭 등록
                      <select value={selectedKeywordId} onChange={(event) => setSelectedKeywordId(event.target.value)}>
                        {keywords.map((keyword) => <option key={keyword.keyword_id} value={keyword.keyword_id}>{keyword.keyword_name}</option>)}
                      </select>
                    </label>
                    <label className="compact-field">
                      별칭으로 저장할 상품어
                      <input value={aliasInput} onChange={(event) => setAliasInput(event.target.value)} placeholder="예: 치즈케이크" />
                    </label>
                    <p className="helper-text compact">장소명은 제외하고 상품명 또는 상품 별칭만 입력합니다.</p>
                    <button className="ghost-button" disabled={selectedClosed || updatingId === selectedUnmapped.unmapped_id} onClick={handleRegisterAlias} type="button">
                      <Tags size={16} /> 선택 검색어를 별칭으로 등록
                    </button>
                    <label className="compact-field">
                      새 기준 키워드 생성
                      <input value={newKeywordName} onChange={(event) => setNewKeywordName(event.target.value)} placeholder="예: 소금빵" />
                    </label>
                    <button className="ghost-button" disabled={selectedClosed || updatingId === selectedUnmapped.unmapped_id} onClick={handleCreateKeyword} type="button">
                      <Plus size={16} /> 새 키워드 생성 후 별칭 등록
                    </button>
                    <div className="table-actions">
                      <button className="ghost-button" disabled={selectedClosed} onClick={() => handleUnmappedStatus(selectedUnmapped, "HOLD")} type="button"><Pause size={16} /> 보류</button>
                      <button className="danger-button" disabled={selectedClosed} onClick={() => handleUnmappedStatus(selectedUnmapped, "REJECTED")} type="button"><X size={16} /> 반려</button>
                    </div>
                    <p className="helper-text">처리 완료된 검색어는 큐에서 삭제해도 Keyword/KeywordAlias 데이터는 유지됩니다.</p>
                  </>
                ) : (
                  <p className="helper-text">왼쪽 큐에서 처리할 검색어를 선택해주세요.</p>
                )}
              </article>
            </section>
          )}

          {activeTab === "키워드 관리" && (
            <section className="table-section">
              <h2>Keyword / KeywordAlias</h2>
              <table>
                <thead><tr><th>기준 키워드</th><th>Trend Score</th><th>상태</th><th>KeywordAlias</th></tr></thead>
                <tbody>
                  {filteredKeywords.map((keyword) => (
                    <tr key={keyword.keyword_id}>
                      <td>{keyword.keyword_name}</td>
                      <td>{keyword.trend_score}</td>
                      <td><span className="status-chip success">{keyword.status}</span></td>
                      <td>
                        <div className="alias-list">
                          {keyword.aliases.map((alias) => (
                            <span className="alias-item" key={alias.alias_id}>
                              {alias.alias}
                              <button
                                className="alias-delete-button"
                                disabled={updatingId === `alias-${alias.alias_id}`}
                                onClick={() => handleDeleteAlias(alias)}
                                title="별칭 삭제"
                                type="button"
                              >
                                <X size={12} />
                              </button>
                            </span>
                          ))}
                        </div>
                      </td>
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
                <span className="inline-feedback">총 {mappingTotalCount}건 · 매핑 성공 {mappingSuccessCount}건 · 미매핑 {searchLogPagination.unmapped_count}건</span>
              </div>
              <div className="table-control-row">
                <span>
                  {searchLogStart}-{searchLogEnd} / {mappingTotalCount}건
                  {normalizedQuery && ` · "${normalizedQuery}" 검색 결과`}
                </span>
                <label>
                  페이지당
                  <select
                    value={searchLogLimit}
                    onChange={(event) => setSearchLogLimit(Number(event.target.value))}
                  >
                    {searchLogLimitOptions.map((option) => (
                      <option key={option} value={option}>{option}개</option>
                    ))}
                  </select>
                </label>
              </div>
              <table>
                <thead><tr><th>Raw Query</th><th>매핑 상태</th><th>기준 키워드</th><th>사용자</th><th>검색 기준 위치</th><th>결과 수</th><th>검색 시각</th></tr></thead>
                <tbody>
                  {filteredLogs.map((log) => (
                    <tr key={log.log_id}>
                      <td>{log.raw_query}</td>
                      <td><span className={`status-chip ${log.mapping_status === "MAPPED" ? "success" : "warning"}`}>{log.mapping_status}</span></td>
                      <td>{log.keyword_name ?? "-"}</td>
                      <td>{log.user_name ?? log.user_role ?? "비로그/미지정"}</td>
                      <td>{log.location_query ?? "-"}</td>
                      <td>{log.result_count}</td>
                      <td>{formatDateTime(log.created_at)}</td>
                    </tr>
                  ))}
                  {filteredLogs.length === 0 && <tr><td colSpan="7">조건에 맞는 검색 로그가 없습니다.</td></tr>}
                </tbody>
              </table>
              <div className="pagination-row">
                <button
                  className="ghost-button small"
                  disabled={!canMovePrevLogPage}
                  onClick={() => setSearchLogPage((page) => Math.max(page - 1, 1))}
                  type="button"
                >
                  이전
                </button>
                <span>{searchLogPagination.page} / {searchLogPagination.total_pages}</span>
                <button
                  className="ghost-button small"
                  disabled={!canMoveNextLogPage}
                  onClick={() => setSearchLogPage((page) => page + 1)}
                  type="button"
                >
                  다음
                </button>
              </div>
            </section>
          )}

          {activeTab === "매장 승인" && (
            <section className="table-section">
              <div className="section-heading-row">
                <h2>승인 대기 매장</h2>
                <span className="inline-feedback">{filteredStores.length}건</span>
              </div>
              <table>
                <thead>
                  <tr><th>매장</th><th>판매자</th><th>주소</th><th>좌표</th><th>연락처</th><th>상태</th><th>처리</th></tr>
                </thead>
                <tbody>
                  {filteredStores.map((store) => (
                    <tr key={store.store_id}>
                      <td>{store.name}</td>
                      <td>{store.seller_name}<br /><span className="helper-text compact">{store.business_name}</span></td>
                      <td>{store.address}</td>
                      <td>{store.latitude}, {store.longitude}</td>
                      <td>{store.phone ?? store.contact_phone ?? "-"}</td>
                      <td><span className="status-chip warning">{store.approval_status}</span></td>
                      <td>
                        <div className="table-actions">
                          <button className="ghost-button" disabled={updatingId === store.store_id} onClick={() => handleStoreApproval(store.store_id, "APPROVED")} type="button">
                            <Check size={16} /> 승인
                          </button>
                          <button className="danger-button" disabled={updatingId === store.store_id} onClick={() => handleStoreApproval(store.store_id, "REJECTED")} type="button">
                            <X size={16} /> 반려
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredStores.length === 0 && <tr><td colSpan="7">승인 대기 매장이 없습니다.</td></tr>}
                </tbody>
              </table>
            </section>
          )}

          {activeTab === "판매자 승인" && (
            <section className="table-section">
              <div className="section-heading-row">
                <h2>판매자 승인 관리</h2>
                <span className="inline-feedback">승인 대기 {metrics.pendingSellers}건 · 전체 {filteredSellers.length}건</span>
              </div>
              <table>
                <thead>
                  <tr><th>판매자</th><th>사업자 정보</th><th>연락처</th><th>매장 수</th><th>상태</th><th>가입일</th><th>처리</th></tr>
                </thead>
                <tbody>
                  {filteredSellers.map((seller) => {
                    const isUpdating = updatingId === `seller-${seller.seller_id}`;
                    const statusClass = seller.approval_status === "APPROVED" ? "success" : seller.approval_status === "REJECTED" ? "danger" : "warning";

                    return (
                      <tr key={seller.seller_id}>
                        <td>
                          <strong>{seller.user_name}</strong><br />
                          <span className="helper-text compact">{seller.login_id}</span>
                        </td>
                        <td>
                          {seller.business_name}<br />
                          <span className="helper-text compact">{seller.business_registration_no} · 대표 {seller.representative_name}</span>
                        </td>
                        <td>{seller.contact_phone ?? seller.user_phone ?? "-"}</td>
                        <td>{seller.store_count}</td>
                        <td><span className={`status-chip ${statusClass}`}>{seller.approval_status}</span></td>
                        <td>{formatDateTime(seller.created_at)}</td>
                        <td>
                          <div className="table-actions">
                            {seller.approval_status !== "APPROVED" && (
                              <button className="ghost-button" disabled={isUpdating} onClick={() => handleSellerApproval(seller.seller_id, "APPROVED")} type="button">
                                <Check size={16} /> 승인
                              </button>
                            )}
                            {seller.approval_status !== "REJECTED" && (
                              <button className="danger-button" disabled={isUpdating} onClick={() => handleSellerApproval(seller.seller_id, "REJECTED")} type="button">
                                <X size={16} /> 반려
                              </button>
                            )}
                            {seller.approval_status !== "PENDING" && (
                              <button className="ghost-button" disabled={isUpdating} onClick={() => handleSellerApproval(seller.seller_id, "PENDING")} type="button">
                                <RotateCcw size={16} /> 재검토
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredSellers.length === 0 && <tr><td colSpan="7">조건에 맞는 판매자가 없습니다.</td></tr>}
                </tbody>
              </table>
            </section>
          )}

          {activeTab === "사용자 관리" && (
            <section className="table-section">
              <div className="section-heading-row">
                <h2>사용자 계정 관리</h2>
                <span className="inline-feedback">전체 {filteredUsers.length}명</span>
              </div>
              <table>
                <thead>
                  <tr><th>사용자</th><th>역할</th><th>연락처</th><th>판매자 승인</th><th>계정 상태</th><th>가입일</th><th>처리</th></tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => {
                    const isUpdating = updatingId === `user-${user.user_id}`;
                    const userStatusClass = user.status === "ACTIVE" ? "success" : user.status === "SUSPENDED" ? "danger" : "warning";
                    const sellerStatusClass = user.seller_approval_status === "APPROVED" ? "success" : user.seller_approval_status === "REJECTED" ? "danger" : "warning";

                    return (
                      <tr key={user.user_id}>
                        <td>
                          <strong>{user.name}</strong><br />
                          <span className="helper-text compact">{user.login_id}</span>
                        </td>
                        <td>{user.role}</td>
                        <td>{user.phone ?? "-"}</td>
                        <td>
                          {user.role === "SELLER"
                            ? <span className={`status-chip ${sellerStatusClass}`}>{user.seller_approval_status}</span>
                            : "-"}
                        </td>
                        <td><span className={`status-chip ${userStatusClass}`}>{user.status}</span></td>
                        <td>{formatDateTime(user.created_at)}</td>
                        <td>
                          <div className="table-actions">
                            {user.status !== "ACTIVE" && (
                              <button className="ghost-button" disabled={isUpdating} onClick={() => handleUserStatus(user.user_id, "ACTIVE")} type="button">
                                <Check size={16} /> 활성
                              </button>
                            )}
                            {user.status !== "SUSPENDED" && (
                              <button className="danger-button" disabled={isUpdating} onClick={() => handleUserStatus(user.user_id, "SUSPENDED")} type="button">
                                <X size={16} /> 정지
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredUsers.length === 0 && <tr><td colSpan="7">조건에 맞는 사용자가 없습니다.</td></tr>}
                </tbody>
              </table>
            </section>
          )}

          {!["미매핑 검색어", "키워드 관리", "검색 로그", "매장 승인", "판매자 승인", "사용자 관리"].includes(activeTab) && (
            <section className="table-section empty-admin-section">
              <h2>{activeTab}</h2>
              <p>이번 시연에서는 검색 로그, 키워드, 미매핑 검색어, 매장 승인 흐름을 중심으로 설명합니다.</p>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

export default AdminDataPage;
