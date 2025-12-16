CREATE TYPE "public"."adminStatus" AS ENUM('pending', 'in_progress', 'completed', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."category" AS ENUM('inconvenience', 'suggestion', 'praise', 'chat', 'emergency');--> statement-breakpoint
CREATE TYPE "public"."type" AS ENUM('comment_on_post', 'empathy_on_post', 'post_status_changed', 'empathy_threshold_reached', 'admin_notice');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TABLE "adminLogs" (
	"id" serial PRIMARY KEY NOT NULL,
	"adminId" integer NOT NULL,
	"action" varchar(50) NOT NULL,
	"targetType" varchar(50) NOT NULL,
	"targetId" integer NOT NULL,
	"details" json,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"postId" integer NOT NULL,
	"userId" integer NOT NULL,
	"content" text NOT NULL,
	"isAnonymous" boolean DEFAULT false,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "empathies" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"postId" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "empathyThresholdEvents" (
	"id" serial PRIMARY KEY NOT NULL,
	"postId" integer NOT NULL,
	"thresholdReached" integer NOT NULL,
	"notificationSent" boolean DEFAULT false,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "empathyThresholdEvents_postId_unique" UNIQUE("postId")
);
--> statement-breakpoint
CREATE TABLE "neighborhoods" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"city" varchar(50) NOT NULL,
	"district" varchar(50) NOT NULL,
	"latitude" numeric(10, 8) NOT NULL,
	"longitude" numeric(11, 8) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "neighborhoods_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"type" "type" NOT NULL,
	"title" varchar(100) NOT NULL,
	"content" text,
	"postId" integer,
	"commentId" integer,
	"isRead" boolean DEFAULT false,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"category" "category" DEFAULT 'inconvenience' NOT NULL,
	"title" varchar(100),
	"content" text NOT NULL,
	"images" json,
	"neighborhood" varchar(100) NOT NULL,
	"latitude" numeric(10, 8),
	"longitude" numeric(11, 8),
	"empathyCount" integer DEFAULT 0,
	"commentCount" integer DEFAULT 0,
	"adminStatus" "adminStatus" DEFAULT 'pending',
	"adminNotes" text,
	"isAnonymous" boolean DEFAULT false,
	"isVisible" boolean DEFAULT true,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"role" "role" DEFAULT 'user' NOT NULL,
	"nickname" varchar(50),
	"profileImage" text,
	"bio" text,
	"isAnonymous" boolean DEFAULT false,
	"neighborhood" varchar(100),
	"latitude" numeric(10, 8),
	"longitude" numeric(11, 8),
	"neighborhoodVerified" boolean DEFAULT false,
	"totalEmpathy" integer DEFAULT 0,
	"totalPosts" integer DEFAULT 0,
	"totalComments" integer DEFAULT 0,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
