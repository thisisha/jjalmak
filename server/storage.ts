// Local file storage (replaces Manus storage)
import fs from "fs/promises";
import path from "path";
import { ENV } from "./env";

// Use process.cwd() instead of import.meta.dirname for production bundle compatibility
const UPLOAD_DIR = path.resolve(process.cwd(), "public", "uploads");

// In production, use Railway backend URL for image URLs
// In development, use relative path
function getUploadUrlPrefix(): string {
  // Check if we have a backend URL configured (for production)
  const backendUrl = process.env.VITE_API_BASE_URL || process.env.API_BASE_URL;
  const isProduction = process.env.NODE_ENV === "production";
  if (backendUrl && isProduction) {
    // Remove trailing slash
    const cleanUrl = backendUrl.replace(/\/$/, "");
    return `${cleanUrl}/uploads`;
  }
  // Development: use relative path
  return "/uploads";
}

const UPLOAD_URL_PREFIX = getUploadUrlPrefix();

// Ensure upload directory exists
async function ensureUploadDir() {
  try {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
  } catch (error) {
    console.error("[Storage] Failed to create upload directory:", error);
  }
}

// Initialize on module load
ensureUploadDir();

function normalizeKey(relKey: string): string {
  // Remove leading slashes and ensure safe filename
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  const ext = path.extname(relKey) || ".jpg";
  const baseName = path.basename(relKey, ext).replace(/[^a-zA-Z0-9._-]/g, "_");
  return `posts/${timestamp}_${random}_${baseName}${ext}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  await ensureUploadDir();
  
  const key = normalizeKey(relKey);
  const filePath = path.join(UPLOAD_DIR, key);
  const fileDir = path.dirname(filePath);
  
  // Ensure directory exists
  await fs.mkdir(fileDir, { recursive: true });
  
  // Write file
  const buffer = typeof data === "string" ? Buffer.from(data, "base64") : Buffer.from(data);
  await fs.writeFile(filePath, buffer);
  
  // Return public URL
  const url = `${UPLOAD_URL_PREFIX}/${key}`;
  return { key, url };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string; }> {
  const key = relKey.replace(/^\/+/, "");
  const url = `${UPLOAD_URL_PREFIX}/${key}`;
  return { key, url };
}
