import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  api,
  platformLabel,
  businessCategoryLabel,
  type Platform,
  type Tone,
  type BusinessCategory,
  type PromptTemplate,
} from "@/lib/api";
import { AppShell, PageHeader } from "@/components/app-shell";
import { useRequireAdmin } from "@/lib/admin-guard";
import { Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/admin/templates")({
  head: () => ({
    meta: [
      { title: "Prompt Templates — แอดมิน FAHSAI" },
      { name: "description", content: "จัดการ prompt template สำหรับสร้างคอนเทนต์" },
    ],
  }),
  component: AdminTemplatesPage,
});

const platforms: Platform[] = ["facebook", "line", "instagram", "tiktok", "youtube"];
const tones: Tone[] = ["friendly", "professional", "playful", "promo"];

const emptyForm = {
  id: null as number | null,
  business_category: "" as BusinessCategory | "",
  platform: "facebook" as Platform,
  tone: "" as Tone | "",
  template_text: "",
};

function AdminTemplatesPage() {
  const { ready } = useRequireAdmin();
  const queryClient = useQueryClient();
  const { data: templates = [] } = useQuery({
    queryKey: ["admin", "prompt-templates"],
    queryFn: () => api.adminListPromptTemplates(),
  });
  const [form, setForm] = useState(emptyForm);

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["admin", "prompt-templates"] });
  }

  function edit(t: PromptTemplate) {
    setForm({
      id: t.id,
      business_category: t.business_category ?? "",
      platform: t.platform,
      tone: t.tone ?? "",
      template_text: t.template_text,
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      business_category: form.business_category || undefined,
      platform: form.platform,
      tone: form.tone || undefined,
      template_text: form.template_text,
    };
    try {
      if (form.id) {
        await api.adminUpdatePromptTemplate(form.id, payload);
        toast.success("บันทึกแล้วค่ะ");
      } else {
        await api.adminCreatePromptTemplate(payload);
        toast.success("เพิ่ม template แล้วค่ะ");
      }
      setForm(emptyForm);
      refresh();
    } catch {
      toast.error("บันทึกไม่สำเร็จ ลองอีกครั้งนะคะ");
    }
  }

  async function remove(id: number) {
    await api.adminDeletePromptTemplate(id);
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
        <PageHeader title="Prompt Templates" subtitle={`ทั้งหมด (${templates.length})`} />

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
            <option value="">ทุกประเภทธุรกิจ</option>
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
          <select
            value={form.tone}
            onChange={(e) => setForm({ ...form, tone: e.target.value as Tone | "" })}
            className="rounded-full border border-border bg-input px-3 py-2 text-sm md:col-span-2"
          >
            <option value="">ทุกโทน</option>
            {tones.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <textarea
            value={form.template_text}
            onChange={(e) => setForm({ ...form, template_text: e.target.value })}
            required
            rows={4}
            placeholder="ข้อความตัวอย่างโพสต์..."
            className="rounded-xl border border-border bg-input p-3 text-sm md:col-span-2"
          />
          <div className="flex gap-2 md:col-span-2">
            <button type="submit" className="btn-gold rounded-full px-5 py-2 text-sm">
              {form.id ? "บันทึกการแก้ไข" : "เพิ่ม Template"}
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
          {templates.map((t) => (
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
                  {t.tone && (
                    <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[11px] text-muted-foreground">
                      {t.tone}
                    </span>
                  )}
                </div>
                <div className="line-clamp-2 text-sm leading-relaxed">{t.template_text}</div>
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
          {templates.length === 0 && (
            <div className="glass-card rounded-2xl p-10 text-center text-sm text-muted-foreground">
              ยังไม่มี prompt template — เพิ่มอันแรกด้านบนได้เลยค่ะ
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
