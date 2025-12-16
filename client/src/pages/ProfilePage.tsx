import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  User,
  MapPin,
  Calendar,
  FileText,
  Heart,
  MessageCircle,
  Settings,
  LogOut,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { PostDetailModal } from "@/components/PostDetailModal";
import { formatDistanceToNow } from "date-fns";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";
import { useLocation } from "wouter";

const categories = [
  { value: "inconvenience", label: "불편신고", icon: "🔴" },
  { value: "suggestion", label: "제안", icon: "🟢" },
  { value: "praise", label: "칭찬", icon: "💛" },
  { value: "chat", label: "잡담", icon: "💬" },
  { value: "emergency", label: "긴급", icon: "⚠️" },
] as const;

const adminStatusLabels: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  pending: { label: "검토 대기", icon: <Clock className="w-3 h-3" />, color: "text-yellow-600" },
  in_progress: { label: "행정 처리 중", icon: <Loader2 className="w-3 h-3 animate-spin" />, color: "text-blue-600" },
  completed: { label: "해결됨", icon: <CheckCircle2 className="w-3 h-3" />, color: "text-green-600" },
  rejected: { label: "반려됨", icon: <XCircle className="w-3 h-3" />, color: "text-red-600" },
};

export default function ProfilePage() {
  const { user, isAuthenticated, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"posts" | "empathized">("posts");

  const { data: profile } = trpc.profile.getMe.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const { data: stats } = trpc.profile.getStats.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const { data: myPosts = [], isLoading: isLoadingPosts } = trpc.posts.getMyPosts.useQuery(
    undefined,
    {
      enabled: isAuthenticated && activeTab === "posts",
    }
  );

  const { data: empathizedPosts = [], isLoading: isLoadingEmpathized } =
    trpc.posts.getMyEmpathizedPosts.useQuery(undefined, {
      enabled: isAuthenticated && activeTab === "empathized",
    });

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("로그아웃되었습니다.");
      window.location.href = "/";
    } catch (error) {
      toast.error("로그아웃에 실패했습니다.");
    }
  };

  if (!isAuthenticated) {
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

  const createdAt = profile?.createdAt ? new Date(profile.createdAt as any) : new Date();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-30 border-b border-border bg-card shadow-sm">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img 
                src="/image/jjalmak_logo.png" 
                alt="짤막" 
                className="h-11 w-auto"
              />
              <h1 className="text-xl font-bold text-muted-foreground">마이페이지</h1>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              로그아웃
            </Button>
          </div>
        </div>
      </div>

      <div className="container py-6 space-y-6">
        {/* Profile Section */}
        <Card className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center overflow-hidden">
              {profile?.profileImage ? (
                <img
                  src={profile.profileImage}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-10 h-10 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold mb-2">
                {profile?.nickname || user?.nickname || "사용자"}
              </h2>
              {profile?.bio && (
                <p className="text-sm text-muted-foreground mb-3">{profile.bio}</p>
              )}
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                {profile?.neighborhood && (
                  <div className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    <span>{profile.neighborhood}</span>
                    {profile.neighborhoodVerified && (
                      <span className="ml-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full dark:bg-green-950 dark:text-green-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        인증됨
                      </span>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  <span>
                    {formatDistanceToNow(createdAt, { addSuffix: true })} 가입
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Stats Dashboard */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <FileText className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold">{stats?.totalPosts || 0}</div>
            <div className="text-xs text-muted-foreground mt-1">작성한 글</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <Heart className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold">{stats?.totalEmpathy || 0}</div>
            <div className="text-xs text-muted-foreground mt-1">받은 공감</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <MessageCircle className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold">{stats?.totalComments || 0}</div>
            <div className="text-xs text-muted-foreground mt-1">받은 댓글</div>
          </Card>
        </div>

        {/* Posts Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "posts" | "empathized")}>
          <TabsList className="w-full">
            <TabsTrigger value="posts" className="flex-1">
              내가 쓴 글
            </TabsTrigger>
            <TabsTrigger value="empathized" className="flex-1">
              공감한 글
            </TabsTrigger>
          </TabsList>

          <TabsContent value="posts" className="mt-4">
            {isLoadingPosts ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Card key={i} className="p-4 skeleton h-24" />
                ))}
              </div>
            ) : myPosts.length === 0 ? (
              <Card className="p-8 text-center">
                <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">작성한 글이 없습니다.</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {myPosts.map((post: any) => {
                  const category = categories.find((c) => c.value === post.category);
                  const status = adminStatusLabels[post.adminStatus] || adminStatusLabels.pending;
                  const createdAt = post.createdAt ? new Date(post.createdAt) : new Date();

                  return (
                    <Card
                      key={post.id}
                      className="p-4 cursor-pointer hover:shadow-md transition-all"
                      onClick={() => setSelectedPostId(post.id)}
                    >
                      <div className="flex gap-3">
                        <div className="text-2xl">{category?.icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-xs font-medium text-foreground">
                              {category?.label}
                            </span>
                            <div
                              className={`flex items-center gap-1 text-xs ${status.color}`}
                            >
                              {status.icon}
                              <span>{status.label}</span>
                            </div>
                          </div>
                          <p className="text-sm font-medium line-clamp-2 mb-2">
                            {post.content}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>❤️ {post.empathyCount || 0}</span>
                            <span>💬 {post.commentCount || 0}</span>
                            <span>
                              {formatDistanceToNow(createdAt, { addSuffix: true })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="empathized" className="mt-4">
            {isLoadingEmpathized ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Card key={i} className="p-4 skeleton h-24" />
                ))}
              </div>
            ) : empathizedPosts.length === 0 ? (
              <Card className="p-8 text-center">
                <Heart className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">공감한 글이 없습니다.</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {empathizedPosts.map((post: any) => {
                  const category = categories.find((c) => c.value === post.category);
                  const status = adminStatusLabels[post.adminStatus] || adminStatusLabels.pending;
                  const createdAt = post.createdAt ? new Date(post.createdAt) : new Date();

                  return (
                    <Card
                      key={post.id}
                      className="p-4 cursor-pointer hover:shadow-md transition-all"
                      onClick={() => setSelectedPostId(post.id)}
                    >
                      <div className="flex gap-3">
                        <div className="text-2xl">{category?.icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-xs font-medium text-foreground">
                              {category?.label}
                            </span>
                            <div
                              className={`flex items-center gap-1 text-xs ${status.color}`}
                            >
                              {status.icon}
                              <span>{status.label}</span>
                            </div>
                          </div>
                          <p className="text-sm font-medium line-clamp-2 mb-2">
                            {post.content}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>❤️ {post.empathyCount || 0}</span>
                            <span>💬 {post.commentCount || 0}</span>
                            <span>
                              {formatDistanceToNow(createdAt, { addSuffix: true })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Settings Section */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="w-5 h-5 text-muted-foreground" />
            <h3 className="font-semibold">설정</h3>
          </div>
          <div className="space-y-2">
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => setLocation("/profile/settings")}
            >
              <User className="w-4 h-4 mr-2" />
              프로필 설정
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => setLocation("/profile/settings")}
            >
              <MapPin className="w-4 h-4 mr-2" />
              동네 재인증
              {user?.neighborhoodVerified && (
                <span className="ml-auto text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  인증됨
                </span>
              )}
            </Button>
            <Button variant="ghost" className="w-full justify-start" disabled>
              <Settings className="w-4 h-4 mr-2" />
              알림 설정
              <span className="ml-auto text-xs text-muted-foreground">준비 중</span>
            </Button>
          </div>
        </Card>
      </div>

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

