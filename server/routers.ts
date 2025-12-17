import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { notifyOwner } from "./_core/notification";
import { TRPCError } from "@trpc/server";
import { storagePut } from "./storage";

// Validation schemas
const createPostSchema = z.object({
  category: z.enum(["inconvenience", "suggestion", "praise", "chat", "emergency"]),
  content: z.string().max(200),
  images: z.array(z.string()).max(3).optional(),
  neighborhood: z.string(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  isAnonymous: z.boolean().default(false),
});

const createCommentSchema = z.object({
  postId: z.number(),
  content: z.string().max(500),
  isAnonymous: z.boolean().default(false),
});

const updateUserProfileSchema = z.object({
  nickname: z.string().max(50).optional().nullable(),
  bio: z.string().optional().nullable(),
  neighborhood: z.string().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  profileImage: z
    .union([
      z.string().url(),
      z.literal(""),
      z.null(),
      z.undefined(),
    ])
    .optional()
    .nullable()
    .transform((val) => (val === "" || val === null || val === undefined ? null : val)),
  neighborhoodVerified: z.boolean().optional(),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // Storage router for image uploads
  storage: router({
    uploadImage: protectedProcedure
      .input(
        z.object({
          base64: z.string(), // base64 encoded image
          mimeType: z.string(), // e.g., "image/jpeg", "image/png"
        })
      )
      .mutation(async ({ input }) => {
        try {
          console.log("[Storage] Image upload request received:", {
            mimeType: input.mimeType,
            base64Length: input.base64.length,
          });
          
          // Convert base64 to buffer
          const base64Data = input.base64.replace(/^data:image\/\w+;base64,/, "");
          const buffer = Buffer.from(base64Data, "base64");

          // Generate unique filename
          const extension = input.mimeType.split("/")[1] || "jpg";
          const filename = `posts/${Date.now()}-${Math.random().toString(36).substring(7)}.${extension}`;

          // Upload to storage
          const { url, key } = await storagePut(filename, buffer, input.mimeType);
          
          console.log("[Storage] Image upload completed:", {
            key,
            url,
            finalKey: key,
          });

          return { url, key };
        } catch (error) {
          console.error("[Storage] Image upload failed:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to upload image: ${error instanceof Error ? error.message : "Unknown error"}`,
          });
        }
      }),
  }),

  // Posts router
  posts: router({
    create: protectedProcedure
      .input(createPostSchema)
      .mutation(async ({ ctx, input }) => {
        const post = await db.createPost({
          userId: ctx.user.id,
          category: input.category,
          content: input.content,
          images: input.images ? JSON.stringify(input.images) : null,
          neighborhood: input.neighborhood,
          latitude: input.latitude?.toString(),
          longitude: input.longitude?.toString(),
          isAnonymous: input.isAnonymous,
          isVisible: true,
          empathyCount: 0,
          commentCount: 0,
          adminStatus: "pending",
        });

        return { success: true, postId: (post as any).insertId || 0 };
      }),

    getById: publicProcedure.input(z.number()).query(async ({ input }) => {
      const post = await db.getPostById(input);
      if (!post) throw new TRPCError({ code: "NOT_FOUND" });

      // Get comments
      const comments = await db.getCommentsByPostId(input);

      return {
        ...post,
        comments,
      };
    }),

    getByNeighborhood: publicProcedure
      .input(
        z.object({
          neighborhood: z.string(),
          limit: z.number().default(20),
          offset: z.number().default(0),
          sortBy: z.enum(["recent", "popular"]).default("recent"),
          category: z.string().optional(),
          // 시/구/동 기준 선택
          scope: z.enum(["city", "district", "neighborhood"]).default("neighborhood"),
        })
      )
      .query(async ({ input }) => {
        const posts = await db.getPostsByNeighborhood(
          input.neighborhood,
          input.limit,
          input.offset,
          input.sortBy,
          input.category,
          input.scope
        );

        return posts;
      }),

    getMyPosts: protectedProcedure.query(async ({ ctx }) => {
      const posts = await db.getPostsByUserId(ctx.user.id);
      return posts;
    }),

    getMyEmpathizedPosts: protectedProcedure.query(async ({ ctx }) => {
      const posts = await db.getUserEmpathizedPosts(ctx.user.id);
      return posts;
    }),

    getByBounds: publicProcedure
      .input(
        z.object({
          north: z.number(),
          south: z.number(),
          east: z.number(),
          west: z.number(),
          category: z.string().optional(),
          sortBy: z.enum(["recent", "popular"]).default("recent"),
          limit: z.number().default(50),
        })
      )
      .query(async ({ input }) => {
        const posts = await db.getPostsByBounds(
          input.north,
          input.south,
          input.east,
          input.west,
          input.category,
          input.sortBy,
          input.limit
        );
        return posts;
      }),

    search: publicProcedure
      .input(
        z.object({
          keyword: z.string().min(1),
          neighborhood: z.string().optional(),
          category: z.string().optional(),
          sortBy: z.enum(["recent", "popular"]).default("recent"),
          limit: z.number().default(20),
          offset: z.number().default(0),
        })
      )
      .query(async ({ input }) => {
        const posts = await db.searchPosts(
          input.keyword,
          input.neighborhood,
          input.category,
          input.sortBy,
          input.limit,
          input.offset
        );
        return posts;
      }),
  }),

  // Comments router
  comments: router({
    create: protectedProcedure
      .input(createCommentSchema)
      .mutation(async ({ ctx, input }) => {
        const comment = await db.createComment({
          postId: input.postId,
          userId: ctx.user.id,
          content: input.content,
          isAnonymous: input.isAnonymous,
        });

        // Update comment count
        const post = await db.getPostById(input.postId);
        if (post && post.commentCount !== null) {
          await db.updatePostCommentCount(input.postId, post.commentCount + 1);
        }

        // Create notification for post author
        const postAuthor = await db.getUserById(post?.userId!);
        if (postAuthor && postAuthor.id !== ctx.user.id) {
          await db.createNotification({
            userId: postAuthor.id,
            type: "comment_on_post",
            title: "댓글 알림",
            content: `${ctx.user.nickname || "익명"}님이 당신의 게시글에 댓글을 달았습니다.`,
            postId: input.postId,
            commentId: ((comment as any).insertId || 0) as number,
          });
        }

        return { success: true, commentId: (comment as any).insertId || 0 };
      }),

    getByPostId: publicProcedure.input(z.number()).query(async ({ input }) => {
      const comments = await db.getCommentsByPostId(input);
      return comments;
    }),

    delete: protectedProcedure.input(z.number()).mutation(async ({ ctx, input: commentId }) => {
      const comment = await db.getCommentById(commentId);
      
      if (!comment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "댓글을 찾을 수 없습니다.",
        });
      }

      // Verify ownership
      if (comment.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "댓글을 삭제할 권한이 없습니다.",
        });
      }

      await db.deleteComment(commentId);

      // Update comment count
      const post = await db.getPostById(comment.postId);
      if (post && post.commentCount !== null && post.commentCount > 0) {
        await db.updatePostCommentCount(comment.postId, post.commentCount - 1);
      }

      return { success: true };
    }),
  }),

  // Empathy (likes) router
  empathy: router({
    add: protectedProcedure.input(z.number()).mutation(async ({ ctx, input: postId }) => {
      const hasEmpathized = await db.hasUserEmpathized(ctx.user.id, postId);
      if (hasEmpathized) {
        throw new TRPCError({ code: "CONFLICT", message: "Already empathized" });
      }

      await db.addEmpathy({
        userId: ctx.user.id,
        postId: postId,
      });

      // Update empathy count
      const count = await db.getEmpathyCount(postId);
      await db.updatePostEmpathyCount(postId, count);

      // Check if threshold reached (50 empathies)
      if (count === 50) {
        const post = await db.getPostById(postId);
        if (post) {
          // Create threshold event
          const existingEvent = await db.getEmpathyThresholdEvent(postId);
          if (!existingEvent) {
            await db.createEmpathyThresholdEvent({
              postId: postId,
              thresholdReached: 50,
              notificationSent: false,
            });

            // Notify post author
            const postAuthor = await db.getUserById(post.userId);
            if (postAuthor) {
              await db.createNotification({
                userId: postAuthor.id,
                type: "empathy_threshold_reached",
                title: "공감 임계치 도달",
                content: `당신의 게시글이 50명의 공감을 받았습니다! 행정 신고로 전달될 준비가 되었습니다.`,
                postId: postId,
              });

              // Notify owner about potential admin action
              await notifyOwner({
                title: "공감 임계치 도달 - 행정 신고 검토 필요",
                content: `게시글 #${postId}: "${post.content.substring(0, 50)}..."이 50명의 공감을 받았습니다. 행정 신고 처리를 검토해주세요.`,
              });
            }
          }
        }
      }

      // Notify post author about empathy
      const post = await db.getPostById(postId);
      if (post && post.userId !== ctx.user.id) {
        // Only notify for every 10th empathy or first few
        if (count % 10 === 0 || count <= 3) {
          await db.createNotification({
            userId: post.userId,
            type: "empathy_on_post",
            title: "공감 알림",
            content: `당신의 게시글이 ${count}명의 공감을 받았습니다.`,
            postId: postId,
          });
        }
      }

      return { success: true, empathyCount: count };
    }),

    remove: protectedProcedure.input(z.number()).mutation(async ({ ctx, input: postId }) => {
      await db.removeEmpathy(ctx.user.id, postId);

      // Update empathy count
      const count = await db.getEmpathyCount(postId);
      await db.updatePostEmpathyCount(postId, count);

      return { success: true, empathyCount: count };
    }),

    hasEmpathized: protectedProcedure.input(z.number()).query(async ({ ctx, input: postId }) => {
      const hasEmpathized = await db.hasUserEmpathized(ctx.user.id, postId);
      return hasEmpathized;
    }),

    getCount: publicProcedure.input(z.number()).query(async ({ input: postId }) => {
      const count = await db.getEmpathyCount(postId);
      return count;
    }),
  }),

  // Notifications router
  notifications: router({
    getAll: protectedProcedure
      .input(
        z.object({
          limit: z.number().default(20),
          offset: z.number().default(0),
        })
      )
      .query(async ({ ctx, input }) => {
        const notifications = await db.getNotificationsByUserId(
          ctx.user.id,
          input.limit,
          input.offset
        );
        return notifications;
      }),

    markAsRead: protectedProcedure.input(z.number()).mutation(async ({ input }) => {
      await db.markNotificationAsRead(input);
      return { success: true };
    }),

    markAllAsRead: protectedProcedure.mutation(async ({ ctx }) => {
      await db.markAllNotificationsAsRead(ctx.user.id);
      return { success: true };
    }),
  }),

  // User profile router
  profile: router({
    getMe: protectedProcedure.query(async ({ ctx }) => {
      const user = await db.getUserById(ctx.user.id);
      return user;
    }),

    update: protectedProcedure
      .input(updateUserProfileSchema)
      .mutation(async ({ ctx, input }) => {
        await db.updateUser(ctx.user.id, {
          nickname: input.nickname ?? undefined,
          bio: input.bio ?? undefined,
          neighborhood: input.neighborhood ?? undefined,
          latitude: input.latitude?.toString() ?? undefined,
          longitude: input.longitude?.toString() ?? undefined,
          profileImage: input.profileImage ?? undefined,
          neighborhoodVerified: input.neighborhoodVerified ?? undefined,
        });
        return { success: true };
      }),

    getStats: protectedProcedure.query(async ({ ctx }) => {
      const stats = await db.getUserStats(ctx.user.id);
      return stats;
    }),
  }),

  // Admin router
  admin: router({
    updatePostStatus: protectedProcedure
      .input(
        z.object({
          postId: z.number(),
          status: z.enum(["pending", "in_progress", "completed", "rejected"]),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Check if user is admin
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        await db.updatePostAdminStatus(input.postId, input.status, input.notes);

        // Create admin log
        await db.createAdminLog({
          adminId: ctx.user.id,
          action: "update_status",
          targetType: "post",
          targetId: input.postId,
          details: JSON.stringify({ status: input.status, notes: input.notes }),
        });

        // Notify post author about status change
        const post = await db.getPostById(input.postId);
        if (post) {
          const statusLabels: Record<string, string> = {
            pending: "검토 대기 중",
            in_progress: "행정 처리 중",
            completed: "처리 완료",
            rejected: "반려됨",
          };

          await db.createNotification({
            userId: post.userId,
            type: "post_status_changed",
            title: "게시글 상태 변경",
            content: `당신의 게시글이 "${statusLabels[input.status]}" 상태로 변경되었습니다.`,
            postId: input.postId,
          });
        }

        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
