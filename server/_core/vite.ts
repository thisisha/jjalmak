import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";

// Note: In production (esbuild bundle), we use process.cwd() instead of __dirname
// because import.meta.url may not work correctly after bundling

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  // Don't import vite.config.ts to avoid import.meta.dirname issues in production bundle
  // Instead, create config inline using process.cwd()
  const rootDir = process.cwd();
  const vite = await createViteServer({
    plugins: [react(), tailwindcss(), jsxLocPlugin()],
    resolve: {
      alias: {
        "@": path.resolve(rootDir, "client", "src"),
        "@shared": path.resolve(rootDir, "shared"),
        "@assets": path.resolve(rootDir, "attached_assets"),
      },
    },
    envDir: rootDir,
    root: path.resolve(rootDir, "client"),
    publicDir: path.resolve(rootDir, "client", "public"),
    server: serverOptions,
    appType: "custom",
    configFile: false,
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

      const clientTemplate = path.resolve(process.cwd(), "client", "index.html");

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
  // Use process.cwd() only (__dirname may be undefined in bundled code)
  const distPath = path.resolve(process.cwd(), "dist", "public");

  if (!fs.existsSync(distPath)) {
    console.error(`[Static] Could not find the build directory: ${distPath}`);
    // Return 404 for all routes if static files not found
    app.use("*", (_req, res) => {
      res.status(404).send("Static files not found. Please build the client first.");
    });
    return;
  }
  
  console.log(`[Static] Using path: ${distPath}`);

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath!, "index.html"));
  });
}
