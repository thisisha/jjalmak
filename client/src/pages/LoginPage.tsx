import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { initKakao, loginWithKakao } from "@/lib/kakao";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");

  const utils = trpc.useUtils();

  useEffect(() => {
    initKakao();
  }, []);

  const handleKakaoLogin = async () => {
    try {
      const accessToken = await loginWithKakao();
      
      const response = await fetch("/api/auth/kakao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ accessToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "카카오 로그인에 실패했습니다.");
        return;
      }

      toast.success("카카오 로그인되었습니다!");
      
      // Wait longer for cookie to be set, especially on mobile
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      await new Promise(resolve => setTimeout(resolve, isMobile ? 1000 : 500));
      
      // Refresh auth state multiple times to ensure it's updated
      await utils.auth.me.invalidate();
      
      // Try to refetch auth state
      let retries = 0;
      let userData = null;
      while (retries < 3 && !userData) {
        try {
          userData = await utils.auth.me.refetch();
          if (userData?.data) break;
        } catch (e) {
          console.warn(`[Login] Auth refetch attempt ${retries + 1} failed:`, e);
        }
        retries++;
        if (retries < 3) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      // Force page reload on mobile to ensure cookies are properly set
      if (isMobile) {
        // Use window.location.replace to avoid back button issues
        window.location.replace("/");
      } else {
        setLocation("/");
      }
    } catch (error) {
      toast.error("카카오 로그인 중 오류가 발생했습니다.");
      console.error(error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 로그인 모드: 아이디(이메일/텍스트)만 있어도 로그인
    if (isLogin && !email.trim()) {
      toast.error("아이디(이메일)를 입력해주세요.");
      return;
    }
    
    // 회원가입 모드: 닉네임 필수
    if (!isLogin && !nickname) {
      toast.error("닉네임을 입력해주세요.");
      return;
    }
    
    try {
      // Use VITE_API_BASE_URL if available (Railway backend), otherwise same-origin
      const apiBaseUrlRaw = import.meta.env.VITE_API_BASE_URL ?? "";
      const apiBaseUrl = apiBaseUrlRaw.trim();
      const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";
      
      // Debug: Log environment variable
      console.log("[Login] VITE_API_BASE_URL raw:", apiBaseUrlRaw);
      console.log("[Login] VITE_API_BASE_URL trimmed:", apiBaseUrl);
      
      // Ensure apiBaseUrl starts with http:// or https://
      let fullUrl: string;
      if (apiBaseUrl) {
        // If apiBaseUrl doesn't start with http:// or https://, add https://
        const baseUrl = apiBaseUrl.startsWith("http://") || apiBaseUrl.startsWith("https://")
          ? apiBaseUrl
          : `https://${apiBaseUrl}`;
        fullUrl = `${baseUrl.replace(/\/$/, "")}${endpoint}`;
      } else {
        fullUrl = endpoint;
        console.warn("[Login] VITE_API_BASE_URL is not set, using relative path:", fullUrl);
      }
      
      const requestBody = {
        email: email.trim() || undefined,
        // 로그인: email만 사용, 회원가입: nickname도 함께 전송
        nickname: !isLogin ? nickname.trim() || undefined : undefined,
        password: password || undefined,
      };
      
      console.log("[Login] Full URL:", fullUrl);
      console.log("[Login] Request body:", requestBody);
      
      const response = await fetch(fullUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      console.log("[Login] Response:", response.status, data);

      if (!response.ok) {
        toast.error(data.error || (isLogin ? "로그인에 실패했습니다." : "회원가입에 실패했습니다."));
        return;
      }

      toast.success(isLogin ? "로그인되었습니다!" : "회원가입되었습니다!");
      
      // Wait longer for cookie to be set, especially on mobile
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const initialWaitTime = isMobile ? 2000 : 800; // 모바일: 2초, 데스크톱: 0.8초
      await new Promise(resolve => setTimeout(resolve, initialWaitTime));
      
      // Refresh auth state multiple times to ensure it's updated
      await utils.auth.me.invalidate();
      
      // Try to refetch auth state with longer wait times on mobile
      let retries = 0;
      let userData = null;
      const maxRetries = isMobile ? 5 : 3; // 모바일: 최대 5번 재시도
      
      while (retries < maxRetries && !userData) {
        try {
          console.log(`[Login] Auth refetch attempt ${retries + 1}/${maxRetries}`);
          userData = await utils.auth.me.refetch();
          
          if (userData?.data) {
            console.log("[Login] Auth state successfully updated:", userData.data.id);
            // 데이터가 있으면 React Query 캐시에 명시적으로 설정
            utils.auth.me.setData(undefined, userData.data);
            break;
          } else {
            console.warn(`[Login] Auth refetch attempt ${retries + 1} returned no data`);
          }
        } catch (e) {
          console.warn(`[Login] Auth refetch attempt ${retries + 1} failed:`, e);
        }
        
        retries++;
        if (retries < maxRetries) {
          // 모바일에서는 더 긴 대기 시간
          const waitTime = isMobile ? 1000 : 500;
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
      
      // 모바일에서는 쿠키가 제대로 설정되었는지 확인하기 위해 추가 대기
      if (isMobile && !userData?.data) {
        console.log("[Login] Mobile: Waiting additional time for cookie to be set...");
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // 마지막 시도
        try {
          userData = await utils.auth.me.refetch();
          if (userData?.data) {
            utils.auth.me.setData(undefined, userData.data);
            console.log("[Login] Mobile: Auth state updated after additional wait");
          }
        } catch (e) {
          console.warn("[Login] Mobile: Final refetch attempt failed:", e);
        }
      }
      
      // Force page reload to ensure cookies are properly set and auth state is refreshed
      // URL에 timestamp를 추가하여 캐시를 우회하고 인증 상태를 강제로 갱신
      const timestamp = Date.now();
      const redirectUrl = `/?_auth=${timestamp}`;
      
      console.log("[Login] Reloading page to ensure auth state is updated");
      window.location.replace(redirectUrl);
    } catch (error) {
      console.error("[Login] Error:", error);
      toast.error("오류가 발생했습니다. 콘솔을 확인해주세요.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">짤막</CardTitle>
          <CardDescription>
            {isLogin ? "로그인하여 시작하세요" : "새 계정을 만드세요"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="nickname">닉네임 (필수)</Label>
                <Input
                  id="nickname"
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="닉네임을 입력하세요"
                  required
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">
                {isLogin ? "아이디 / 이메일 (필수)" : "이메일 (선택)"}
              </Label>
              <Input
                id="email"
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={isLogin ? "예: test 또는 test@example.com" : "예: test@example.com"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">비밀번호 (선택, 개발 모드)</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호를 입력하세요"
              />
            </div>
            <Button type="submit" className="w-full">
              {isLogin ? "로그인" : "회원가입"}
            </Button>
          </form>
          
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">또는</span>
            </div>
          </div>

          <Button
            type="button"
            onClick={handleKakaoLogin}
            className="w-full bg-[#FEE500] text-black hover:bg-[#FEE500]/90"
          >
            <svg
              className="w-5 h-5 mr-2"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 3c5.799 0 10.5 3.664 10.5 8.185 0 4.52-4.701 8.184-10.5 8.184a13.5 13.5 0 0 1-1.912-.123 4.5 4.5 0 0 0 2.935-4.122c0-2.23-1.769-4.04-3.95-4.04-2.181 0-3.95 1.81-3.95 4.04a4.5 4.5 0 0 0 2.935 4.122 13.5 13.5 0 0 1-1.912.123C6.201 19.369 1.5 15.705 1.5 11.185 1.5 6.664 6.201 3 12 3z" />
            </svg>
            카카오로 시작하기
          </Button>

          <div className="mt-4 text-center text-sm">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-primary hover:underline"
            >
              {isLogin ? "계정이 없으신가요? 회원가입" : "이미 계정이 있으신가요? 로그인"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

