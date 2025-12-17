import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { nanoid } from "nanoid";
import axios from "axios";

export function registerOAuthRoutes(app: Express) {
  // Simple login endpoint (replaces Manus OAuth)
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const { email, password, nickname } = req.body;
    
    console.log("[Auth] Login request:", { email, nickname, hasPassword: !!password });

    // 개발 편의를 위해: 이메일이나 닉네임 중 하나만 있어도 로그인/회원 생성
    if (!email && !nickname) {
      console.log("[Auth] Login failed: email and nickname both missing");
      res.status(400).json({ error: "email or nickname is required" });
      return;
    }

    try {
      // For development: "로그인" 자체를 간단 회원가입 + 로그인처럼 동작시킴
      // - 비밀번호는 검증하지 않음
      // - 주어진 email / nickname 이 없으면 자동으로 닉네임을 만들어서 사용자 생성
      let user = email ? await db.getUserByEmail(email) : undefined;
      
      console.log("[Auth] Found user by email:", user ? "yes" : "no");

      if (!user) {
        const devNickname =
          nickname ||
          (email ? email.split("@")[0] || email || "사용자" : "사용자");

        console.log("[Auth] Creating new user with nickname:", devNickname);
        
        const openId = `dev_${nanoid(16)}`;
        await db.upsertUser({
          openId,
          name: devNickname,
          email: email || null,
          nickname: devNickname,
          loginMethod: "dev",
          lastSignedIn: new Date(),
        });

        user = await db.getUserByOpenId(openId);

        if (!user) {
          console.error("[Auth] Failed to create user after upsert");
          res.status(500).json({ error: "Failed to create user" });
          return;
        }
        
        console.log("[Auth] User created successfully:", user.id);
      }

      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: user.name || user.nickname || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      console.log("[Auth] Cookie options:", {
        httpOnly: cookieOptions.httpOnly,
        secure: cookieOptions.secure,
        sameSite: cookieOptions.sameSite,
        path: cookieOptions.path,
        maxAge: ONE_YEAR_MS,
        isSecure: req.protocol === "https" || req.headers["x-forwarded-proto"] === "https",
        origin: req.headers.origin,
        userAgent: req.headers["user-agent"],
      });
      
      // iOS Safari 호환성을 위해 명시적으로 모든 옵션 설정
      const finalCookieOptions = {
        ...cookieOptions,
        maxAge: ONE_YEAR_MS,
        // iOS Safari는 domain을 명시하지 않는 것이 더 안전할 수 있음
        // domain: undefined,
      };
      
      res.cookie(COOKIE_NAME, sessionToken, finalCookieOptions);
      
      // iOS Safari를 위한 추가 헤더 설정
      // Set-Cookie 헤더를 명시적으로 설정하여 쿠키가 확실히 설정되도록 함
      const setCookieHeader = res.getHeader("Set-Cookie");
      console.log("[Auth] Set-Cookie header:", setCookieHeader);

      console.log("[Auth] Login successful for user:", user.id);
      res.json({ success: true, user });
    } catch (error) {
      console.error("[Auth] Login failed", error);
      res.status(500).json({ error: "Login failed", details: error instanceof Error ? error.message : String(error) });
    }
  });

  // Register endpoint
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    const { email, password, nickname } = req.body;
    
    console.log("[Auth] Register request:", { email, nickname, hasPassword: !!password });

    if (!nickname) {
      console.log("[Auth] Register failed: nickname missing");
      res.status(400).json({ error: "nickname is required" });
      return;
    }

    try {
      const openId = `dev_${nanoid(16)}`;
      console.log("[Auth] Creating user with openId:", openId);
      
      await db.upsertUser({
        openId,
        name: nickname,
        email: email || null,
        nickname: nickname,
        loginMethod: "dev",
        lastSignedIn: new Date(),
      });

      const user = await db.getUserByOpenId(openId);
      if (!user) {
        console.error("[Auth] Failed to create user after upsert");
        res.status(500).json({ error: "Failed to create user" });
        return;
      }
      
      console.log("[Auth] User created successfully:", user.id);

      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: user.name || user.nickname || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      console.log("[Auth] Registration successful for user:", user.id);
      res.json({ success: true, user });
    } catch (error) {
      console.error("[Auth] Registration failed", error);
      res.status(500).json({ error: "Registration failed", details: error instanceof Error ? error.message : String(error) });
    }
  });

  // Kakao OAuth callback
  app.post("/api/auth/kakao", async (req: Request, res: Response) => {
    const { accessToken } = req.body;

    if (!accessToken) {
      res.status(400).json({ error: "accessToken is required" });
      return;
    }

    try {
      // Get user info from Kakao
      const userInfoResponse = await axios.get("https://kapi.kakao.com/v2/user/me", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const kakaoUser = userInfoResponse.data;
      const openId = `kakao_${kakaoUser.id}`;
      const nickname = kakaoUser.kakao_account?.profile?.nickname || kakaoUser.kakao_account?.name || "카카오 사용자";
      const email = kakaoUser.kakao_account?.email || null;

      // Create or update user
      await db.upsertUser({
        openId,
        name: nickname,
        email,
        nickname,
        loginMethod: "kakao",
        lastSignedIn: new Date(),
      });

      const user = await db.getUserByOpenId(openId);
      if (!user) {
        res.status(500).json({ error: "Failed to create user" });
        return;
      }

      // Create session
      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: user.name || user.nickname || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.json({ success: true, user });
    } catch (error) {
      console.error("[Auth] Kakao login failed", error);
      res.status(500).json({ error: "Kakao login failed" });
    }
  });
}
