import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Camera, RotateCcw, Check } from "lucide-react";

// JPEG, not PNG: the backend rejects uploads over its size cap *before* it
// re-compresses them, and a raw PNG screen capture blows past that easily.
const CAPTURE_JPEG_QUALITY = 0.9;

/**
 * Shared "capture a browser tab/window, optionally crop, use the frame as a
 * File" flow. Call `startScreenCapture()` from a button, render
 * `captureDialog` somewhere in the tree, and `onCaptured` fires with the
 * resulting JPEG File once the user confirms.
 */
export function useScreenCapture(onCaptured: (file: File) => void) {
  const [captureOpen, setCaptureOpen] = useState(false);
  const [captureStream, setCaptureStream] = useState<MediaStream | null>(null);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [cropRect, setCropRect] = useState<{ x: number; y: number; w: number; h: number } | null>(
    null,
  );
  const [cropDragStart, setCropDragStart] = useState<{ x: number; y: number } | null>(null);
  // The video element has a stream attached but needs a beat to actually
  // start decoding frames before videoWidth/videoHeight are non-zero --
  // clicking "ถ่ายภาพ" before that point used to silently no-op with zero
  // feedback, which read as the whole capture flow being stuck.
  const [videoReady, setVideoReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const capturedImgRef = useRef<HTMLImageElement>(null);
  const captureStreamRef = useRef<MediaStream | null>(null);

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
      setVideoReady(false);
      setCaptureOpen(true);
    } catch (err) {
      if (err instanceof DOMException && err.name === "NotAllowedError") return;
      toast.error("จับภาพหน้าจอไม่สำเร็จ ลองอีกครั้งนะคะ");
    }
  }

  function takeSnapshot() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) {
      toast.error("วิดีโอยังโหลดไม่เสร็จ รอสักครู่แล้วลองใหม่นะคะ");
      return;
    }
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
    onCaptured(file);
    closeCaptureModal();
  }

  const captureDialog = (
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
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              onLoadedMetadata={() => setVideoReady(true)}
              className="w-full"
            />
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
                disabled={!videoReady}
                className="btn-gold inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Camera className="h-4 w-4" /> {videoReady ? "ถ่ายภาพ" : "กำลังโหลด..."}
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
  );

  return { startScreenCapture, captureDialog };
}
