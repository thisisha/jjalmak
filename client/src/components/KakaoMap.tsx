import { useEffect, useRef, useCallback } from "react";
import { Map, MapMarker, MarkerClusterer, useKakaoLoader } from "react-kakao-maps-sdk";

declare global {
  interface Window {
    kakao: any;
  }
}

interface KakaoMapViewProps {
  className?: string;
  initialCenter?: { lat: number; lng: number };
  initialZoom?: number;
  onMapReady?: (map: any) => void;
  onBoundsChanged?: (bounds: { north: number; south: number; east: number; west: number }) => void;
  onMapClick?: (lat: number, lng: number) => void;
  markers?: Array<{
    id: number;
    lat: number;
    lng: number;
    icon?: string;
    color?: string;
    onClick?: () => void;
  }>;
}

export function KakaoMapView({
  className,
  initialCenter = { lat: 37.5665, lng: 126.978 },
  initialZoom = 3,
  onMapReady,
  onBoundsChanged,
  onMapClick,
  markers = [],
}: KakaoMapViewProps) {
  const mapRef = useRef<any>(null);
  const kakaoApiKey = import.meta.env.VITE_KAKAO_MAP_API_KEY || "";

  const [loading, error] = useKakaoLoader({
    appkey: kakaoApiKey,
    libraries: ["services", "clusterer"], // 주소 검색 및 마커 클러스터링 라이브러리
  });

  const handleMapLoad = useCallback((map: any) => {
    mapRef.current = map;
    if (onMapReady) {
      onMapReady(map);
    }

    // 지도 이동 이벤트 리스너
    if (onBoundsChanged) {
      const updateBounds = () => {
        try {
          const bounds = map.getBounds();
          if (bounds) {
            const swLatLng = bounds.getSouthWest();
            const neLatLng = bounds.getNorthEast();
            onBoundsChanged({
              north: neLatLng.getLat(),
              south: swLatLng.getLat(),
              east: neLatLng.getLng(),
              west: swLatLng.getLng(),
            });
          }
        } catch (error) {
          console.error("Failed to get map bounds:", error);
        }
      };

      // 초기 bounds 설정 (약간의 지연 후)
      setTimeout(updateBounds, 100);

      // 지도 이동 시 bounds 업데이트
      if (window.kakao && window.kakao.maps) {
        window.kakao.maps.event.addListener(map, "bounds_changed", updateBounds);
        window.kakao.maps.event.addListener(map, "dragend", updateBounds);
        window.kakao.maps.event.addListener(map, "zoom_changed", updateBounds);
      }
    }
  }, [onMapReady, onBoundsChanged]);

  if (error) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ minHeight: "400px" }}>
        <div className="text-center">
          <p className="text-red-500 mb-2">지도를 불러올 수 없습니다.</p>
          <p className="text-sm text-muted-foreground">
            카카오 맵 API 키가 설정되지 않았습니다.
            <br />
            VITE_KAKAO_MAP_API_KEY 환경 변수를 설정해주세요.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ minHeight: "400px" }}>
        <p className="text-muted-foreground">지도를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <Map
      center={initialCenter}
      style={{ width: "100%", height: "100%" }}
      level={initialZoom}
      onCreate={handleMapLoad}
      onClick={(_, mouseEvent: any) => {
        if (!onMapClick || !mouseEvent) return;
        try {
          const latLng = mouseEvent.latLng;
          if (latLng) {
            const lat = latLng.getLat();
            const lng = latLng.getLng();
            onMapClick(lat, lng);
          }
        } catch (error) {
          console.error("Map click handler error:", error);
        }
      }}
      className={className}
    >
      {/* 내 위치 마커는 클러스터에서 제외 */}
      {markers
        .filter((marker) => marker.id === -1)
        .map((marker) => (
          <MapMarker
            key={marker.id}
            position={{ lat: marker.lat, lng: marker.lng }}
            onClick={marker.onClick}
            image={{
              // 내 위치: 메인 컬러(오렌지) 원형 아이콘 (현재 위치 표시용)
              src: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`
                <svg width="24" height="24" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="10" fill="#e67e27" stroke="#FFFFFF" stroke-width="2" opacity="0.9"/>
                  <circle cx="12" cy="12" r="4" fill="#FFFFFF"/>
                </svg>
              `),
              size: { width: 24, height: 24 },
              options: {
                offset: { x: 12, y: 12 },
              },
            }}
          />
        ))}
      
      {/* 게시글 마커들 - 클러스터링 적용 */}
      <MarkerClusterer
        averageCenter={true}
        minLevel={7}
        disableClickZoom={false}
        styles={[
          {
            width: "50px",
            height: "50px",
            background: "rgba(230, 126, 39, 0.6)",
            borderRadius: "50%",
            color: "#fff",
            textAlign: "center",
            fontWeight: "bold",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "3px solid rgba(230, 126, 39, 0.8)",
            fontSize: "12px",
          },
          {
            width: "60px",
            height: "60px",
            background: "rgba(230, 126, 39, 0.7)",
            borderRadius: "50%",
            color: "#fff",
            textAlign: "center",
            fontWeight: "bold",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "3px solid rgba(230, 126, 39, 0.9)",
            fontSize: "13px",
          },
          {
            width: "70px",
            height: "70px",
            background: "rgba(230, 126, 39, 0.8)",
            borderRadius: "50%",
            color: "#fff",
            textAlign: "center",
            fontWeight: "bold",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "3px solid rgba(230, 126, 39, 1)",
            fontSize: "14px",
          },
        ]}
      >
        {markers
          .filter((marker) => marker.id !== -1)
          .map((marker) => (
            <MapMarker
              key={marker.id}
              position={{ lat: marker.lat, lng: marker.lng }}
              onClick={marker.onClick}
              image={{
                src: marker.icon || "https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/marker_red.png",
                size: { width: 32, height: 32 },
                options: {
                  offset: { x: 16, y: 32 },
                },
              }}
            />
          ))}
      </MarkerClusterer>
    </Map>
  );
}

