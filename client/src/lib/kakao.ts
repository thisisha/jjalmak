declare global {
  interface Window {
    Kakao: any;
  }
}

export function initKakao() {
  const apiKey = import.meta.env.VITE_KAKAO_JS_KEY;
  if (!apiKey) {
    console.warn("Kakao JS Key is not set");
    return false;
  }

  if (window.Kakao) {
    if (!window.Kakao.isInitialized()) {
      window.Kakao.init(apiKey);
    }
    return true;
  }
  return false;
}

export async function loginWithKakao(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!window.Kakao) {
      reject(new Error("Kakao SDK is not loaded"));
      return;
    }

    initKakao();

    window.Kakao.Auth.login({
      success: (authObj: any) => {
        resolve(authObj.access_token);
      },
      fail: (err: any) => {
        reject(err);
      },
    });
  });
}

export async function getKakaoUserInfo(accessToken: string) {
  const response = await fetch("https://kapi.kakao.com/v2/user/me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to get user info");
  }

  return response.json();
}

