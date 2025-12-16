import { eq, and, desc, asc, gte, lte, sql, inArray, like, or, count } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  InsertUser,
  users,
  posts,
  InsertPost,
  comments,
  InsertComment,
  empathies,
  InsertEmpathy,
  notifications,
  InsertNotification,
  neighborhoods,
  adminLogs,
  InsertAdminLog,
  empathyThresholdEvents,
  InsertEmpathyThresholdEvent,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: Pool | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      if (!_pool) {
        _pool = new Pool({
          connectionString: process.env.DATABASE_URL,
          ssl: { rejectUnauthorized: false },
        });
      }
      _db = drizzle(_pool, { schema: { users, posts, comments, empathies, notifications, neighborhoods, adminLogs, empathyThresholdEvents } });
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod", "nickname", "profileImage", "bio", "neighborhood"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    // Postgres용 upsert: openId 기준으로 충돌 시 update
    await db
      .insert(users)
      .values(values)
      .onConflictDoUpdate({
        target: users.openId,
        set: updateSet,
      });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(userId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateUser(
  userId: number,
  updates: {
    nickname?: string | null;
    profileImage?: string | null;
    bio?: string | null;
    neighborhood?: string | null;
    latitude?: string | null;
    longitude?: string | null;
    neighborhoodVerified?: boolean;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const updateSet: Record<string, unknown> = {};

  if (updates.nickname !== undefined) {
    updateSet.nickname = updates.nickname;
  }
  if (updates.profileImage !== undefined) {
    updateSet.profileImage = updates.profileImage;
  }
  if (updates.bio !== undefined) {
    updateSet.bio = updates.bio;
  }
  if (updates.neighborhood !== undefined) {
    updateSet.neighborhood = updates.neighborhood;
  }
  if (updates.latitude !== undefined) {
    updateSet.latitude = updates.latitude;
  }
  if (updates.longitude !== undefined) {
    updateSet.longitude = updates.longitude;
  }
  if (updates.neighborhoodVerified !== undefined) {
    updateSet.neighborhoodVerified = updates.neighborhoodVerified;
  }

  if (Object.keys(updateSet).length === 0) {
    return;
  }

  await db.update(users).set(updateSet).where(eq(users.id, userId));
}

// Posts queries
export async function createPost(post: InsertPost) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(posts).values(post);
  return { insertId: (result as any).insertId || 0 };
}

export async function getPostById(postId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getPostsByNeighborhood(
  neighborhood: string,
  limit: number = 20,
  offset: number = 0,
  sortBy: "recent" | "popular" = "recent",
  category?: string,
  scope: "city" | "district" | "neighborhood" = "neighborhood"
) {
  const db = await getDb();
  if (!db) return [];

  // 시/구/동 기준에 따라 매칭 prefix 결정
  const parts = neighborhood.split(" ").filter(Boolean);
  let prefix = neighborhood;
  if (scope === "city" && parts.length >= 1) {
    prefix = parts[0];
  } else if (scope === "district" && parts.length >= 2) {
    prefix = `${parts[0]} ${parts[1]}`;
  } else if (scope === "neighborhood" && parts.length >= 3) {
    prefix = `${parts[0]} ${parts[1]} ${parts[2]}`;
  }

  const whereConditions = [
    like(posts.neighborhood, `${prefix}%`),
    eq(posts.isVisible, true),
  ];
  if (category) {
    whereConditions.push(eq(posts.category, category as any));
  }

  let baseQuery = db
    .select()
    .from(posts)
    .where(and(...whereConditions));

  const result = await (
    sortBy === "popular"
      ? baseQuery.orderBy(desc(posts.empathyCount)).limit(limit).offset(offset)
      : baseQuery.orderBy(desc(posts.createdAt)).limit(limit).offset(offset)
  );
  return result;
}

export async function getPostsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];

  const result = await db
    .select()
    .from(posts)
    .where(eq(posts.userId, userId))
    .orderBy(desc(posts.createdAt));

  return result;
}

export async function getPostsByBounds(
  north: number,
  south: number,
  east: number,
  west: number,
  category?: string,
  sortBy: "recent" | "popular" = "recent",
  limit: number = 50
) {
  const db = await getDb();
  if (!db) return [];

  const whereConditions = [
    eq(posts.isVisible, true),
    sql`${posts.latitude} IS NOT NULL`,
    sql`${posts.longitude} IS NOT NULL`,
    sql`CAST(${posts.latitude} AS DECIMAL(10,8)) >= ${south}`,
    sql`CAST(${posts.latitude} AS DECIMAL(10,8)) <= ${north}`,
    sql`CAST(${posts.longitude} AS DECIMAL(11,8)) >= ${west}`,
    sql`CAST(${posts.longitude} AS DECIMAL(11,8)) <= ${east}`,
  ];

  if (category) {
    whereConditions.push(eq(posts.category, category as any));
  }

  let baseQuery = db
    .select()
    .from(posts)
    .where(and(...whereConditions));

  const result = await (
    sortBy === "popular"
      ? baseQuery.orderBy(desc(posts.empathyCount)).limit(limit)
      : baseQuery.orderBy(desc(posts.createdAt)).limit(limit)
  );

  return result;
}

export async function getUserStats(userId: number) {
  const db = await getDb();
  if (!db) {
    return {
      totalPosts: 0,
      totalEmpathy: 0,
      totalComments: 0,
    };
  }

  // Total posts written by the user
  const postsCountResult = await db
    .select({ count: count() })
    .from(posts)
    .where(eq(posts.userId, userId));
  const totalPosts = Number(postsCountResult[0]?.count ?? 0);

  // Total empathy received on the user's posts
  const empathyResult = await db
    .select({ count: count() })
    .from(empathies)
    .innerJoin(posts, eq(empathies.postId, posts.id))
    .where(eq(posts.userId, userId));
  const totalEmpathy = Number(empathyResult[0]?.count ?? 0);

  // Total comments received on the user's posts
  const commentsResult = await db
    .select({ count: count() })
    .from(comments)
    .innerJoin(posts, eq(comments.postId, posts.id))
    .where(eq(posts.userId, userId));
  const totalComments = Number(commentsResult[0]?.count ?? 0);

  return {
    totalPosts,
    totalEmpathy,
    totalComments,
  };
}

export async function searchPosts(
  keyword: string,
  neighborhood?: string,
  category?: string,
  sortBy: "recent" | "popular" = "recent",
  limit: number = 20,
  offset: number = 0
) {
  const db = await getDb();
  if (!db) return [];

  const searchPattern = `%${keyword}%`;
  const whereConditions = [
    eq(posts.isVisible, true),
    or(
      like(posts.content, searchPattern),
      like(posts.neighborhood, searchPattern)
    ) as any,
  ];

  if (neighborhood) {
    whereConditions.push(eq(posts.neighborhood, neighborhood));
  }

  if (category) {
    whereConditions.push(eq(posts.category, category as any));
  }

  let baseQuery = db
    .select()
    .from(posts)
    .where(and(...whereConditions));

  const result = await (
    sortBy === "popular"
      ? baseQuery.orderBy(desc(posts.empathyCount)).limit(limit).offset(offset)
      : baseQuery.orderBy(desc(posts.createdAt)).limit(limit).offset(offset)
  );

  return result;
}

export async function updatePostEmpathyCount(postId: number, count: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(posts).set({ empathyCount: count }).where(eq(posts.id, postId));
}

export async function updatePostCommentCount(postId: number, count: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(posts).set({ commentCount: count }).where(eq(posts.id, postId));
}

export async function updatePostAdminStatus(postId: number, status: string, notes?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const updateData: any = { adminStatus: status };
  if (notes) updateData.adminNotes = notes;

  await db.update(posts).set(updateData).where(eq(posts.id, postId));
}

// Comments queries
export async function createComment(comment: InsertComment) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(comments).values(comment);
  return { insertId: (result as any).insertId || 0 };
}

export async function getCommentsByPostId(postId: number) {
  const db = await getDb();
  if (!db) return [];

  const result = await db
    .select({
      id: comments.id,
      postId: comments.postId,
      userId: comments.userId,
      content: comments.content,
      isAnonymous: comments.isAnonymous,
      createdAt: comments.createdAt,
      updatedAt: comments.updatedAt,
      // Join user info
      userNickname: users.nickname,
      userName: users.name,
      userProfileImage: users.profileImage,
    })
    .from(comments)
    .leftJoin(users, eq(comments.userId, users.id))
    .where(eq(comments.postId, postId))
    .orderBy(desc(comments.createdAt));

  return result;
}

export async function getCommentById(commentId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(comments)
    .where(eq(comments.id, commentId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function deleteComment(commentId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(comments).where(eq(comments.id, commentId));
}

// Empathy queries
export async function addEmpathy(empathy: InsertEmpathy) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(empathies).values(empathy);
  return result;
}

export async function removeEmpathy(userId: number, postId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .delete(empathies)
    .where(and(eq(empathies.userId, userId), eq(empathies.postId, postId)));
}

export async function getEmpathyCount(postId: number) {
  const db = await getDb();
  if (!db) return 0;

  const result = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(empathies)
    .where(eq(empathies.postId, postId));

  return result[0]?.count || 0;
}

export async function hasUserEmpathized(userId: number, postId: number) {
  const db = await getDb();
  if (!db) return false;

  const result = await db
    .select()
    .from(empathies)
    .where(and(eq(empathies.userId, userId), eq(empathies.postId, postId)))
    .limit(1);

  return result.length > 0;
}

export async function getUserEmpathizedPosts(userId: number) {
  const db = await getDb();
  if (!db) return [];

  const result = await db
    .select({ postId: empathies.postId })
    .from(empathies)
    .where(eq(empathies.userId, userId));

  const postIds = result.map((r) => r.postId);
  if (postIds.length === 0) return [];

  return db.select().from(posts).where(inArray(posts.id, postIds));
}

// Notifications queries
export async function createNotification(notification: InsertNotification) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(notifications).values(notification);
  return result;
}

export async function getNotificationsByUserId(userId: number, limit: number = 20, offset: number = 0) {
  const db = await getDb();
  if (!db) return [];

  const result = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
    .offset(offset);

  return result;
}

export async function markNotificationAsRead(notificationId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, notificationId));
}

export async function markAllNotificationsAsRead(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, userId));
}

// Admin logs queries
export async function createAdminLog(log: InsertAdminLog) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(adminLogs).values(log);
  return result;
}

// Empathy threshold events
export async function createEmpathyThresholdEvent(event: InsertEmpathyThresholdEvent) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(empathyThresholdEvents).values(event);
  return result;
}

export async function getEmpathyThresholdEvent(postId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(empathyThresholdEvents)
    .where(eq(empathyThresholdEvents.postId, postId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function updateEmpathyThresholdEventNotification(eventId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(empathyThresholdEvents)
    .set({ notificationSent: true })
    .where(eq(empathyThresholdEvents.id, eventId));
}

// Neighborhoods queries
export async function getNeighborhoodByName(name: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(neighborhoods)
    .where(eq(neighborhoods.name, name))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getAllNeighborhoods() {
  const db = await getDb();
  if (!db) return [];

  const result = await db.select().from(neighborhoods);
  return result;
}
