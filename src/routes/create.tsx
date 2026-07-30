import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { api, type Platform, type Tone, platformLabel } from "@/lib/api";
import { AppShell, PageHeader } from "@/components/app-shell";
import { useRequireAuth } from "@/lib/auth-guard";
import { Sparkles, Check, RefreshCw, Copy, Facebook, Instagram, MessageCircle } from "lucide-react";

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

function CreateContent() {
  const { ready } = useRequireAuth();
  const [prompt, setPrompt] = useState("โปรโมชั่นหน้าร้อนสำหรับเมนูกาแฟส้ม");
  const [platform, setPlatform] = useState<Platform>("facebook");
  const [tone, setTone] = useState<Tone>("friendly");
  const [loading, setLoading] = useState(false);
  const [caption, setCaption] = useState<string>("");
  const [approved, setApproved] = useState(false);

  async function generate() {
    setLoading(true);
    setApproved(false);
    const t = toast.loading("กำลังสร้างโพสต์ให้อยู่ค่ะ...");
    try {
      const res = await api.generate({ businessId: "me", prompt, platform, tone });
      setCaption(res.caption);
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
    await api.saveContent({ platform, preview: caption.slice(0, 80), status: "approved" });
    toast.success("อนุมัติแล้วค่ะ พร้อมคัดลอกไปโพสต์ได้เลย ✓");
  }

  async function copy() {
    await navigator.clipboard.writeText(caption);
    await api.saveContent({ platform, preview: caption.slice(0, 80), status: "posted" });
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
            <label className="mb-2 block text-sm font-semibold">อยากโพสต์อะไรวันนี้?</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              placeholder="เช่น อยากได้โพสต์ชวนคนมาลองเมนูใหม่ กาแฟส้ม ช่วงบ่ายลด 20%"
              className="w-full resize-none rounded-xl border border-border bg-input p-3 text-base outline-none placeholder:text-muted-foreground focus:border-teal"
            />

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
              disabled={loading}
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
