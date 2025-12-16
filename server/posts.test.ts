import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(userId: number = 1): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `test-user-${userId}`,
    email: `test${userId}@example.com`,
    name: `Test User ${userId}`,
    nickname: `TestUser${userId}`,
    loginMethod: "test",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };

  return ctx;
}

describe("Posts API", () => {
  it("should get posts by neighborhood", async () => {
    const ctx = createAuthContext(1);
    const caller = appRouter.createCaller(ctx);

    const posts = await caller.posts.getByNeighborhood({
      neighborhood: "서울시 강남구 역삼동",
      limit: 20,
      sortBy: "recent",
    });

    expect(Array.isArray(posts)).toBe(true);
  });

  it("should get user posts", async () => {
    const ctx = createAuthContext(1);
    const caller = appRouter.createCaller(ctx);

    const posts = await caller.posts.getMyPosts();

    expect(Array.isArray(posts)).toBe(true);
  });
});

describe("Empathy API", () => {
  it("should get empathy count", async () => {
    const ctx = createAuthContext(1);
    const caller = appRouter.createCaller(ctx);

    const count = await caller.empathy.getCount(1);

    expect(typeof count).toBe("number");
    expect(count).toBeGreaterThanOrEqual(0);
  });
});

describe("Comments API", () => {
  it("should get comments by post id", async () => {
    const ctx = createAuthContext(1);
    const caller = appRouter.createCaller(ctx);

    const comments = await caller.comments.getByPostId(1);

    expect(Array.isArray(comments)).toBe(true);
  });
});

describe("Notifications API", () => {
  it("should get user notifications", async () => {
    const ctx = createAuthContext(1);
    const caller = appRouter.createCaller(ctx);

    const notifications = await caller.notifications.getAll({
      limit: 20,
      offset: 0,
    });

    expect(Array.isArray(notifications)).toBe(true);
  });
});

describe("Profile API", () => {
  it("should get user profile", async () => {
    const ctx = createAuthContext(1);
    const caller = appRouter.createCaller(ctx);

    const profile = await caller.profile.getMe();

    expect(profile).toBeDefined();
    expect(profile.id).toBe(1);
  });

  it("should get user stats", async () => {
    const ctx = createAuthContext(1);
    const caller = appRouter.createCaller(ctx);

    const stats = await caller.profile.getStats();

    expect(stats).toBeDefined();
    expect(stats.totalPosts).toBeGreaterThanOrEqual(0);
    expect(stats.totalEmpathy).toBeGreaterThanOrEqual(0);
    expect(stats.totalComments).toBeGreaterThanOrEqual(0);
  });
});

describe("Admin API", () => {
  it("should reject non-admin users", async () => {
    const ctx = createAuthContext(2);
    const caller = appRouter.createCaller(ctx);

    try {
      await caller.admin.updatePostStatus({
        postId: 1,
        status: "completed",
        notes: "Should fail",
      });
      expect.fail("Should have thrown an error");
    } catch (error: any) {
      expect(error.code).toBe("FORBIDDEN");
    }
  });
});
