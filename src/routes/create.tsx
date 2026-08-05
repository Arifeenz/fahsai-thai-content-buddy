import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  api,
  exampleSelectionModeLabel,
  platformLabel,
  type BusinessCategory,
  type ExampleSelectionMode,
  type Platform,
  type Tone,
} from "@/lib/api";
import { AppShell, PageHeader, useCurrentUser } from "@/components/app-shell";
import { useRequireAuth } from "@/lib/auth-guard";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sparkles,
  Check,
  RefreshCw,
  Copy,
  Facebook,
  Instagram,
  MessageCircle,
  ImagePlus,
  Info,
  X,
  Camera,
  RotateCcw,
} from "lucide-react";

export const Route = createFileRoute("/create")({
  head: () => ({
    meta: [
      { title: "สร้างคอนเทนต์ — FAHSAI" },
      { name: "description", content: "ให้ AI ช่วยเขียนโพสต์สำหรับร้านของคุณใน 2 วินาที" },
      { property: "og:title", content: "สร้างคอนเทนต์ — FAHSAI" },
      { property: "og:description", content: "ให้ AI ช่วยเขียนโพสต์สำหรับร้านของคุณใน 2 วินาที" },
    ],
  }),
  component: CreateContent,
});

const platforms: { key: Platform; icon: any }[] = [
  { key: "facebook", icon: Facebook },
  { key: "line", icon: MessageCircle },
  { key: "instagram", icon: Instagram },
];
const tones: { key: Tone; label: string }[] = [
  { key: "friendly", label: "เป็นกันเอง" },
  { key: "professional", label: "ทางการ" },
  { key: "playful", label: "สนุกสนาน" },
  { key: "promo", label: "โปรโมชั่น" },
];

const MAX_PHOTOS = 3;
// JPEG, not PNG: the backend rejects uploads over 5MB *before* it
// re-compresses them, and a raw PNG screen capture blows past that easily.
const CAPTURE_JPEG_QUALITY = 0.9;

type Mode = "idea" | "photo";
type CategoryKey = BusinessCategory | "default";

const categoryPlaceholder: Record<CategoryKey, string> = {
  food_beverage: "เช่น โปรโมทเมนูใหม่ กาแฟส้ม ลด 20% ช่วงบ่าย",
  online_shop: "เช่น สินค้ามาใหม่ กระเป๋าหนัง ลด 15% วันนี้วันเดียว",
  fortune_telling: "เช่น ดวงรายสัปดาห์ราศีเมษ เปิดคิวดูดวงเสาร์-อาทิตย์นี้",
  streamer: "เช่น ไลฟ์เกม Valorant คืนนี้ 3 ทุ่ม มีแจกของ",
  default: "เช่น อยากได้โพสต์ชวนคนมาลองเมนูใหม่ กาแฟส้ม ช่วงบ่ายลด 20%",
};

const categoryChips: Record<CategoryKey, { label: string; insert: string }[]> = {
  food_beverage: [
    { label: "เมนู", insert: "เมนูที่จะโปรโมท: " },
    { label: "ราคา/โปรโมชั่น", insert: "ราคา/โปรโมชั่น: " },
    { label: "จุดเด่น", insert: "จุดเด่นของเมนูนี้: " },
  ],
  online_shop: [
    { label: "สินค้า", insert: "สินค้าที่จะโปรโมท: " },
    { label: "ราคา/ส่วนลด", insert: "ราคา/ส่วนลด: " },
    { label: "ของจำกัด", insert: "จำนวนจำกัด/ใกล้หมด: " },
  ],
  fortune_telling: [
    { label: "หัวข้อดวง", insert: "หัวข้อดวงที่จะพูดถึง: " },
    { label: "บริการที่เปิดจอง", insert: "บริการที่เปิดรับ: " },
    { label: "ช่วงเวลาว่าง", insert: "ช่วงเวลาที่เปิดคิว: " },
  ],
  streamer: [
    { label: "คอนเทนต์/เกม", insert: "คอนเทนต์ที่จะสตรีม: " },
    { label: "วันเวลาไลฟ์", insert: "วันเวลาไลฟ์: " },
    { label: "กิจกรรมพิเศษ", insert: "กิจกรรมพิเศษ: " },
  ],
  default: [],
};

const SHORT_PROMPT_THRESHOLD = 15;

function CreateContent() {
  const { ready } = useRequireAuth();
  const user = useCurrentUser();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>("idea");
  const [prompt, setPrompt] = useState("");
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoContext, setPhotoContext] = useState("");
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [captureStream, setCaptureStream] = useState<MediaStream | null>(null);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [cropRect, setCropRect] = useState<{ x: number; y: number; w: number; h: number } | null>(
    null,
  );
  const [cropDragStart, setCropDragStart] = useState<{ x: number; y: number } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const capturedImgRef = useRef<HTMLImageElement>(null);
  const captureStreamRef = useRef<MediaStream | null>(null);
  const [platform, setPlatform] = useState<Platform>("facebook");
  const [tone, setTone] = useState<Tone>("friendly");
  const [loading, setLoading] = useState(false);
  const [caption, setCaption] = useState<string>("");
  const [resultImageUrls, setResultImageUrls] = useState<string[]>([]);
  const [imagePrompt, setImagePrompt] = useState<string | null>(null);
  const [imagePromptTh, setImagePromptTh] = useState<string | null>(null);
  const [approved, setApproved] = useState(false);
  const [showShortPromptWarning, setShowShortPromptWarning] = useState(false);

  const categoryKey: CategoryKey = user?.business_category ?? "default";

  useEffect(() => {
    if (videoRef.current && captureStream) {
      videoRef.current.srcObject = captureStream;
    }
  }, [captureStream]);

  useEffect(() => {
    if (!captureStream) return;
    const track = captureStream.getVideoTracks()[0];
    if (!track) return;
    const handleEnded = () => closeCaptureModal();
    track.addEventListener("ended", handleEnded);
    return () => track.removeEventListener("ended", handleEnded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captureStream]);

  useEffect(() => {
    return () => {
      captureStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function startScreenCapture() {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      toast.error("เบราว์เซอร์นี้ยังไม่รองรับการจับภาพหน้าจอค่ะ ลองอัปโหลดไฟล์แทนนะคะ");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      captureStreamRef.current = stream;
      setCaptureStream(stream);
      setCapturedUrl(null);
      setCapturedBlob(null);
      setCropRect(null);
      setCaptureOpen(true);
    } catch (err) {
      if (err instanceof DOMException && err.name === "NotAllowedError") return;
      toast.error("จับภาพหน้าจอไม่สำเร็จ ลองอีกครั้งนะคะ");
    }
  }

  function takeSnapshot() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        setCapturedBlob(blob);
        setCapturedUrl(URL.createObjectURL(blob));
        setCropRect(null);
      },
      "image/jpeg",
      CAPTURE_JPEG_QUALITY,
    );
  }

  function retakeSnapshot() {
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    setCapturedUrl(null);
    setCapturedBlob(null);
    setCropRect(null);
  }

  function closeCaptureModal() {
    captureStreamRef.current?.getTracks().forEach((t) => t.stop());
    captureStreamRef.current = null;
    setCaptureStream(null);
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    setCapturedUrl(null);
    setCapturedBlob(null);
    setCropRect(null);
    setCaptureOpen(false);
  }

  function handleCropPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    const point = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setCropDragStart(point);
    setCropRect({ ...point, w: 0, h: 0 });
  }

  function handleCropPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!cropDragStart) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(Math.max(e.clientX - rect.left, 0), rect.width);
    const y = Math.min(Math.max(e.clientY - rect.top, 0), rect.height);
    setCropRect({
      x: Math.min(cropDragStart.x, x),
      y: Math.min(cropDragStart.y, y),
      w: Math.abs(x - cropDragStart.x),
      h: Math.abs(y - cropDragStart.y),
    });
  }

  function handleCropPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setCropDragStart(null);
    setCropRect((r) => (r && r.w > 8 && r.h > 8 ? r : null));
  }

  async function useCapturedFrame() {
    if (!capturedBlob) return;
    let finalBlob = capturedBlob;
    const imgEl = capturedImgRef.current;

    if (cropRect && imgEl && imgEl.clientWidth > 0 && imgEl.clientHeight > 0) {
      try {
        const bitmap = await createImageBitmap(capturedBlob);
        const scaleX = bitmap.width / imgEl.clientWidth;
        const scaleY = bitmap.height / imgEl.clientHeight;
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(cropRect.w * scaleX));
        canvas.height = Math.max(1, Math.round(cropRect.h * scaleY));
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(
            bitmap,
            cropRect.x * scaleX,
            cropRect.y * scaleY,
            canvas.width,
            canvas.height,
            0,
            0,
            canvas.width,
            canvas.height,
          );
          const croppedBlob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob(resolve, "image/jpeg", CAPTURE_JPEG_QUALITY),
          );
          if (croppedBlob) finalBlob = croppedBlob;
        }
      } catch {
        // fall back to the uncropped frame if cropping fails for any reason
      }
    }

    const file = new File([finalBlob], `screenshot-${Date.now()}.jpg`, { type: "image/jpeg" });
    setPhotoFiles((prev) => {
      if (prev.length >= MAX_PHOTOS) {
        toast.error(`แนบได้สูงสุด ${MAX_PHOTOS} รูปนะคะ`);
        return prev;
      }
      return [...prev, file];
    });
    closeCaptureModal();
  }

  function insertChip(insert: string) {
    setPrompt((prev) => (prev.trim() ? `${prev}\n${insert}` : insert));
    requestAnimationFrame(() => {
      const el = promptRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    });
  }

  function handleGenerateClick() {
    if (mode === "idea" && prompt.trim().length < SHORT_PROMPT_THRESHOLD) {
      setShowShortPromptWarning(true);
      return;
    }
    generate();
  }

  function generateAnyway() {
    setShowShortPromptWarning(false);
    generate();
  }

  function dismissShortPromptWarning() {
    setShowShortPromptWarning(false);
    promptRef.current?.focus();
  }

  async function generate() {
    if (mode === "photo" && photoFiles.length === 0) return;
    if (mode === "idea" && !prompt.trim()) {
      toast.error("พิมพ์อะไรสักหน่อยนะคะ อยากโพสต์เรื่องอะไรวันนี้");
      return;
    }
    setLoading(true);
    setApproved(false);
    const t = toast.loading("กำลังสร้างโพสต์ให้อยู่ค่ะ...");
    try {
      if (mode === "photo" && photoFiles.length > 0) {
        const formData = new FormData();
        formData.append("platform", platform);
        formData.append("tone", tone);
        formData.append("context", photoContext);
        photoFiles.forEach((file) => formData.append("images", file));
        const res = await api.generateFromImage(formData);
        setCaption(res.caption);
        setResultImageUrls(res.image_urls);
        setImagePrompt(null);
        setImagePromptTh(null);
      } else {
        const res = await api.generate({ businessId: "me", prompt, platform, tone });
        setCaption(res.caption);
        setResultImageUrls([]);
        setImagePrompt(res.image_prompt);
        setImagePromptTh(res.image_prompt_th);
      }
      toast.success("โพสต์ใหม่พร้อมแล้วค่ะ ลองดูได้เลย", { id: t });
    } catch {
      toast.error("สร้างไม่สำเร็จ ลองอีกครั้งนะคะ", {
        id: t,
        action: { label: "ลองใหม่", onClick: generate },
      });
    } finally {
      setLoading(false);
    }
  }

  async function changeExampleSelectionMode(value: ExampleSelectionMode) {
    await api.updateExampleSelectionMode(value);
    queryClient.invalidateQueries({ queryKey: ["me"] });
  }

  async function approve() {
    if (!caption.trim()) return;
    setApproved(true);
    await api.saveContent({ platform, preview: caption, status: "approved", mode });
    toast.success("อนุมัติแล้วค่ะ พร้อมคัดลอกไปโพสต์ได้เลย ✓");
  }

  async function copy() {
    await navigator.clipboard.writeText(caption);
    await api.saveContent({ platform, preview: caption, status: "posted", mode });
    toast.success("คัดลอกแล้วค่ะ ไปวางในแอปของคุณได้เลย 🎉");
  }

  if (!ready) {
    return (
      <AppShell>
        <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
          กำลังโหลด...
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="p-6 md:p-8">
        <PageHeader title="สร้างคอนเทนต์" subtitle="บอก FAHSAI สั้นๆ ว่าอยากได้โพสต์แบบไหน" />

        <div className="grid gap-6 lg:grid-cols-2">
          {/* left: form */}
          <div className="glass-card rounded-2xl p-6">
            <div className="mb-4 flex gap-2">
              <button
                onClick={() => {
                  setMode("idea");
                  setShowShortPromptWarning(false);
                }}
                className={
                  "rounded-full border px-4 py-1.5 text-sm transition " +
                  (mode === "idea"
                    ? "border-teal bg-teal/15 text-teal"
                    : "border-border text-muted-foreground hover:text-foreground")
                }
              >
                เขียนจากไอเดีย
              </button>
              <button
                onClick={() => {
                  setMode("photo");
                  setShowShortPromptWarning(false);
                }}
                className={
                  "rounded-full border px-4 py-1.5 text-sm transition " +
                  (mode === "photo"
                    ? "border-teal bg-teal/15 text-teal"
                    : "border-border text-muted-foreground hover:text-foreground")
                }
              >
                เขียนจากรูปภาพ
              </button>
            </div>

            {mode === "idea" ? (
              <>
                <label className="mb-2 block text-sm font-semibold">อยากโพสต์อะไรวันนี้?</label>
                <textarea
                  ref={promptRef}
                  value={prompt}
                  onChange={(e) => {
                    setPrompt(e.target.value);
                    setShowShortPromptWarning(false);
                  }}
                  rows={4}
                  placeholder={categoryPlaceholder[categoryKey]}
                  className="w-full resize-none rounded-xl border border-border bg-input p-3 text-base outline-none placeholder:text-muted-foreground focus:border-teal"
                />
                {categoryChips[categoryKey].length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {categoryChips[categoryKey].map((chip) => (
                      <button
                        key={chip.label}
                        type="button"
                        onClick={() => insertChip(chip.insert)}
                        className="rounded-full border border-dashed border-border px-3 py-1 text-xs text-muted-foreground hover:border-teal hover:text-teal"
                      >
                        + {chip.label}
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <label className="mb-2 block text-sm font-semibold">
                  แนบรูปภาพที่จะโพสต์ (สูงสุด {MAX_PHOTOS} รูป)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-input/40 px-4 py-6 text-sm text-muted-foreground hover:text-foreground">
                    <ImagePlus className="h-5 w-5" />
                    {photoFiles.length > 0
                      ? `เลือกแล้ว ${photoFiles.length} รูป`
                      : "แตะเพื่อเลือกรูปภาพ"}
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        const files = Array.from(e.target.files ?? []);
                        if (files.length > MAX_PHOTOS) {
                          toast.error(`แนบได้สูงสุด ${MAX_PHOTOS} รูปนะคะ`);
                        }
                        setPhotoFiles(files.slice(0, MAX_PHOTOS));
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={startScreenCapture}
                    className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-input/40 px-4 py-6 text-sm text-muted-foreground hover:text-foreground"
                  >
                    <Camera className="h-5 w-5" />
                    จับภาพหน้าจอ
                  </button>
                </div>
                {photoFiles.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {photoFiles.map((file, i) => (
                      <span
                        key={`${file.name}-${i}`}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-input/40 px-3 py-1 text-xs text-muted-foreground"
                      >
                        {file.name}
                        <button
                          type="button"
                          onClick={() =>
                            setPhotoFiles((prev) => prev.filter((_, idx) => idx !== i))
                          }
                          className="hover:text-foreground"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <input
                  value={photoContext}
                  onChange={(e) => setPhotoContext(e.target.value)}
                  placeholder="บริบทเพิ่มเติม (ถ้ามี) เช่น เน้นโปรโมชั่นลด 20%"
                  className="mt-3 w-full rounded-xl border border-border bg-input p-3 text-sm outline-none placeholder:text-muted-foreground focus:border-teal"
                />
              </>
            )}

            <div className="mt-5">
              <div className="mb-2 text-sm font-semibold">แพลตฟอร์ม</div>
              <div className="grid grid-cols-3 gap-2">
                {platforms.map(({ key, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setPlatform(key)}
                    className={
                      "flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition " +
                      (platform === key
                        ? "border-teal bg-teal/15 text-teal"
                        : "border-border bg-input/40 text-muted-foreground hover:text-foreground")
                    }
                  >
                    <Icon className="h-4 w-4" />
                    {platformLabel[key]}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <div className="mb-2 text-sm font-semibold">น้ำเสียง</div>
              <div className="flex flex-wrap gap-2">
                {tones.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setTone(key)}
                    className={
                      "rounded-full border px-4 py-1.5 text-sm transition " +
                      (tone === key
                        ? "border-gold bg-gold/15 text-gold"
                        : "border-border bg-input/40 text-muted-foreground hover:text-foreground")
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {mode === "idea" && (
              <div className="mt-5">
                <div className="mb-2 text-sm font-semibold">ตัวอย่างที่ใช้อ้างอิง</div>
                <select
                  value={user?.example_selection_mode ?? "latest"}
                  onChange={(e) =>
                    changeExampleSelectionMode(e.target.value as ExampleSelectionMode)
                  }
                  className="w-full rounded-xl border border-border bg-input p-3 text-sm outline-none focus:border-teal"
                >
                  {Object.entries(exampleSelectionModeLabel).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {showShortPromptWarning ? (
              <div className="mt-6 rounded-xl border border-dashed border-gold/50 bg-gold/10 p-4">
                <div className="flex gap-2 text-sm">
                  <Info className="h-4 w-4 shrink-0 text-gold" />
                  <span>
                    {prompt.trim().length === 0
                      ? "พิมพ์อะไรสักหน่อยนะคะ อยากโพสต์เรื่องอะไรวันนี้"
                      : "เพิ่มรายละเอียดหน่อยมั้ยคะ เช่น ชื่อเมนู ราคา จะได้โพสต์ตรงใจร้านมากขึ้น"}
                  </span>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={dismissShortPromptWarning}
                    className="rounded-full border border-border px-4 py-1.5 text-sm hover:bg-white/5"
                  >
                    เพิ่มรายละเอียด
                  </button>
                  {prompt.trim().length > 0 && (
                    <button
                      onClick={generateAnyway}
                      className="btn-gold inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm"
                    >
                      <Sparkles className="h-4 w-4" /> สร้างเลย
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <button
                onClick={handleGenerateClick}
                disabled={loading || (mode === "photo" && photoFiles.length === 0)}
                className="btn-gold mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-base disabled:opacity-60"
              >
                <Sparkles className="h-5 w-5" />
                {loading ? "กำลังสร้างโพสต์ให้อยู่ค่ะ..." : "ให้ FAHSAI ช่วยเขียน"}
              </button>
            )}
          </div>

          {/* right: result */}
          <div className="glass-card rounded-2xl p-6">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold">ผลลัพธ์จาก AI</div>
              <span className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-muted-foreground">
                {platformLabel[platform]}
              </span>
            </div>

            {loading ? (
              <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-border">
                <div className="text-center">
                  <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-teal border-t-transparent" />
                  <div className="text-sm text-muted-foreground">กำลังสร้างโพสต์ให้อยู่ค่ะ...</div>
                </div>
              </div>
            ) : caption ? (
              <>
                {resultImageUrls.length > 0 && (
                  <div
                    className={
                      "mb-3 grid gap-2 " +
                      (resultImageUrls.length === 1 ? "grid-cols-1" : "grid-cols-3")
                    }
                  >
                    {resultImageUrls.map((url, i) => (
                      <img
                        key={url + i}
                        src={url}
                        alt=""
                        className="h-32 w-full rounded-xl object-cover"
                      />
                    ))}
                  </div>
                )}
                <textarea
                  value={caption}
                  onChange={(e) => {
                    setCaption(e.target.value);
                    setApproved(false);
                  }}
                  rows={10}
                  className="w-full resize-none rounded-xl border border-border bg-input p-4 text-base leading-relaxed outline-none focus:border-teal"
                />
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={approve}
                    disabled={approved}
                    className="inline-flex items-center gap-2 rounded-full bg-success/20 px-4 py-2 text-sm text-success hover:bg-success/30 disabled:opacity-60"
                  >
                    <Check className="h-4 w-4" /> {approved ? "อนุมัติแล้ว" : "อนุมัติ"}
                  </button>
                  <button
                    onClick={generate}
                    className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm hover:bg-white/5"
                  >
                    <RefreshCw className="h-4 w-4" /> สร้างใหม่
                  </button>
                  {approved && (
                    <button
                      onClick={copy}
                      className="btn-gold inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm"
                    >
                      <Copy className="h-4 w-4" /> คัดลอกไปโพสต์
                    </button>
                  )}
                </div>

                {imagePrompt && (
                  <div className="mt-5 rounded-xl border border-dashed border-border bg-input/40 p-4">
                    <div className="mb-2 text-sm font-semibold">
                      Prompt สำหรับสร้างรูปภาพ (แก้ไขได้ก่อนคัดลอก)
                    </div>
                    <textarea
                      value={imagePrompt}
                      onChange={(e) => setImagePrompt(e.target.value)}
                      rows={3}
                      className="w-full resize-none rounded-lg border border-border bg-input p-3 text-sm leading-relaxed outline-none focus:border-teal"
                    />
                    {imagePromptTh && (
                      <>
                        <div className="mb-1 mt-3 text-xs font-semibold text-muted-foreground">
                          คำแปลไทย (อ่านอย่างเดียว)
                        </div>
                        <p className="rounded-lg border border-border/50 bg-white/5 p-3 text-sm leading-relaxed text-muted-foreground">
                          {imagePromptTh}
                        </p>
                      </>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <button
                        onClick={async () => {
                          await navigator.clipboard.writeText(imagePrompt);
                          toast.success("คัดลอก prompt แล้วค่ะ");
                        }}
                        className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm hover:bg-white/5"
                      >
                        <Copy className="h-4 w-4" /> คัดลอก prompt
                      </button>
                      <span className="text-xs text-muted-foreground">
                        เอาไปวางใน AI สร้างภาพที่ถนัดได้เลย เช่น{" "}
                        <a
                          href="https://chatgpt.com/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-teal underline hover:text-teal/80"
                        >
                          ChatGPT
                        </a>
                        ,{" "}
                        <a
                          href="https://www.bing.com/images/create"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-teal underline hover:text-teal/80"
                        >
                          Bing Image Creator
                        </a>
                        ,{" "}
                        <a
                          href="https://gemini.google.com/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-teal underline hover:text-teal/80"
                        >
                          Gemini
                        </a>
                      </span>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-border text-center">
                <Sparkles className="mb-2 h-8 w-8 text-gold" />
                <div className="text-sm text-muted-foreground">
                  กดปุ่ม "ให้ FAHSAI ช่วยเขียน" เพื่อสร้างโพสต์แรกค่ะ
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog
        open={captureOpen}
        onOpenChange={(open) => {
          if (!open) closeCaptureModal();
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>จับภาพหน้าจอ</DialogTitle>
            <DialogDescription>
              {capturedUrl
                ? "ลากบนภาพเพื่อเลือกส่วนที่ต้องการ (ไม่ลากก็ใช้เต็มภาพได้) แล้วกดยืนยัน"
                : 'เลือกหน้าต่างหรือหน้าจอที่จะแชร์ แล้วกด "ถ่ายภาพ" ตอนพร้อมค่ะ'}
            </DialogDescription>
          </DialogHeader>

          {!capturedUrl ? (
            <div className="overflow-hidden rounded-xl border border-border bg-black">
              <video ref={videoRef} autoPlay muted playsInline className="w-full" />
            </div>
          ) : (
            <div
              className="relative touch-none select-none overflow-hidden rounded-xl border border-border"
              onPointerDown={handleCropPointerDown}
              onPointerMove={handleCropPointerMove}
              onPointerUp={handleCropPointerUp}
            >
              <img
                ref={capturedImgRef}
                src={capturedUrl}
                draggable={false}
                className="block w-full"
                alt="ภาพที่จับหน้าจอ"
              />
              {cropRect && (
                <div
                  className="pointer-events-none absolute border-2 border-teal bg-teal/20"
                  style={{
                    left: cropRect.x,
                    top: cropRect.y,
                    width: cropRect.w,
                    height: cropRect.h,
                  }}
                />
              )}
            </div>
          )}

          <DialogFooter>
            {!capturedUrl ? (
              <>
                <button
                  type="button"
                  onClick={closeCaptureModal}
                  className="rounded-full border border-border px-4 py-1.5 text-sm hover:bg-white/5"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={takeSnapshot}
                  className="btn-gold inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm"
                >
                  <Camera className="h-4 w-4" /> ถ่ายภาพ
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={retakeSnapshot}
                  className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-1.5 text-sm hover:bg-white/5"
                >
                  <RotateCcw className="h-4 w-4" /> ถ่ายใหม่
                </button>
                {cropRect && (
                  <button
                    type="button"
                    onClick={() => setCropRect(null)}
                    className="rounded-full border border-border px-4 py-1.5 text-sm hover:bg-white/5"
                  >
                    ล้างการเลือก
                  </button>
                )}
                <button
                  type="button"
                  onClick={useCapturedFrame}
                  className="btn-gold inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm"
                >
                  <Check className="h-4 w-4" /> ใช้ภาพนี้
                </button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
