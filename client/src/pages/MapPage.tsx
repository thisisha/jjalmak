import { useState, useRef, useCallback, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { KakaoMapView } from "@/components/KakaoMap";
import { PostDetailModal } from "@/components/PostDetailModal";
import { List, Map as MapIcon, Filter, X, Crosshair, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useLocation } from "wouter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const categories = [
  { value: "inconvenience", label: "불편신고", icon: "🔴", color: "#ef4444" },
  { value: "suggestion", label: "제안", icon: "🟢", color: "#22c55e" },
  { value: "praise", label: "칭찬", icon: "💛", color: "#eab308" },
  { value: "chat", label: "잡담", icon: "💬", color: "#3b82f6" },
  { value: "emergency", label: "긴급", icon: "⚠️", color: "#f59e0b" },
] as const;

type ViewMode = "map" | "list";

export default function MapPage() {
  const { isAuthenticated } = useAuth();
  const [location, setLocation] = useLocation();
  const [viewMode, setViewMode] = useState<ViewMode>("map");
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const [sortBy, setSortBy] = useState<"recent" | "popular">("popular");
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);
  const [mapBounds, setMapBounds] = useState<{
    north: number;
    south: number;
    east: number;
    west: number;
  } | null>(null);
  const [currentCenter, setCurrentCenter] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [highlightedPostId, setHighlightedPostId] = useState<number | null>(null);
  const mapRef = useRef<any>(null);

  // Parse URL query parameters for location and postId
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const lat = params.get("lat");
    const lng = params.get("lng");
    const postId = params.get("postId");

    if (lat && lng) {
      const latNum = parseFloat(lat);
      const lngNum = parseFloat(lng);
      if (!isNaN(latNum) && !isNaN(lngNum)) {
        setCurrentCenter({ lat: latNum, lng: lngNum });
        if (postId) {
          const postIdNum = parseInt(postId, 10);
          if (!isNaN(postIdNum)) {
            setHighlightedPostId(postIdNum);
            setSelectedPostId(postIdNum);
          }
        }
        // Clear URL parameters after reading
        setLocation("/map");
        return;
      }
    }

    // Get current location if no URL params
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentCenter({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        () => {
          // Default to Seoul
          setCurrentCenter({ lat: 37.5665, lng: 126.978 });
        }
      );
    } else {
      setCurrentCenter({ lat: 37.5665, lng: 126.978 });
    }
  }, [setLocation]);

  // Fetch posts by bounds
  const { data: posts = [], isLoading, refetch } = trpc.posts.getByBounds.useQuery(
    {
      north: mapBounds?.north || 37.7,
      south: mapBounds?.south || 37.4,
      east: mapBounds?.east || 127.1,
      west: mapBounds?.west || 126.8,
      category: selectedCategory,
      sortBy,
      limit: 100,
    },
    {
      enabled: mapBounds !== null,
    }
  );

  // Update map bounds when map moves
  const handleMapReady = useCallback((map: any) => {
    mapRef.current = map;
  }, []);

  // Center map on highlighted post when map is ready and location is set
  useEffect(() => {
    if (highlightedPostId && currentCenter && mapRef.current && window.kakao) {
      setTimeout(() => {
        try {
          const kakaoLatLng = new window.kakao.maps.LatLng(currentCenter.lat, currentCenter.lng);
          mapRef.current.setCenter(kakaoLatLng);
          mapRef.current.setLevel(3); // Zoom in
        } catch (error) {
          console.error("Failed to center map on highlighted post:", error);
        }
      }, 300);
    }
  }, [highlightedPostId, currentCenter]);

  const handleBoundsChanged = useCallback((bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  }) => {
    setMapBounds(bounds);
  }, []);

  // Prepare markers for KakaoMap
  const mapMarkers = posts
    .filter((post: any) => post.latitude && post.longitude)
    .map((post: any) => {
      const lat = parseFloat(post.latitude as string);
      const lng = parseFloat(post.longitude as string);
      if (isNaN(lat) || isNaN(lng)) return null;

      const category = categories.find((c) => c.value === post.category);
      if (!category) return null;

      // 카테고리별 마커 색상 매핑 (SVG로 마커 생성 - 카카오 맵 기본 마커 모양 유지)
      const categoryColorMap: Record<string, string> = {
        inconvenience: "#ef4444", // 빨강
        suggestion: "#22c55e", // 초록
        praise: "#eab308", // 노랑
        chat: "#9ca3af", // 회색 (흰색 대신)
        emergency: "#000000", // 검은색
      };

      const markerColor = categoryColorMap[post.category] || categoryColorMap.inconvenience;
      
      // 카카오 맵 기본 마커 모양을 SVG로 생성 (색상만 변경)
      // 마커 모양: 위쪽이 둥근 삼각형 형태 (카카오 맵 기본 마커와 동일한 형태)
      const markerSize = 24;
      const svgMarker = `<svg width="${markerSize}" height="${markerSize * 1.46}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 35"><path d="M12 0C5.4 0 0 5.4 0 12c0 8.5 12 23 12 23s12-14.5 12-23C24 5.4 18.6 0 12 0z" fill="${markerColor}" stroke="#fff" stroke-width="1.5"/><circle cx="12" cy="12" r="5" fill="#fff"/></svg>`;
      const encodedSvg = encodeURIComponent(svgMarker);
      const markerDataUrl = `data:image/svg+xml;charset=utf-8,${encodedSvg}`;
      
      const markerIcon = markerDataUrl;

      return {
        id: post.id,
        lat,
        lng,
        color: category.color,
        icon: markerIcon,
        onClick: () => setSelectedPostId(post.id),
      };
    })
    .filter((m): m is NonNullable<typeof m> => m !== null);

  // Add current location marker if available
  const allMarkers = currentCenter
    ? [
        ...mapMarkers,
        {
          id: -1, // Special ID for current location
          lat: currentCenter.lat,
          lng: currentCenter.lng,
          icon: undefined, // 기본 파란색 위치 아이콘 사용
          onClick: undefined,
        },
      ]
    : mapMarkers;

  const handlePostClick = useCallback((postId: number) => {
    setSelectedPostId(postId);
    // Optionally center map on post
    const post = posts.find((p: any) => p.id === postId);
    if (post && post.latitude && post.longitude && mapRef.current && window.kakao) {
      const lat = parseFloat(post.latitude as string);
      const lng = parseFloat(post.longitude as string);
      if (!isNaN(lat) && !isNaN(lng)) {
        const moveLatLng = new window.kakao.maps.LatLng(lat, lng);
        mapRef.current.setCenter(moveLatLng);
        mapRef.current.setLevel(4); // 카카오 맵은 level 사용 (숫자가 작을수록 확대)
      }
    }
  }, [posts]);

  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error("이 브라우저에서는 현재 위치를 사용할 수 없습니다.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setCurrentCenter({ lat, lng });

        if (mapRef.current && (window as any).kakao?.maps) {
          try {
            const kakaoLatLng = new (window as any).kakao.maps.LatLng(lat, lng);
            mapRef.current.setCenter(kakaoLatLng);
            mapRef.current.setLevel(3);
          } catch (error) {
            console.error("Failed to recenter map:", error);
          }
        }
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          toast.error("위치 권한이 거부되었습니다. 브라우저 설정에서 위치 접근을 허용해주세요.");
        } else {
          toast.error("현재 위치를 가져오는 중 오류가 발생했습니다.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, []);

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="sticky top-0 z-30 border-b border-border bg-card shadow-sm">
        <div className="container py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <img 
                src="/image/jjalmak_logo.png" 
                alt="짤막" 
                className="h-11 w-auto"
              />
              <h1 className="text-xl font-bold text-muted-foreground">지도</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === "map" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("map")}
              >
                <MapIcon className="w-4 h-4 mr-2" />
                지도
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("list")}
              >
                <List className="w-4 h-4 mr-2" />
                리스트
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            <Select value={selectedCategory || "all"} onValueChange={(value) => setSelectedCategory(value === "all" ? undefined : value)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="카테고리" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.icon} {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={(value) => setSortBy(value as "recent" | "popular")}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">최신순</SelectItem>
                <SelectItem value="popular">공감순</SelectItem>
              </SelectContent>
            </Select>

            {selectedCategory && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedCategory(undefined)}
              >
                <X className="w-4 h-4 mr-1" />
                필터 초기화
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 relative overflow-hidden">
        {viewMode === "map" ? (
          <div className="h-full w-full relative">
            {currentCenter ? (
              <KakaoMapView
                initialCenter={currentCenter}
                initialZoom={3}
                onMapReady={handleMapReady}
                onBoundsChanged={handleBoundsChanged}
                markers={allMarkers}
                className="h-full w-full"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">지도를 불러오는 중...</p>
              </div>
            )}
          </div>
        ) : (
          <div className="h-full overflow-y-auto">
            <div className="container py-4 space-y-3">
              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Card key={i} className="p-4 skeleton h-24" />
                  ))}
                </div>
              ) : posts.length === 0 ? (
                <Card className="p-8 text-center">
                  <p className="text-muted-foreground">현재 범위에 게시글이 없습니다.</p>
                </Card>
              ) : (
                posts.map((post: any) => {
                  const category = categories.find((c) => c.value === post.category);
                  
                  // 행정 상태 배지
                  const getAdminStatusBadge = () => {
                    const status = post.adminStatus || "pending";
                    switch (status) {
                      case "pending":
                        return (
                          <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded border border-border/50 bg-muted/30">
                            <Clock className="w-2.5 h-2.5 inline mr-0.5" />
                            검토대기
                          </span>
                        );
                      case "in_progress":
                        return (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full dark:bg-blue-950 dark:text-blue-400 flex items-center gap-1">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            처리중
                          </span>
                        );
                      case "completed":
                        return (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full dark:bg-green-950 dark:text-green-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            해결됨
                          </span>
                        );
                      case "rejected":
                        return (
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full dark:bg-red-950 dark:text-red-400 flex items-center gap-1">
                            <XCircle className="w-3 h-3" />
                            반려됨
                          </span>
                        );
                      default:
                        return null;
                    }
                  };
                  
                  return (
                    <Card
                      key={post.id}
                      className="p-4 cursor-pointer hover:shadow-md transition-all"
                      onClick={() => handlePostClick(post.id)}
                    >
                      <div className="flex gap-3">
                        <div className="text-2xl">{category?.icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-xs font-medium text-primary">
                              {category?.label}
                            </span>
                            {getAdminStatusBadge()}
                          </div>
                          <p className="text-sm font-medium line-clamp-2 mb-2">
                            {post.content}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>❤️ {post.empathyCount || 0}</span>
                            <span>💬 {post.commentCount || 0}</span>
                            {post.latitude && post.longitude && (
                              <span>
                                📍 {post.neighborhood}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Locate Me Floating Button (only on map view) */}
      {viewMode === "map" && (
        <Button
          size="icon"
          className="fixed bottom-24 right-4 rounded-full shadow-lg z-40"
          variant="default"
          onClick={handleLocateMe}
        >
          <Crosshair className="w-5 h-5" />
        </Button>
      )}

      {/* Post Detail Modal */}
      {selectedPostId && (
        <PostDetailModal
          postId={selectedPostId}
          open={selectedPostId !== null}
          onOpenChange={(open) => {
            if (!open) setSelectedPostId(null);
          }}
        />
      )}
    </div>
  );
}

