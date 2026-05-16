import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { loadKakaoMapSdk } from "../utils/kakaoMap.js";

function FallbackMap({ stores, selectedStoreId, onSelectStore }) {
  return (
    <section className="map-area fallback-map" aria-label="지도 영역">
      <div className="map-grid" />
      {stores.map((store, index) => (
        <button
          className={`map-pin pin-${index + 1} ${selectedStoreId === store.id ? "selected" : ""}`}
          key={store.id}
          onClick={() => onSelectStore(store.id)}
          type="button"
          aria-label={`${store.name} 선택`}
        >
          <MapPin size={18} />
        </button>
      ))}
      <div className="map-notice">Kakao JavaScript 키를 설정하면 실제 지도가 표시됩니다.</div>
    </section>
  );
}

function KakaoMap({ stores, selectedStoreId, onSelectStore }) {
  const mapElement = useRef(null);
  const mapInstance = useRef(null);
  const markers = useRef([]);
  const [isFallback, setIsFallback] = useState(false);

  useEffect(() => {
    let cancelled = false;

    loadKakaoMapSdk()
      .then((kakao) => {
        if (cancelled || !mapElement.current || stores.length === 0) return;

        const centerStore = stores.find((store) => store.id === selectedStoreId) ?? stores[0];
        const center = new kakao.maps.LatLng(centerStore.latitude, centerStore.longitude);

        mapInstance.current = new kakao.maps.Map(mapElement.current, {
          center,
          level: 5,
        });

        markers.current = stores.map((store) => {
          const marker = new kakao.maps.Marker({
            position: new kakao.maps.LatLng(store.latitude, store.longitude),
            map: mapInstance.current,
          });

          kakao.maps.event.addListener(marker, "click", () => onSelectStore(store.id));
          return marker;
        });
      })
      .catch(() => setIsFallback(true));

    return () => {
      cancelled = true;
      markers.current.forEach((marker) => marker.setMap(null));
      markers.current = [];
    };
  }, [stores, onSelectStore, selectedStoreId]);

  useEffect(() => {
    if (!mapInstance.current || !window.kakao?.maps) return;
    const selectedStore = stores.find((store) => store.id === selectedStoreId);
    if (!selectedStore) return;
    mapInstance.current.panTo(new window.kakao.maps.LatLng(selectedStore.latitude, selectedStore.longitude));
  }, [selectedStoreId, stores]);

  if (isFallback) {
    return <FallbackMap stores={stores} selectedStoreId={selectedStoreId} onSelectStore={onSelectStore} />;
  }

  return <section ref={mapElement} className="map-area kakao-map" aria-label="카카오 지도" />;
}

export default KakaoMap;
