import type { CookieOptions, Request } from "express";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isIpAddress(host: string) {
  // Basic IPv4 check and IPv6 presence detection.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}

function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");

  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  const secure = isSecureRequest(req);

  // iOS Safari 호환성을 위해 항상 명시적으로 설정
  return {
    httpOnly: true,
    path: "/",
    // iOS Safari는 SameSite=None일 때 반드시 Secure=true가 필요
    // 로컬 개발(http://localhost)에서는 Lax로, https 환경에서는 None + Secure로 설정.
    sameSite: secure ? "none" : "lax",
    secure: secure, // iOS Safari는 Secure 플래그가 필수
  };
}
