import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import cors from "cors";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";

// Get __dirname equivalent for ES modules
// In production (esbuild bundle), import.meta.url may not work correctly
// So we'll use process.cwd() as the base path
let __dirname: string | undefined;
try {
  const __filename = fileURLToPath(import.meta.url);
  __dirname = path.dirname(__filename);
} catch (e) {
  console.warn("[Server] Could not determine __dirname from import.meta.url, using process.cwd()");
  __dirname = undefined;
}

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
    })
  );
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // Serve uploaded files
  // In Railway, use process.cwd() only (__dirname may be undefined in bundled code)
  const uploadsPath = path.resolve(process.cwd(), "public", "uploads");
  if (fs.existsSync(uploadsPath)) {
    app.use("/uploads", express.static(uploadsPath));
    console.log(`[Uploads] Using path: ${uploadsPath}`);
  } else {
    console.warn(`[Uploads] Uploads directory not found at: ${uploadsPath}`);
    // Continue without uploads - not critical for API server
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
    app.use("*", (req, res, next) => {
      if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) {
        next();
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
