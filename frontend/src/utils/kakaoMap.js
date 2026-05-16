let kakaoMapLoader;

export function loadKakaoMapSdk() {
  const appKey = import.meta.env.VITE_KAKAO_JAVASCRIPT_KEY;

  if (!appKey || appKey === "your_kakao_javascript_key") {
    return Promise.reject(new Error("Kakao JavaScript key is not configured."));
  }

  if (window.kakao?.maps) {
    return new Promise((resolve) => window.kakao.maps.load(() => resolve(window.kakao)));
  }

  if (kakaoMapLoader) {
    return kakaoMapLoader;
  }

  kakaoMapLoader = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false&libraries=services`;
    script.async = true;
    script.onload = () => window.kakao.maps.load(() => resolve(window.kakao));
    script.onerror = () => reject(new Error("Failed to load Kakao Map SDK."));
    document.head.appendChild(script);
  });

  return kakaoMapLoader;
}
