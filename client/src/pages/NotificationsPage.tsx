import { useState, useCallback } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  MessageCircle,
  Heart,
  CheckCircle2,
  AlertCircle,
  Bell,
  Loader2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { PostDetailModal } from "@/components/PostDetailModal";
import { formatDistanceToNow } from "date-fns";
import { getLoginUrl } from "@/const";

const notificationIcons: Record<
  string,
  { icon: React.ReactNode; color: string }
> = {
  comment_on_post: {
    icon: <MessageCircle className="w-5 h-5" />,
    color: "text-blue-600 dark:text-blue-400",
  },
  empathy_on_post: {
    icon: <Heart className="w-5 h-5" />,
    color: "text-red-600 dark:text-red-400",
  },
  post_status_changed: {
    icon: <CheckCircle2 className="w-5 h-5" />,
    color: "text-green-600 dark:text-green-400",
  },
  empathy_threshold_reached: {
    icon: <AlertCircle className="w-5 h-5" />,
    color: "text-orange-600 dark:text-orange-400",
  },
  admin_notice: {
    icon: <Bell className="w-5 h-5" />,
    color: "text-purple-600 dark:text-purple-400",
  },
};

export default function NotificationsPage() {
  const { isAuthenticated } = useAuth();
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const { data: notifications = [], isLoading, refetch } = trpc.notifications.getAll.useQuery(
    {
      limit: 50,
      offset: 0,
    },
    {
      enabled: isAuthenticated,
    }
  );

  const markAsReadMutation = trpc.notifications.markAsRead.useMutation({
    onSuccess: () => {
      refetch();
      utils.notifications.getAll.invalidate();
    },
  });

  const markAllAsReadMutation = trpc.notifications.markAllAsRead.useMutation({
    onSuccess: () => {
      toast.success("모든 알림이 읽음 처리되었습니다.");
      refetch();
      utils.notifications.getAll.invalidate();
    },
  });

  const handleNotificationClick = useCallback(
    async (notification: any) => {
      // Mark as read
      if (!notification.isRead) {
        await markAsReadMutation.mutateAsync(notification.id);
      }

      // Open post detail if postId exists
      if (notification.postId) {
        setSelectedPostId(notification.postId);
      }
    },
    [markAsReadMutation]
  );

  const handleMarkAllAsRead = useCallback(async () => {
    await markAllAsReadMutation.mutateAsync();
  }, [markAllAsReadMutation]);

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

  const unreadCount = notifications.filter((n: any) => !n.isRead).length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-30 border-b border-border bg-card shadow-sm">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <img 
                  src="/image/jjalmak_logo.png" 
                  alt="짤막" 
                  className="h-11 w-auto"
                />
                <h1 className="text-xl font-bold text-muted-foreground">알림</h1>
              </div>
              {unreadCount > 0 && (
                <p className="text-sm text-muted-foreground mt-1">
                  읽지 않은 알림 {unreadCount}개
                </p>
              )}
            </div>
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleMarkAllAsRead}
                disabled={markAllAsReadMutation.isPending}
              >
                {markAllAsReadMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    처리 중...
                  </>
                ) : (
                  "모두 읽음"
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="container py-4">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Card key={i} className="p-4 skeleton h-20" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <Card className="p-8 text-center">
            <Bell className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">알림이 없습니다.</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {notifications.map((notification: any) => {
              const iconConfig =
                notificationIcons[notification.type] ||
                notificationIcons.admin_notice;
              const createdAt = notification.createdAt
                ? new Date(notification.createdAt)
                : new Date();
              const isUnread = !notification.isRead;

              return (
                <Card
                  key={notification.id}
                  className={`p-4 cursor-pointer hover:shadow-md transition-all ${
                    isUnread
                      ? "bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800"
                      : ""
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex gap-3">
                    <div
                      className={`flex-shrink-0 mt-1 ${iconConfig.color}`}
                    >
                      {iconConfig.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3
                          className={`font-medium ${
                            isUnread ? "font-semibold" : ""
                          }`}
                        >
                          {notification.title}
                        </h3>
                        {isUnread && (
                          <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0 mt-2" />
                        )}
                      </div>
                      {notification.content && (
                        <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                          {notification.content}
                        </p>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(createdAt, { addSuffix: true })}
                        </span>
                        {notification.postId && (
                          <span className="text-xs text-primary">
                            게시글 보기 →
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
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

