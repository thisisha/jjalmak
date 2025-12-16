import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    try {
      const url = req.originalUrl;
      
      // Validate URL to prevent URI malformed errors
      if (!url || typeof url !== "string") {
        res.status(400).send("Invalid URL");
        return;
      }

      // Try to decode URL to check if it's valid
      try {
        decodeURIComponent(url);
      } catch (e) {
        // Invalid URI, return 400
        res.status(400).send("Invalid URI");
        return;
      }

      const clientTemplate = path.resolve(
        __dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  // In production (Railway), the built files are in /app/dist
  // The static files are in /app/dist/public
  // Try multiple possible paths
  const possiblePaths = [
    // Railway production: /app/dist/public
    path.resolve(process.cwd(), "dist", "public"),
    // Development: relative to __dirname
    __dirname ? path.resolve(__dirname, "../..", "dist", "public") : null,
    // Alternative: relative to __dirname in production
    __dirname ? path.resolve(__dirname, "public") : null,
  ].filter((p): p is string => p !== null);

  let distPath: string | null = null;
  for (const testPath of possiblePaths) {
    if (fs.existsSync(testPath)) {
      distPath = testPath;
      console.log(`[Static] Using path: ${distPath}`);
      break;
    }
  }

  if (!distPath) {
    console.error(
      `[Static] Could not find the build directory. Tried: ${possiblePaths.join(", ")}`
    );
    // Return 404 for all routes if static files not found
    app.use("*", (_req, res) => {
      res.status(404).send("Static files not found. Please build the client first.");
    });
    return;
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath!, "index.html"));
  });
}
