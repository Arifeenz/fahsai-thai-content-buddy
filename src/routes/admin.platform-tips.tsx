import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  api,
  platformLabel,
  businessCategoryLabel,
  type Platform,
  type BusinessCategory,
  type PlatformTip,
} from "@/lib/api";
import { AppShell, PageHeader } from "@/components/app-shell";
import { useRequireAdmin } from "@/lib/admin-guard";
import { Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/admin/platform-tips")({
  head: () => ({
    meta: [
      { title: "เคล็ดลับแพลตฟอร์ม — แอดมิน FAHSAI" },
      { name: "description", content: "จัดการเคล็ดลับที่แสดงให้ผู้ใช้ตอนสร้างคอนเทนต์" },
    ],
  }),
  component: AdminPlatformTipsPage,
});

const platforms: Platform[] = ["facebook", "line", "instagram", "tiktok", "youtube"];

const emptyForm = {
  id: null as number | null,
  business_category: "" as BusinessCategory | "",
  platform: "facebook" as Platform,
  caption_tip: "",
  hashtag_tip: "",
  media_tip: "",
  mistake_tip: "",
};

function AdminPlatformTipsPage() {
  const { ready } = useRequireAdmin();
  const queryClient = useQueryClient();
  const { data: tips = [] } = useQuery({
    queryKey: ["admin", "platform-tips"],
    queryFn: () => api.adminListPlatformTips(),
  });
  const [form, setForm] = useState(emptyForm);

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["admin", "platform-tips"] });
  }

  function edit(t: PlatformTip) {
    setForm({
      id: t.id,
      business_category: t.business_category ?? "",
      platform: t.platform,
      caption_tip: t.caption_tip ?? "",
      hashtag_tip: t.hashtag_tip ?? "",
      media_tip: t.media_tip ?? "",
      mistake_tip: t.mistake_tip ?? "",
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      business_category: form.business_category || undefined,
      platform: form.platform,
      caption_tip: form.caption_tip || null,
      hashtag_tip: form.hashtag_tip || null,
      media_tip: form.media_tip || null,
      mistake_tip: form.mistake_tip || null,
    };
    try {
      if (form.id) {
        await api.adminUpdatePlatformTip(form.id, payload);
        toast.success("บันทึกแล้วค่ะ");
      } else {
        await api.adminCreatePlatformTip(payload);
        toast.success("เพิ่มเคล็ดลับแล้วค่ะ");
      }
      setForm(emptyForm);
      refresh();
    } catch {
      toast.error("บันทึกไม่สำเร็จ ลองอีกครั้งนะคะ");
    }
  }

  async function remove(id: number) {
    await api.adminDeletePlatformTip(id);
    toast.success("ลบแล้วค่ะ");
    refresh();
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
        <PageHeader
          title="เคล็ดลับแพลตฟอร์ม"
          subtitle={`ทั้งหมด (${tips.length}) — ขึ้นแสดงในหน้าสร้างคอนเทนต์ของผู้ใช้`}
        />

        <form
          onSubmit={submit}
          className="glass-card mb-4 grid gap-3 rounded-2xl p-5 md:grid-cols-2"
        >
          <select
            value={form.business_category}
            onChange={(e) =>
              setForm({ ...form, business_category: e.target.value as BusinessCategory | "" })
            }
            className="rounded-full border border-border bg-input px-3 py-2 text-sm"
          >
            <option value="">ทุกประเภทธุรกิจ (ค่าเริ่มต้น)</option>
            {Object.entries(businessCategoryLabel).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={form.platform}
            onChange={(e) => setForm({ ...form, platform: e.target.value as Platform })}
            className="rounded-full border border-border bg-input px-3 py-2 text-sm"
          >
            {platforms.map((p) => (
              <option key={p} value={p}>
                {platformLabel[p]}
              </option>
            ))}
          </select>
          <input
            value={form.caption_tip}
            onChange={(e) => setForm({ ...form, caption_tip: e.target.value })}
            placeholder="เคล็ดลับเรื่องแคปชั่น"
            className="rounded-xl border border-border bg-input p-3 text-sm md:col-span-2"
          />
          <input
            value={form.hashtag_tip}
            onChange={(e) => setForm({ ...form, hashtag_tip: e.target.value })}
            placeholder="เคล็ดลับเรื่องแฮชแท็ก"
            className="rounded-xl border border-border bg-input p-3 text-sm md:col-span-2"
          />
          <input
            value={form.media_tip}
            onChange={(e) => setForm({ ...form, media_tip: e.target.value })}
            placeholder="เคล็ดลับเรื่องรูป/วิดีโอ"
            className="rounded-xl border border-border bg-input p-3 text-sm md:col-span-2"
          />
          <input
            value={form.mistake_tip}
            onChange={(e) => setForm({ ...form, mistake_tip: e.target.value })}
            placeholder="ข้อผิดพลาดที่ควรเลี่ยง"
            className="rounded-xl border border-border bg-input p-3 text-sm md:col-span-2"
          />
          <div className="flex gap-2 md:col-span-2">
            <button type="submit" className="btn-gold rounded-full px-5 py-2 text-sm">
              {form.id ? "บันทึกการแก้ไข" : "เพิ่มเคล็ดลับ"}
            </button>
            {form.id && (
              <button
                type="button"
                onClick={() => setForm(emptyForm)}
                className="rounded-full border border-border px-5 py-2 text-sm"
              >
                ยกเลิก
              </button>
            )}
          </div>
        </form>

        <div className="grid gap-3">
          {tips.map((t) => (
            <div
              key={t.id}
              className="glass-card grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 rounded-2xl p-4"
            >
              <div className="min-w-0">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[11px] text-muted-foreground">
                    {platformLabel[t.platform]}
                  </span>
                  <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[11px] text-muted-foreground">
                    {t.business_category
                      ? businessCategoryLabel[t.business_category]
                      : "ทุกประเภทธุรกิจ"}
                  </span>
                </div>
                <ul className="space-y-0.5 text-sm leading-relaxed text-foreground/90">
                  {[t.caption_tip, t.hashtag_tip, t.media_tip, t.mistake_tip]
                    .filter((v): v is string => !!v)
                    .map((v, i) => (
                      <li key={i} className="line-clamp-1">
                        • {v}
                      </li>
                    ))}
                </ul>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  onClick={() => edit(t)}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-white/5 hover:text-foreground"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => remove(t.id)}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
          {tips.length === 0 && (
            <div className="glass-card rounded-2xl p-10 text-center text-sm text-muted-foreground">
              ยังไม่มีเคล็ดลับ — เพิ่มอันแรกด้านบนได้เลยค่ะ
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
