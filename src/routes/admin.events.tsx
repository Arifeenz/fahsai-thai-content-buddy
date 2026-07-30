import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, type EventItem } from "@/lib/api";
import { AppShell, PageHeader } from "@/components/app-shell";
import { useRequireAdmin } from "@/lib/admin-guard";
import { Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/admin/events")({
  head: () => ({
    meta: [
      { title: "วันสำคัญ — แอดมิน FAHSAI" },
      { name: "description", content: "จัดการวันสำคัญกลางของระบบ" },
    ],
  }),
  component: AdminEventsPage,
});

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

const emptyEventForm = {
  id: null as number | null,
  name: "",
  month: 1,
  day: 1,
  suggestion_text: "",
};

function AdminEventsPage() {
  const { ready } = useRequireAdmin();
  const queryClient = useQueryClient();
  const { data: events = [] } = useQuery({
    queryKey: ["admin", "events"],
    queryFn: () => api.adminListEvents(),
  });
  const [form, setForm] = useState(emptyEventForm);

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["admin", "events"] });
  }

  function edit(ev: EventItem) {
    setForm({
      id: ev.id,
      name: ev.name,
      month: ev.month,
      day: ev.day,
      suggestion_text: ev.suggestion_text,
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      name: form.name,
      month: form.month,
      day: form.day,
      suggestion_text: form.suggestion_text,
    };
    try {
      if (form.id) {
        await api.adminUpdateEvent(form.id, payload);
        toast.success("บันทึกแล้วค่ะ");
      } else {
        await api.adminCreateEvent(payload);
        toast.success("เพิ่มวันสำคัญแล้วค่ะ");
      }
      setForm(emptyEventForm);
      refresh();
    } catch {
      toast.error("บันทึกไม่สำเร็จ ลองอีกครั้งนะคะ");
    }
  }

  async function remove(id: number) {
    await api.adminDeleteEvent(id);
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
        <PageHeader title="วันสำคัญ" subtitle={`วันสำคัญกลางของระบบ (${events.length})`} />

        <form
          onSubmit={submit}
          className="glass-card mb-4 grid gap-3 rounded-2xl p-5 md:grid-cols-2"
        >
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            placeholder="ชื่อวันสำคัญ เช่น วันแม่แห่งชาติ"
            className="rounded-full border border-border bg-input px-3 py-2 text-sm md:col-span-2"
          />
          <select
            value={form.month}
            onChange={(e) => setForm({ ...form, month: Number(e.target.value) })}
            className="rounded-full border border-border bg-input px-3 py-2 text-sm"
          >
            {MONTH_LABELS.map((label, i) => (
              <option key={label} value={i + 1}>
                {label}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            max={31}
            value={form.day}
            onChange={(e) => setForm({ ...form, day: Number(e.target.value) })}
            className="rounded-full border border-border bg-input px-3 py-2 text-sm"
          />
          <textarea
            value={form.suggestion_text}
            onChange={(e) => setForm({ ...form, suggestion_text: e.target.value })}
            required
            rows={3}
            placeholder="ข้อความแนะนำที่จะโชว์บนแดชบอร์ด..."
            className="rounded-xl border border-border bg-input p-3 text-sm md:col-span-2"
          />
          <div className="flex gap-2 md:col-span-2">
            <button type="submit" className="btn-gold rounded-full px-5 py-2 text-sm">
              {form.id ? "บันทึกการแก้ไข" : "เพิ่มวันสำคัญ"}
            </button>
            {form.id && (
              <button
                type="button"
                onClick={() => setForm(emptyEventForm)}
                className="rounded-full border border-border px-5 py-2 text-sm"
              >
                ยกเลิก
              </button>
            )}
          </div>
        </form>

        <div className="grid gap-3">
          {events.map((ev) => (
            <div
              key={ev.id}
              className="glass-card grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 rounded-2xl p-4"
            >
              <div className="min-w-0">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[11px] text-muted-foreground">
                    {MONTH_LABELS[ev.month - 1]} {ev.day}
                  </span>
                  <span className="font-medium">{ev.name}</span>
                </div>
                <div className="line-clamp-2 text-sm text-muted-foreground">
                  {ev.suggestion_text}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  onClick={() => edit(ev)}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-white/5 hover:text-foreground"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => remove(ev.id)}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
          {events.length === 0 && (
            <div className="glass-card rounded-2xl p-10 text-center text-sm text-muted-foreground">
              ยังไม่มีวันสำคัญ — เพิ่มอันแรกด้านบนได้เลยค่ะ
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
