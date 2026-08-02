import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { api, type Platform, type Tone, platformLabel } from "@/lib/api";
import { AppShell, PageHeader } from "@/components/app-shell";
import { useRequireAuth } from "@/lib/auth-guard";
import {
  Sparkles,
  Check,
  RefreshCw,
  Copy,
  Facebook,
  Instagram,
  MessageCircle,
  ImagePlus,
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

type Mode = "idea" | "photo";

function CreateContent() {
  const { ready } = useRequireAuth();
  const [mode, setMode] = useState<Mode>("idea");
  const [prompt, setPrompt] = useState("โปรโมชั่นหน้าร้อนสำหรับเมนูกาแฟส้ม");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoContext, setPhotoContext] = useState("");
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [platform, setPlatform] = useState<Platform>("facebook");
  const [tone, setTone] = useState<Tone>("friendly");
  const [loading, setLoading] = useState(false);
  const [caption, setCaption] = useState<string>("");
  const [resultImageUrl, setResultImageUrl] = useState<string | null>(null);
  const [imagePrompt, setImagePrompt] = useState<string | null>(null);
  const [approved, setApproved] = useState(false);

  async function generate() {
    if (mode === "photo" && !photoFile) return;
    setLoading(true);
    setApproved(false);
    const t = toast.loading("กำลังสร้างโพสต์ให้อยู่ค่ะ...");
    try {
      if (mode === "photo" && photoFile) {
        const formData = new FormData();
        formData.append("platform", platform);
        formData.append("tone", tone);
        formData.append("context", photoContext);
        formData.append("image", photoFile);
        const res = await api.generateFromImage(formData);
        setCaption(res.caption);
        setResultImageUrl(res.image_url);
        setImagePrompt(null);
      } else {
        const res = await api.generate({ businessId: "me", prompt, platform, tone });
        setCaption(res.caption);
        setResultImageUrl(null);
        setImagePrompt(res.image_prompt);
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

  async function approve() {
    if (!caption.trim()) return;
    setApproved(true);
    await api.saveContent({ platform, preview: caption, status: "approved" });
    toast.success("อนุมัติแล้วค่ะ พร้อมคัดลอกไปโพสต์ได้เลย ✓");
  }

  async function copy() {
    await navigator.clipboard.writeText(caption);
    await api.saveContent({ platform, preview: caption, status: "posted" });
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
                onClick={() => setMode("idea")}
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
                onClick={() => setMode("photo")}
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
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={4}
                  placeholder="เช่น อยากได้โพสต์ชวนคนมาลองเมนูใหม่ กาแฟส้ม ช่วงบ่ายลด 20%"
                  className="w-full resize-none rounded-xl border border-border bg-input p-3 text-base outline-none placeholder:text-muted-foreground focus:border-teal"
                />
              </>
            ) : (
              <>
                <label className="mb-2 block text-sm font-semibold">แนบรูปภาพที่จะโพสต์</label>
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-input/40 px-4 py-6 text-sm text-muted-foreground hover:text-foreground">
                  <ImagePlus className="h-5 w-5" />
                  {photoFile ? photoFile.name : "แตะเพื่อเลือกรูปภาพ"}
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                  />
                </label>
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

            <button
              onClick={generate}
              disabled={loading || (mode === "photo" && !photoFile)}
              className="btn-gold mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-base disabled:opacity-60"
            >
              <Sparkles className="h-5 w-5" />
              {loading ? "กำลังสร้างโพสต์ให้อยู่ค่ะ..." : "ให้ FAHSAI ช่วยเขียน"}
            </button>
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
                {resultImageUrl && (
                  <img
                    src={resultImageUrl}
                    alt=""
                    className="mb-3 h-32 w-full rounded-xl object-cover"
                  />
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
                      Prompt สำหรับสร้างรูปภาพ (ถ้าต้องการ)
                    </div>
                    <p className="text-sm leading-relaxed text-muted-foreground">{imagePrompt}</p>
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
                        เอาไปวางใน AI สร้างภาพที่ถนัดได้เลย เช่น ChatGPT, Bing Image Creator, Gemini
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
    </AppShell>
  );
}
