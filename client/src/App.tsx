import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import { useEffect } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { WritePostProvider, useWritePost } from "./contexts/WritePostContext";
import Home from "./pages/Home";
import MapPage from "./pages/MapPage";
import NotificationsPage from "./pages/NotificationsPage";
import ProfilePage from "./pages/ProfilePage";
import ProfileSettingsPage from "./pages/ProfileSettingsPage";
import LoginPage from "./pages/LoginPage";
import { Home as HomeIcon, Map, Plus, Bell, User } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { WritePostModal } from "./components/WritePostModal";
import { trpc } from "@/lib/trpc";

function BottomNavigation() {
  const [location, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  const { openModal } = useWritePost();

  const navItems = [
    { href: "/", icon: HomeIcon, label: "홈" },
    { href: "/map", icon: Map, label: "지도" },
    { href: "/write", icon: Plus, label: "글쓰기", isModal: true },
    { href: "/notifications", icon: Bell, label: "알림", requiresAuth: true },
    { href: "/profile", icon: User, label: "마이", requiresAuth: true },
  ] as const;

  const handleNavClick = (item: (typeof navItems)[number]) => {
    // 글쓰기 버튼
    if (item.isModal) {
      if (!isAuthenticated) {
        setLocation("/login");
        return;
      }
      openModal();
      return;
    }

    // 인증이 필요한 메뉴
    if (item.requiresAuth && !isAuthenticated) {
      setLocation("/login");
      return;
    }

    setLocation(item.href);
  };

  return (
    <div className="bottom-nav">
      {navItems.map((item) => (
        <button
          key={item.href}
          onClick={() => handleNavClick(item)}
          className={`bottom-nav-item ${location === item.href ? "active" : ""}`}
        >
          <item.icon className="w-5 h-5" />
          <span className="text-xs">{item.label}</span>
        </button>
      ))}
    </div>
  );
}

function WriteRoute() {
  const { isAuthenticated } = useAuth();
  const { openModal } = useWritePost();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isAuthenticated) {
      openModal();
      // Redirect to home after opening modal
      setLocation("/");
    }
  }, [isAuthenticated, openModal, setLocation]);

  if (isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-muted-foreground mb-4">로그인이 필요합니다.</p>
        <Button asChild>
          <a href={getLoginUrl()}>로그인</a>
        </Button>
      </div>
    </div>
  );
}

function Router() {
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const [location] = useLocation();

  // URL에 _auth 파라미터가 있으면 인증 상태를 강제로 갱신
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has("_auth")) {
      console.log("[App] Auth parameter detected, refreshing auth state...");
      
      // iOS Safari는 쿠키 설정 후 즉시 읽을 수 없을 수 있으므로
      // 더 긴 대기 시간 후에 강제로 refetch
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      const delay = isIOS ? 3000 : 500; // iOS는 3초 (2초에서 증가), 다른 브라우저는 0.5초
      
      const refreshAuth = async () => {
        try {
          console.log("[App] Invalidating and refetching auth state...");
          console.log("[App] Current cookies:", document.cookie);
          
          // 캐시 무효화
          await utils.auth.me.invalidate();
          
          // 강제로 refetch
          const result = await utils.auth.me.refetch();
          
          console.log("[App] Refetch result:", {
            hasData: !!result?.data,
            data: result?.data ? { id: result.data.id, email: result.data.email } : null,
            error: result?.error,
          });
          
          if (result?.data) {
            console.log("[App] Auth state successfully refreshed:", result.data.id);
            // 데이터를 명시적으로 캐시에 설정
            utils.auth.me.setData(undefined, result.data);
          } else {
            console.warn("[App] Auth refetch returned no data, retrying...");
            // httpOnly 쿠키는 document.cookie에 나타나지 않으므로 확인 불가
            // 하지만 로그는 남겨둠
            console.log("[App] Cookies before retry (httpOnly cookies not visible):", document.cookie);
            
            // 재시도 (iOS Safari는 더 긴 대기 시간 필요)
            const retryDelay = isIOS ? 3000 : 1000; // iOS는 3초 (2초에서 증가)
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            
            const retryResult = await utils.auth.me.refetch();
            console.log("[App] Retry result:", {
              hasData: !!retryResult?.data,
              data: retryResult?.data ? { id: retryResult.data.id } : null,
              error: retryResult?.error,
            });
            
            if (retryResult?.data) {
              console.log("[App] Auth state refreshed on retry:", retryResult.data.id);
              utils.auth.me.setData(undefined, retryResult.data);
            } else {
              console.error("[App] Failed to refresh auth state after retry");
              console.error("[App] Final cookies:", document.cookie);
            }
          }
        } catch (error) {
          console.error("[App] Error refreshing auth state:", error);
          console.error("[App] Cookies on error:", document.cookie);
        }
      };
      
      setTimeout(refreshAuth, delay);
      
      // URL에서 _auth 파라미터 제거 (히스토리 정리)
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);
    }
  }, [location, utils]);

  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/login"} component={LoginPage} />
      <Route path={"/map"} component={MapPage} />
      <Route path={"/write"} component={WriteRoute} />
      <Route path={"/notifications"} component={NotificationsPage} />
      <Route path={"/profile"} component={ProfilePage} />
      <Route path={"/profile/settings"} component={ProfileSettingsPage} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { isOpen, closeModal, defaultNeighborhood } = useWritePost();
  const { isAuthenticated } = useAuth();

  return (
    <>
      <div className="flex flex-col min-h-screen">
        <Router />
        <BottomNavigation />
      </div>
      {isAuthenticated && (
        <WritePostModal
          open={isOpen}
          onOpenChange={closeModal}
          defaultNeighborhood={defaultNeighborhood}
        />
      )}
    </>
  );
}

function App() {
  const isProd = import.meta.env.MODE === "production";

  const content = (
    <ThemeProvider defaultTheme="light">
      <WritePostProvider>
        <TooltipProvider>
          <Toaster />
          <AppContent />
        </TooltipProvider>
      </WritePostProvider>
    </ThemeProvider>
  );

  // 개발 환경에서는 ErrorBoundary를 끄고, 콘솔에서만 에러를 확인
  // 프로덕션 빌드에서만 전체 앱 ErrorBoundary 적용
  return isProd ? <ErrorBoundary>{content}</ErrorBoundary> : content;
}

export default App;
