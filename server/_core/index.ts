import "dotenv/config";
// Ensure crypto is available globally for jose library
import { webcrypto } from "node:crypto";
if (typeof globalThis.crypto === "undefined") {
  (globalThis as any).crypto = webcrypto;
}
import express from "express";
import { createServer } from "http";
import net from "net";
import path from "path";
import fs from "fs";
import cors from "cors";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";

// Note: In production (esbuild bundle), we use process.cwd() instead of __dirname
// because import.meta.url may not work correctly after bundling

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // CORS (allow frontend on Vercel / localhost to call this API with cookies)
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow no origin (e.g., server-side calls) and all origins in development.
        if (!origin || process.env.NODE_ENV !== "production") {
          return callback(null, true);
        }
        // In production, you can restrict to specific front-end domains via env
        const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
          .split(",")
          .map((o) => o.trim())
          .filter(Boolean);
        if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error("Not allowed by CORS"));
      },
      credentials: true,
      // iOS Safari 호환성을 위해 명시적으로 헤더 설정
      exposedHeaders: ["Set-Cookie"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    })
  );
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // Serve uploaded files - MUST be before API-only middleware
  // In Railway, use process.cwd() only (__dirname may be undefined in bundled code)
  const uploadsPath = path.resolve(process.cwd(), "public", "uploads");
  if (fs.existsSync(uploadsPath)) {
    // Serve static files from /uploads path
    app.use("/uploads", express.static(uploadsPath, {
      // Set proper headers for images
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg') || filePath.endsWith('.png') || filePath.endsWith('.gif') || filePath.endsWith('.webp')) {
          res.setHeader('Content-Type', 'image/jpeg');
          res.setHeader('Cache-Control', 'public, max-age=31536000');
        }
      }
    }));
    console.log(`[Uploads] Serving static files from: ${uploadsPath}`);
  } else {
    console.warn(`[Uploads] Uploads directory not found at: ${uploadsPath}`);
    // Create directory if it doesn't exist
    try {
      fs.mkdirSync(uploadsPath, { recursive: true });
      app.use("/uploads", express.static(uploadsPath));
      console.log(`[Uploads] Created and serving from: ${uploadsPath}`);
    } catch (error) {
      console.error(`[Uploads] Failed to create uploads directory:`, error);
    }
  }
  
  // Auth routes (login/register)
  registerOAuthRoutes(app);
  
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  
  // development mode uses Vite, production mode is API-only
  // In Railway (production), we only serve API, not static files (Vercel serves frontend)
  if (process.env.NODE_ENV === "development") {
    const { setupVite } = await import("./vite");
    await setupVite(app, server);
  } else {
    // Railway only serves API, Vercel serves the frontend
    // API-only mode: return 404 for non-API routes
    // /uploads is already handled above, so it won't reach here
    app.use("*", (req, res, next) => {
      // /uploads should already be handled by express.static above
      if (req.path.startsWith("/api")) {
        next();
      } else if (req.path.startsWith("/uploads")) {
        // If we reach here, the file doesn't exist
        console.warn(`[Uploads] File not found: ${req.path}`);
        res.status(404).json({ error: "Image not found" });
      } else {
        res.status(404).json({ error: "Not found. This is an API-only server." });
      }
    });
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
