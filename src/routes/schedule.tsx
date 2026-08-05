import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, platformLabel, type ContentItem } from "@/lib/api";
import { AppShell, PageHeader } from "@/components/app-shell";
import { useRequireAuth } from "@/lib/auth-guard";
import { StatusBadge } from "./dashboard";
import { CalendarPlus, Copy, Trash2, PartyPopper } from "lucide-react";

export const Route = createFileRoute("/schedule")({
  head: () => ({
    meta: [
      { title: "ตารางโพสต์ — FAHSAI" },
      { name: "description", content: "เตรียมคอนเทนต์ล่วงหน้าตามวันที่ รอถึงวันแล้วค่อยโพสต์" },
      { property: "og:title", content: "ตารางโพสต์ — FAHSAI" },
      {
        property: "og:description",
        content: "เตรียมคอนเทนต์ล่วงหน้าตามวันที่ รอถึงวันแล้วค่อยโพสต์",
      },
    ],
  }),
  component: SchedulePage,
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

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDaysIso(daysFromToday: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatThaiDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return `${d.getDate()} ${MONTH_LABELS[d.getMonth()]} ${d.getFullYear() + 543}`;
}

interface DateGroup {
  date: string;
  isToday: boolean;
  eventNames: string[];
  items: ContentItem[];
}

function SchedulePage() {
  const { ready } = useRequireAuth();
  const queryClient = useQueryClient();
  const { data: items = [] } = useQuery({
    queryKey: ["content"],
    queryFn: () => api.listContent(),
  });
  const { data: events = [] } = useQuery({ queryKey: ["events"], queryFn: () => api.listEvents() });

  const groups = useMemo(() => {
    const today = todayIso();
    const map = new Map<string, DateGroup>();
    const getGroup = (date: string) => {
      let group = map.get(date);
      if (!group) {
        group = { date, isToday: date === today, eventNames: [], items: [] };
        map.set(date, group);
      }
      return group;
    };
    for (const it of items) {
      if (!it.scheduledDate) continue;
      getGroup(it.scheduledDate).items.push(it);
    }
    for (const ev of events) {
      getGroup(addDaysIso(ev.days_until)).eventNames.push(ev.name);
    }
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [items, events]);

  const rescheduleMutation = useMutation({
    mutationFn: ({ id, date }: { id: string; date: string }) => api.updateContentSchedule(id, date),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content"] });
      toast.success("เลื่อนวันแล้วค่ะ");
    },
    onError: () => toast.error("เลื่อนวันไม่สำเร็จ ลองใหม่อีกครั้งนะคะ"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteContent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content"] });
      toast.success("ลบออกจากตารางโพสต์แล้วค่ะ");
    },
    onError: () => toast.error("ลบไม่สำเร็จ ลองใหม่อีกครั้งนะคะ"),
  });

  async function copyAndMarkPosted(item: ContentItem) {
    await navigator.clipboard.writeText(item.preview);
    try {
      await api.markContentPosted(item.id);
      queryClient.invalidateQueries({ queryKey: ["content"] });
      toast.success("คัดลอกแล้วค่ะ ไปวางในแอปของคุณได้เลย 🎉");
    } catch {
      toast.error("คัดลอกสำเร็จ แต่บันทึกสถานะไม่สำเร็จ ลองรีเฟรชนะคะ");
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
        <PageHeader
          title="ตารางโพสต์"
          subtitle="เตรียมคอนเทนต์ล่วงหน้าตามวันที่ รอถึงวันแล้วค่อยโพสต์"
        />

        <Link
          to="/create"
          className="btn-gold mb-6 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm"
        >
          <CalendarPlus className="h-4 w-4" /> วางแผนโพสต์ใหม่
        </Link>

        {groups.length === 0 ? (
          <div className="glass-card rounded-2xl p-10 text-center text-sm text-muted-foreground">
            ยังไม่มีคอนเทนต์ที่เตรียมไว้ล่วงหน้าค่ะ กด "วางแผนโพสต์ใหม่" ด้านบนเพื่อเริ่มได้เลย
          </div>
        ) : (
          <div className="grid gap-3">
            {groups.map((group) => (
              <div key={group.date} className="glass-card rounded-2xl p-5">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="font-bold">{formatThaiDate(group.date)}</span>
                  {group.isToday && (
                    <span className="rounded-full bg-teal/15 px-2.5 py-0.5 text-[11px] font-semibold text-teal">
                      วันนี้!
                    </span>
                  )}
                  {group.eventNames.map((name) => (
                    <span
                      key={name}
                      className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2.5 py-0.5 text-[11px] text-gold"
                    >
                      <PartyPopper className="h-3 w-3" /> {name}
                    </span>
                  ))}
                </div>

                {group.items.length === 0 ? (
                  <Link
                    to="/create"
                    search={{ date: group.date }}
                    className="inline-flex items-center gap-1.5 text-xs text-teal hover:underline"
                  >
                    <CalendarPlus className="h-3.5 w-3.5" /> วางแผนโพสต์สำหรับวันนี้
                  </Link>
                ) : (
                  <div className="grid gap-2">
                    {group.items.map((it) => (
                      <div key={it.id} className="rounded-xl border border-border bg-input/40 p-3">
                        <div className="mb-1.5 flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[11px] text-muted-foreground">
                            {platformLabel[it.platform]}
                          </span>
                          <StatusBadge status={it.status} />
                        </div>
                        <div className="line-clamp-2 text-sm leading-relaxed">{it.preview}</div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {it.status !== "posted" && (
                            <button
                              onClick={() => copyAndMarkPosted(it)}
                              className="btn-gold inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs"
                            >
                              <Copy className="h-3.5 w-3.5" /> คัดลอกไปโพสต์
                            </button>
                          )}
                          <input
                            type="date"
                            value={it.scheduledDate ?? ""}
                            onChange={(e) =>
                              rescheduleMutation.mutate({ id: it.id, date: e.target.value })
                            }
                            className="rounded-full border border-border bg-input px-2.5 py-1 text-xs outline-none focus:border-teal"
                          />
                          <button
                            onClick={() => deleteMutation.mutate(it.id)}
                            title="ลบออกจากตารางโพสต์"
                            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
