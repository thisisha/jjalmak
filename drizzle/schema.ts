import {
  pgTable,
  integer,
  text,
  timestamp,
  varchar,
  boolean,
  numeric,
  json,
  bigserial,
  pgEnum,
  serial,
} from "drizzle-orm/pg-core";

// Enums
export const roleEnum = pgEnum("role", ["user", "admin"]);
export const categoryEnum = pgEnum("category", [
  "inconvenience",
  "suggestion",
  "praise",
  "chat",
  "emergency",
]);
export const adminStatusEnum = pgEnum("adminStatus", [
  "pending",
  "in_progress",
  "completed",
  "rejected",
]);
export const notificationTypeEnum = pgEnum("type", [
  "comment_on_post",
  "empathy_on_post",
  "post_status_changed",
  "empathy_threshold_reached",
  "admin_notice",
]);

/**
 * Core user table backing auth flow.
 * Extended with neighborhood and profile information.
 */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  
  // Profile information
  nickname: varchar("nickname", { length: 50 }),
  profileImage: text("profileImage"), // S3 URL
  bio: text("bio"),
  isAnonymous: boolean("isAnonymous").default(false),
  
  // Neighborhood information
  neighborhood: varchar("neighborhood", { length: 100 }), // e.g., "서울시 강남구 역삼동"
  latitude: numeric("latitude", { precision: 10, scale: 8 }),
  longitude: numeric("longitude", { precision: 11, scale: 8 }),
  neighborhoodVerified: boolean("neighborhoodVerified").default(false),
  
  // Statistics
  totalEmpathy: integer("totalEmpathy").default(0), // Total empathy received
  totalPosts: integer("totalPosts").default(0),
  totalComments: integer("totalComments").default(0),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Neighborhoods table for location-based filtering
 */
export const neighborhoods = pgTable("neighborhoods", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  city: varchar("city", { length: 50 }).notNull(),
  district: varchar("district", { length: 50 }).notNull(),
  latitude: numeric("latitude", { precision: 10, scale: 8 }).notNull(),
  longitude: numeric("longitude", { precision: 11, scale: 8 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Neighborhood = typeof neighborhoods.$inferSelect;

/**
 * Posts table for community content
 */
export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  
  // Content
  category: categoryEnum("category").default("inconvenience").notNull(),
  title: varchar("title", { length: 100 }),
  content: text("content").notNull(), // Max 200 characters
  
  // Media
  images: json("images"), // Array of URLs, max 3
  
  // Location
  neighborhood: varchar("neighborhood", { length: 100 }).notNull(),
  latitude: numeric("latitude", { precision: 10, scale: 8 }),
  longitude: numeric("longitude", { precision: 11, scale: 8 }),
  
  // Engagement
  empathyCount: integer("empathyCount").default(0),
  commentCount: integer("commentCount").default(0),
  
  // Admin status
  adminStatus: adminStatusEnum("adminStatus").default("pending"),
  adminNotes: text("adminNotes"),
  
  // Visibility
  isAnonymous: boolean("isAnonymous").default(false),
  isVisible: boolean("isVisible").default(true),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Post = typeof posts.$inferSelect;
export type InsertPost = typeof posts.$inferInsert;

/**
 * Comments table for post discussions
 */
export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  postId: integer("postId").notNull(),
  userId: integer("userId").notNull(),
  
  content: text("content").notNull(),
  isAnonymous: boolean("isAnonymous").default(false),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Comment = typeof comments.$inferSelect;
export type InsertComment = typeof comments.$inferInsert;

/**
 * Empathy (likes) table for tracking user engagement
 */
export const empathies = pgTable("empathies", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  postId: integer("postId").notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Empathy = typeof empathies.$inferSelect;
export type InsertEmpathy = typeof empathies.$inferInsert;

/**
 * Notifications table for user alerts
 */
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  
  type: notificationTypeEnum("type").notNull(),
  
  title: varchar("title", { length: 100 }).notNull(),
  content: text("content"),
  
  // Reference to related post or comment
  postId: integer("postId"),
  commentId: integer("commentId"),
  
  isRead: boolean("isRead").default(false),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

/**
 * Admin logs table for tracking administrative actions
 */
export const adminLogs = pgTable("adminLogs", {
  id: serial("id").primaryKey(),
  adminId: integer("adminId").notNull(),
  
  action: varchar("action", { length: 50 }).notNull(), // e.g., "update_status", "add_note"
  targetType: varchar("targetType", { length: 50 }).notNull(), // e.g., "post"
  targetId: integer("targetId").notNull(),
  
  details: json("details"), // Additional information about the action
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AdminLog = typeof adminLogs.$inferSelect;
export type InsertAdminLog = typeof adminLogs.$inferInsert;

/**
 * Empathy threshold events table for tracking when posts reach thresholds
 */
export const empathyThresholdEvents = pgTable("empathyThresholdEvents", {
  id: serial("id").primaryKey(),
  postId: integer("postId").notNull().unique(),
  
  thresholdReached: integer("thresholdReached").notNull(), // e.g., 50
  notificationSent: boolean("notificationSent").default(false),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EmpathyThresholdEvent = typeof empathyThresholdEvents.$inferSelect;
export type InsertEmpathyThresholdEvent = typeof empathyThresholdEvents.$inferInsert;
