import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
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
  Loader2,
  Clapperboard,
  CalendarPlus,
} from "lucide-react";

export const Route = createFileRoute("/create")({
  validateSearch: z.object({ date: z.string().optional(), prompt: z.string().optional() }),
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

const MONTH_LABELS = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];

function formatThaiDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return `${d.getDate()} ${MONTH_LABELS[d.getMonth()]} ${d.getFullYear() + 543}`;
}

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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: dna } = useQuery({ queryKey: ["dna"], queryFn: () => api.getDna() });
  const [mode, setMode] = useState<Mode>("idea");
  const [prompt, setPrompt] = useState("");
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoContext, setPhotoContext] = useState("");
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingPhoto, setIsDraggingPhoto] = useState(false);
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
  const [videoScript, setVideoScript] = useState<string | null>(null);
  const [videoScriptLoading, setVideoScriptLoading] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const [contentId, setContentId] = useState<string | null>(null);
  const [approved, setApproved] = useState(false);
  const [showShortPromptWarning, setShowShortPromptWarning] = useState(false);

  const categoryKey: CategoryKey = user?.business_category ?? "default";
  const { date: requestedDate, prompt: requestedPrompt } = Route.useSearch();
  // Only the fields the video-script prompt actually reads -- if these are
  // empty the script falls back to "ไม่ระบุ" and reads generic, so nudge
  // toward filling them in specifically (not the full 5-field DNA form).
  const dnaMissingForScript = dna
    ? !dna.usp?.trim() || !dna.tone?.trim() || !dna.audience?.trim()
    : false;

  useEffect(() => {
    if (requestedDate) setScheduleDate(requestedDate);
  }, [requestedDate]);

  useEffect(() => {
    if (requestedPrompt) {
      setMode("idea");
      setPrompt(requestedPrompt);
      promptRef.current?.focus();
    }
  }, [requestedPrompt]);

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
    addPhotoFiles([file]);
    closeCaptureModal();
  }

  function addPhotoFiles(incoming: File[]) {
    const images = incoming.filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) {
      if (incoming.length > 0) toast.error("แนบได้เฉพาะไฟล์รูปภาพนะคะ");
      return;
    }
    setPhotoFiles((prev) => {
      const combined = [...prev, ...images];
      if (combined.length > MAX_PHOTOS) {
        toast.error(`แนบได้สูงสุด ${MAX_PHOTOS} รูปนะคะ`);
      }
      return combined.slice(0, MAX_PHOTOS);
    });
  }

  function clearRequestedDate() {
    setScheduleDate("");
    navigate({ to: "/create", search: { prompt: requestedPrompt }, replace: true });
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
    setVideoScript(null);
    const t = toast.loading("กำลังสร้างโพสต์ให้อยู่ค่ะ...");
    try {
      if (mode === "photo" && photoFiles.length > 0) {
        const formData = new FormData();
        formData.append("platform", platform);
        formData.append("tone", tone);
        formData.append("context", photoContext);
        if (contentId) formData.append("content_id", contentId);
        photoFiles.forEach((file) => formData.append("images", file));
        const res = await api.generateFromImage(formData);
        setCaption(res.caption);
        setResultImageUrls(res.image_urls);
        setImagePrompt(null);
        setImagePromptTh(null);
        setContentId(res.content_id);
      } else {
        const res = await api.generate({
          businessId: "me",
          prompt,
          platform,
          tone,
          contentId: contentId ?? undefined,
        });
        setCaption(res.caption);
        setResultImageUrls([]);
        setImagePrompt(res.image_prompt);
        setImagePromptTh(res.image_prompt_th);
        setContentId(res.content_id);
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

  async function handleGenerateVideoScript() {
    if (!caption.trim() || videoScriptLoading) return;
    setVideoScriptLoading(true);
    const t = toast.loading("กำลังวางสคริปวิดีโอให้อยู่ค่ะ...");
    try {
      const res = await api.generateVideoScript(caption, platform, tone);
      setVideoScript(res.video_script);
      toast.success("ได้สคริปวิดีโอแล้วค่ะ ✨", { id: t });
    } catch {
      toast.error("สร้างสคริปวิดีโอไม่สำเร็จ ลองใหม่อีกครั้งนะคะ", {
        id: t,
        action: { label: "ลองใหม่", onClick: handleGenerateVideoScript },
      });
    } finally {
      setVideoScriptLoading(false);
    }
  }

  async function changeExampleSelectionMode(value: ExampleSelectionMode) {
    await api.updateExampleSelectionMode(value);
    queryClient.invalidateQueries({ queryKey: ["me"] });
  }

  async function approve() {
    if (!caption.trim() || !contentId) return;
    setApproved(true);
    await api.updateContent(contentId, { preview: caption, status: "approved" });
    toast.success("อนุมัติแล้วค่ะ พร้อมคัดลอกไปโพสต์ได้เลย ✓");
  }

  async function copy() {
    await navigator.clipboard.writeText(caption);
    if (contentId) {
      await api.updateContent(contentId, { preview: caption, status: "posted" });
      // A posted item is done — the next generation should start a fresh
      // draft instead of silently overwriting what was just published.
      setContentId(null);
    }
    toast.success("คัดลอกแล้วค่ะ ไปวางในแอปของคุณได้เลย 🎉");
  }

  async function scheduleContent() {
    if (!scheduleDate || !caption.trim() || scheduling || !contentId) return;
    setScheduling(true);
    try {
      await api.updateContent(contentId, {
        preview: caption,
        status: "approved",
        scheduled_date: scheduleDate,
      });
      toast.success('เตรียมไว้ในตารางโพสต์แล้วค่ะ ✅ ดูได้ที่เมนู "ตารางโพสต์"');
      setScheduleDate("");
      // Same reasoning as copy(): this item is now claimed for a specific
      // date, so further regeneration shouldn't be able to overwrite it.
      setContentId(null);
    } catch {
      toast.error("บันทึกลงตารางโพสต์ไม่สำเร็จ ลองใหม่อีกครั้งนะคะ");
    } finally {
      setScheduling(false);
    }
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

        {requestedDate && (
          <div className="mb-6 flex flex-wrap items-center gap-2 rounded-xl border border-teal/30 bg-teal/10 px-4 py-2.5 text-sm text-teal">
            <CalendarPlus className="h-4 w-4 shrink-0" />
            กำลังเตรียมโพสต์สำหรับ {formatThaiDate(requestedDate)}
            <button
              type="button"
              onClick={clearRequestedDate}
              className="ml-auto shrink-0 text-xs underline hover:text-teal/80"
            >
              เปลี่ยนวันที่
            </button>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {/* left: form */}
          <div className="glass-card rounded-2xl p-6">
            <div className="mb-4 flex gap-2">
              <button
                onClick={() => {
                  setMode("idea");
                  setShowShortPromptWarning(false);
                  setContentId(null);
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
                  setContentId(null);
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
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDraggingPhoto(true);
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      setIsDraggingPhoto(false);
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDraggingPhoto(false);
                    addPhotoFiles(Array.from(e.dataTransfer.files));
                  }}
                  className={
                    "grid grid-cols-2 gap-2 rounded-xl transition " +
                    (isDraggingPhoto ? "ring-2 ring-teal ring-offset-2 ring-offset-background" : "")
                  }
                >
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-input/40 px-4 py-6 text-sm text-muted-foreground hover:text-foreground">
                    <ImagePlus className="h-5 w-5" />
                    {photoFiles.length > 0
                      ? `เลือกแล้ว ${photoFiles.length} รูป`
                      : "แตะเพื่อเลือกรูปภาพ หรือลากมาวางตรงนี้"}
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        addPhotoFiles(Array.from(e.target.files ?? []));
                        e.target.value = "";
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
              <div className="mb-2 text-sm font-semibold">สไตล์การเขียน</div>
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
                    setVideoScript(null);
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

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
                  <input
                    type="date"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    className="rounded-full border border-border bg-input px-3 py-1.5 text-sm outline-none focus:border-teal"
                  />
                  <button
                    type="button"
                    onClick={scheduleContent}
                    disabled={!scheduleDate || scheduling}
                    className="inline-flex items-center gap-2 rounded-full border border-dashed border-teal px-4 py-2 text-sm text-teal hover:bg-teal/10 disabled:opacity-60"
                  >
                    <CalendarPlus className="h-4 w-4" />
                    {scheduling ? "กำลังบันทึก..." : "เตรียมไว้สำหรับวันที่นี้"}
                  </button>
                  <span className="w-full text-xs text-muted-foreground">
                    ไม่โพสต์ทันที แค่เก็บไว้ในตารางโพสต์ รอถึงวันนั้นค่อยมาคัดลอกไปโพสต์เอง
                  </span>
                </div>

                <div className="mt-5 rounded-2xl border border-teal/25 bg-gradient-to-br from-teal/10 via-transparent to-gold/10 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-gold/30 to-teal/30 text-gold">
                        <Clapperboard className="h-4.5 w-4.5" />
                      </div>
                      <div className="text-sm font-semibold">สคริปวิดีโอสั้น</div>
                    </div>
                    {!videoScript && (
                      <button
                        type="button"
                        onClick={handleGenerateVideoScript}
                        disabled={videoScriptLoading}
                        className="btn-gold inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs disabled:opacity-60"
                      >
                        {videoScriptLoading ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Clapperboard className="h-3.5 w-3.5" />
                        )}
                        {videoScriptLoading ? "กำลังวางสคริป..." : "สร้างสคริปวิดีโอสั้น"}
                      </button>
                    )}
                  </div>

                  {videoScript ? (
                    <>
                      <textarea
                        value={videoScript}
                        onChange={(e) => setVideoScript(e.target.value)}
                        rows={8}
                        className="mt-3 w-full resize-none rounded-lg border border-border bg-input p-3 text-sm leading-relaxed outline-none focus:border-teal"
                      />
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <button
                          onClick={async () => {
                            await navigator.clipboard.writeText(videoScript);
                            toast.success("คัดลอกสคริปวิดีโอแล้วค่ะ");
                          }}
                          className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm hover:bg-white/5"
                        >
                          <Copy className="h-4 w-4" /> คัดลอกสคริป
                        </button>
                        <button
                          onClick={handleGenerateVideoScript}
                          disabled={videoScriptLoading}
                          className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm hover:bg-white/5 disabled:opacity-60"
                        >
                          <RefreshCw className="h-4 w-4" /> วางสคริปใหม่
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="mt-2 pl-12 text-xs text-muted-foreground">
                        ใช้บุคลิก จุดเด่น และตัวอย่างโพสต์ของร้านคุณช่วยวางบท ให้ได้สคริปที่เป็นเสียงของร้านคุณจริงๆ
                        ไม่ใช่บทถ่ายวิดีโอทั่วไป
                      </p>
                      {dnaMissingForScript && (
                        <p className="mt-2 pl-12 text-xs text-gold">
                          <Link to="/brand-dna" className="underline hover:text-gold/80">
                            เติมอัตลักษณ์แบรนด์ให้ครบ
                          </Link>{" "}
                          ก่อน จะได้สคริปที่เป็นตัวคุณมากขึ้น
                        </p>
                      )}
                    </>
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
