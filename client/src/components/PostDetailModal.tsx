import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Heart, MessageCircle, MapPin, Share2, Loader2, CheckCircle2, Clock, XCircle, Trash2, AlertCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useLocation } from "wouter";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { formatDistanceToNow, differenceInHours, differenceInDays, differenceInWeeks } from "date-fns";

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
import { getLoginUrl } from "@/const";
import { initKakao } from "@/lib/kakao";

const categories = [
  { value: "inconvenience", label: "불편신고", icon: "🔴" },
  { value: "suggestion", label: "제안", icon: "🟢" },
  { value: "praise", label: "칭찬", icon: "💛" },
  { value: "chat", label: "잡담", icon: "💬" },
  { value: "emergency", label: "긴급", icon: "⚠️" },
] as const;

const adminStatusLabels: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  pending: { label: "검토 대기 중", icon: <Clock className="w-4 h-4" />, color: "text-yellow-600 dark:text-yellow-400" },
  in_progress: { label: "행정 처리 중", icon: <Loader2 className="w-4 h-4 animate-spin" />, color: "text-blue-600 dark:text-blue-400" },
  completed: { label: "처리 완료", icon: <CheckCircle2 className="w-4 h-4" />, color: "text-green-600 dark:text-green-400" },
  rejected: { label: "반려됨", icon: <XCircle className="w-4 h-4" />, color: "text-red-600 dark:text-red-400" },
};

interface PostDetailModalProps {
  postId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PostDetailModal({
  postId,
  open,
  onOpenChange,
}: PostDetailModalProps) {
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [commentContent, setCommentContent] = useState("");
  const [hasEmpathized, setHasEmpathized] = useState(false);

  // Fetch post details
  const { data: post, isLoading, refetch } = trpc.posts.getById.useQuery(
    postId,
    {
      enabled: open && postId > 0,
    }
  );

  // Check if user has empathized
  const { data: userHasEmpathized } = trpc.empathy.hasEmpathized.useQuery(
    postId,
    {
      enabled: open && isAuthenticated && postId > 0,
    }
  );

  useEffect(() => {
    if (userHasEmpathized !== undefined) {
      setHasEmpathized(userHasEmpathized);
    }
  }, [userHasEmpathized]);

  useEffect(() => {
    // Initialize Kakao SDK for sharing
    if (open) {
      initKakao();
    }
  }, [open]);

  const utils = trpc.useUtils();
  const addEmpathyMutation = trpc.empathy.add.useMutation({
    onSuccess: () => {
      setHasEmpathized(true);
      refetch();
      utils.posts.getByNeighborhood.invalidate();
    },
  });
  const removeEmpathyMutation = trpc.empathy.remove.useMutation({
    onSuccess: () => {
      setHasEmpathized(false);
      refetch();
      utils.posts.getByNeighborhood.invalidate();
    },
  });
  const createCommentMutation = trpc.comments.create.useMutation({
    onSuccess: () => {
      setCommentContent("");
      refetch();
      utils.posts.getByNeighborhood.invalidate();
      toast.success("댓글이 작성되었습니다.");
    },
    onError: (error) => {
      toast.error(`댓글 작성 실패: ${error.message}`);
    },
  });

  const deleteCommentMutation = trpc.comments.delete.useMutation({
    onSuccess: () => {
      refetch();
      utils.posts.getByNeighborhood.invalidate();
      toast.success("댓글이 삭제되었습니다.");
    },
    onError: (error) => {
      toast.error(`댓글 삭제 실패: ${error.message}`);
    },
  });

  const handleEmpathy = useCallback(async () => {
    if (!isAuthenticated) {
      window.location.href = getLoginUrl();
      return;
    }

    if (hasEmpathized) {
      await removeEmpathyMutation.mutateAsync(postId);
    } else {
      await addEmpathyMutation.mutateAsync(postId);
    }
  }, [isAuthenticated, hasEmpathized, postId, addEmpathyMutation, removeEmpathyMutation]);

  const handleCommentSubmit = useCallback(async () => {
    if (!isAuthenticated) {
      window.location.href = getLoginUrl();
      return;
    }

    if (!commentContent.trim()) {
      toast.error("댓글 내용을 입력해주세요.");
      return;
    }

    if (commentContent.length > 500) {
      toast.error("댓글은 500자 이하여야 합니다.");
      return;
    }

    await createCommentMutation.mutateAsync({
      postId,
      content: commentContent.trim(),
      isAnonymous: false, // TODO: Add anonymous option for comments
    });
  }, [isAuthenticated, commentContent, postId, createCommentMutation]);

  const handleShare = useCallback(async () => {
    const url = `${window.location.origin}/post/${postId}`;
    const title = "짤막 게시글";
    const description = post?.content?.substring(0, 100) || "";
    
    // 카카오톡 공유 (카카오 SDK가 로드된 경우)
    if (window.Kakao && window.Kakao.isInitialized()) {
      try {
        window.Kakao.Share.sendDefault({
          objectType: "feed",
          content: {
            title: title,
            description: description,
            imageUrl: (() => {
              if (!post?.images) return undefined;
              try {
                const parsed = JSON.parse(post.images as string);
                return Array.isArray(parsed) ? parsed[0] : parsed;
              } catch {
                return typeof post.images === "string" ? post.images : undefined;
              }
            })(),
            link: {
              mobileWebUrl: url,
              webUrl: url,
            },
          },
        });
        toast.success("카카오톡으로 공유되었습니다.");
        return;
      } catch (error) {
        console.error("Kakao share error:", error);
      }
    }

    // Web Share API (모바일)
    if (navigator.share) {
      try {
        await navigator.share({
          title: title,
          text: description,
          url,
        });
        toast.success("공유되었습니다.");
      } catch (error) {
        // User cancelled or error occurred
        if ((error as Error).name !== "AbortError") {
          // Copy to clipboard as fallback
          try {
            await navigator.clipboard.writeText(url);
            toast.success("링크가 클립보드에 복사되었습니다.");
          } catch (clipboardError) {
            toast.error("공유에 실패했습니다.");
          }
        }
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(url);
        toast.success("링크가 클립보드에 복사되었습니다.");
      } catch (error) {
        toast.error("링크 복사에 실패했습니다.");
      }
    }
  }, [postId, post?.content, post?.images]);

  if (isLoading || !post) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const category = categories.find((c) => c.value === post.category);
  // Safely parse images - handle both JSON array and single string URL
  const images = (() => {
    if (!post.images) return [];
    try {
      const parsed = JSON.parse(post.images as string);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      // If parsing fails, treat as single URL string
      return typeof post.images === "string" ? [post.images] : [];
    }
  })();
  const comments = (post as any).comments || [];
  const adminStatus = adminStatusLabels[post.adminStatus] || adminStatusLabels.pending;
  const createdAt = post.createdAt ? new Date(post.createdAt as any) : new Date();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pr-8">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-2xl">{category?.icon}</span>
            <DialogTitle className="flex-1">
              <span className="text-sm font-medium text-primary">
                {category?.label}
              </span>
            </DialogTitle>
            <div className="flex items-center gap-2 flex-wrap">
              {post.category === "emergency" && (
                <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full dark:bg-orange-950 dark:text-orange-400 font-semibold flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  긴급
                </span>
              )}
              {(post.empathyCount || 0) >= 20 && post.category !== "emergency" && (
                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full dark:bg-red-950 dark:text-red-400 font-semibold">
                  🔥 HOT
                </span>
              )}
              {post.adminStatus === "pending" && (
                <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded border border-border/50 bg-muted/30 flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" />
                  검토대기
                </span>
              )}
              {post.adminStatus === "in_progress" && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full dark:bg-blue-950 dark:text-blue-400 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  처리중
                </span>
              )}
              {post.adminStatus === "completed" && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full dark:bg-green-950 dark:text-green-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  해결됨
                </span>
              )}
              {post.adminStatus === "rejected" && (
                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full dark:bg-red-950 dark:text-red-400 flex items-center gap-1">
                  <XCircle className="w-3 h-3" />
                  반려됨
                </span>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Post Content */}
          <div className="space-y-3">
            <p className="text-base leading-relaxed">{post.content}</p>
            
            <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
              <span>{post.isAnonymous ? "익명" : "사용자"}</span>
              <span>•</span>
              <span>
                {formatRelativeTime(createdAt)}
              </span>
              <span>•</span>
              <div className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                <span>{post.neighborhood}</span>
              </div>
              {post.latitude && post.longitude && (
                <>
                  <span>•</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => {
                      const lat = parseFloat(post.latitude as string);
                      const lng = parseFloat(post.longitude as string);
                      if (!isNaN(lat) && !isNaN(lng)) {
                        onOpenChange(false);
                        setLocation(`/map?lat=${lat}&lng=${lng}&postId=${postId}`);
                      }
                    }}
                  >
                    <MapPin className="w-3 h-3 mr-1" />
                    지도에서 보기
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Images Carousel */}
          {images.length > 0 && (
            <div className="relative">
              <Carousel className="w-full">
                <CarouselContent>
                  {images.map((img: string, idx: number) => (
                    <CarouselItem key={idx}>
                      <div className="relative aspect-video w-full overflow-hidden rounded-lg border">
                        <img
                          src={img}
                          alt={`Post image ${idx + 1}`}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                {images.length > 1 && (
                  <>
                    <CarouselPrevious className="left-2" />
                    <CarouselNext className="right-2" />
                  </>
                )}
              </Carousel>
            </div>
          )}

          {/* Admin Notes - 관리자 메모가 있을 때만 표시 */}
          {post.adminNotes && (
            <div className="rounded-lg border p-4 bg-muted/50">
              <p className="text-sm text-muted-foreground">
                {post.adminNotes}
              </p>
            </div>
          )}
          
          {/* 검토대기 중 공감 50개 달성 안내 */}
          {post.empathyCount >= 50 && post.adminStatus === "pending" && (
            <div className="rounded-lg border p-4 bg-muted/50">
              <p className="text-sm text-muted-foreground">
                이 게시글은 공감 50개를 달성하여 행정기관에 전달되었습니다.
              </p>
            </div>
          )}

          {/* Empathy Button */}
          <div className="flex items-center gap-4 py-4 border-y">
            <Button
              variant="ghost"
              size="lg"
              onClick={handleEmpathy}
              disabled={addEmpathyMutation.isPending || removeEmpathyMutation.isPending}
              className="flex items-center gap-2 text-lg"
            >
              <Heart
                className={`w-6 h-6 ${
                  hasEmpathized
                    ? "fill-red-500 text-red-500"
                    : "text-muted-foreground"
                }`}
              />
              <span className="font-semibold">{post.empathyCount || 0}</span>
              <span className="text-muted-foreground">공감</span>
            </Button>
            <Button
              variant="ghost"
              size="lg"
              className="flex items-center gap-2"
            >
              <MessageCircle className="w-5 h-5 text-muted-foreground" />
              <span className="font-semibold">{post.commentCount || 0}</span>
              <span className="text-muted-foreground">댓글</span>
            </Button>
            <Button
              variant="ghost"
              size="lg"
              onClick={handleShare}
              className="flex items-center gap-2 ml-auto"
            >
              <Share2 className="w-5 h-5 text-muted-foreground" />
              <span className="text-muted-foreground">공유</span>
            </Button>
          </div>

          {/* Comments Section */}
          <div className="space-y-4">
            <h3 className="font-semibold">댓글 {comments.length}</h3>
            
            {/* Comments List */}
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {comments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  아직 댓글이 없습니다.
                </p>
              ) : (
                comments.map((comment: any) => (
                  <div key={comment.id} className="flex gap-3">
                    {comment.userProfileImage && !comment.isAnonymous ? (
                      <img
                        src={comment.userProfileImage}
                        alt={comment.userNickname || "사용자"}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs">
                        {comment.isAnonymous ? "익" : (comment.userNickname?.[0] || "사")}
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">
                          {comment.isAnonymous 
                            ? "익명" 
                            : (comment.userNickname || comment.userName || "사용자")}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {comment.createdAt
                            ? formatDistanceToNow(
                                new Date(comment.createdAt),
                                { addSuffix: true }
                              )
                            : ""}
                        </span>
                        {isAuthenticated && user && comment.userId === user.id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 ml-auto"
                            onClick={() => {
                              if (confirm("댓글을 삭제하시겠습니까?")) {
                                deleteCommentMutation.mutate(comment.id);
                              }
                            }}
                            disabled={deleteCommentMutation.isPending}
                          >
                            <Trash2 className="w-3 h-3 text-muted-foreground" />
                          </Button>
                        )}
                      </div>
                      <p className="text-sm">{comment.content}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Comment Input */}
            <div className="space-y-2 pt-4 border-t">
              <Textarea
                placeholder="댓글을 입력하세요..."
                value={commentContent}
                onChange={(e) => setCommentContent(e.target.value)}
                maxLength={500}
                rows={3}
                className="resize-none"
              />
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">
                  {commentContent.length}/500
                </span>
                <Button
                  onClick={handleCommentSubmit}
                  disabled={
                    !commentContent.trim() ||
                    createCommentMutation.isPending ||
                    !isAuthenticated
                  }
                  size="sm"
                >
                  {createCommentMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      작성 중...
                    </>
                  ) : (
                    "댓글 작성"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

