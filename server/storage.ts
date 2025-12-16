// Local file storage (replaces Manus storage)
import fs from "fs/promises";
import path from "path";

const UPLOAD_DIR = path.resolve(import.meta.dirname, "../public/uploads");
const UPLOAD_URL_PREFIX = "/uploads";

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
