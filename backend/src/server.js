import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { pool } from "./config/db.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(cors());
app.use(express.json());

function ok(data, message = "success") {
  return { data, message };
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

async function findLocationFromQuery(rawQuery, fallbackLat, fallbackLng, { matchedTerms = [], allowClientFallback = true } = {}) {
  const locationCandidate = deriveLocationCandidate(rawQuery, matchedTerms);

  if (locationCandidate) {
    const cached = await findLocationByText(locationCandidate);
    if (cached) return cached;
  }

  if (allowClientFallback && fallbackLat && fallbackLng) {
    return {
      query: "현재 위치",
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

app.get("/api/products/trending", async (_req, res) => {
  const keywords = await getTrendingKeywords();
  res.json(ok(keywords));
});

app.get("/api/keywords/trending", async (_req, res) => {
  const keywords = await getTrendingKeywords();
  res.json(ok(keywords));
});

app.get("/api/search", async (req, res) => {
  const rawQuery = String(req.query.query ?? "").trim();
  const radiusKm = Number(req.query.radiusKm ?? 5);

  if (!rawQuery) {
    return res.status(400).json({ message: "query is required.", code: "QUERY_REQUIRED" });
  }

  const keyword = await findKeywordFromQuery(rawQuery);
  const product = keyword.keyword_id ? { product_id: null, name: null, mapped: false } : await findProductFromQuery(rawQuery);
  const matchedTerms = [keyword.keyword_id ? keyword.raw : null, product.product_id ? product.raw : null];
  const location = await findLocationFromQuery(rawQuery, req.query.lat, req.query.lng, {
    matchedTerms,
    allowClientFallback: Boolean(keyword.keyword_id || product.product_id),
  });
  const hasSearchIntent = Boolean(keyword.keyword_id || product.product_id || location);

  const params = [];
  let productWhere = "";

  if (keyword.keyword_id) {
    productWhere = "AND p.name = ?";
    params.push(keyword.keyword_name);
  } else if (product.product_id) {
    productWhere = "AND p.product_id = ?";
    params.push(product.product_id);
  }

  if (!hasSearchIntent) {
    await logSearch({
      userId: req.query.userId,
      rawQuery,
      keyword,
      location: null,
      resultCount: 0,
      mapped: false,
    });

    return res.json(ok({ location: null, keyword, product, radius_km: radiusKm, stores: [] }));
  }

  const [rows] = await pool.query(
    `SELECT s.store_id, s.name AS store_name, s.address, s.latitude, s.longitude,
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
    userId: req.query.userId,
    rawQuery,
    keyword,
    location,
    resultCount: stores.length,
    mapped: Boolean(keyword.keyword_id || product.product_id),
  });

  res.json(ok({ location, keyword, product, radius_km: radiusKm, stores }));
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

app.get("/api/seller/stores", async (req, res) => {
  const sellerId = Number(req.query.sellerId ?? req.query.seller_id);

  if (!sellerId) {
    return res.status(400).json({ message: "sellerId is required.", code: "SELLER_ID_REQUIRED" });
  }

  const [rows] = await pool.query(
    `SELECT store_id, seller_id, name, address, latitude, longitude, phone, opening_hours, approval_status
       FROM stores
      WHERE seller_id = ?
      ORDER BY store_id`,
    [sellerId]
  );

  res.json(ok(rows.map((row) => ({
    ...row,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
  }))));
});

app.get("/api/seller/stores/:storeId/inventories", async (req, res) => {
  const sellerId = Number(req.query.sellerId ?? req.query.seller_id);
  const storeId = Number(req.params.storeId);

  if (!sellerId) {
    return res.status(400).json({ message: "sellerId is required.", code: "SELLER_ID_REQUIRED" });
  }

  const [rows] = await pool.query(
    `SELECT i.inventory_id, i.store_id, i.product_id, p.name AS product_name,
            c.name AS category_name, p.price, p.image_url,
            i.total_stock, i.reservable_stock, i.reserved_stock
       FROM inventories i
       JOIN stores s ON s.store_id = i.store_id
       JOIN products p ON p.product_id = i.product_id
       LEFT JOIN product_categories c ON c.category_id = p.category_id
      WHERE i.store_id = ?
        AND s.seller_id = ?
      ORDER BY i.inventory_id`,
    [storeId, sellerId]
  );

  res.json(ok(rows));
});

app.patch("/api/seller/inventories/:inventoryId", async (req, res) => {
  const sellerId = Number(req.body.seller_id ?? req.body.sellerId);
  const inventoryId = Number(req.params.inventoryId);
  const totalStock = Number(req.body.total_stock ?? req.body.totalStock);
  const reservableStock = Number(req.body.reservable_stock ?? req.body.reservableStock);

  if (!sellerId || !Number.isInteger(totalStock) || !Number.isInteger(reservableStock) || totalStock < 0 || reservableStock < 0) {
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

    if (rows.length === 0 || rows[0].seller_id !== sellerId) {
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
  const sellerId = Number(req.query.sellerId ?? req.query.seller_id);
  const storeId = Number(req.params.storeId);

  if (!sellerId) {
    return res.status(400).json({ message: "sellerId is required.", code: "SELLER_ID_REQUIRED" });
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
    [storeId, sellerId]
  );

  res.json(ok(rows));
});

app.patch("/api/seller/reservations/:reservationId/status", async (req, res) => {
  const sellerId = Number(req.body.seller_id ?? req.body.sellerId);
  const reservationId = Number(req.params.reservationId);
  const nextStatus = String(req.body.status ?? "").toUpperCase();
  const allowedStatuses = ["APPROVED", "CANCELED", "PICKED_UP"];

  if (!sellerId || !allowedStatuses.includes(nextStatus)) {
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

    if (rows.length === 0 || rows[0].seller_id !== sellerId) {
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
      [reservationId, reservation.status, nextStatus, sellerId]
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

app.post("/api/reservations", async (req, res) => {
  const userId = Number(req.body.user_id ?? req.body.userId);
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
      `SELECT inventory_id, reservable_stock
         FROM inventories
        WHERE inventory_id = ?
        FOR UPDATE`,
      [inventoryId]
    );

    if (inventoryRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: "Inventory not found.", code: "INVENTORY_NOT_FOUND" });
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

app.get("/api/users/:userId/reservations", async (req, res) => {
  const [rows] = await pool.query(
    `SELECT r.reservation_id, r.user_id, r.inventory_id, r.quantity, r.status,
            r.visit_time, r.request_note, r.created_at,
            s.name AS store_name, p.name AS product_name, p.image_url
       FROM reservations r
       JOIN inventories i ON i.inventory_id = r.inventory_id
       JOIN stores s ON s.store_id = i.store_id
       JOIN products p ON p.product_id = i.product_id
      WHERE r.user_id = ?
      ORDER BY r.created_at DESC`,
    [req.params.userId]
  );
  res.json(ok(rows));
});

app.patch("/api/reservations/:reservationId/cancel", async (req, res) => {
  const reservationId = Number(req.params.reservationId);
  const userId = Number(req.body.user_id ?? req.body.userId) || null;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [reservationRows] = await connection.query(
      `SELECT reservation_id, inventory_id, quantity, status
         FROM reservations
        WHERE reservation_id = ?
        FOR UPDATE`,
      [reservationId]
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
