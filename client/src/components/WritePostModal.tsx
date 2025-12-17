import { useState, useRef, useCallback } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ImageIcon, MapPin, X, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { KakaoMapView } from "@/components/KakaoMap";
import { reverseGeocode } from "@/lib/kakaoAddress";

const categories = [
  { value: "inconvenience", label: "불편신고", icon: "🔴" },
  { value: "suggestion", label: "제안", icon: "🟢" },
  { value: "praise", label: "칭찬", icon: "💛" },
  { value: "chat", label: "잡담", icon: "💬" },
  { value: "emergency", label: "긴급", icon: "⚠️" },
] as const;

interface WritePostModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultNeighborhood?: string;
  onSuccess?: () => void;
}

export function WritePostModal({
  open,
  onOpenChange,
  defaultNeighborhood = "서울시 강남구 역삼동",
  onSuccess,
}: WritePostModalProps) {
  const { user } = useAuth();
  const [category, setCategory] = useState<string>("inconvenience");
  const [content, setContent] = useState("");
  const [images, setImages] = useState<string[]>([]); // Array of image URLs
  const [imageFiles, setImageFiles] = useState<File[]>([]); // Array of File objects for preview
  const [neighborhood, setNeighborhood] = useState(defaultNeighborhood);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isLocationDialogOpen, setIsLocationDialogOpen] = useState(false);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>({
    lat: 37.5665,
    lng: 126.978,
  });
  const [selectedMapLocation, setSelectedMapLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [tempSelectedLocation, setTempSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isResolvingAddress, setIsResolvingAddress] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();
  const uploadImageMutation = trpc.storage.uploadImage.useMutation();
  const createPostMutation = trpc.posts.create.useMutation({
    onSuccess: () => {
      toast.success("게시글이 작성되었습니다!");
      // Reset form
      setContent("");
      setImages([]);
      setImageFiles([]);
      setCategory("inconvenience");
      setIsAnonymous(false);
      onOpenChange(false);
      // Invalidate posts query to refresh feed
      utils.posts.getByNeighborhood.invalidate();
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(`게시글 작성 실패: ${error.message}`);
    },
  });

  // 내 위치로 설정
  const handleUseCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error("위치 정보를 사용할 수 없습니다.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude: lat, longitude: lng } = position.coords;
          // 좌표는 먼저 저장
          setLatitude(lat);
          setLongitude(lng);
          
          // 역지오코딩 시도 (재시도 로직은 reverseGeocode 내부에서 처리)
          try {
            const addr = await reverseGeocode(lat, lng);
            if (addr?.address_name) {
              setNeighborhood(addr.address_name);
              toast.success("현재 위치로 설정되었습니다.");
            } else {
              // 역지오코딩 결과가 없으면 좌표 기반 주소 생성
              const coordinateBasedAddress = `위치: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
              setNeighborhood(coordinateBasedAddress);
              toast.info("주소를 찾을 수 없어 좌표로 저장됩니다.");
            }
          } catch (error: any) {
            // API 오류 시에도 좌표는 저장되어 있음 - 좌표 기반 주소 사용
            console.warn("Reverse geocode failed after retries:", error);
            const coordinateBasedAddress = `위치: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
            setNeighborhood(coordinateBasedAddress);
            if (error.message?.includes("429") || error.message?.includes("호출 제한")) {
              toast.warning("API 호출 제한으로 좌표로 저장됩니다. 잠시 후 다시 시도해주세요.");
            } else {
              toast.info("주소를 찾을 수 없어 좌표로 저장됩니다.");
            }
          }
        } catch (error) {
          console.error("Location processing error:", error);
          toast.error("위치 정보를 처리하는데 실패했습니다.");
        }
      },
      (error) => {
        toast.error(`위치 정보를 가져올 수 없습니다: ${error.message}`);
      },
      {
        enableHighAccuracy: false, // 정확도 낮춰서 API 호출 감소
        timeout: 10000,
        maximumAge: 5 * 60 * 1000, // 5분간 캐시 사용
      }
    );
  }, [user, defaultNeighborhood]);

  // 지도에서 선택용 현재 위치 가져오기 (지도 센터)
  const prepareLocationPicker = useCallback(() => {
    // 임시 선택 초기화
    setTempSelectedLocation(null);
    
    // 이미 선택된 위치가 있으면 그 위치로, 없으면 현재 위치 또는 기본값
    if (latitude && longitude) {
      setSelectedMapLocation({ lat: latitude, lng: longitude });
      setMapCenter({ lat: latitude, lng: longitude });
    } else if (!navigator.geolocation) {
      setIsLocationDialogOpen(true);
      return;
    } else {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude: lat, longitude: lng } = position.coords;
          setMapCenter({ lat, lng });
          setIsLocationDialogOpen(true);
        },
        () => {
          // 실패해도 지도는 열어준다 (기본 서울 좌표)
          setIsLocationDialogOpen(true);
        },
        {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 5 * 60 * 1000,
        }
      );
      return;
    }
    setIsLocationDialogOpen(true);
  }, [latitude, longitude]);

  // Handle image selection
  const handleImageSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;

      // Check total images (existing + new)
      if (images.length + files.length > 3) {
        toast.error("최대 3장까지만 첨부할 수 있습니다.");
        return;
      }

      // Validate file types and sizes
      const validFiles = files.filter((file) => {
        if (!file.type.startsWith("image/")) {
          toast.error(`${file.name}은(는) 이미지 파일이 아닙니다.`);
          return false;
        }
        if (file.size > 5 * 1024 * 1024) {
          // 5MB limit
          toast.error(`${file.name}의 크기가 너무 큽니다. (최대 5MB)`);
          return false;
        }
        return true;
      });

      if (validFiles.length === 0) return;

      // Create preview URLs
      const newPreviewUrls = validFiles.map((file) => URL.createObjectURL(file));
      setImageFiles((prev) => [...prev, ...validFiles]);

      // Upload images
      setIsUploading(true);
      try {
        const uploadPromises = validFiles.map(async (file) => {
          // Convert to base64
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const result = reader.result as string;
              resolve(result);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });

          // Upload to server
          const result = await uploadImageMutation.mutateAsync({
            base64,
            mimeType: file.type,
          });

          return result.url;
        });

        const uploadedUrls = await Promise.all(uploadPromises);
        setImages((prev) => [...prev, ...uploadedUrls]);
        toast.success(`${uploadedUrls.length}장의 사진이 업로드되었습니다.`);
      } catch (error) {
        toast.error("이미지 업로드에 실패했습니다.");
        // Remove failed previews
        newPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
        setImageFiles((prev) => prev.slice(0, prev.length - validFiles.length));
      } finally {
        setIsUploading(false);
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [images.length, uploadImageMutation]
  );

  // Remove image
  const handleRemoveImage = useCallback(
    (index: number) => {
      setImages((prev) => prev.filter((_, i) => i !== index));
      setImageFiles((prev) => {
        const file = prev[index];
        if (file) {
          URL.revokeObjectURL(URL.createObjectURL(file));
        }
        return prev.filter((_, i) => i !== index);
      });
    },
    []
  );

  // Handle submit
  const handleSubmit = useCallback(async () => {
    if (!content.trim()) {
      toast.error("내용을 입력해주세요.");
      return;
    }

    if (content.length > 200) {
      toast.error("내용은 200자 이하여야 합니다.");
      return;
    }

    try {
      await createPostMutation.mutateAsync({
        category: category as "inconvenience" | "suggestion" | "praise" | "chat" | "emergency",
        content: content.trim(),
        images: images.length > 0 ? images : undefined,
        neighborhood,
        latitude: latitude ?? undefined,
        longitude: longitude ?? undefined,
        isAnonymous,
      });
    } catch (error) {
      // Error handling is done in mutation callbacks
    }
  }, [category, content, images, neighborhood, isAnonymous, createPostMutation]);

  const selectedCategory = categories.find((c) => c.value === category);
  const remainingChars = 200 - content.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>짤막 올리기</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Category Selection */}
          <div className="space-y-2">
            <Label htmlFor="category">카테고리</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="category" className="w-full">
                <SelectValue>
                  {selectedCategory && (
                    <span className="flex items-center gap-2">
                      <span>{selectedCategory.icon}</span>
                      <span>{selectedCategory.label}</span>
                    </span>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    <span className="flex items-center gap-2">
                      <span>{cat.icon}</span>
                      <span>{cat.label}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Content Input */}
          <div className="space-y-2">
            <Label htmlFor="content">내용</Label>
            <Textarea
              id="content"
              placeholder="내용을 200자 이내로 적어주세요"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={200}
              rows={4}
              className="resize-none"
            />
            <div className="flex justify-end">
              <span
                className={`text-xs ${
                  remainingChars < 20 ? "text-destructive" : "text-muted-foreground"
                }`}
              >
                {remainingChars}자 남음
              </span>
            </div>
          </div>

          {/* Image Upload */}
          <div className="space-y-2">
            <Label>사진 첨부 (최대 3장)</Label>
            <div className="flex gap-2 flex-wrap">
              {images.map((url, index) => (
                <div key={index} className="relative group">
                  <img
                    src={url}
                    alt={`Upload ${index + 1}`}
                    className="w-20 h-20 object-cover rounded-md border"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(index)}
                    className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {images.length < 3 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="w-20 h-20 border-2 border-dashed rounded-md flex items-center justify-center hover:bg-accent transition-colors disabled:opacity-50"
                >
                  {isUploading ? (
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  ) : (
                    <ImageIcon className="w-6 h-6 text-muted-foreground" />
                  )}
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                onChange={handleImageSelect}
                className="hidden"
              />
            </div>
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label>위치</Label>
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-3 py-2 border rounded-md bg-muted/50">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm line-clamp-1 flex-1">
                  {neighborhood || "위치를 선택해주세요"}
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={handleUseCurrentLocation}
                >
                  내 위치로 설정
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={prepareLocationPicker}
                >
                  지도에서 선택
                </Button>
              </div>
            </div>
          </div>

          {/* Anonymous Option */}
          <div className="flex items-center justify-between">
            <Label htmlFor="anonymous" className="flex items-center gap-2">
              <span>🙈</span>
              <span>익명으로 올리기</span>
            </Label>
            <Switch
              id="anonymous"
              checked={isAnonymous}
              onCheckedChange={setIsAnonymous}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={createPostMutation.isPending}
          >
            취소
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              !content.trim() ||
              content.length > 200 ||
              createPostMutation.isPending ||
              isUploading
            }
          >
            {createPostMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                올리는 중...
              </>
            ) : (
              "올리기"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* 위치 선택용 지도 다이얼로그 */}
      <Dialog open={isLocationDialogOpen} onOpenChange={setIsLocationDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>지도에서 위치 선택</DialogTitle>
          </DialogHeader>
          <div className="h-80 rounded-md overflow-hidden border">
            <KakaoMapView
              initialCenter={selectedMapLocation || mapCenter}
              initialZoom={4}
              className="w-full h-full"
              markers={
                tempSelectedLocation
                  ? [
                      {
                        id: 1,
                        lat: tempSelectedLocation.lat,
                        lng: tempSelectedLocation.lng,
                        icon: undefined, // 기본 빨간색 핀 마커 사용
                      },
                    ]
                  : selectedMapLocation
                  ? [
                      {
                        id: 1,
                        lat: selectedMapLocation.lat,
                        lng: selectedMapLocation.lng,
                        icon: undefined, // 기본 빨간색 핀 마커 사용
                      },
                    ]
                  : []
              }
              onMapClick={(lat, lng) => {
                // 지도 클릭 시 임시로 위치 선택 (아직 확정 안 됨)
                setTempSelectedLocation({ lat, lng });
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            지도를 탭하거나 클릭해서 게시글의 위치를 선택하세요.
          </p>
          {tempSelectedLocation && (
            <div className="text-sm text-muted-foreground">
              선택한 위치: {tempSelectedLocation.lat.toFixed(4)}, {tempSelectedLocation.lng.toFixed(4)}
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setTempSelectedLocation(null);
                setIsLocationDialogOpen(false);
              }}
            >
              취소
            </Button>
            <Button
              type="button"
              onClick={async () => {
                if (!tempSelectedLocation) {
                  toast.error("위치를 선택해주세요.");
                  return;
                }

                try {
                  setIsResolvingAddress(true);
                  const { lat, lng } = tempSelectedLocation;
                  
                  // 좌표 저장
                  setLatitude(lat);
                  setLongitude(lng);
                  setSelectedMapLocation({ lat, lng });
                  
                  // 역지오코딩 시도 (재시도 로직은 reverseGeocode 내부에서 처리)
                  try {
                    const addr = await reverseGeocode(lat, lng);
                    if (addr?.address_name) {
                      setNeighborhood(addr.address_name);
                      toast.success("위치가 설정되었습니다.");
                    } else {
                      // 역지오코딩 결과가 없으면 좌표 기반 주소 생성
                      const coordinateBasedAddress = `위치: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
                      setNeighborhood(coordinateBasedAddress);
                      toast.info("주소를 찾을 수 없어 좌표로 저장됩니다.");
                    }
                  } catch (error: any) {
                    // API 오류 시에도 좌표는 저장되어 있음 - 좌표 기반 주소 사용
                    console.warn("Reverse geocode failed after retries:", error);
                    const coordinateBasedAddress = `위치: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
                    setNeighborhood(coordinateBasedAddress);
                    if (error.message?.includes("429") || error.message?.includes("호출 제한")) {
                      toast.warning("API 호출 제한으로 좌표로 저장됩니다. 잠시 후 다시 시도해주세요.");
                    } else {
                      toast.info("주소를 찾을 수 없어 좌표로 저장됩니다.");
                    }
                  }
                  setTempSelectedLocation(null);
                  setIsLocationDialogOpen(false);
                } catch (error) {
                  console.error("Location processing error:", error);
                  toast.error("위치 정보를 처리하는데 실패했습니다.");
                } finally {
                  setIsResolvingAddress(false);
                }
              }}
              disabled={!tempSelectedLocation || isResolvingAddress}
            >
              {isResolvingAddress ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  처리 중...
                </>
              ) : (
                "선택"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

