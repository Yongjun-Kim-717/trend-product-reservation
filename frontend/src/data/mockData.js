export const products = [
  {
    id: 1,
    name: "버터떡",
    category: "디저트",
    description: "고소한 버터 풍미와 쫀득한 식감이 특징인 인기 디저트입니다.",
    imageUrl: "",
    trendBadge: "추천",
  },
  {
    id: 2,
    name: "두쫀쿠",
    category: "쿠키",
    description: "쫀득한 식감의 SNS 인기 쿠키 상품입니다.",
    imageUrl: "",
    trendBadge: "인기",
  },
  {
    id: 3,
    name: "약과쿠키",
    category: "디저트",
    description: "약과와 쿠키를 결합한 트렌드 상품입니다.",
    imageUrl: "",
    trendBadge: "상승",
  },
];

export const nearbyStores = [
  {
    id: 1,
    name: "성수 디저트랩",
    address: "서울 성동구 성수이로 10",
    distance: "350m",
    latitude: 37.544581,
    longitude: 127.055961,
    openingHours: "10:00 - 21:00",
    inventories: [
      { inventoryId: 1, productId: 1, totalStock: 40, reservableStock: 18, reservedStock: 6 },
      { inventoryId: 2, productId: 2, totalStock: 24, reservableStock: 9, reservedStock: 4 },
    ],
  },
  {
    id: 2,
    name: "홍대 트렌드스낵",
    address: "서울 마포구 와우산로 29",
    distance: "1.2km",
    latitude: 37.555173,
    longitude: 126.923639,
    openingHours: "11:00 - 22:00",
    inventories: [
      { inventoryId: 3, productId: 2, totalStock: 32, reservableStock: 12, reservedStock: 7 },
      { inventoryId: 4, productId: 3, totalStock: 20, reservableStock: 5, reservedStock: 3 },
    ],
  },
  {
    id: 3,
    name: "강남 핫딜스토어",
    address: "서울 강남구 강남대로 396",
    distance: "2.8km",
    latitude: 37.497952,
    longitude: 127.027619,
    openingHours: "09:30 - 20:30",
    inventories: [
      { inventoryId: 5, productId: 1, totalStock: 26, reservableStock: 8, reservedStock: 5 },
      { inventoryId: 6, productId: 3, totalStock: 18, reservableStock: 3, reservedStock: 4 },
    ],
  },
];

export const mockLocationQueries = {
  부평역: { label: "부평역", latitude: 37.4895, longitude: 126.7247 },
  성수역: { label: "성수역", latitude: 37.5446, longitude: 127.0557 },
  홍대입구역: { label: "홍대입구역", latitude: 37.5572, longitude: 126.9245 },
  강남역: { label: "강남역", latitude: 37.4979, longitude: 127.0276 },
};

export const sellerProducts = [
  { id: 1, name: "버터떡", category: "디저트", total: 40, reservable: 18, reserved: 6, imageUrl: "", status: "판매중" },
  { id: 2, name: "두쫀쿠", category: "쿠키", total: 24, reservable: 9, reserved: 4, imageUrl: "", status: "판매중" },
  { id: 3, name: "약과쿠키", category: "디저트", total: 12, reservable: 2, reserved: 5, imageUrl: "", status: "재고부족" },
];

export const sellerReservations = [
  { id: 101, product: "버터떡", customer: "민지", quantity: 2, status: "PENDING", visitTime: "오늘 16:30" },
  { id: 102, product: "두쫀쿠", customer: "준호", quantity: 1, status: "APPROVED", visitTime: "오늘 18:00" },
  { id: 103, product: "약과쿠키", customer: "서연", quantity: 3, status: "PICKED_UP", visitTime: "오늘 14:20" },
];

export const adminRows = [
  { id: 1, type: "미매핑 검색어", title: "버터 떡 맛집", status: "검토 필요" },
  { id: 2, type: "판매자 승인", title: "연남 디저트샵", status: "승인 대기" },
  { id: 3, type: "키워드", title: "두쫀쿠", status: "활성" },
  { id: 4, type: "매장 데이터", title: "강남 핫딜스토어", status: "정상" },
];

export const adminKeywords = [
  { id: 1, name: "버터떡", trendScore: 95, status: "ACTIVE", aliases: ["버터떡", "버터 떡", "버터떡 맛집"] },
  { id: 2, name: "두쫀쿠", trendScore: 88, status: "ACTIVE", aliases: ["두쫀쿠", "두쫀쿠키"] },
  { id: 3, name: "약과쿠키", trendScore: 80, status: "ACTIVE", aliases: ["약과쿠키", "약과 쿠키"] },
];

export const adminUnmappedSearches = [
  { id: 1, rawQuery: "버터 떡 파는곳", count: 24, lastSeenAt: "2026-05-16 17:10", status: "REVIEW", resolution: null },
  { id: 2, rawQuery: "두쫀쿠 예약", count: 16, lastSeenAt: "2026-05-16 16:42", status: "REVIEW", resolution: null },
  { id: 3, rawQuery: "요즘 약과쿠키", count: 9, lastSeenAt: "2026-05-16 15:58", status: "REVIEW", resolution: null },
  { id: 4, rawQuery: "신상 크림떡", count: 6, lastSeenAt: "2026-05-16 14:12", status: "HOLD", resolution: "검색량 증가 시 재검토" },
];

export const adminSearchLogs = [
  { id: 1, rawQuery: "버터떡", mappingStatus: "매핑 성공", keywordName: "버터떡", userRole: "소비자", location: "성수동", resultCount: 3, createdAt: "2026-05-16 17:20" },
  { id: 2, rawQuery: "버터 떡 맛집", mappingStatus: "매핑 성공", keywordName: "버터떡", userRole: "소비자", location: "성수동", resultCount: 2, createdAt: "2026-05-16 17:12" },
  { id: 3, rawQuery: "두쫀쿠", mappingStatus: "매핑 성공", keywordName: "두쫀쿠", userRole: "소비자", location: "홍대", resultCount: 1, createdAt: "2026-05-16 16:55" },
  { id: 4, rawQuery: "신상 크림떡", mappingStatus: "미매핑", keywordName: "-", userRole: "소비자", location: "강남", resultCount: 0, createdAt: "2026-05-16 14:12" },
];

export function getProduct(productId) {
  return products.find((product) => product.id === Number(productId));
}

export function getStore(storeId) {
  return nearbyStores.find((store) => store.id === Number(storeId));
}

export function getInventory(storeId, productId) {
  const store = getStore(storeId);
  return store?.inventories.find((inventory) => inventory.productId === Number(productId));
}
