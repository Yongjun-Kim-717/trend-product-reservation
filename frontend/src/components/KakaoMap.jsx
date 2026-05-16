import { useEffect, useRef, useState } from "react";
import { MapPin, Navigation } from "lucide-react";
import { loadKakaoMapSdk } from "../utils/kakaoMap.js";

function FallbackMap({ stores, selectedStoreId, onSelectStore, userLocation, errorMessage }) {
  return (
    <section className="map-area fallback-map" aria-label="지도 영역">
      <div className="map-grid" />
      {userLocation && (
        <div className="user-location-pin fallback-user-pin" aria-label="내 위치">
          <Navigation size={16} />
        </div>
      )}
      {stores.map((store, index) => (
        <button
          className={`map-pin pin-${(index % 3) + 1} ${selectedStoreId === store.id ? "selected" : ""}`}
          key={store.id}
          onClick={() => onSelectStore(store.id)}
          type="button"
          aria-label={`${store.name} 선택`}
        >
          <MapPin size={18} />
        </button>
      ))}
      <div className="map-notice">
        <strong>카카오맵 연결 대기</strong>
        <span>{errorMessage || "Kakao JavaScript 키를 설정하면 실제 지도가 표시됩니다."}</span>
      </div>
    </section>
  );
}

function KakaoMap({ stores, selectedStoreId, onSelectStore, userLocation, focusTarget }) {
  const mapElement = useRef(null);
  const mapInstance = useRef(null);
  const markers = useRef([]);
  const overlays = useRef([]);
  const userMarker = useRef(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    loadKakaoMapSdk()
      .then((kakao) => {
        if (cancelled || !mapElement.current || stores.length === 0) return;

        const centerStore = stores.find((store) => store.id === selectedStoreId) ?? stores[0];
        const center = userLocation
          ? new kakao.maps.LatLng(userLocation.latitude, userLocation.longitude)
          : new kakao.maps.LatLng(centerStore.latitude, centerStore.longitude);

        mapInstance.current = new kakao.maps.Map(mapElement.current, {
          center,
          level: 5,
        });
      })
      .catch((error) => {
        console.error(error);
        setErrorMessage(error.message);
      });

    return () => {
      cancelled = true;
      markers.current.forEach((marker) => marker.setMap(null));
      overlays.current.forEach((overlay) => overlay.setMap(null));
      userMarker.current?.setMap(null);
      markers.current = [];
      overlays.current = [];
      userMarker.current = null;
      mapInstance.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapInstance.current || !window.kakao?.maps) return;

    const kakao = window.kakao;
    markers.current.forEach((marker) => marker.setMap(null));
    overlays.current.forEach((overlay) => overlay.setMap(null));
    userMarker.current?.setMap(null);
    markers.current = [];
    overlays.current = [];
    userMarker.current = null;

    const bounds = new kakao.maps.LatLngBounds();

    if (userLocation) {
      const userPosition = new kakao.maps.LatLng(userLocation.latitude, userLocation.longitude);
      const markerElement = document.createElement("div");
      markerElement.className = "kakao-user-location-marker";
      markerElement.innerHTML = "내 위치";

      userMarker.current = new kakao.maps.CustomOverlay({
        position: userPosition,
        content: markerElement,
        yAnchor: 0.5,
        zIndex: 6,
      });
      userMarker.current.setMap(mapInstance.current);
      bounds.extend(userPosition);
    }

    stores.forEach((store) => {
      const position = new kakao.maps.LatLng(store.latitude, store.longitude);
      const marker = new kakao.maps.Marker({
        position,
        map: mapInstance.current,
      });

      const overlayElement = document.createElement("button");
      overlayElement.type = "button";
      overlayElement.className = `map-label ${selectedStoreId === store.id ? "selected" : ""}`;
      overlayElement.innerHTML = `<strong>${store.name}</strong><span>${store.distance}</span>`;
      overlayElement.addEventListener("click", () => onSelectStore(store.id));

      const overlay = new kakao.maps.CustomOverlay({
        position,
        content: overlayElement,
        yAnchor: 2.25,
        zIndex: selectedStoreId === store.id ? 4 : 3,
      });

      kakao.maps.event.addListener(marker, "click", () => onSelectStore(store.id));
      overlay.setMap(mapInstance.current);
      markers.current.push(marker);
      overlays.current.push(overlay);
      bounds.extend(position);
    });

    if (stores.length > 1 || userLocation) {
      mapInstance.current.setBounds(bounds);
    }

    return () => {
      markers.current.forEach((marker) => marker.setMap(null));
      overlays.current.forEach((overlay) => overlay.setMap(null));
      userMarker.current?.setMap(null);
      markers.current = [];
      overlays.current = [];
      userMarker.current = null;
    };
  }, [stores, onSelectStore, selectedStoreId, userLocation]);

  useEffect(() => {
    if (!mapInstance.current || !window.kakao?.maps) return;
    if (focusTarget?.type === "user" && userLocation) {
      mapInstance.current.setLevel(5);
      mapInstance.current.panTo(new window.kakao.maps.LatLng(userLocation.latitude, userLocation.longitude));
      return;
    }

    if (focusTarget?.type === "store") {
      const selectedStore = stores.find((store) => store.id === selectedStoreId);
      if (!selectedStore) return;
      mapInstance.current.panTo(new window.kakao.maps.LatLng(selectedStore.latitude, selectedStore.longitude));
    }
  }, [focusTarget, selectedStoreId, stores, userLocation]);

  if (errorMessage) {
    return <FallbackMap stores={stores} selectedStoreId={selectedStoreId} onSelectStore={onSelectStore} userLocation={userLocation} errorMessage={errorMessage} />;
  }

  return <section ref={mapElement} className="map-area kakao-map" aria-label="카카오 지도" />;
}

export default KakaoMap;

