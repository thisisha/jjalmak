import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  // Try multiple possible paths for uploads directory
  const uploadsPaths = [
    path.resolve(process.cwd(), "public", "uploads"),
    __dirname ? path.resolve(__dirname, "../public/uploads") : null,
  ].filter((p): p is string => p !== null);
  
  let uploadsPath: string | null = null;
  for (const testPath of uploadsPaths) {
    if (fs.existsSync(testPath)) {
      uploadsPath = testPath;
      console.log(`[Uploads] Using path: ${uploadsPath}`);
      break;
    }
  }
  
  if (uploadsPath) {
    app.use("/uploads", express.static(uploadsPath));
  } else {
    console.warn(`[Uploads] Uploads directory not found. Tried: ${uploadsPaths.join(", ")}`);
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
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
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
