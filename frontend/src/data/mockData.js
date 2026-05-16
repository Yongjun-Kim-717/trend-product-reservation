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

export const sellerProducts = [
  { id: 1, name: "버터떡", category: "디저트", total: 40, reservable: 18, reserved: 6, imageUrl: "", status: "판매중" },
  { id: 2, name: "두쫀쿠", category: "쿠키", total: 24, reservable: 9, reserved: 4, imageUrl: "", status: "판매중" },
  { id: 3, name: "약과쿠키", category: "디저트", total: 12, reservable: 2, reserved: 5, imageUrl: "", status: "재고부족" },
];

export const sellerReservations = [
  { id: 101, product: "버터떡", customer: "민지", quantity: 2, status: "승인 대기", visitTime: "오늘 16:30" },
  { id: 102, product: "두쫀쿠", customer: "준호", quantity: 1, status: "수령 대기", visitTime: "오늘 18:00" },
];

export const adminRows = [
  { id: 1, type: "미매핑 검색어", title: "버터 떡 맛집", status: "검토 필요" },
  { id: 2, type: "판매자 승인", title: "연남 디저트샵", status: "승인 대기" },
  { id: 3, type: "키워드", title: "두쫀쿠", status: "활성" },
  { id: 4, type: "매장 데이터", title: "강남 핫딜스토어", status: "정상" },
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
