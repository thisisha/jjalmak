import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Heart,
  MessageCircle,
  MapPin,
  AlertCircle,
  Loader2,
  Search,
  X,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { useState, useCallback, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { useWritePost } from "@/contexts/WritePostContext";
import { PostDetailModal } from "@/components/PostDetailModal";
import { useLocation } from "wouter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { reverseGeocode } from "@/lib/kakaoAddress";
import { formatDistanceToNow, differenceInHours, differenceInDays, differenceInWeeks } from "date-fns";
import { ko } from "date-fns/locale";

// 커스텀 시간 포맷 함수: 24시간까지는 시간 단위, 7일까지는 일 단위, 그 이후는 주 단위
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const hours = differenceInHours(now, date);
  const days = differenceInDays(now, date);
  const weeks = differenceInWeeks(now, date);

  if (hours < 24) {
    if (hours < 1) {
      return "방금 전";
    }
    return `${hours}시간 전`;
  } else if (days < 7) {
    return `${days}일 전`;
  } else {
    return `${weeks}주 전`;
  }
}

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const { openModal, setDefaultNeighborhood } = useWritePost();
  const [, setLocation] = useLocation();
  const [sortBy, setSortBy] = useState<"recent" | "popular">("popular");
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const [locationScope, setLocationScope] = useState<"city" | "district" | "neighborhood">(
    "neighborhood"
  );
  // 프로필에 저장된 동네 또는 localStorage에서 마지막으로 사용한 동네 불러오기
  const getInitialNeighborhood = () => {
    // 1순위: 프로필에 저장된 동네
    if (user?.neighborhood) {
      return user.neighborhood as string;
    }
    // 2순위: localStorage의 마지막 동네
    try {
      const last = localStorage.getItem("lastNeighborhood");
      if (last) return last;
    } catch {
      // ignore
    }
    return null;
  };

  const [neighborhood, setNeighborhood] = useState<string | null>(getInitialNeighborhood());
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);
  const [offset, setOffset] = useState(0);
  const [allPosts, setAllPosts] = useState<any[]>([]);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [isSearchMode, setIsSearchMode] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const PAGE_SIZE = 20;

  // 위치 가져오기 함수
  const getCurrentLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      setLocationError("이 브라우저는 위치 정보를 지원하지 않습니다.");
      setIsLoadingLocation(false);
      return;
    }

    setIsLoadingLocation(true);
    setLocationError(null);

    // 사파리에서 위치 권한이 제대로 작동하도록 옵션 조정
    // enableHighAccuracy: false로 설정하면 사파리에서 더 안정적으로 작동
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    const geoOptions = {
      enableHighAccuracy: !isSafari, // 사파리에서는 false로 설정
      timeout: 15000, // 15초 타임아웃 (사파리는 더 오래 걸릴 수 있음)
      maximumAge: isSafari ? 60000 : 0, // 사파리에서는 1분간 캐시 허용
    };

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          
          try {
            // 역지오코딩 시도 (재시도 로직은 reverseGeocode 내부에서 처리)
            const addr = await reverseGeocode(latitude, longitude);
            if (addr?.address_name) {
              setNeighborhood(addr.address_name);
              setDefaultNeighborhood(addr.address_name);
              setLocationError(null);
              // localStorage에 저장
              try {
                localStorage.setItem("lastNeighborhood", addr.address_name);
              } catch (e) {
                console.warn("Failed to save neighborhood to localStorage:", e);
              }
            } else {
              // 역지오코딩 결과가 없으면 프로필 동네 또는 마지막 동네 사용
              const fallbackNeighborhood = (user as any)?.neighborhood || getInitialNeighborhood();
              if (fallbackNeighborhood) {
                setNeighborhood(fallbackNeighborhood);
                setDefaultNeighborhood(fallbackNeighborhood);
                setLocationError(null); // 에러가 아니라 차선책 사용
              } else {
                setLocationError("주소를 찾을 수 없습니다. 프로필 설정에서 동네를 수동으로 설정해주세요.");
                setNeighborhood(null);
              }
            }
          } catch (error: any) {
            // API 오류 시 프로필 동네 또는 마지막 동네 사용
            console.warn("Reverse geocode failed after retries:", error);
            const fallbackNeighborhood = (user as any)?.neighborhood || getInitialNeighborhood();
            
            if (error.message?.includes("429") || error.message?.includes("호출 제한")) {
              if (fallbackNeighborhood) {
                setNeighborhood(fallbackNeighborhood);
                setDefaultNeighborhood(fallbackNeighborhood);
                setLocationError("API 호출 제한으로 프로필에 저장된 위치를 사용합니다. 잠시 후 자동으로 업데이트됩니다.");
              } else {
                setLocationError("API 호출 제한에 도달했습니다. 잠시 후 다시 시도하거나 프로필 설정에서 동네를 수동으로 설정해주세요.");
                setNeighborhood(null);
              }
            } else {
              if (fallbackNeighborhood) {
                setNeighborhood(fallbackNeighborhood);
                setDefaultNeighborhood(fallbackNeighborhood);
                setLocationError(null); // 에러가 아니라 차선책 사용
              } else {
                setLocationError("주소를 찾을 수 없습니다. 프로필 설정에서 동네를 수동으로 설정해주세요.");
                setNeighborhood(null);
              }
            }
          }
        } catch (error) {
          console.error("Location processing error:", error);
          // 위치 처리 오류 시에도 프로필 동네 사용
          const fallbackNeighborhood = (user as any)?.neighborhood || getInitialNeighborhood();
          if (fallbackNeighborhood) {
            setNeighborhood(fallbackNeighborhood);
            setDefaultNeighborhood(fallbackNeighborhood);
            setLocationError("위치 정보 처리에 실패했지만 프로필에 저장된 위치를 사용합니다.");
          } else {
            setLocationError("위치 정보를 처리하는데 실패했습니다.");
            setNeighborhood(null);
          }
        } finally {
          setIsLoadingLocation(false);
        }
      },
      (error) => {
        console.error("Geolocation error:", error);
        console.error("Error code:", error.code, "Error message:", error.message);
        
        // 사파리에서 PERMISSION_DENIED가 나와도 실제로는 권한이 있을 수 있음
        // enableHighAccuracy: true로 시도했을 때 실패하면 false로 재시도
        if (error.code === error.PERMISSION_DENIED && isSafari && geoOptions.enableHighAccuracy) {
          console.log("[Home] Safari permission denied with enableHighAccuracy: true, retrying with false");
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              try {
                const { latitude, longitude } = position.coords;
                const addr = await reverseGeocode(latitude, longitude);
                if (addr?.address_name) {
                  setNeighborhood(addr.address_name);
                  setDefaultNeighborhood(addr.address_name);
                  setLocationError(null);
                  try {
                    localStorage.setItem("lastNeighborhood", addr.address_name);
                  } catch (e) {
                    console.warn("Failed to save neighborhood to localStorage:", e);
                  }
                } else {
                  const fallbackNeighborhood = (user as any)?.neighborhood || getInitialNeighborhood();
                  if (fallbackNeighborhood) {
                    setNeighborhood(fallbackNeighborhood);
                    setDefaultNeighborhood(fallbackNeighborhood);
                    setLocationError(null);
                  }
                }
              } catch (e) {
                const fallbackNeighborhood = (user as any)?.neighborhood || getInitialNeighborhood();
                if (fallbackNeighborhood) {
                  setNeighborhood(fallbackNeighborhood);
                  setDefaultNeighborhood(fallbackNeighborhood);
                  setLocationError(null);
                }
              } finally {
                setIsLoadingLocation(false);
              }
            },
            (retryError) => {
              // 재시도도 실패하면 fallback 사용
              const fallbackNeighborhood = (user as any)?.neighborhood || getInitialNeighborhood();
              if (fallbackNeighborhood) {
                setNeighborhood(fallbackNeighborhood);
                setDefaultNeighborhood(fallbackNeighborhood);
                setLocationError("위치 정보를 가져올 수 없어 프로필에 저장된 위치를 사용합니다.");
              } else {
                setLocationError("위치 정보를 가져올 수 없습니다. 프로필 설정에서 동네를 수동으로 설정해주세요.");
              }
              setIsLoadingLocation(false);
            },
            {
              enableHighAccuracy: false,
              timeout: 15000,
              maximumAge: 60000,
            }
          );
          return; // 첫 번째 에러 핸들러는 여기서 종료
        }
        
        // GPS 권한 거부 시에도 프로필 동네 사용
        const fallbackNeighborhood = (user as any)?.neighborhood || getInitialNeighborhood();
        if (fallbackNeighborhood) {
          setNeighborhood(fallbackNeighborhood);
          setDefaultNeighborhood(fallbackNeighborhood);
          if (error.code === error.PERMISSION_DENIED) {
            setLocationError("위치 권한이 거부되어 프로필에 저장된 위치를 사용합니다.");
          } else {
            setLocationError("위치 정보를 가져올 수 없어 프로필에 저장된 위치를 사용합니다.");
          }
        } else {
          if (error.code === error.PERMISSION_DENIED) {
            setLocationError("위치 권한이 거부되었습니다. 위치를 허용해주세요.");
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            setLocationError("위치 정보를 사용할 수 없습니다.");
          } else if (error.code === error.TIMEOUT) {
            setLocationError("위치 정보 요청 시간이 초과되었습니다.");
          } else {
            setLocationError("위치 정보를 가져오는데 실패했습니다.");
          }
        }
        setIsLoadingLocation(false);
      },
      geoOptions
    );
  }, [setDefaultNeighborhood]);

  // 초기 진입 시 브라우저 GPS로 현재 위치를 가져와 동네 설정
  // 프로필에 동네가 있으면 API 호출 없이 바로 사용
  // iOS Safari는 사용자 제스처 내에서만 위치 정보를 요청할 수 있으므로
  // 자동으로 위치를 가져오지 않고 사용자가 명시적으로 요청할 때만 가져옴
  const hasInitialized = useRef(false);
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  
  useEffect(() => {
    // 한 번만 실행되도록 보장
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    
    // 프로필에 동네가 있으면 API 호출 없이 바로 사용
    if ((user as any)?.neighborhood) {
      setNeighborhood((user as any).neighborhood);
      setDefaultNeighborhood((user as any).neighborhood);
      setIsLoadingLocation(false);
      return;
    }
    
    // iOS Safari는 사용자 제스처 없이 위치 정보를 요청할 수 없으므로
    // 자동으로 위치를 가져오지 않고 사용자에게 버튼을 표시
    if (isIOS) {
      setIsLoadingLocation(false);
      setLocationError("위치 권한을 허용해주세요");
      return;
    }
    
    // iOS가 아닌 경우에만 자동으로 위치 가져오기
    getCurrentLocation();
  }, [user, getCurrentLocation, isIOS]); // user가 변경될 때만 재실행

  // Update default neighborhood in context when it changes
  useEffect(() => {
    if (neighborhood) {
      setDefaultNeighborhood(neighborhood);
    }
  }, [neighborhood, setDefaultNeighborhood]);

  // Reset posts when filters change
  useEffect(() => {
    setAllPosts([]);
    setOffset(0);
  }, [neighborhood, sortBy, selectedCategory, searchKeyword, isSearchMode, locationScope]);

  // Get posts by neighborhood or search (only if neighborhood is set)
  const {
    data: posts = [],
    isLoading,
    isFetching,
  } = isSearchMode && searchKeyword.trim()
    ? trpc.posts.search.useQuery(
        {
          keyword: searchKeyword.trim(),
          neighborhood: neighborhood || "",
          category: selectedCategory,
          sortBy,
          limit: PAGE_SIZE,
          offset,
        },
        { enabled: !!neighborhood }
      )
    : trpc.posts.getByNeighborhood.useQuery(
        {
          neighborhood: neighborhood || "",
          limit: PAGE_SIZE,
          offset,
          sortBy,
          category: selectedCategory,
          scope: locationScope,
        },
        { enabled: !!neighborhood }
      );

  // Update allPosts when new posts are fetched
  useEffect(() => {
    if (posts.length > 0) {
      if (offset === 0) {
        // First page or filter changed
        setAllPosts(posts);
      } else {
        // Append new posts
        setAllPosts((prev) => {
          // Avoid duplicates
          const existingIds = new Set(prev.map((p: any) => p.id));
          const newPosts = posts.filter((p: any) => !existingIds.has(p.id));
          return [...prev, ...newPosts];
        });
      }
    } else if (offset === 0) {
      // No posts found
      setAllPosts([]);
    }
  }, [posts, offset]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isFetching && posts.length === PAGE_SIZE) {
          // Load more if we got a full page
          setOffset((prev) => prev + PAGE_SIZE);
        }
      },
      { threshold: 0.1 }
    );

    const currentRef = loadMoreRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [isFetching, posts.length]);

  const addEmpathyMutation = trpc.empathy.add.useMutation();
  const removeEmpathyMutation = trpc.empathy.remove.useMutation();

  const handleEmpathy = useCallback(
    async (postId: number, hasEmpathized: boolean) => {
      if (!isAuthenticated) {
        window.location.href = getLoginUrl();
        return;
      }

      if (hasEmpathized) {
        await removeEmpathyMutation.mutateAsync(postId);
      } else {
        await addEmpathyMutation.mutateAsync(postId);
      }
    },
    [isAuthenticated, addEmpathyMutation, removeEmpathyMutation]
  );

  const handleShowInMap = useCallback((postId: number, lat: number, lng: number) => {
    setLocation(`/map?lat=${lat}&lng=${lng}&postId=${postId}`);
  }, [setLocation]);

  const categories = [
    { value: "inconvenience", label: "불편신고", icon: "🔴" },
    { value: "suggestion", label: "제안", icon: "🟢" },
    { value: "praise", label: "칭찬", icon: "💛" },
    { value: "chat", label: "잡담", icon: "💬" },
    { value: "emergency", label: "긴급", icon: "⚠️" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-30 border-b border-border bg-card shadow-sm">
        <div className="container py-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img 
                src="/image/jjalmak_logo.png" 
                alt="짤막" 
                className="h-12 w-auto"
              />
              {isLoadingLocation ? (
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  위치 불러오는 중...
                </div>
              ) : locationError ? (
                <button
                  onClick={() => {
                    // 사용자가 명시적으로 요청할 때만 API 호출
                    setIsLoadingLocation(true);
                    getCurrentLocation();
                  }}
                  className="text-xs text-orange-600 dark:text-orange-400 flex items-center gap-1 hover:underline"
                >
                  <MapPin className="w-3 h-3" />
                  위치를 허용해주세요
                </button>
              ) : neighborhood ? (
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {neighborhood}
                </div>
              ) : null}
            </div>
            {isAuthenticated ? (
              <div className="text-sm font-medium text-foreground">
                {user?.nickname || "사용자"}
              </div>
            ) : (
              <Button size="sm" asChild>
                <a href={getLoginUrl()}>로그인</a>
              </Button>
            )}
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="게시글 검색..."
              value={searchKeyword}
              onChange={(e) => {
                setSearchKeyword(e.target.value);
                setIsSearchMode(e.target.value.trim().length > 0);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && searchKeyword.trim()) {
                  setIsSearchMode(true);
                }
              }}
              className="pl-9 pr-9"
            />
            {searchKeyword && (
              <button
                type="button"
                onClick={() => {
                  setSearchKeyword("");
                  setIsSearchMode(false);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content">
        <div className="container py-4 space-y-4">
          {/* Sort and Location Scope */}
          <div className="flex gap-2 overflow-x-auto pb-2 items-center">
            <div className="flex gap-2">
              <Button
                variant={sortBy === "recent" ? "default" : "outline"}
                size="sm"
                onClick={() => setSortBy("recent")}
              >
                최신순
              </Button>
              <Button
                variant={sortBy === "popular" ? "default" : "outline"}
                size="sm"
                onClick={() => setSortBy("popular")}
              >
                공감순
              </Button>
            </div>
            <Select
              value={locationScope}
              onValueChange={(value) =>
                setLocationScope(value as "city" | "district" | "neighborhood")
              }
            >
              <SelectTrigger className="w-[120px] ml-auto">
                <SelectValue placeholder="범위" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="neighborhood">동 기준</SelectItem>
                <SelectItem value="district">구 전체</SelectItem>
                <SelectItem value="city">시 전체</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Category Filter */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            <Button
              variant={selectedCategory === undefined ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(undefined)}
            >
              전체
            </Button>
            {categories.map((cat) => (
              <Button
                key={cat.value}
                variant={selectedCategory === cat.value ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(cat.value)}
              >
                {cat.icon} {cat.label}
              </Button>
            ))}
          </div>

          {/* Search Mode Indicator */}
          {isSearchMode && searchKeyword.trim() && (
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  "{searchKeyword}" 검색 결과
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchKeyword("");
                  setIsSearchMode(false);
                }}
              >
                <X className="w-4 h-4 mr-1" />
                검색 취소
              </Button>
            </div>
          )}

          {/* Posts Feed */}
          <div className="space-y-3">
            {!neighborhood && locationError ? (
              <Card className="p-8 text-center">
                <MapPin className="w-12 h-12 mx-auto mb-4 text-orange-500" />
                <h3 className="text-lg font-semibold mb-2">위치 권한이 필요합니다</h3>
                <p className="text-muted-foreground mb-4">
                  동네 게시글을 보려면 위치 권한을 허용해주세요.
                </p>
                <Button 
                  onClick={() => {
                    setIsLoadingLocation(true);
                    getCurrentLocation();
                  }} 
                  variant="default"
                >
                  위치 권한 허용하기
                </Button>
              </Card>
            ) : isLoading && offset === 0 ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Card key={i} className="p-4 skeleton h-32" />
                ))}
              </div>
            ) : allPosts.length === 0 ? (
              <Card className="p-8 text-center">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-muted-foreground">
                  {isSearchMode
                    ? `"${searchKeyword}"에 대한 검색 결과가 없습니다.`
                    : "게시글이 없습니다."}
                </p>
              </Card>
            ) : (
              <>
                {allPosts.map((post: any) => (
                  <PostCard
                    key={post.id}
                    post={post as any}
                    onEmpathy={handleEmpathy}
                    categories={categories}
                    onClick={() => setSelectedPostId(post.id)}
                    onShowInMap={handleShowInMap}
                  />
                ))}
                {/* Load More Trigger */}
                <div ref={loadMoreRef} className="py-4">
                  {isFetching && offset > 0 && (
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">더 많은 게시글을 불러오는 중...</span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Floating Write Button */}
      {isAuthenticated && (
        <Button
          className="fixed bottom-24 right-4 rounded-full w-14 h-14 shadow-lg z-40"
          onClick={openModal}
        >
          +
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

interface PostCardProps {
  post: {
    id: number;
    content: string;
    category: string;
    empathyCount: number;
    commentCount: number;
    neighborhood: string;
    isAnonymous: boolean;
    images?: string | null;
    adminStatus: string;
    latitude?: string | null;
    longitude?: string | null;
  };
  onEmpathy: (postId: number, hasEmpathized: boolean) => void;
  categories: Array<{ value: string; label: string; icon: string }>;
  onClick?: () => void;
  onShowInMap?: (postId: number, lat: number, lng: number) => void;
}

function PostCard({ post, onEmpathy, categories, onClick, onShowInMap }: PostCardProps) {
  const { user } = useAuth();
  const [hasEmpathized, setHasEmpathized] = useState(false);

  const category = categories.find((c) => c.value === post.category);
  const isHot = (post.empathyCount || 0) >= 20; // HOT 기준: 공감 20개 이상
  const isEmergency = post.category === "emergency";
  
  // 행정 상태 스타일
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
  
  const handleShowInMap = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (post.latitude && post.longitude && onShowInMap) {
      const lat = parseFloat(post.latitude);
      const lng = parseFloat(post.longitude);
      if (!isNaN(lat) && !isNaN(lng)) {
        onShowInMap(post.id, lat, lng);
      }
    }
  }, [post, onShowInMap]);

  return (
    <Card
      className={`card-post cursor-pointer hover:shadow-md transition-all ${
        isEmergency ? "border-orange-500 border-2" : ""
      }`}
      onClick={onClick}
    >
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <div className="text-2xl">{category?.icon}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-xs font-medium text-foreground">
                  {category?.label}
                </span>
                {isEmergency && (
                  <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full dark:bg-orange-950 dark:text-orange-400 font-semibold">
                    ⚠️ 긴급
                  </span>
                )}
                {isHot && !isEmergency && (
                  <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full dark:bg-red-950 dark:text-red-400 font-semibold">
                    🔥 HOT
                  </span>
                )}
                {getAdminStatusBadge()}
              </div>
              <p className="text-sm font-medium text-foreground line-clamp-2">
                {post.content}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {post.isAnonymous ? "익명" : "사용자"} • {post.createdAt ? formatRelativeTime(new Date(post.createdAt as any)) : "방금 전"}
              </p>
            </div>
          </div>
        </div>

        {/* Images Preview */}
        {post.images && (() => {
          // Safely parse images - handle both JSON array and single string URL
          let imageArray: string[] = [];
          try {
            const parsed = JSON.parse((post.images as string) || "[]");
            imageArray = Array.isArray(parsed) ? parsed : [parsed];
          } catch {
            // If parsing fails, treat as single URL string
            imageArray = typeof post.images === "string" ? [post.images] : [];
          }
          return imageArray.length > 0 ? (
            <div className="flex gap-2 overflow-x-auto py-2">
              {imageArray.map((img: string, idx: number) => (
                <img
                  key={idx}
                  src={img}
                  alt="post thumbnail"
                  className="w-20 h-20 rounded-md object-cover flex-shrink-0 border"
                  onError={(e) => {
                    console.error("[Home] Failed to load image:", img);
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              ))}
            </div>
          ) : null;
        })()}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div className="flex items-center gap-4">
            <button
              className="empathy-btn"
              onClick={(e) => {
                e.stopPropagation(); // Prevent card click
                setHasEmpathized(!hasEmpathized);
                onEmpathy(post.id, hasEmpathized);
              }}
            >
              <Heart
                className={`w-4 h-4 ${
                  hasEmpathized ? "fill-current" : ""
                }`}
              />
              <span className="text-xs font-medium">{post.empathyCount}</span>
            </button>
            <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <MessageCircle className="w-4 h-4" />
              <span>{post.commentCount}</span>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground">
              {post.neighborhood}
            </p>
            {post.latitude && post.longitude && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={handleShowInMap}
              >
                <MapPin className="w-3 h-3 mr-1" />
                지도에서 보기
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
