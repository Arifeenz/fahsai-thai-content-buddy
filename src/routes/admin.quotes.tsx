import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, type Quote } from "@/lib/api";
import { AppShell, PageHeader } from "@/components/app-shell";
import { useRequireAdmin } from "@/lib/admin-guard";
import { Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/admin/quotes")({
  head: () => ({
    meta: [
      { title: "คำคมให้กำลังใจ — แอดมิน FAHSAI" },
      { name: "description", content: "จัดการคำคมให้กำลังใจที่โชว์บนแดชบอร์ดผู้ใช้" },
    ],
  }),
  component: AdminQuotesPage,
});

const moodLabel: Record<string, string> = {
  general: "ทั่วไป",
  discouraged: "ให้กำลังใจตอนห่างหายไปนาน",
  celebration: "ชื่นชมตอนผลตอบรับดี",
};
const moodOptions = Object.keys(moodLabel);

const emptyQuoteForm = {
  id: null as number | null,
  text: "",
  mood: "general",
};

function AdminQuotesPage() {
  const { ready } = useRequireAdmin();
  const queryClient = useQueryClient();
  const { data: quotes = [] } = useQuery({
    queryKey: ["admin", "quotes"],
    queryFn: () => api.adminListQuotes(),
  });
  const [form, setForm] = useState(emptyQuoteForm);

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["admin", "quotes"] });
  }

  function edit(q: Quote) {
    setForm({ id: q.id, text: q.text, mood: q.mood });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload = { text: form.text, mood: form.mood };
    try {
      if (form.id) {
        await api.adminUpdateQuote(form.id, payload);
        toast.success("บันทึกแล้วค่ะ");
      } else {
        await api.adminCreateQuote(payload);
        toast.success("เพิ่มคำคมแล้วค่ะ");
      }
      setForm(emptyQuoteForm);
      refresh();
    } catch {
      toast.error("บันทึกไม่สำเร็จ ลองอีกครั้งนะคะ");
    }
  }

  async function remove(id: number) {
    await api.adminDeleteQuote(id);
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
          title="คำคมให้กำลังใจ"
          subtitle={`โชว์แบบสุ่มใต้คำทักทายบนแดชบอร์ดผู้ใช้ (${quotes.length})`}
        />

        <form
          onSubmit={submit}
          className="glass-card mb-4 grid gap-3 rounded-2xl p-5 md:grid-cols-2"
        >
          <textarea
            value={form.text}
            onChange={(e) => setForm({ ...form, text: e.target.value })}
            required
            rows={3}
            placeholder="ข้อความให้กำลังใจ..."
            className="rounded-xl border border-border bg-input p-3 text-sm md:col-span-2"
          />
          <select
            value={form.mood}
            onChange={(e) => setForm({ ...form, mood: e.target.value })}
            className="rounded-full border border-border bg-input px-3 py-2 text-sm md:col-span-2"
          >
            {moodOptions.map((mood) => (
              <option key={mood} value={mood}>
                {moodLabel[mood]}
              </option>
            ))}
          </select>
          <div className="flex gap-2 md:col-span-2">
            <button type="submit" className="btn-gold rounded-full px-5 py-2 text-sm">
              {form.id ? "บันทึกการแก้ไข" : "เพิ่มคำคม"}
            </button>
            {form.id && (
              <button
                type="button"
                onClick={() => setForm(emptyQuoteForm)}
                className="rounded-full border border-border px-5 py-2 text-sm"
              >
                ยกเลิก
              </button>
            )}
          </div>
        </form>

        <div className="grid gap-3">
          {quotes.map((q) => (
            <div
              key={q.id}
              className="glass-card grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 rounded-2xl p-4"
            >
              <div className="min-w-0">
                <div className="mb-1.5">
                  <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[11px] text-muted-foreground">
                    {moodLabel[q.mood] ?? q.mood}
                  </span>
                </div>
                <div className="text-sm">{q.text}</div>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  onClick={() => edit(q)}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-white/5 hover:text-foreground"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => remove(q.id)}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
          {quotes.length === 0 && (
            <div className="glass-card rounded-2xl p-10 text-center text-sm text-muted-foreground">
              ยังไม่มีคำคม — เพิ่มอันแรกด้านบนได้เลยค่ะ
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
