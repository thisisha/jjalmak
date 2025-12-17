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
  // iOS Safari는 SameSite=None일 때 반드시 Secure=true가 필요
  // 또한 domain을 명시하지 않는 것이 더 안전함 (서브도메인 간 쿠키 공유 방지)
  return {
    httpOnly: true,
    path: "/",
    // 로컬 개발(http://localhost)에서는 Lax로, https 환경에서는 None + Secure로 설정.
    sameSite: secure ? "none" : "lax",
    secure: secure, // iOS Safari는 Secure 플래그가 필수
    // domain을 명시하지 않음 - 현재 도메인에만 쿠키 설정 (더 안전)
    // domain: undefined,
  };
}
