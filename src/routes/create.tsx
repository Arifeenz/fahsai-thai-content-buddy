import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
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
                    เพิ่มรายละเอียดหน่อยมั้ยคะ เช่น ชื่อเมนู ราคา จะได้โพสต์ตรงใจร้านมากขึ้น
                  </span>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={dismissShortPromptWarning}
                    className="rounded-full border border-border px-4 py-1.5 text-sm hover:bg-white/5"
                  >
                    เพิ่มรายละเอียด
                  </button>
                  <button
                    onClick={generateAnyway}
                    className="btn-gold inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm"
                  >
                    <Sparkles className="h-4 w-4" /> สร้างเลย
                  </button>
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
    </AppShell>
  );
}
