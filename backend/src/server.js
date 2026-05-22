import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";
import { pool } from "./config/db.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 4000);
const jwtSecret = process.env.JWT_SECRET ?? "trend-product-demo-secret";
const jwtExpiresIn = process.env.JWT_EXPIRES_IN ?? "8h";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, "..", "public");
const uploadDir = path.join(publicDir, "uploads", "products");

app.use(cors());
app.use(express.json({ limit: "6mb" }));
app.use("/uploads", express.static(path.join(publicDir, "uploads")));
app.get("/uploads/products/:fileName", (req, res) => {
  const label = decodeURIComponent(String(req.params.fileName ?? "상품")).replace(/\.[^.]+$/, "").slice(0, 12) || "상품";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320">
    <rect width="320" height="320" rx="24" fill="#f0f4f2"/>
    <circle cx="160" cy="132" r="48" fill="#d9e7e1"/>
    <rect x="72" y="202" width="176" height="30" rx="15" fill="#d9e7e1"/>
    <text x="160" y="272" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="#5f6f7c">${label}</text>
  </svg>`;
  res.type("image/svg+xml").send(svg);
});

function ok(data, message = "success") {
  return { data, message };
}

function toUserResponse(row) {
  return {
    user_id: row.user_id,
    role: row.role,
    login_id: row.login_id,
    name: row.name,
    phone: row.phone,
    status: row.status,
  };
}

function issueAuthSession(row) {
  const user = toUserResponse(row);
  const token = jwt.sign(
    {
      user_id: user.user_id,
      role: user.role,
      login_id: user.login_id,
      name: user.name,
      status: user.status,
    },
    jwtSecret,
    { expiresIn: jwtExpiresIn }
  );

  return {
    user,
    session: {
      token,
      token_type: "Bearer",
      expires_in: jwtExpiresIn,
    },
  };
}

function getBearerToken(req) {
  const header = String(req.headers.authorization ?? "");
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

async function loadActiveUserFromToken(token) {
  const decoded = jwt.verify(token, jwtSecret);
  const [rows] = await pool.query(
    `SELECT user_id, role, login_id, name, phone, status
       FROM users
      WHERE user_id = ?
      LIMIT 1`,
    [decoded.user_id]
  );

  if (rows.length === 0 || rows[0].status !== "ACTIVE") {
    return null;
  }

  return toUserResponse(rows[0]);
}

async function authenticateToken(req, res, next) {
  const token = getBearerToken(req);

  if (!token) {
    return res.status(401).json({ message: "로그인이 필요합니다.", code: "AUTH_REQUIRED" });
  }

  try {
    req.user = await loadActiveUserFromToken(token);
    if (!req.user) {
      return res.status(403).json({ message: "사용할 수 없는 계정입니다.", code: "USER_NOT_ACTIVE" });
    }
    return next();
  } catch {
    return res.status(401).json({ message: "로그인 정보가 만료되었거나 유효하지 않습니다.", code: "INVALID_AUTH_TOKEN" });
  }
}

async function optionalAuthenticateToken(req, _res, next) {
  const token = getBearerToken(req);
  if (!token) return next();

  try {
    req.user = await loadActiveUserFromToken(token);
  } catch {
    req.user = null;
  }

  return next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "로그인이 필요합니다.", code: "AUTH_REQUIRED" });
    }

    if (roles.length > 0 && !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "요청 권한이 없습니다.", code: "FORBIDDEN_ROLE" });
    }

    return next();
  };
}

async function resolveSellerProfileId(userId) {
  const numericUserId = Number(userId);
  if (!numericUserId) return null;

  const [rows] = await pool.query(
    `SELECT seller_id, approval_status
       FROM seller_profiles
      WHERE user_id = ?
      LIMIT 1`,
    [numericUserId]
  );

  return rows.length > 0 ? Number(rows[0].seller_id) : null;
}

async function resolveApprovedSellerProfileId(userId) {
  const numericUserId = Number(userId);
  if (!numericUserId) return { sellerProfileId: null, error: "SELLER_PROFILE_NOT_FOUND" };

  const [rows] = await pool.query(
    `SELECT seller_id, approval_status
       FROM seller_profiles
      WHERE user_id = ?
      LIMIT 1`,
    [numericUserId]
  );

  if (rows.length === 0) {
    return { sellerProfileId: null, error: "SELLER_PROFILE_NOT_FOUND" };
  }

  if (rows[0].approval_status !== "APPROVED") {
    return { sellerProfileId: null, error: "SELLER_NOT_APPROVED", approvalStatus: rows[0].approval_status };
  }

  return { sellerProfileId: Number(rows[0].seller_id), error: null };
}

function sendSellerAccessError(res, sellerAccess) {
  if (sellerAccess.error === "SELLER_NOT_APPROVED") {
    return res.status(403).json({
      message: "관리자 승인 이후 판매자 기능을 사용할 수 있습니다.",
      code: "SELLER_NOT_APPROVED",
      approval_status: sellerAccess.approvalStatus,
    });
  }

  return res.status(403).json({ message: "판매자 프로필을 찾을 수 없습니다.", code: "SELLER_PROFILE_NOT_FOUND" });
}

function sanitizeUploadFileName(fileName) {
  const extension = path.extname(String(fileName ?? "")).toLowerCase();
  const safeExtension = [".jpg", ".jpeg", ".png", ".webp"].includes(extension) ? extension : ".png";
  const baseName = path.basename(String(fileName ?? "product"), extension)
    .replace(/[^a-zA-Z0-9가-힣_-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 40) || "product";
  return `${Date.now()}-${baseName}${safeExtension}`;
}

function parseOpeningHours(openingHours) {
  const raw = String(openingHours ?? "").trim();
  const match = raw.match(/(\d{1,2}):(\d{2})\s*(?:~|-|–|—|부터|to)\s*(\d{1,2}):(\d{2})/i);
  if (!match) return null;

  const openHour = Number(match[1]);
  const openMinute = Number(match[2]);
  const closeHour = Number(match[3]);
  const closeMinute = Number(match[4]);

  if ([openHour, openMinute, closeHour, closeMinute].some((value) => !Number.isInteger(value))) return null;
  if (openHour > 23 || closeHour > 23 || openMinute > 59 || closeMinute > 59) return null;

  return {
    openMinutes: openHour * 60 + openMinute,
    closeMinutes: closeHour * 60 + closeMinute,
  };
}

function getMinutesFromVisitTime(visitTime) {
  const raw = String(visitTime ?? "");
  const match = raw.match(/T(\d{2}):(\d{2})/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

function isVisitTimeWithinOpeningHours(visitTime, openingHours) {
  const parsedHours = parseOpeningHours(openingHours);
  const visitMinutes = getMinutesFromVisitTime(visitTime);
  if (!parsedHours || visitMinutes === null) {
    return { checkable: false, valid: true };
  }

  const { openMinutes, closeMinutes } = parsedHours;
  const valid = closeMinutes > openMinutes
    ? visitMinutes >= openMinutes && visitMinutes <= closeMinutes
    : visitMinutes >= openMinutes || visitMinutes <= closeMinutes;

  return { checkable: true, valid, openMinutes, closeMinutes };
}

async function findCoordinatesForStore(address, name) {
  const kakaoKey = process.env.KAKAO_REST_API_KEY;
  const query = String(address || name || "").trim();

  if (!query || !kakaoKey || kakaoKey === "your_kakao_rest_api_key") {
    return null;
  }

  const candidates = [
    { url: "https://dapi.kakao.com/v2/local/search/address.json", param: "query" },
    { url: "https://dapi.kakao.com/v2/local/search/keyword.json", param: "query" },
  ];

  for (const candidate of candidates) {
    const url = new URL(candidate.url);
    url.searchParams.set(candidate.param, query);
    url.searchParams.set("size", "1");

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `KakaoAK ${kakaoKey}`,
        },
      });

      if (!response.ok) continue;

      const payload = await response.json();
      const place = payload.documents?.[0];
      const longitude = Number(place?.x);
      const latitude = Number(place?.y);

      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        return { latitude, longitude };
      }
    } catch (error) {
      console.warn("Kakao store geocoding failed.", error.message);
    }
  }

  return null;
}

function normalizeSearchText(value = "") {
  return String(value).trim().replace(/\s+/g, "").toLowerCase();
}

const LOCATION_INTENT_WORDS = ["맛집", "추천", "예약", "파는곳", "근처", "주변", "인근", "근방", "부근", "앞", "쪽", "에서"];

function sanitizeLocationCandidate(value = "") {
  let candidate = String(value).trim();

  let changed = true;
  while (changed) {
    const before = candidate;
    for (const word of LOCATION_INTENT_WORDS) {
      candidate = candidate.replace(new RegExp(`\\s*${word}\\s*$`), "");
    }
    changed = candidate !== before;
  }

  return candidate.trim();
}

function isCacheableLocationCandidate(value = "") {
  const normalized = normalizeSearchText(value);
  if (normalized.length < 2 || normalized.length > 20) return false;
  return !LOCATION_INTENT_WORDS.includes(normalized);
}

function extractLocationCandidate(rawQuery) {
  const query = String(rawQuery).trim();
  const locationPattern = /(.+?)(?:\s*(?:주변|근처|인근|쪽|에서|맛집)\s*)/;
  const matched = query.match(locationPattern);

  if (matched?.[1]) {
    return sanitizeLocationCandidate(matched[1]);
  }

  const stationMatched = query.match(/([가-힣A-Za-z0-9]+역)/);
  if (stationMatched?.[1]) {
    return sanitizeLocationCandidate(stationMatched[1]);
  }

  return null;
}

function escapeRegExp(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function removeMatchedTerms(rawQuery, terms = []) {
  let remaining = String(rawQuery).trim();

  for (const term of terms.filter(Boolean)) {
    remaining = remaining.replace(new RegExp(escapeRegExp(term), "gi"), " ");
    remaining = remaining.replace(new RegExp(escapeRegExp(normalizeSearchText(term)), "gi"), " ");
  }

  return remaining.replace(/\s+/g, " ").trim();
}

function deriveLocationCandidate(rawQuery, matchedTerms = []) {
  const hasMatchedTerm = matchedTerms.filter(Boolean).length > 0;
  const remaining = removeMatchedTerms(rawQuery, matchedTerms);
  const fromRemaining = sanitizeLocationCandidate(remaining);

  if (hasMatchedTerm && isCacheableLocationCandidate(fromRemaining)) {
    return fromRemaining;
  }

  return extractLocationCandidate(rawQuery);
}

const SEARCH_LOCATION_INTENT_WORDS = ["맛집", "추천", "예약", "파는곳", "근처", "주변", "인근", "근방", "부근", "앞", "쪽", "에서"];

function sanitizeSearchLocationCandidate(value = "") {
  let candidate = String(value).trim();

  let changed = true;
  while (changed) {
    const before = candidate;
    for (const word of SEARCH_LOCATION_INTENT_WORDS) {
      candidate = candidate.replace(new RegExp(`\\s*${word}\\s*$`), "");
    }
    changed = candidate !== before;
  }

  return candidate.trim();
}

function extractSearchLocationCandidate(rawQuery) {
  const query = String(rawQuery).trim();
  const locationPattern = /(.+?)(?:\s*(?:주변|근처|인근|근방|부근|앞|쪽|에서|맛집)\s*)/;
  const matched = query.match(locationPattern);

  if (matched?.[1]) {
    return sanitizeSearchLocationCandidate(matched[1]);
  }

  const stationMatched = query.match(/([가-힣A-Za-z0-9]+역)/);
  if (stationMatched?.[1]) {
    return sanitizeSearchLocationCandidate(stationMatched[1]);
  }

  return null;
}

function deriveSearchLocationCandidate(rawQuery, matchedTerms = []) {
  const hasMatchedTerm = matchedTerms.filter(Boolean).length > 0;
  const remaining = removeMatchedTerms(rawQuery, matchedTerms);
  const fromRemaining = sanitizeSearchLocationCandidate(remaining);

  if (hasMatchedTerm && isCacheableLocationCandidate(fromRemaining)) {
    return fromRemaining;
  }

  const explicitLocation = extractSearchLocationCandidate(rawQuery);
  if (explicitLocation) {
    return explicitLocation;
  }

  if (!hasMatchedTerm && isCacheableLocationCandidate(rawQuery)) {
    return sanitizeSearchLocationCandidate(rawQuery);
  }

  return null;
}

function calculateDistanceKm(from, to) {
  if (!from || !to) return null;
  const earthRadiusKm = 6371;
  const latDistance = ((Number(to.latitude) - Number(from.latitude)) * Math.PI) / 180;
  const lngDistance = ((Number(to.longitude) - Number(from.longitude)) * Math.PI) / 180;
  const fromLat = (Number(from.latitude) * Math.PI) / 180;
  const toLat = (Number(to.latitude) * Math.PI) / 180;
  const a = Math.sin(latDistance / 2) ** 2
    + Math.cos(fromLat) * Math.cos(toLat) * Math.sin(lngDistance / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function findLocationFromQuery(rawQuery, fallbackLat, fallbackLng, { matchedTerms = [], allowClientFallback = true, fallbackLabel = "좌표 기준 위치" } = {}) {
  const locationCandidate = deriveSearchLocationCandidate(rawQuery, matchedTerms);

  if (locationCandidate) {
    const cached = await findLocationByText(locationCandidate);
    if (cached) return cached;
  }

  if (allowClientFallback && fallbackLat && fallbackLng) {
    return {
      query: fallbackLabel,
      latitude: Number(fallbackLat),
      longitude: Number(fallbackLng),
      source: "CLIENT_LOCATION",
    };
  }

  return null;
}

async function findLocationByText(locationText) {
  if (!isCacheableLocationCandidate(locationText)) {
    return null;
  }

  const normalized = normalizeSearchText(locationText);

  const [cacheRows] = await pool.query(
    `SELECT query, latitude, longitude, source
       FROM location_cache
      WHERE query_normalized = ?
      LIMIT 1`,
    [normalized]
  );

  if (cacheRows.length > 0) {
    return {
      query: cacheRows[0].query,
      latitude: Number(cacheRows[0].latitude),
      longitude: Number(cacheRows[0].longitude),
      source: cacheRows[0].source,
    };
  }

  const kakaoKey = process.env.KAKAO_REST_API_KEY;
  if (!kakaoKey || kakaoKey === "your_kakao_rest_api_key") {
    return null;
  }

  const url = new URL("https://dapi.kakao.com/v2/local/search/keyword.json");
  url.searchParams.set("query", locationText);
  url.searchParams.set("size", "1");

  let payload;

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `KakaoAK ${kakaoKey}`,
      },
    });

    if (!response.ok) {
      console.warn("Kakao Local REST API request failed.", response.status);
      return null;
    }

    payload = await response.json();
  } catch (error) {
    console.warn("Kakao Local REST API request failed.", error.message);
    return null;
  }

  const place = payload.documents?.[0];
  if (!place) return null;

  const location = {
    query: locationText,
    latitude: Number(place.y),
    longitude: Number(place.x),
    source: "KAKAO_LOCAL",
  };

  await pool.query(
    `INSERT INTO location_cache (query, query_normalized, latitude, longitude, source)
     VALUES (?, ?, ?, ?, 'KAKAO_LOCAL')
     ON DUPLICATE KEY UPDATE
       latitude = VALUES(latitude),
       longitude = VALUES(longitude),
       source = 'KAKAO_LOCAL',
       updated_at = CURRENT_TIMESTAMP`,
    [location.query, normalized, location.latitude, location.longitude]
  );

  return location;
}

async function findKeywordFromQuery(rawQuery) {
  const normalizedQuery = normalizeSearchText(rawQuery);

  const [keywordRows] = await pool.query(
    `SELECT keyword_id, keyword_name
       FROM keywords
      WHERE ? LIKE CONCAT('%', REPLACE(LOWER(keyword_name), ' ', ''), '%')
      ORDER BY CHAR_LENGTH(keyword_name) DESC
      LIMIT 1`,
    [normalizedQuery]
  );

  if (keywordRows.length > 0) {
    return {
      raw: keywordRows[0].keyword_name,
      keyword_id: keywordRows[0].keyword_id,
      keyword_name: keywordRows[0].keyword_name,
      mapped: true,
    };
  }

  const [aliasRows] = await pool.query(
    `SELECT k.keyword_id, k.keyword_name, ka.alias
       FROM keyword_aliases ka
       JOIN keywords k ON k.keyword_id = ka.keyword_id
      WHERE ? LIKE CONCAT('%', ka.alias_normalized, '%')
      ORDER BY CHAR_LENGTH(ka.alias_normalized) DESC
      LIMIT 1`,
    [normalizedQuery]
  );

  if (aliasRows.length > 0) {
    return {
      raw: aliasRows[0].alias,
      keyword_id: aliasRows[0].keyword_id,
      keyword_name: aliasRows[0].keyword_name,
      mapped: true,
    };
  }

  return {
    raw: rawQuery,
    keyword_id: null,
    keyword_name: null,
    mapped: false,
  };
}

async function findProductFromQuery(rawQuery) {
  const normalizedQuery = normalizeSearchText(rawQuery);

  const [productRows] = await pool.query(
    `SELECT product_id, name
       FROM products
      WHERE status = 'ACTIVE'
        AND ? LIKE CONCAT('%', REPLACE(LOWER(name), ' ', ''), '%')
      ORDER BY CHAR_LENGTH(name) DESC
      LIMIT 1`,
    [normalizedQuery]
  );

  if (productRows.length > 0) {
    return {
      product_id: productRows[0].product_id,
      name: productRows[0].name,
      raw: productRows[0].name,
      mapped: true,
    };
  }

  return {
    product_id: null,
    name: null,
    raw: rawQuery,
    mapped: false,
  };
}

async function findCategoryFromQuery(rawQuery) {
  const normalizedQuery = normalizeSearchText(rawQuery);

  const [categoryRows] = await pool.query(
    `SELECT category_id, name
       FROM product_categories
      WHERE status = 'ACTIVE'
        AND ? LIKE CONCAT('%', REPLACE(LOWER(name), ' ', ''), '%')
      ORDER BY CHAR_LENGTH(name) DESC
      LIMIT 1`,
    [normalizedQuery]
  );

  if (categoryRows.length > 0) {
    return {
      category_id: categoryRows[0].category_id,
      name: categoryRows[0].name,
      raw: categoryRows[0].name,
      mapped: true,
    };
  }

  return {
    category_id: null,
    name: null,
    raw: rawQuery,
    mapped: false,
  };
}

async function logSearch({ userId, rawQuery, keyword, location, resultCount, mapped = keyword.mapped }) {
  const mappingStatus = mapped ? "MAPPED" : "UNMAPPED";

  await pool.query(
    `INSERT INTO search_logs (user_id, keyword_id, raw_query, location_query, result_count, mapping_status)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId || null, keyword.keyword_id, rawQuery, location?.query ?? null, resultCount, mappingStatus]
  );

  if (!mapped) {
    const normalized = normalizeSearchText(rawQuery);
    await pool.query(
      `INSERT INTO unmapped_searches (raw_query, raw_query_normalized, count, status)
       VALUES (?, ?, 1, 'PENDING')
       ON DUPLICATE KEY UPDATE count = count + 1, last_seen_at = CURRENT_TIMESTAMP`,
      [rawQuery, normalized]
    );
  }
}

async function getTrendingKeywords() {
  const [searchRows] = await pool.query(
    `SELECT k.keyword_id, k.keyword_name, COUNT(*) AS search_count, MAX(sl.created_at) AS last_searched_at
       FROM search_logs sl
       JOIN keywords k ON k.keyword_id = sl.keyword_id
      WHERE sl.keyword_id IS NOT NULL
        AND sl.mapping_status = 'MAPPED'
        AND k.status = 'ACTIVE'
        AND sl.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY k.keyword_id, k.keyword_name
      HAVING COUNT(*) >= 1
      ORDER BY search_count DESC, last_searched_at DESC
      LIMIT 10`
  );

  if (searchRows.length > 0) {
    return searchRows.map((row, index) => ({
      rank: index + 1,
      keyword_id: row.keyword_id,
      keyword_name: row.keyword_name,
      search_count: Number(row.search_count),
      rank_basis: "SEARCH_LOG_7D",
    }));
  }

  const [fallbackRows] = await pool.query(
    `SELECT keyword_id, keyword_name, trend_score
       FROM keywords
      WHERE status = 'ACTIVE'
      ORDER BY trend_score DESC, keyword_id ASC
      LIMIT 10`
  );

  return fallbackRows.map((row, index) => ({
    rank: index + 1,
    keyword_id: row.keyword_id,
    keyword_name: row.keyword_name,
    search_count: 0,
    rank_basis: "ADMIN_TREND_SCORE",
  }));
}

app.get("/api/health", async (_req, res) => {
  try {
    const [rows] = await pool.query("SELECT 1 AS ok");
    res.json({ status: "ok", db: rows[0].ok === 1 });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: "error", db: false });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const loginId = String(req.body.login_id ?? "").trim();
  const password = String(req.body.password ?? "");

  if (!loginId || !password) {
    return res.status(400).json({ message: "login_id and password are required.", code: "INVALID_LOGIN_REQUEST" });
  }

  const [rows] = await pool.query(
    `SELECT user_id, role, login_id, password_hash, name, phone, status
       FROM users
      WHERE login_id = ?
      LIMIT 1`,
    [loginId]
  );

  if (rows.length === 0 || rows[0].password_hash !== password) {
    return res.status(401).json({ message: "아이디 또는 비밀번호가 올바르지 않습니다.", code: "INVALID_CREDENTIALS" });
  }

  if (rows[0].status === "SUSPENDED") {
    return res.status(403).json({ message: "정지된 계정입니다.", code: "USER_SUSPENDED" });
  }

  res.json(ok(issueAuthSession(rows[0])));
});

app.post("/api/auth/register", async (req, res) => {
  const role = String(req.body.role ?? "CONSUMER").trim().toUpperCase();
  const loginId = String(req.body.login_id ?? "").trim();
  const password = String(req.body.password ?? "");
  const name = String(req.body.name ?? "").trim();
  const phone = String(req.body.phone ?? "").trim() || null;

  if (!["CONSUMER", "SELLER"].includes(role)) {
    return res.status(400).json({ message: "소비자 또는 판매자만 회원가입할 수 있습니다.", code: "INVALID_ROLE" });
  }

  if (!loginId || !password || !name) {
    return res.status(400).json({ message: "role, login_id, password, name are required.", code: "INVALID_REGISTER_REQUEST" });
  }

  if (loginId.length < 4 || loginId.length > 50 || password.length < 4 || password.length > 100 || name.length > 50) {
    return res.status(400).json({ message: "아이디/비밀번호/이름 길이를 확인해 주세요.", code: "INVALID_REGISTER_LENGTH" });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [result] = await connection.query(
      `INSERT INTO users (role, login_id, password_hash, name, phone, status)
       VALUES (?, ?, ?, ?, ?, 'ACTIVE')`,
      [role, loginId, password, name, phone]
    );

    if (role === "SELLER") {
      await connection.query(
        `INSERT INTO seller_profiles
         (user_id, business_name, business_registration_no, representative_name, contact_phone, approval_status, approved_at)
         VALUES (?, ?, ?, ?, ?, 'PENDING', NULL)`,
        [result.insertId, `${name} 판매자`, `DEMO-${result.insertId}`, name, phone ?? "미입력"]
      );
    }

    const [rows] = await connection.query(
      `SELECT user_id, role, login_id, password_hash, name, phone, status
         FROM users
        WHERE user_id = ?`,
      [result.insertId]
    );

    await connection.commit();

    return res.status(201).json(ok(issueAuthSession(rows[0])));
  } catch (error) {
    await connection.rollback();

    if (error?.errno === 1062) {
      return res.status(409).json({ message: "이미 사용 중인 아이디입니다.", code: "DUPLICATE_LOGIN_ID" });
    }

    console.error(error);
    return res.status(500).json({ message: "회원가입 처리 중 오류가 발생했습니다.", code: "REGISTER_FAILED" });
  } finally {
    connection.release();
  }
});

app.get("/api/products", async (_req, res) => {
  const [rows] = await pool.query(
    `SELECT p.product_id, p.name, c.name AS category, p.description, p.price, p.image_url, p.status
       FROM products p
       LEFT JOIN product_categories c ON c.category_id = p.category_id
      WHERE p.status = 'ACTIVE'
      ORDER BY p.product_id`
  );
  res.json(ok(rows));
});

app.get("/api/product-categories", async (_req, res) => {
  const [rows] = await pool.query(
    `SELECT category_id, name, status
       FROM product_categories
      WHERE status = 'ACTIVE'
      ORDER BY category_id`
  );
  res.json(ok(rows));
});

app.post("/api/uploads/products", authenticateToken, requireRole("SELLER"), async (req, res) => {
  const fileName = String(req.body.file_name ?? req.body.fileName ?? "").trim();
  const dataUrl = String(req.body.data_url ?? req.body.dataUrl ?? "").trim();
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/);

  if (!fileName || !match) {
    return res.status(400).json({ message: "valid image file_name and data_url are required.", code: "INVALID_IMAGE_UPLOAD" });
  }

  const imageBuffer = Buffer.from(match[2], "base64");
  if (imageBuffer.length > 5 * 1024 * 1024) {
    return res.status(400).json({ message: "이미지 파일은 5MB 이하만 등록할 수 있습니다.", code: "IMAGE_TOO_LARGE" });
  }

  await fs.mkdir(uploadDir, { recursive: true });
  const storedFileName = sanitizeUploadFileName(fileName);
  await fs.writeFile(path.join(uploadDir, storedFileName), imageBuffer);

  res.status(201).json(ok({
    image_url: `/uploads/products/${storedFileName}`,
  }));
});

app.get("/api/products/trending", async (_req, res) => {
  const keywords = await getTrendingKeywords();
  res.json(ok(keywords));
});

app.get("/api/keywords/trending", async (_req, res) => {
  const keywords = await getTrendingKeywords();
  res.json(ok(keywords));
});

app.use("/api/admin", authenticateToken, requireRole("ADMIN"));

app.get("/api/admin/stores/pending", async (_req, res) => {
  const [rows] = await pool.query(
    `SELECT s.store_id, s.seller_id, s.name, s.address, s.latitude, s.longitude,
            s.phone, s.opening_hours, s.approval_status, s.created_at,
            sp.business_name, sp.representative_name, sp.contact_phone,
            u.user_id, u.login_id, u.name AS seller_name
       FROM stores s
       JOIN seller_profiles sp ON sp.seller_id = s.seller_id
       JOIN users u ON u.user_id = sp.user_id
      WHERE s.approval_status = 'PENDING'
      ORDER BY s.created_at DESC, s.store_id DESC`
  );

  res.json(ok(rows.map((row) => ({
    ...row,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
  }))));
});

app.patch("/api/admin/stores/:storeId/approval", async (req, res) => {
  const storeId = Number(req.params.storeId);
  const approvalStatus = String(req.body.approval_status ?? req.body.approvalStatus ?? "").trim().toUpperCase();
  const allowedStatuses = ["APPROVED", "REJECTED"];

  if (!storeId || !allowedStatuses.includes(approvalStatus)) {
    return res.status(400).json({ message: "storeId and valid approval_status are required.", code: "INVALID_STORE_APPROVAL_REQUEST" });
  }

  const [result] = await pool.query(
    `UPDATE stores
        SET approval_status = ?
      WHERE store_id = ?
        AND approval_status = 'PENDING'`,
    [approvalStatus, storeId]
  );

  if (result.affectedRows !== 1) {
    return res.status(404).json({ message: "승인 대기 매장을 찾지 못했습니다.", code: "PENDING_STORE_NOT_FOUND" });
  }

  const [rows] = await pool.query(
    `SELECT s.store_id, s.seller_id, s.name, s.address, s.latitude, s.longitude,
            s.phone, s.opening_hours, s.approval_status, s.created_at,
            sp.business_name, sp.representative_name, sp.contact_phone,
            u.user_id, u.login_id, u.name AS seller_name
       FROM stores s
       JOIN seller_profiles sp ON sp.seller_id = s.seller_id
       JOIN users u ON u.user_id = sp.user_id
      WHERE s.store_id = ?`,
    [storeId]
  );

  res.json(ok({
    ...rows[0],
    latitude: Number(rows[0].latitude),
    longitude: Number(rows[0].longitude),
  }));
});

app.get("/api/admin/sellers", async (_req, res) => {
  const [rows] = await pool.query(
    `SELECT sp.seller_id, sp.user_id, sp.business_name, sp.business_registration_no,
            sp.representative_name, sp.contact_phone, sp.approval_status, sp.approved_at,
            u.login_id, u.name AS user_name, u.phone AS user_phone, u.status AS user_status, u.created_at,
            COUNT(s.store_id) AS store_count
       FROM seller_profiles sp
       JOIN users u ON u.user_id = sp.user_id
       LEFT JOIN stores s ON s.seller_id = sp.seller_id
      GROUP BY sp.seller_id, sp.user_id, sp.business_name, sp.business_registration_no,
               sp.representative_name, sp.contact_phone, sp.approval_status, sp.approved_at,
               u.login_id, u.name, u.phone, u.status, u.created_at
      ORDER BY FIELD(sp.approval_status, 'PENDING', 'APPROVED', 'REJECTED'),
               u.created_at DESC,
               sp.seller_id DESC`
  );

  res.json(ok(rows.map((row) => ({
    ...row,
    store_count: Number(row.store_count),
  }))));
});

app.patch("/api/admin/sellers/:sellerId/approval", async (req, res) => {
  const sellerId = Number(req.params.sellerId);
  const approvalStatus = String(req.body.approval_status ?? req.body.approvalStatus ?? "").trim().toUpperCase();
  const allowedStatuses = ["APPROVED", "REJECTED", "PENDING"];

  if (!sellerId || !allowedStatuses.includes(approvalStatus)) {
    return res.status(400).json({ message: "sellerId and valid approval_status are required.", code: "INVALID_SELLER_APPROVAL_REQUEST" });
  }

  const [result] = await pool.query(
    `UPDATE seller_profiles
        SET approval_status = ?,
            approved_at = CASE WHEN ? = 'APPROVED' THEN CURRENT_TIMESTAMP ELSE NULL END
      WHERE seller_id = ?`,
    [approvalStatus, approvalStatus, sellerId]
  );

  if (result.affectedRows !== 1) {
    return res.status(404).json({ message: "판매자 프로필을 찾지 못했습니다.", code: "SELLER_PROFILE_NOT_FOUND" });
  }

  const [rows] = await pool.query(
    `SELECT sp.seller_id, sp.user_id, sp.business_name, sp.business_registration_no,
            sp.representative_name, sp.contact_phone, sp.approval_status, sp.approved_at,
            u.login_id, u.name AS user_name, u.phone AS user_phone, u.status AS user_status, u.created_at,
            COUNT(s.store_id) AS store_count
       FROM seller_profiles sp
       JOIN users u ON u.user_id = sp.user_id
       LEFT JOIN stores s ON s.seller_id = sp.seller_id
      WHERE sp.seller_id = ?
      GROUP BY sp.seller_id, sp.user_id, sp.business_name, sp.business_registration_no,
               sp.representative_name, sp.contact_phone, sp.approval_status, sp.approved_at,
               u.login_id, u.name, u.phone, u.status, u.created_at`,
    [sellerId]
  );

  res.json(ok({
    ...rows[0],
    store_count: Number(rows[0].store_count),
  }));
});

app.get("/api/admin/users", async (_req, res) => {
  const [rows] = await pool.query(
    `SELECT u.user_id, u.role, u.login_id, u.name, u.phone, u.status, u.created_at,
            sp.seller_id, sp.business_name, sp.approval_status AS seller_approval_status
       FROM users u
       LEFT JOIN seller_profiles sp ON sp.user_id = u.user_id
      ORDER BY FIELD(u.role, 'ADMIN', 'SELLER', 'CONSUMER'), u.created_at DESC, u.user_id DESC`
  );

  res.json(ok(rows));
});

app.patch("/api/admin/users/:userId/status", async (req, res) => {
  const userId = Number(req.params.userId);
  const status = String(req.body.status ?? "").trim().toUpperCase();
  const allowedStatuses = ["ACTIVE", "PENDING", "SUSPENDED"];

  if (!userId || !allowedStatuses.includes(status)) {
    return res.status(400).json({ message: "userId and valid status are required.", code: "INVALID_USER_STATUS_REQUEST" });
  }

  const [result] = await pool.query(
    `UPDATE users
        SET status = ?
      WHERE user_id = ?`,
    [status, userId]
  );

  if (result.affectedRows !== 1) {
    return res.status(404).json({ message: "사용자를 찾지 못했습니다.", code: "USER_NOT_FOUND" });
  }

  const [rows] = await pool.query(
    `SELECT u.user_id, u.role, u.login_id, u.name, u.phone, u.status, u.created_at,
            sp.seller_id, sp.business_name, sp.approval_status AS seller_approval_status
       FROM users u
       LEFT JOIN seller_profiles sp ON sp.user_id = u.user_id
      WHERE u.user_id = ?`,
    [userId]
  );

  res.json(ok(rows[0]));
});

app.get("/api/admin/search-logs", async (req, res) => {
  const page = Math.max(Number(req.query.page ?? 1) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit ?? 20) || 20, 10), 100);
  const offset = (page - 1) * limit;
  const query = String(req.query.q ?? "").trim();
  const whereParams = [];
  let whereSql = "";

  if (query) {
    const likeQuery = `%${query}%`;
    whereSql = `WHERE sl.raw_query LIKE ?
                   OR k.keyword_name LIKE ?
                   OR sl.location_query LIKE ?
                   OR u.name LIKE ?
                   OR u.role LIKE ?`;
    whereParams.push(likeQuery, likeQuery, likeQuery, likeQuery, likeQuery);
  }

  const [summaryRows] = await pool.query(
    `SELECT COUNT(*) AS total_count,
            COALESCE(SUM(CASE WHEN sl.mapping_status = 'MAPPED' THEN 1 ELSE 0 END), 0) AS mapped_count
       FROM search_logs sl
       LEFT JOIN users u ON u.user_id = sl.user_id
       LEFT JOIN keywords k ON k.keyword_id = sl.keyword_id
      ${whereSql}`,
    whereParams
  );

  const [rows] = await pool.query(
    `SELECT sl.log_id, sl.user_id, u.role AS user_role, u.name AS user_name,
            sl.keyword_id, k.keyword_name, sl.raw_query, sl.location_query,
            sl.result_count, sl.mapping_status, sl.created_at
       FROM search_logs sl
       LEFT JOIN users u ON u.user_id = sl.user_id
       LEFT JOIN keywords k ON k.keyword_id = sl.keyword_id
      ${whereSql}
      ORDER BY sl.created_at DESC, sl.log_id DESC
      LIMIT ? OFFSET ?`,
    [...whereParams, limit, offset]
  );

  const totalCount = Number(summaryRows[0]?.total_count ?? 0);
  const mappedCount = Number(summaryRows[0]?.mapped_count ?? 0);
  const totalPages = Math.max(Math.ceil(totalCount / limit), 1);

  res.json(ok({
    items: rows,
    pagination: {
      page,
      limit,
      total_count: totalCount,
      total_pages: totalPages,
      mapped_count: mappedCount,
      unmapped_count: totalCount - mappedCount,
    },
  }));
});

app.get("/api/admin/unmapped-searches", async (_req, res) => {
  const [rows] = await pool.query(
    `SELECT us.unmapped_id, us.raw_query, us.raw_query_normalized, us.count,
            us.status, us.resolved_action, us.resolved_keyword_id,
            rk.keyword_name AS resolved_keyword_name,
            us.created_keyword_id, ck.keyword_name AS created_keyword_name,
            us.resolution_note, us.resolved_by, u.name AS resolved_by_name,
            us.resolved_at, us.created_at, us.last_seen_at
       FROM unmapped_searches us
       LEFT JOIN keywords rk ON rk.keyword_id = us.resolved_keyword_id
       LEFT JOIN keywords ck ON ck.keyword_id = us.created_keyword_id
       LEFT JOIN users u ON u.user_id = us.resolved_by
      ORDER BY FIELD(us.status, 'PENDING', 'HOLD', 'RESOLVED', 'REJECTED'),
               us.last_seen_at DESC,
               us.count DESC`
  );

  res.json(ok(rows));
});

app.get("/api/admin/keywords", async (_req, res) => {
  const [rows] = await pool.query(
    `SELECT k.keyword_id, k.keyword_name, k.trend_score, k.status, k.updated_at,
            ka.alias_id, ka.alias, ka.alias_normalized
       FROM keywords k
       LEFT JOIN keyword_aliases ka ON ka.keyword_id = k.keyword_id
      ORDER BY k.status ASC, k.trend_score DESC, k.keyword_name ASC, ka.alias ASC`
  );

  const keywordMap = new Map();
  rows.forEach((row) => {
    if (!keywordMap.has(row.keyword_id)) {
      keywordMap.set(row.keyword_id, {
        keyword_id: row.keyword_id,
        keyword_name: row.keyword_name,
        trend_score: row.trend_score,
        status: row.status,
        updated_at: row.updated_at,
        aliases: [],
      });
    }

    if (row.alias_id) {
      keywordMap.get(row.keyword_id).aliases.push({
        alias_id: row.alias_id,
        alias: row.alias,
        alias_normalized: row.alias_normalized,
      });
    }
  });

  res.json(ok(Array.from(keywordMap.values())));
});

app.post("/api/admin/unmapped-searches/:unmappedId/register-alias", async (req, res) => {
  const unmappedId = Number(req.params.unmappedId);
  const keywordId = Number(req.body.keyword_id ?? req.body.keywordId);
  const adminUserId = req.user.user_id;

  if (!unmappedId || !keywordId) {
    return res.status(400).json({ message: "unmappedId and keyword_id are required.", code: "INVALID_ALIAS_RESOLUTION_REQUEST" });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [unmappedRows] = await connection.query(
      `SELECT unmapped_id, raw_query, raw_query_normalized, status
         FROM unmapped_searches
        WHERE unmapped_id = ?
        FOR UPDATE`,
      [unmappedId]
    );

    if (unmappedRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: "미매핑 검색어를 찾지 못했습니다.", code: "UNMAPPED_SEARCH_NOT_FOUND" });
    }

    const [keywordRows] = await connection.query(
      `SELECT keyword_id, keyword_name
         FROM keywords
        WHERE keyword_id = ?
          AND status = 'ACTIVE'
        LIMIT 1`,
      [keywordId]
    );

    if (keywordRows.length === 0) {
      await connection.rollback();
      return res.status(400).json({ message: "활성 기준 키워드를 선택해 주세요.", code: "KEYWORD_NOT_FOUND" });
    }

    await connection.query(
      `INSERT INTO keyword_aliases (keyword_id, alias, alias_normalized)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE keyword_id = VALUES(keyword_id)`,
      [keywordId, unmappedRows[0].raw_query, unmappedRows[0].raw_query_normalized]
    );

    await connection.query(
      `UPDATE unmapped_searches
          SET status = 'RESOLVED',
              resolved_action = 'ALIAS_REGISTERED',
              resolved_keyword_id = ?,
              created_keyword_id = NULL,
              resolution_note = ?,
              resolved_by = ?,
              resolved_at = CURRENT_TIMESTAMP
        WHERE unmapped_id = ?`,
      [keywordId, `"${keywordRows[0].keyword_name}"의 별칭으로 등록`, adminUserId, unmappedId]
    );

    await connection.commit();
    res.json(ok({ unmapped_id: unmappedId, status: "RESOLVED", resolved_action: "ALIAS_REGISTERED", keyword_id: keywordId }));
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ message: "별칭 등록 처리 중 오류가 발생했습니다.", code: "ALIAS_RESOLUTION_FAILED" });
  } finally {
    connection.release();
  }
});

app.post("/api/admin/unmapped-searches/:unmappedId/create-keyword", async (req, res) => {
  const unmappedId = Number(req.params.unmappedId);
  const keywordName = String(req.body.keyword_name ?? req.body.keywordName ?? "").trim();
  const adminUserId = req.user.user_id;

  if (!unmappedId || !keywordName) {
    return res.status(400).json({ message: "unmappedId and keyword_name are required.", code: "INVALID_KEYWORD_RESOLUTION_REQUEST" });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [unmappedRows] = await connection.query(
      `SELECT unmapped_id, raw_query, raw_query_normalized, count, status
         FROM unmapped_searches
        WHERE unmapped_id = ?
        FOR UPDATE`,
      [unmappedId]
    );

    if (unmappedRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: "미매핑 검색어를 찾지 못했습니다.", code: "UNMAPPED_SEARCH_NOT_FOUND" });
    }

    const [keywordResult] = await connection.query(
      `INSERT INTO keywords (keyword_name, trend_score, status)
       VALUES (?, ?, 'ACTIVE')`,
      [keywordName, unmappedRows[0].count]
    );

    await connection.query(
      `INSERT INTO keyword_aliases (keyword_id, alias, alias_normalized)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE keyword_id = VALUES(keyword_id)`,
      [keywordResult.insertId, unmappedRows[0].raw_query, unmappedRows[0].raw_query_normalized]
    );

    await connection.query(
      `UPDATE unmapped_searches
          SET status = 'RESOLVED',
              resolved_action = 'KEYWORD_CREATED',
              resolved_keyword_id = NULL,
              created_keyword_id = ?,
              resolution_note = ?,
              resolved_by = ?,
              resolved_at = CURRENT_TIMESTAMP
        WHERE unmapped_id = ?`,
      [keywordResult.insertId, `새 기준 키워드 "${keywordName}" 생성`, adminUserId, unmappedId]
    );

    await connection.commit();
    res.status(201).json(ok({ unmapped_id: unmappedId, status: "RESOLVED", resolved_action: "KEYWORD_CREATED", keyword_id: keywordResult.insertId, keyword_name: keywordName }));
  } catch (error) {
    await connection.rollback();
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "이미 존재하는 키워드 또는 별칭입니다.", code: "DUPLICATE_KEYWORD_OR_ALIAS" });
    }
    console.error(error);
    res.status(500).json({ message: "새 키워드 생성 처리 중 오류가 발생했습니다.", code: "KEYWORD_RESOLUTION_FAILED" });
  } finally {
    connection.release();
  }
});

app.patch("/api/admin/unmapped-searches/:unmappedId/status", async (req, res) => {
  const unmappedId = Number(req.params.unmappedId);
  const status = String(req.body.status ?? "").trim().toUpperCase();
  const adminUserId = req.user.user_id;
  const allowedStatuses = ["PENDING", "HOLD", "REJECTED"];

  if (!unmappedId || !allowedStatuses.includes(status)) {
    return res.status(400).json({ message: "unmappedId and valid status are required.", code: "INVALID_UNMAPPED_STATUS_REQUEST" });
  }

  const note = status === "HOLD"
    ? "검색량 증가 또는 상품성 확인 후 재검토"
    : status === "REJECTED"
      ? "상품 키워드로 부적절하여 반려"
      : null;

  await pool.query(
    `UPDATE unmapped_searches
        SET status = ?,
            resolved_action = NULL,
            resolved_keyword_id = NULL,
            created_keyword_id = NULL,
            resolution_note = ?,
            resolved_by = CASE WHEN ? = 'PENDING' THEN NULL ELSE ? END,
            resolved_at = CASE WHEN ? = 'PENDING' THEN NULL ELSE CURRENT_TIMESTAMP END
      WHERE unmapped_id = ?`,
    [status, note, status, adminUserId, status, unmappedId]
  );

  res.json(ok({ unmapped_id: unmappedId, status, resolution_note: note }));
});

app.delete("/api/admin/unmapped-searches/:unmappedId", async (req, res) => {
  const unmappedId = Number(req.params.unmappedId);

  if (!unmappedId) {
    return res.status(400).json({ message: "valid unmappedId is required.", code: "INVALID_UNMAPPED_DELETE_REQUEST" });
  }

  const [result] = await pool.query(
    `DELETE FROM unmapped_searches
      WHERE unmapped_id = ?`,
    [unmappedId]
  );

  if (result.affectedRows !== 1) {
    return res.status(404).json({ message: "미매핑 검색어를 찾지 못했습니다.", code: "UNMAPPED_SEARCH_NOT_FOUND" });
  }

  res.json(ok({ unmapped_id: unmappedId }, "미매핑 검색어를 삭제했습니다."));
});

app.get("/api/search", optionalAuthenticateToken, async (req, res) => {
  const rawQuery = String(req.query.query ?? "").trim();
  const radiusKm = Number(req.query.radiusKm ?? 5);

  if (!rawQuery) {
    return res.status(400).json({ message: "query is required.", code: "QUERY_REQUIRED" });
  }

  const keyword = await findKeywordFromQuery(rawQuery);
  const product = keyword.keyword_id ? { product_id: null, name: null, mapped: false } : await findProductFromQuery(rawQuery);
  const category = keyword.keyword_id || product.product_id
    ? { category_id: null, name: null, mapped: false }
    : await findCategoryFromQuery(rawQuery);
  const matchedTerms = [
    keyword.keyword_id ? keyword.raw : null,
    product.product_id ? product.raw : null,
    category.category_id ? category.raw : null,
  ];
  const location = await findLocationFromQuery(rawQuery, req.query.lat, req.query.lng, {
    matchedTerms,
    allowClientFallback: Boolean(keyword.keyword_id || product.product_id || category.category_id),
    fallbackLabel: String(req.query.locationLabel ?? "좌표 기준 위치").trim() || "좌표 기준 위치",
  });
  const hasSearchIntent = Boolean(keyword.keyword_id || product.product_id || category.category_id || location);

  const params = [];
  let productWhere = "";

  if (keyword.keyword_id) {
    productWhere = "AND p.name = ?";
    params.push(keyword.keyword_name);
  } else if (product.product_id) {
    productWhere = "AND p.product_id = ?";
    params.push(product.product_id);
  } else if (category.category_id) {
    productWhere = "AND c.category_id = ?";
    params.push(category.category_id);
  }

  if (!hasSearchIntent) {
    await logSearch({
      userId: req.user?.user_id,
      rawQuery,
      keyword,
      location: null,
      resultCount: 0,
      mapped: false,
    });

    return res.json(ok({ location: null, keyword, product, category, radius_km: radiusKm, stores: [] }));
  }

  const [rows] = await pool.query(
    `SELECT s.store_id, s.name AS store_name, s.address, s.latitude, s.longitude,
            s.phone, s.opening_hours,
            i.inventory_id, i.product_id, p.name AS product_name, p.image_url,
            i.total_stock, i.reservable_stock, i.reserved_stock
       FROM stores s
       JOIN inventories i ON i.store_id = s.store_id
       JOIN products p ON p.product_id = i.product_id
       JOIN product_categories c ON c.category_id = p.category_id
      WHERE s.approval_status = 'APPROVED'
        AND p.status = 'ACTIVE'
        ${productWhere}
      ORDER BY s.store_id, i.inventory_id`,
    params
  );

  const stores = rows
    .map((row) => {
      const distanceKm = location ? calculateDistanceKm(location, row) : null;
      return {
        store_id: row.store_id,
        name: row.store_name,
        address: row.address,
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        phone: row.phone,
        opening_hours: row.opening_hours,
        distance_km: distanceKm === null ? null : Number(distanceKm.toFixed(2)),
        inventory: {
          inventory_id: row.inventory_id,
          product_id: row.product_id,
          product_name: row.product_name,
          image_url: row.image_url,
          total_stock: row.total_stock,
          reservable_stock: row.reservable_stock,
          reserved_stock: row.reserved_stock,
        },
      };
    })
    .filter((store) => store.distance_km !== null && store.distance_km <= radiusKm)
    .sort((a, b) => {
      if (a.distance_km === null || b.distance_km === null) return 0;
      return a.distance_km - b.distance_km;
    });

  await logSearch({
    userId: req.user?.user_id,
    rawQuery,
    keyword,
    location,
    resultCount: stores.length,
    mapped: Boolean(keyword.keyword_id || product.product_id || category.category_id),
  });

  res.json(ok({ location, keyword, product, category, radius_km: radiusKm, stores }));
});

app.get("/api/stores/nearby", async (req, res) => {
  const lat = req.query.lat ? Number(req.query.lat) : null;
  const lng = req.query.lng ? Number(req.query.lng) : null;
  const productId = req.query.productId ? Number(req.query.productId) : null;
  const radiusKm = Number(req.query.radiusKm ?? 5);
  const location = lat && lng
    ? { query: "현재 위치", latitude: lat, longitude: lng, source: "CLIENT_LOCATION" }
    : null;
  const params = [];
  let productWhere = "";

  if (productId) {
    productWhere = "AND p.product_id = ?";
    params.push(productId);
  }

  const [rows] = await pool.query(
    `SELECT s.store_id, s.name AS store_name, s.address, s.latitude, s.longitude,
            s.phone, s.opening_hours,
            i.inventory_id, i.product_id, p.name AS product_name, p.image_url,
            i.total_stock, i.reservable_stock, i.reserved_stock
       FROM stores s
       JOIN inventories i ON i.store_id = s.store_id
       JOIN products p ON p.product_id = i.product_id
      WHERE s.approval_status = 'APPROVED'
        AND p.status = 'ACTIVE'
        ${productWhere}
      ORDER BY s.store_id, i.inventory_id`,
    params
  );

  const stores = rows
    .map((row) => {
      const distanceKm = location ? calculateDistanceKm(location, row) : null;
      return {
        store_id: row.store_id,
        name: row.store_name,
        address: row.address,
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        phone: row.phone,
        opening_hours: row.opening_hours,
        distance_km: distanceKm === null ? null : Number(distanceKm.toFixed(2)),
        inventory: {
          inventory_id: row.inventory_id,
          product_id: row.product_id,
          product_name: row.product_name,
          image_url: row.image_url,
          total_stock: row.total_stock,
          reservable_stock: row.reservable_stock,
          reserved_stock: row.reserved_stock,
        },
      };
    })
    .filter((store) => store.distance_km === null || store.distance_km <= radiusKm)
    .sort((a, b) => {
      if (a.distance_km === null || b.distance_km === null) return 0;
      return a.distance_km - b.distance_km;
    });

  res.json(ok({ location, radius_km: radiusKm, stores }));
});

app.get("/api/stores/:storeId/inventories", async (req, res) => {
  const [rows] = await pool.query(
    `SELECT i.inventory_id, i.store_id, i.product_id, p.name AS product_name,
            p.image_url, i.total_stock, i.reservable_stock, i.reserved_stock
       FROM inventories i
       JOIN products p ON p.product_id = i.product_id
      WHERE i.store_id = ?
      ORDER BY i.inventory_id`,
    [req.params.storeId]
  );
  res.json(ok(rows));
});

app.get("/api/stores/:storeId", async (req, res) => {
  const [rows] = await pool.query(
    `SELECT store_id, seller_id, name, address, latitude, longitude, phone, opening_hours, approval_status
       FROM stores
      WHERE store_id = ?`,
    [req.params.storeId]
  );

  if (rows.length === 0) {
    return res.status(404).json({ message: "Store not found.", code: "STORE_NOT_FOUND" });
  }

  res.json(ok({
    ...rows[0],
    latitude: Number(rows[0].latitude),
    longitude: Number(rows[0].longitude),
  }));
});

app.use("/api/seller", authenticateToken, requireRole("SELLER"));

app.get("/api/seller/stores", async (req, res) => {
  const sellerUserId = req.user.user_id;
  const sellerAccess = await resolveApprovedSellerProfileId(sellerUserId);

  if (sellerAccess.error) {
    return sendSellerAccessError(res, sellerAccess);
  }

  const [rows] = await pool.query(
    `SELECT store_id, seller_id, name, address, latitude, longitude, phone, opening_hours, approval_status
      FROM stores
      WHERE seller_id = ?
      ORDER BY store_id`,
    [sellerAccess.sellerProfileId]
  );

  res.json(ok(rows.map((row) => ({
    ...row,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
  }))));
});

app.post("/api/seller/stores", async (req, res) => {
  const sellerUserId = req.user.user_id;
  const sellerAccess = await resolveApprovedSellerProfileId(sellerUserId);
  const name = String(req.body.name ?? "").trim();
  const address = String(req.body.address ?? "").trim();
  const phone = String(req.body.phone ?? "").trim() || null;
  const openingHours = String(req.body.opening_hours ?? req.body.openingHours ?? "").trim() || null;
  const latitudeInput = req.body.latitude === undefined ? null : Number(req.body.latitude);
  const longitudeInput = req.body.longitude === undefined ? null : Number(req.body.longitude);

  if (sellerAccess.error) {
    return sendSellerAccessError(res, sellerAccess);
  }

  if (!name || !address) {
    return res.status(400).json({ message: "name and address are required.", code: "INVALID_STORE_REQUEST" });
  }

  let coordinates = Number.isFinite(latitudeInput) && Number.isFinite(longitudeInput)
    ? { latitude: latitudeInput, longitude: longitudeInput }
    : await findCoordinatesForStore(address, name);

  if (!coordinates) {
    return res.status(400).json({ message: "주소 좌표를 찾지 못했습니다. 주소를 더 구체적으로 입력해 주세요.", code: "STORE_LOCATION_NOT_FOUND" });
  }

  const [result] = await pool.query(
    `INSERT INTO stores
     (seller_id, name, address, latitude, longitude, phone, opening_hours, approval_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
    [sellerAccess.sellerProfileId, name, address, coordinates.latitude, coordinates.longitude, phone, openingHours]
  );

  const [rows] = await pool.query(
    `SELECT store_id, seller_id, name, address, latitude, longitude, phone, opening_hours, approval_status
       FROM stores
      WHERE store_id = ?`,
    [result.insertId]
  );

  res.status(201).json(ok({
    ...rows[0],
    latitude: Number(rows[0].latitude),
    longitude: Number(rows[0].longitude),
  }));
});

app.patch("/api/seller/stores/:storeId", async (req, res) => {
  const sellerUserId = req.user.user_id;
  const sellerAccess = await resolveApprovedSellerProfileId(sellerUserId);
  const storeId = Number(req.params.storeId);
  const name = String(req.body.name ?? "").trim();
  const address = String(req.body.address ?? "").trim();
  const phone = String(req.body.phone ?? "").trim() || null;
  const openingHours = String(req.body.opening_hours ?? req.body.openingHours ?? "").trim() || null;
  const latitudeInput = req.body.latitude === undefined ? null : Number(req.body.latitude);
  const longitudeInput = req.body.longitude === undefined ? null : Number(req.body.longitude);

  if (sellerAccess.error) {
    return sendSellerAccessError(res, sellerAccess);
  }

  if (!storeId || !name || !address) {
    return res.status(400).json({ message: "storeId, name and address are required.", code: "INVALID_STORE_REQUEST" });
  }

  const [ownerRows] = await pool.query(
    `SELECT store_id
       FROM stores
      WHERE store_id = ?
        AND seller_id = ?
      LIMIT 1`,
    [storeId, sellerAccess.sellerProfileId]
  );

  if (ownerRows.length === 0) {
    return res.status(404).json({ message: "Store not found.", code: "STORE_NOT_FOUND" });
  }

  let coordinates = Number.isFinite(latitudeInput) && Number.isFinite(longitudeInput)
    ? { latitude: latitudeInput, longitude: longitudeInput }
    : await findCoordinatesForStore(address, name);

  if (!coordinates) {
    return res.status(400).json({ message: "주소 좌표를 찾지 못했습니다. 주소를 더 구체적으로 입력해 주세요.", code: "STORE_LOCATION_NOT_FOUND" });
  }

  await pool.query(
    `UPDATE stores
        SET name = ?,
            address = ?,
            latitude = ?,
            longitude = ?,
            phone = ?,
            opening_hours = ?
      WHERE store_id = ?
        AND seller_id = ?`,
    [name, address, coordinates.latitude, coordinates.longitude, phone, openingHours, storeId, sellerAccess.sellerProfileId]
  );

  const [rows] = await pool.query(
    `SELECT store_id, seller_id, name, address, latitude, longitude, phone, opening_hours, approval_status
       FROM stores
      WHERE store_id = ?`,
    [storeId]
  );

  res.json(ok({
    ...rows[0],
    latitude: Number(rows[0].latitude),
    longitude: Number(rows[0].longitude),
  }));
});

app.get("/api/seller/stores/:storeId/inventories", async (req, res) => {
  const sellerUserId = req.user.user_id;
  const sellerAccess = await resolveApprovedSellerProfileId(sellerUserId);
  const storeId = Number(req.params.storeId);

  if (sellerAccess.error) {
    return sendSellerAccessError(res, sellerAccess);
  }

  const [rows] = await pool.query(
    `SELECT i.inventory_id, i.store_id, i.product_id, p.name AS product_name,
            p.category_id, c.name AS category_name, p.description, p.price, p.image_url,
            i.total_stock, i.reservable_stock, i.reserved_stock
       FROM inventories i
       JOIN stores s ON s.store_id = i.store_id
       JOIN products p ON p.product_id = i.product_id
       LEFT JOIN product_categories c ON c.category_id = p.category_id
      WHERE i.store_id = ?
        AND s.seller_id = ?
      ORDER BY i.inventory_id`,
    [storeId, sellerAccess.sellerProfileId]
  );

  res.json(ok(rows));
});

app.post("/api/seller/stores/:storeId/products", async (req, res) => {
  const sellerUserId = req.user.user_id;
  const sellerAccess = await resolveApprovedSellerProfileId(sellerUserId);
  const storeId = Number(req.params.storeId);
  const name = String(req.body.name ?? "").trim();
  const categoryId = Number(req.body.category_id ?? req.body.categoryId);
  const categoryName = String(req.body.category ?? "").trim();
  const description = String(req.body.description ?? "").trim() || null;
  const price = req.body.price === "" || req.body.price === undefined ? null : Number(req.body.price);
  const imageUrl = String(req.body.image_url ?? req.body.imageUrl ?? "").trim() || null;
  const totalStock = Number(req.body.total_stock ?? req.body.totalStock);
  const reservableStock = Number(req.body.reservable_stock ?? req.body.reservableStock);

  if (sellerAccess.error) {
    return sendSellerAccessError(res, sellerAccess);
  }

  if (!storeId || !name || !Number.isInteger(totalStock) || !Number.isInteger(reservableStock)) {
    return res.status(400).json({ message: "storeId, name, total_stock, reservable_stock are required.", code: "INVALID_PRODUCT_REQUEST" });
  }

  if (name.length > 100 || totalStock < 0 || reservableStock < 0 || reservableStock > totalStock || (price !== null && (!Number.isInteger(price) || price < 0))) {
    return res.status(400).json({ message: "상품명, 가격, 재고 값을 확인해 주세요.", code: "INVALID_PRODUCT_VALUES" });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [storeRows] = await connection.query(
      `SELECT store_id
         FROM stores
        WHERE store_id = ?
          AND seller_id = ?
        FOR UPDATE`,
      [storeId, sellerAccess.sellerProfileId]
    );

    if (storeRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: "Store not found.", code: "STORE_NOT_FOUND" });
    }

    const [duplicateRows] = await connection.query(
      `SELECT i.inventory_id
         FROM inventories i
         JOIN products p ON p.product_id = i.product_id
        WHERE i.store_id = ?
          AND p.name = ?
          AND p.status <> 'DELETED'
        LIMIT 1`,
      [storeId, name]
    );

    if (duplicateRows.length > 0) {
      await connection.rollback();
      return res.status(409).json({ message: "이미 이 매장에 등록된 상품명입니다.", code: "DUPLICATE_STORE_PRODUCT" });
    }

    let categoryRows;

    if (categoryId) {
      [categoryRows] = await connection.query(
        `SELECT category_id, name
           FROM product_categories
          WHERE category_id = ?
            AND status = 'ACTIVE'
          LIMIT 1`,
        [categoryId]
      );
    } else {
      [categoryRows] = await connection.query(
        `SELECT category_id, name
           FROM product_categories
          WHERE name = ?
            AND status = 'ACTIVE'
          LIMIT 1`,
        [categoryName || "디저트"]
      );
    }

    if (categoryRows.length === 0) {
      await connection.rollback();
      return res.status(400).json({ message: "유효한 상품 카테고리를 선택해 주세요.", code: "INVALID_PRODUCT_CATEGORY" });
    }

    const [productResult] = await connection.query(
      `INSERT INTO products (name, category_id, description, price, image_url, status)
       VALUES (?, ?, ?, ?, ?, 'ACTIVE')`,
      [name, categoryRows[0].category_id, description, price, imageUrl]
    );

    const [inventoryResult] = await connection.query(
      `INSERT INTO inventories (store_id, product_id, total_stock, reservable_stock, reserved_stock)
       VALUES (?, ?, ?, ?, 0)`,
      [storeId, productResult.insertId, totalStock, reservableStock]
    );

    await connection.commit();

    return res.status(201).json(ok({
      inventory_id: inventoryResult.insertId,
      store_id: storeId,
      product_id: productResult.insertId,
      product_name: name,
      category_id: categoryRows[0].category_id,
      category_name: categoryRows[0].name,
      price,
      image_url: imageUrl,
      total_stock: totalStock,
      reservable_stock: reservableStock,
      reserved_stock: 0,
    }));
  } catch (error) {
    await connection.rollback();
    console.error(error);
    return res.status(500).json({ message: "상품 등록 처리 중 오류가 발생했습니다.", code: "PRODUCT_CREATE_FAILED" });
  } finally {
    connection.release();
  }
});

app.patch("/api/seller/stores/:storeId/products/:productId", async (req, res) => {
  const sellerUserId = req.user.user_id;
  const sellerAccess = await resolveApprovedSellerProfileId(sellerUserId);
  const storeId = Number(req.params.storeId);
  const productId = Number(req.params.productId);
  const name = String(req.body.name ?? "").trim();
  const categoryId = Number(req.body.category_id ?? req.body.categoryId);
  const description = String(req.body.description ?? "").trim() || null;
  const price = req.body.price === "" || req.body.price === undefined ? null : Number(req.body.price);
  const imageUrl = String(req.body.image_url ?? req.body.imageUrl ?? "").trim() || null;
  const totalStock = Number(req.body.total_stock ?? req.body.totalStock);
  const reservableStock = Number(req.body.reservable_stock ?? req.body.reservableStock);

  if (sellerAccess.error) {
    return sendSellerAccessError(res, sellerAccess);
  }

  if (!storeId || !productId || !name || !Number.isInteger(totalStock) || !Number.isInteger(reservableStock)) {
    return res.status(400).json({ message: "storeId, productId, name, total_stock, reservable_stock are required.", code: "INVALID_PRODUCT_UPDATE_REQUEST" });
  }

  if (price !== null && (!Number.isFinite(price) || price < 0)) {
    return res.status(400).json({ message: "상품 가격을 확인해 주세요.", code: "INVALID_PRODUCT_PRICE" });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [targetRows] = await connection.query(
      `SELECT i.inventory_id, i.reserved_stock
         FROM inventories i
         JOIN stores s ON s.store_id = i.store_id
        WHERE i.store_id = ?
          AND i.product_id = ?
          AND s.seller_id = ?
        FOR UPDATE`,
      [storeId, productId, sellerAccess.sellerProfileId]
    );

    if (targetRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: "상품을 찾을 수 없습니다.", code: "SELLER_PRODUCT_NOT_FOUND" });
    }

    const reservedStock = Number(targetRows[0].reserved_stock);
    if (totalStock < reservedStock || reservableStock < 0 || reservableStock > totalStock - reservedStock) {
      await connection.rollback();
      return res.status(400).json({
        message: `예약 가능 재고는 0개 이상 ${Math.max(totalStock - reservedStock, 0)}개 이하로 설정해야 합니다.`,
        code: "INVALID_PRODUCT_STOCK",
      });
    }

    const [categoryRows] = await connection.query(
      `SELECT category_id, name
         FROM product_categories
        WHERE category_id = ?
          AND status = 'ACTIVE'
        LIMIT 1`,
      [categoryId]
    );

    if (categoryRows.length === 0) {
      await connection.rollback();
      return res.status(400).json({ message: "유효한 상품 카테고리를 선택해 주세요.", code: "INVALID_PRODUCT_CATEGORY" });
    }

    await connection.query(
      `UPDATE products
          SET name = ?,
              category_id = ?,
              description = ?,
              price = ?,
              image_url = ?
        WHERE product_id = ?`,
      [name, categoryId, description, price, imageUrl, productId]
    );

    await connection.query(
      `UPDATE inventories
          SET total_stock = ?,
              reservable_stock = ?
        WHERE inventory_id = ?`,
      [totalStock, reservableStock, targetRows[0].inventory_id]
    );

    await connection.commit();

    res.json(ok({
      inventory_id: targetRows[0].inventory_id,
      store_id: storeId,
      product_id: productId,
      product_name: name,
      category_id: categoryId,
      category_name: categoryRows[0].name,
      description,
      price,
      image_url: imageUrl,
      total_stock: totalStock,
      reservable_stock: reservableStock,
      reserved_stock: reservedStock,
    }));
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ message: "상품 수정 처리 중 오류가 발생했습니다.", code: "PRODUCT_UPDATE_FAILED" });
  } finally {
    connection.release();
  }
});

app.patch("/api/seller/inventories/:inventoryId", async (req, res) => {
  const sellerUserId = req.user.user_id;
  const sellerAccess = await resolveApprovedSellerProfileId(sellerUserId);
  const inventoryId = Number(req.params.inventoryId);
  const totalStock = Number(req.body.total_stock ?? req.body.totalStock);
  const reservableStock = Number(req.body.reservable_stock ?? req.body.reservableStock);

  if (sellerAccess.error) {
    return sendSellerAccessError(res, sellerAccess);
  }

  if (!Number.isInteger(totalStock) || !Number.isInteger(reservableStock) || totalStock < 0 || reservableStock < 0) {
    return res.status(400).json({ message: "seller_id, total_stock, reservable_stock are required.", code: "INVALID_INVENTORY_REQUEST" });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT i.inventory_id, i.store_id, i.reserved_stock, s.seller_id
         FROM inventories i
         JOIN stores s ON s.store_id = i.store_id
        WHERE i.inventory_id = ?
        FOR UPDATE`,
      [inventoryId]
    );

    if (rows.length === 0 || rows[0].seller_id !== sellerAccess.sellerProfileId) {
      await connection.rollback();
      return res.status(404).json({ message: "Inventory not found.", code: "INVENTORY_NOT_FOUND" });
    }

    const reservedStock = rows[0].reserved_stock;
    const maxReservable = Math.max(totalStock - reservedStock, 0);

    if (reservableStock > maxReservable) {
      await connection.rollback();
      return res.status(400).json({
        message: `예약 가능 재고는 최대 ${maxReservable}개까지 설정할 수 있습니다.`,
        code: "INVALID_RESERVABLE_STOCK",
      });
    }

    await connection.query(
      `UPDATE inventories
          SET total_stock = ?,
              reservable_stock = ?
        WHERE inventory_id = ?`,
      [totalStock, reservableStock, inventoryId]
    );

    await connection.commit();
    res.json(ok({
      inventory_id: inventoryId,
      total_stock: totalStock,
      reservable_stock: reservableStock,
      reserved_stock: reservedStock,
    }));
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ message: "Failed to update inventory.", code: "INVENTORY_UPDATE_FAILED" });
  } finally {
    connection.release();
  }
});

app.get("/api/seller/stores/:storeId/reservations", async (req, res) => {
  const sellerUserId = req.user.user_id;
  const sellerAccess = await resolveApprovedSellerProfileId(sellerUserId);
  const storeId = Number(req.params.storeId);

  if (sellerAccess.error) {
    return sendSellerAccessError(res, sellerAccess);
  }

  const [rows] = await pool.query(
    `SELECT r.reservation_id, r.user_id, u.name AS customer_name, r.inventory_id,
            r.quantity, r.status, r.visit_time, r.request_note, r.created_at,
            p.name AS product_name, s.name AS store_name
       FROM reservations r
       JOIN inventories i ON i.inventory_id = r.inventory_id
       JOIN stores s ON s.store_id = i.store_id
       JOIN products p ON p.product_id = i.product_id
       JOIN users u ON u.user_id = r.user_id
      WHERE s.store_id = ?
        AND s.seller_id = ?
      ORDER BY r.created_at DESC`,
    [storeId, sellerAccess.sellerProfileId]
  );

  res.json(ok(rows));
});

app.patch("/api/seller/reservations/:reservationId/status", async (req, res) => {
  const sellerUserId = req.user.user_id;
  const sellerAccess = await resolveApprovedSellerProfileId(sellerUserId);
  const reservationId = Number(req.params.reservationId);
  const nextStatus = String(req.body.status ?? "").toUpperCase();
  const allowedStatuses = ["APPROVED", "CANCELED", "PICKED_UP"];

  if (sellerAccess.error) {
    return sendSellerAccessError(res, sellerAccess);
  }

  if (!allowedStatuses.includes(nextStatus)) {
    return res.status(400).json({ message: "seller_id and valid status are required.", code: "INVALID_STATUS_REQUEST" });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT r.reservation_id, r.inventory_id, r.quantity, r.status, s.seller_id
         FROM reservations r
         JOIN inventories i ON i.inventory_id = r.inventory_id
         JOIN stores s ON s.store_id = i.store_id
        WHERE r.reservation_id = ?
        FOR UPDATE`,
      [reservationId]
    );

    if (rows.length === 0 || rows[0].seller_id !== sellerAccess.sellerProfileId) {
      await connection.rollback();
      return res.status(404).json({ message: "Reservation not found.", code: "RESERVATION_NOT_FOUND" });
    }

    const reservation = rows[0];
    const validTransition = (nextStatus === "APPROVED" && reservation.status === "PENDING")
      || (nextStatus === "CANCELED" && ["PENDING", "APPROVED"].includes(reservation.status))
      || (nextStatus === "PICKED_UP" && reservation.status === "APPROVED");

    if (!validTransition) {
      await connection.rollback();
      return res.status(409).json({ message: "허용되지 않는 예약 상태 변경입니다.", code: "INVALID_RESERVATION_TRANSITION" });
    }

    if (nextStatus === "CANCELED") {
      const [inventoryUpdateResult] = await connection.query(
        `UPDATE inventories
            SET reservable_stock = reservable_stock + ?,
                reserved_stock = reserved_stock - ?
          WHERE inventory_id = ?
            AND reserved_stock >= ?`,
        [reservation.quantity, reservation.quantity, reservation.inventory_id, reservation.quantity]
      );

      if (inventoryUpdateResult.affectedRows !== 1) {
        await connection.rollback();
        return res.status(409).json({ message: "예약 재고 복구에 실패했습니다.", code: "INVENTORY_RESTORE_FAILED" });
      }
    }

    if (nextStatus === "PICKED_UP") {
      const [inventoryUpdateResult] = await connection.query(
        `UPDATE inventories
            SET reserved_stock = reserved_stock - ?,
                total_stock = total_stock - ?
          WHERE inventory_id = ?
            AND reserved_stock >= ?
            AND total_stock >= ?`,
        [reservation.quantity, reservation.quantity, reservation.inventory_id, reservation.quantity, reservation.quantity]
      );

      if (inventoryUpdateResult.affectedRows !== 1) {
        await connection.rollback();
        return res.status(409).json({ message: "수령 완료 재고 반영에 실패했습니다.", code: "INVENTORY_PICKUP_FAILED" });
      }
    }

    await connection.query(
      `UPDATE reservations
          SET status = ?,
              canceled_at = CASE WHEN ? = 'CANCELED' THEN CURRENT_TIMESTAMP ELSE canceled_at END,
              picked_up_at = CASE WHEN ? = 'PICKED_UP' THEN CURRENT_TIMESTAMP ELSE picked_up_at END
        WHERE reservation_id = ?`,
      [nextStatus, nextStatus, nextStatus, reservationId]
    );

    await connection.query(
      `INSERT INTO reservation_status_logs
       (reservation_id, previous_status, new_status, changed_by_user_id, changed_by_role, reason)
       VALUES (?, ?, ?, ?, 'SELLER', '판매자 예약 상태 변경')`,
      [reservationId, reservation.status, nextStatus, sellerUserId]
    );

    await connection.commit();
    res.json(ok({ reservation_id: reservationId, status: nextStatus }));
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ message: "Failed to update reservation status.", code: "RESERVATION_STATUS_UPDATE_FAILED" });
  } finally {
    connection.release();
  }
});

app.post("/api/reservations", authenticateToken, requireRole("CONSUMER"), async (req, res) => {
  const userId = req.user.user_id;
  const inventoryId = Number(req.body.inventory_id ?? req.body.inventoryId);
  const quantity = Number(req.body.quantity);
  const visitTime = req.body.visit_time ?? req.body.visitTime ?? null;
  const requestNote = req.body.request_note ?? req.body.requestNote ?? null;

  if (!userId || !inventoryId || !Number.isInteger(quantity) || quantity <= 0) {
    return res.status(400).json({
      message: "user_id, inventory_id, positive integer quantity are required.",
      code: "INVALID_RESERVATION_REQUEST",
    });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [inventoryRows] = await connection.query(
      `SELECT i.inventory_id, i.reservable_stock, s.opening_hours
         FROM inventories i
         JOIN stores s ON s.store_id = i.store_id
        WHERE i.inventory_id = ?
        FOR UPDATE`,
      [inventoryId]
    );

    if (inventoryRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: "Inventory not found.", code: "INVENTORY_NOT_FOUND" });
    }

    if (visitTime) {
      const openingCheck = isVisitTimeWithinOpeningHours(visitTime, inventoryRows[0].opening_hours);
      if (openingCheck.checkable && !openingCheck.valid) {
        await connection.rollback();
        return res.status(400).json({
          message: `방문 예정 시간은 매장 영업시간(${inventoryRows[0].opening_hours}) 안에서만 선택할 수 있습니다.`,
          code: "VISIT_TIME_OUT_OF_OPENING_HOURS",
        });
      }
    }

    const [updateResult] = await connection.query(
      `UPDATE inventories
          SET reservable_stock = reservable_stock - ?,
              reserved_stock = reserved_stock + ?
        WHERE inventory_id = ?
          AND reservable_stock >= ?`,
      [quantity, quantity, inventoryId, quantity]
    );

    if (updateResult.affectedRows !== 1) {
      await connection.rollback();
      return res.status(409).json({ message: "예약 가능 재고가 부족합니다.", code: "INSUFFICIENT_STOCK" });
    }

    const [insertResult] = await connection.query(
      `INSERT INTO reservations (user_id, inventory_id, quantity, status, visit_time, request_note)
       VALUES (?, ?, ?, 'PENDING', ?, ?)`,
      [userId, inventoryId, quantity, visitTime, requestNote]
    );

    await connection.query(
      `INSERT INTO reservation_status_logs
       (reservation_id, previous_status, new_status, changed_by_user_id, changed_by_role, reason)
       VALUES (?, NULL, 'PENDING', ?, 'CONSUMER', '예약 생성')`,
      [insertResult.insertId, userId]
    );

    const [remainingRows] = await connection.query(
      "SELECT reservable_stock FROM inventories WHERE inventory_id = ?",
      [inventoryId]
    );

    await connection.commit();

    res.status(201).json(ok({
      reservation_id: insertResult.insertId,
      status: "PENDING",
      remaining_reservable_stock: remainingRows[0].reservable_stock,
    }, "예약 요청이 완료되었습니다."));
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ message: "Failed to create reservation.", code: "RESERVATION_CREATE_FAILED" });
  } finally {
    connection.release();
  }
});

app.get("/api/users/:userId/reservations", authenticateToken, requireRole("CONSUMER"), async (req, res) => {
  const requestedUserId = Number(req.params.userId);
  if (requestedUserId && requestedUserId !== req.user.user_id) {
    return res.status(403).json({ message: "본인의 예약 내역만 조회할 수 있습니다.", code: "FORBIDDEN_USER_RESERVATIONS" });
  }

  const [rows] = await pool.query(
    `SELECT r.reservation_id, r.user_id, r.inventory_id, i.store_id, r.quantity, r.status,
            r.visit_time, r.request_note, r.created_at,
            s.name AS store_name, p.name AS product_name, p.image_url
       FROM reservations r
       JOIN inventories i ON i.inventory_id = r.inventory_id
       JOIN stores s ON s.store_id = i.store_id
       JOIN products p ON p.product_id = i.product_id
      WHERE r.user_id = ?
      ORDER BY r.created_at DESC`,
    [req.user.user_id]
  );
  res.json(ok(rows));
});

app.patch("/api/reservations/:reservationId/cancel", authenticateToken, requireRole("CONSUMER"), async (req, res) => {
  const reservationId = Number(req.params.reservationId);
  const userId = req.user.user_id;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [reservationRows] = await connection.query(
      `SELECT reservation_id, inventory_id, quantity, status, user_id
         FROM reservations
        WHERE reservation_id = ?
          AND user_id = ?
        FOR UPDATE`,
      [reservationId, userId]
    );

    if (reservationRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: "Reservation not found.", code: "RESERVATION_NOT_FOUND" });
    }

    const reservation = reservationRows[0];

    if (!["PENDING", "APPROVED"].includes(reservation.status)) {
      await connection.rollback();
      return res.status(409).json({ message: "취소할 수 없는 예약 상태입니다.", code: "INVALID_RESERVATION_STATUS" });
    }

    const [inventoryUpdateResult] = await connection.query(
      `UPDATE inventories
          SET reservable_stock = reservable_stock + ?,
              reserved_stock = reserved_stock - ?
        WHERE inventory_id = ?
          AND reserved_stock >= ?`,
      [reservation.quantity, reservation.quantity, reservation.inventory_id, reservation.quantity]
    );

    if (inventoryUpdateResult.affectedRows !== 1) {
      await connection.rollback();
      return res.status(409).json({ message: "예약 재고 복구에 실패했습니다.", code: "INVENTORY_RESTORE_FAILED" });
    }

    await connection.query(
      `UPDATE reservations
          SET status = 'CANCELED',
              canceled_at = CURRENT_TIMESTAMP
        WHERE reservation_id = ?`,
      [reservationId]
    );

    await connection.query(
      `INSERT INTO reservation_status_logs
       (reservation_id, previous_status, new_status, changed_by_user_id, changed_by_role, reason)
       VALUES (?, ?, 'CANCELED', ?, 'CONSUMER', '예약 취소')`,
      [reservationId, reservation.status, userId]
    );

    await connection.commit();
    res.json(ok({ reservation_id: reservationId, status: "CANCELED" }, "예약이 취소되었습니다."));
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ message: "Failed to cancel reservation.", code: "RESERVATION_CANCEL_FAILED" });
  } finally {
    connection.release();
  }
});

app.listen(port, () => {
  console.log(`API server listening on http://localhost:${port}`);
});
