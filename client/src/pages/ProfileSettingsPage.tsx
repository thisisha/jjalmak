import { useState, useRef, useCallback } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  User,
  ImageIcon,
  MapPin,
  Loader2,
  ArrowLeft,
  Camera,
  X,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";
import { reverseGeocode, searchAddress } from "@/lib/kakaoAddress";

export default function ProfileSettingsPage() {
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [nickname, setNickname] = useState(user?.nickname || "");
  const [bio, setBio] = useState((user as any)?.bio || "");
  const [neighborhood, setNeighborhood] = useState((user as any)?.neighborhood || "");
  const [latitude, setLatitude] = useState<string>((user as any)?.latitude || "");
  const [longitude, setLongitude] = useState<string>((user as any)?.longitude || "");
  const [profileImage, setProfileImage] = useState((user as any)?.profileImage || "");
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState<string>("");
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [addressSearchQuery, setAddressSearchQuery] = useState("");
  const [addressResults, setAddressResults] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();
  const uploadImageMutation = trpc.storage.uploadImage.useMutation();
  const updateProfileMutation = trpc.profile.update.useMutation({
    onSuccess: () => {
      toast.success("프로필이 업데이트되었습니다.");
      utils.profile.getMe.invalidate();
      utils.auth.me.invalidate();
      setLocation("/profile");
    },
    onError: (error) => {
      toast.error(`프로필 업데이트 실패: ${error.message}`);
    },
  });

  // Get current location with reverse geocoding
  const getCurrentLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      toast.error("위치 정보를 사용할 수 없습니다.");
      return;
    }

    const loadingToast = toast.loading("위치 정보를 가져오는 중...");
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude: lat, longitude: lng } = position.coords;
        
        try {
          // Reverse geocoding to get address
          const address = await reverseGeocode(lat, lng);
          
          if (address) {
            setNeighborhood(address.address_name);
            setLatitude(address.y);
            setLongitude(address.x);
            toast.dismiss(loadingToast);
            toast.success(`위치가 설정되었습니다: ${address.address_name}`);
          } else {
            setLatitude(lat.toString());
            setLongitude(lng.toString());
            toast.dismiss(loadingToast);
            toast.success("위치가 설정되었습니다. (주소를 찾을 수 없습니다)");
          }
        } catch (error) {
          // Fallback: just set coordinates
          setLatitude(lat.toString());
          setLongitude(lng.toString());
          toast.dismiss(loadingToast);
          toast.success("위치가 설정되었습니다.");
        }
      },
      (error) => {
        toast.dismiss(loadingToast);
        toast.error(`위치 정보를 가져올 수 없습니다: ${error.message}`);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, []);

  // Search address
  const handleAddressSearch = useCallback(async () => {
    if (!addressSearchQuery.trim()) {
      toast.error("주소를 입력해주세요.");
      return;
    }

    setIsSearchingAddress(true);
    try {
      const results = await searchAddress(addressSearchQuery);
      setAddressResults(results);
      if (results.length === 0) {
        toast.info("검색 결과가 없습니다.");
      }
    } catch (error) {
      toast.error("주소 검색에 실패했습니다.");
      console.error(error);
    } finally {
      setIsSearchingAddress(false);
    }
  }, [addressSearchQuery]);

  // Select address from search results
  const handleSelectAddress = useCallback((address: any) => {
    setNeighborhood(address.address_name);
    setLatitude(address.y);
    setLongitude(address.x);
    setAddressResults([]);
    setAddressSearchQuery("");
    toast.success(`주소가 설정되었습니다: ${address.address_name}`);
  }, []);

  // Handle profile image selection
  const handleImageSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Validate file
      if (!file.type.startsWith("image/")) {
        toast.error("이미지 파일만 업로드할 수 있습니다.");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error("이미지 크기는 5MB 이하여야 합니다.");
        return;
      }

      // Create preview
      const previewUrl = URL.createObjectURL(file);
      setProfileImagePreview(previewUrl);
      setProfileImageFile(file);
    },
    []
  );

  // Remove profile image
  const handleRemoveImage = useCallback(() => {
    setProfileImage("");
    setProfileImageFile(null);
    if (profileImagePreview) {
      URL.revokeObjectURL(profileImagePreview);
      setProfileImagePreview("");
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [profileImagePreview]);

  // Handle submit
  const handleSubmit = useCallback(async () => {
    let imageUrl = profileImage;

    // Upload new image if selected
    if (profileImageFile) {
      try {
        setIsUploading(true);
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result);
          };
          reader.onerror = reject;
          reader.readAsDataURL(profileImageFile);
        });

        const result = await uploadImageMutation.mutateAsync({
          base64,
          mimeType: profileImageFile.type,
        });

        imageUrl = result.url;
        // Clean up preview
        if (profileImagePreview) {
          URL.revokeObjectURL(profileImagePreview);
          setProfileImagePreview("");
        }
      } catch (error) {
        toast.error("이미지 업로드에 실패했습니다.");
        setIsUploading(false);
        return;
      } finally {
        setIsUploading(false);
      }
    }

    // Update profile
    // Verify neighborhood if GPS location is set
    const neighborhoodVerified = !!(latitude && longitude && neighborhood);
    
    // Convert empty strings to null for profileImage
    let finalImageUrl: string | null = null;
    if (imageUrl && typeof imageUrl === "string" && imageUrl.trim()) {
      const trimmed = imageUrl.trim();
      // Only set if it's a valid URL (starts with http:// or https://)
      if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
        finalImageUrl = trimmed;
      } else {
        // If it's not a valid URL, set to null
        finalImageUrl = null;
      }
    }
    
    console.log("[Profile Update] Sending data:", {
      nickname: nickname.trim() || null,
      bio: bio.trim() || null,
      neighborhood: neighborhood.trim() || null,
      latitude: latitude ? (typeof latitude === "string" ? parseFloat(latitude) : latitude) : null,
      longitude: longitude ? (typeof longitude === "string" ? parseFloat(longitude) : longitude) : null,
      profileImage: finalImageUrl,
      neighborhoodVerified,
    });
    
    await updateProfileMutation.mutateAsync({
      nickname: nickname.trim() || null,
      bio: bio.trim() || null,
      neighborhood: neighborhood.trim() || null,
      latitude: latitude ? (typeof latitude === "string" ? parseFloat(latitude) : latitude) : null,
      longitude: longitude ? (typeof longitude === "string" ? parseFloat(longitude) : longitude) : null,
      profileImage: finalImageUrl,
      neighborhoodVerified,
    });
  }, [
    nickname,
    bio,
    neighborhood,
    latitude,
    longitude,
    profileImage,
    profileImageFile,
    profileImagePreview,
    uploadImageMutation,
    updateProfileMutation,
  ]);

  const [isUploading, setIsUploading] = useState(false);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">로그인이 필요합니다.</p>
          <Button asChild>
            <a href={getLoginUrl()}>로그인</a>
          </Button>
        </div>
      </div>
    );
  }

  const currentImageUrl = profileImagePreview || profileImage;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-30 border-b border-border bg-card shadow-sm">
        <div className="container py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/profile")}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              뒤로
            </Button>
            <h1 className="text-xl font-bold">프로필 설정</h1>
          </div>
        </div>
      </div>

      <div className="container py-6 pb-28 space-y-6 max-w-2xl">
        {/* Profile Image */}
        <Card className="p-6">
          <Label className="text-base font-semibold mb-4 block">
            프로필 이미지
          </Label>
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                {currentImageUrl ? (
                  <img
                    src={currentImageUrl}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-12 h-12 text-muted-foreground" />
                )}
              </div>
              {currentImageUrl && (
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="flex-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    업로드 중...
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4 mr-2" />
                    이미지 선택
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                JPG, PNG 파일만 가능합니다. (최대 5MB)
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
            </div>
          </div>
        </Card>

        {/* Nickname */}
        <Card className="p-6">
          <Label htmlFor="nickname" className="text-base font-semibold mb-4 block">
            닉네임
          </Label>
          <Input
            id="nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="닉네임을 입력하세요"
            maxLength={50}
          />
          <p className="text-xs text-muted-foreground mt-2">
            {nickname.length}/50자
          </p>
        </Card>

        {/* Bio */}
        <Card className="p-6">
          <Label htmlFor="bio" className="text-base font-semibold mb-4 block">
            소개글
          </Label>
          <Textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="자신을 소개해주세요"
            rows={4}
            className="resize-none"
          />
        </Card>

        {/* Neighborhood */}
        <Card className="p-6">
          <Label
            htmlFor="neighborhood"
            className="text-base font-semibold mb-4 block"
          >
            동네
          </Label>
          
          {/* Address Search */}
          <div className="space-y-2 mb-4">
            <div className="flex gap-2">
              <Input
                value={addressSearchQuery}
                onChange={(e) => setAddressSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleAddressSearch();
                  }
                }}
                placeholder="주소를 검색하세요 (예: 강남구 역삼동)"
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleAddressSearch}
                disabled={isSearchingAddress || !addressSearchQuery.trim()}
              >
                {isSearchingAddress ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "검색"
                )}
              </Button>
            </div>
            
            {/* Search Results */}
            {addressResults.length > 0 && (
              <div className="border rounded-lg max-h-48 overflow-y-auto">
                {addressResults.map((address, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectAddress(address)}
                    className="w-full text-left px-4 py-2 hover:bg-muted transition-colors border-b last:border-b-0"
                  >
                    <div className="font-medium text-sm">{address.address_name}</div>
                    {address.road_address && (
                      <div className="text-xs text-muted-foreground">
                        {address.road_address.address_name}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Current Address Display */}
          <div className="flex gap-2 mb-2">
            <Input
              id="neighborhood"
              value={neighborhood}
              onChange={(e) => setNeighborhood(e.target.value)}
              placeholder="예: 서울시 강남구 역삼동"
              readOnly
              className="bg-muted"
            />
            <Button
              type="button"
              variant="outline"
              onClick={getCurrentLocation}
            >
              <MapPin className="w-4 h-4 mr-2" />
              GPS 위치
            </Button>
          </div>
          
          {neighborhood && (
            <div className="text-xs text-muted-foreground mb-2">
              현재 설정된 동네: <span className="font-medium">{neighborhood}</span>
            </div>
          )}
          
          <p className="text-xs text-muted-foreground">
            주소 검색 또는 GPS로 현재 위치를 설정할 수 있습니다.
          </p>
        </Card>

        {/* Submit Button - Sticky above bottom nav */}
        <div className="sticky bottom-16 bg-background border-t border-border pt-4 pb-6 -mx-6 px-6 mt-8">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setLocation("/profile")}
              className="flex-1"
            >
              취소
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                updateProfileMutation.isPending ||
                uploadImageMutation.isPending ||
                isUploading
              }
              className="flex-1"
            >
              {updateProfileMutation.isPending || isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  저장 중...
                </>
              ) : (
                "저장"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

