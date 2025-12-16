// 카카오 주소 검색 API 유틸리티

declare global {
  interface Window {
    kakao: any;
  }
}

export interface AddressResult {
  address_name: string;
  y: string; // latitude
  x: string; // longitude
  place_name?: string;
}

export function initKakaoAddress() {
  // REST API 키 (없으면 MAP 키를 fallback으로 사용)
  const apiKey = import.meta.env.VITE_KAKAO_REST_API_KEY || import.meta.env.VITE_KAKAO_MAP_API_KEY;
  if (!apiKey) {
    console.warn("Kakao REST API Key is not set (VITE_KAKAO_REST_API_KEY)");
    return false;
  }

  // 카카오 REST API는 별도 SDK 로드는 필요 없으므로 true만 반환
  return true;
}

export async function searchAddress(query: string): Promise<AddressResult[]> {
  const apiKey = import.meta.env.VITE_KAKAO_REST_API_KEY || import.meta.env.VITE_KAKAO_MAP_API_KEY;
  if (!apiKey) {
    throw new Error("카카오 REST API 키가 설정되지 않았습니다. VITE_KAKAO_REST_API_KEY를 설정해주세요.");
  }

  try {
    const response = await fetch(
      `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(query)}`,
      {
        headers: {
          Authorization: `KakaoAK ${apiKey}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error("주소 검색에 실패했습니다.");
    }

    const data = await response.json();
    return data.documents || [];
  } catch (error) {
    console.error("Address search error:", error);
    throw error;
  }
}

// 캐시를 위한 간단한 메모리 저장소
const reverseGeocodeCache = new Map<string, { result: AddressResult | null; timestamp: number }>();
const CACHE_DURATION = 30 * 60 * 1000; // 30분으로 증가 (API 호출 감소)

// localStorage 기반 영구 캐시
const getLocalStorageCache = (key: string): AddressResult | null => {
  try {
    const cached = localStorage.getItem(`reverseGeocode_${key}`);
    if (cached) {
      const { result, timestamp } = JSON.parse(cached);
      // 24시간 이내 캐시만 사용
      if (Date.now() - timestamp < 24 * 60 * 60 * 1000) {
        return result;
      }
    }
  } catch {
    // ignore
  }
  return null;
};

const setLocalStorageCache = (key: string, result: AddressResult | null) => {
  try {
    localStorage.setItem(`reverseGeocode_${key}`, JSON.stringify({
      result,
      timestamp: Date.now(),
    }));
  } catch {
    // ignore
  }
};

// 재시도 로직 (exponential backoff)
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function reverseGeocode(lat: number, lng: number, retryCount = 0): Promise<AddressResult | null> {
  const apiKey = import.meta.env.VITE_KAKAO_REST_API_KEY || import.meta.env.VITE_KAKAO_MAP_API_KEY;
  if (!apiKey) {
    throw new Error("카카오 REST API 키가 설정되지 않았습니다. VITE_KAKAO_REST_API_KEY를 설정해주세요.");
  }

  // 캐시 키 생성 (소수점 4자리로 반올림하여 캐시 효율성 향상)
  const cacheKey = `${Math.round(lat * 10000) / 10000},${Math.round(lng * 10000) / 10000}`;
  
  // 1순위: 메모리 캐시
  const cached = reverseGeocodeCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.result;
  }
  
  // 2순위: localStorage 캐시
  const localStorageCached = getLocalStorageCache(cacheKey);
  if (localStorageCached) {
    // 메모리 캐시에도 저장
    reverseGeocodeCache.set(cacheKey, { result: localStorageCached, timestamp: Date.now() });
    return localStorageCached;
  }

  try {
    const response = await fetch(
      `https://dapi.kakao.com/v2/local/geo/coord2address.json?x=${lng}&y=${lat}`,
      {
        headers: {
          Authorization: `KakaoAK ${apiKey}`,
        },
      }
    );

    // 429 Too Many Requests 에러 처리
    // 429 오류는 재시도하면 더 많은 호출이 발생하므로 바로 캐시 사용
    if (response.status === 429) {
      console.warn(`Kakao API rate limit exceeded. Using cache instead of retrying.`);
      
      // 재시도하지 않고 바로 캐시된 결과 반환
      if (cached) {
        console.log("Using memory cache for rate-limited request");
        return cached.result;
      }
      if (localStorageCached) {
        console.log("Using localStorage cache for rate-limited request");
        return localStorageCached;
      }
      
      // 캐시도 없으면 에러 던지기 (호출하는 쪽에서 처리)
      throw new Error("API 호출 제한에 도달했습니다. 잠시 후 다시 시도해주세요.");
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error(`Reverse geocode failed: ${response.status}`, errorText);
      throw new Error(`역지오코딩에 실패했습니다. (${response.status})`);
    }

    const data = await response.json();
    let result: AddressResult | null = null;
    
    if (data.documents && data.documents.length > 0) {
      const doc = data.documents[0];
      result = {
        address_name: doc.address?.address_name || doc.road_address?.address_name || "",
        y: lat.toString(),
        x: lng.toString(),
      };
    }

    // 결과를 캐시에 저장 (메모리 + localStorage)
    reverseGeocodeCache.set(cacheKey, { result, timestamp: Date.now() });
    setLocalStorageCache(cacheKey, result);
    
    return result;
  } catch (error: any) {
    console.error("Reverse geocode error:", error);
    
    // 네트워크 오류 등으로 실패한 경우, 캐시된 결과가 있으면 사용
    if (cached) {
      return cached.result;
    }
    if (localStorageCached) {
      return localStorageCached;
    }
    
    // 재시도 가능한 에러면 재시도
    if (retryCount < 2 && error.message?.includes("Failed to fetch")) {
      const backoffTime = Math.pow(2, retryCount) * 1000;
      await sleep(backoffTime);
      return reverseGeocode(lat, lng, retryCount + 1);
    }
    
    throw error;
  }
}

