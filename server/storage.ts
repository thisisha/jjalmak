// Supabase Storage for image uploads
import { createClient } from "@supabase/supabase-js";
import { ENV } from "./env";

// Initialize Supabase client
let supabaseClient: ReturnType<typeof createClient> | null = null;

function getSupabaseClient() {
  if (!supabaseClient && ENV.supabaseUrl && ENV.supabaseServiceKey) {
    supabaseClient = createClient(ENV.supabaseUrl, ENV.supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    console.log("[Storage] Supabase client initialized");
  }
  return supabaseClient;
}

// Fallback to local storage if Supabase is not configured
import fs from "fs/promises";
import path from "path";

const UPLOAD_DIR = path.resolve(process.cwd(), "public", "uploads");
const BUCKET_NAME = "posts"; // Supabase Storage bucket name

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
  contentType = "image/jpeg"
): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  const supabase = getSupabaseClient();
  
  // Convert data to buffer
  const buffer = typeof data === "string" 
    ? Buffer.from(data.replace(/^data:image\/\w+;base64,/, ""), "base64")
    : Buffer.from(data);
  
  // Try Supabase Storage first
  if (supabase) {
    try {
      console.log("[Storage] Uploading to Supabase Storage:", {
        bucket: BUCKET_NAME,
        key,
        size: buffer.length,
        contentType,
      });
      
      const { data: uploadData, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(key, buffer, {
          contentType,
          upsert: true, // Overwrite if exists
        });
      
      if (error) {
        console.error("[Storage] Supabase upload error:", error);
        throw error;
      }
      
      // Get public URL
      const { data: urlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(key);
      
      const publicUrl = urlData.publicUrl;
      console.log("[Storage] Image uploaded to Supabase:", {
        key,
        url: publicUrl,
        size: buffer.length,
      });
      
      return { key, url: publicUrl };
    } catch (error) {
      console.error("[Storage] Supabase upload failed, falling back to local storage:", error);
      // Fall through to local storage
    }
  }
  
  // Fallback to local storage
  console.log("[Storage] Using local storage (Supabase not configured)");
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  
  const filePath = path.join(UPLOAD_DIR, key);
  const fileDir = path.dirname(filePath);
  await fs.mkdir(fileDir, { recursive: true });
  await fs.writeFile(filePath, buffer);
  
  // Use Railway backend URL for local storage in production
  const backendUrl = process.env.API_BASE_URL || process.env.RAILWAY_PUBLIC_DOMAIN;
  const isProduction = process.env.NODE_ENV === "production";
  let url: string;
  
  if (backendUrl && isProduction) {
    let cleanUrl = backendUrl.replace(/\/$/, "");
    if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
      cleanUrl = `https://${cleanUrl}`;
    }
    url = `${cleanUrl}/uploads/${key}`;
  } else {
    url = `/uploads/${key}`;
  }
  
  console.log("[Storage] Image uploaded to local storage:", {
    key,
    filePath,
    url,
    size: buffer.length,
  });
  
  return { key, url };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string; }> {
  const key = relKey.replace(/^\/+/, "");
  const supabase = getSupabaseClient();
  
  if (supabase) {
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(key);
    return { key, url: urlData.publicUrl };
  }
  
  // Fallback to local storage
  const backendUrl = process.env.API_BASE_URL || process.env.RAILWAY_PUBLIC_DOMAIN;
  const isProduction = process.env.NODE_ENV === "production";
  let url: string;
  
  if (backendUrl && isProduction) {
    let cleanUrl = backendUrl.replace(/\/$/, "");
    if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
      cleanUrl = `https://${cleanUrl}`;
    }
    url = `${cleanUrl}/uploads/${key}`;
  } else {
    url = `/uploads/${key}`;
  }
  
  return { key, url };
}
