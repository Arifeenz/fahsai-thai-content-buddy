import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, platformLabel, type ContentItem } from "@/lib/api";
import { AppShell, PageHeader } from "@/components/app-shell";
import { useRequireAuth } from "@/lib/auth-guard";
import { StatusBadge } from "./dashboard";
import { CalendarPlus, ChevronLeft, ChevronRight, Copy, Trash2, PartyPopper } from "lucide-react";

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
const MONTH_FULL_LABELS = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];
// Sunday-first, matching the convention Thai calendars use (unlike the
// Monday-first ISO week).
const WEEKDAY_LABELS = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

function dateToIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayIso(): string {
  return dateToIso(new Date());
}

function addDaysIso(daysFromToday: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  return dateToIso(d);
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

interface CalendarCell {
  iso: string;
  day: number;
  inMonth: boolean;
}

// Builds however many full weeks (rows) are needed to cover the month --
// not padded to a fixed 6 rows, so a short month doesn't carry a blank
// trailing row.
function buildCalendarCells(viewDate: Date): CalendarCell[] {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const leadingCount = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const cells: CalendarCell[] = [];
  for (let i = leadingCount - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    cells.push({ iso: dateToIso(new Date(year, month - 1, day)), day, inMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ iso: dateToIso(new Date(year, month, day)), day, inMonth: true });
  }
  let trailDay = 1;
  while (cells.length % 7 !== 0) {
    cells.push({ iso: dateToIso(new Date(year, month + 1, trailDay)), day: trailDay, inMonth: false });
    trailDay++;
  }
  return cells;
}

function SchedulePage() {
  const { ready } = useRequireAuth();
  const queryClient = useQueryClient();
  const { data: items = [] } = useQuery({
    queryKey: ["content"],
    queryFn: () => api.listContent(),
  });
  const { data: events = [] } = useQuery({ queryKey: ["events"], queryFn: () => api.listEvents() });

  const [viewDate, setViewDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [selectedDate, setSelectedDate] = useState(() => todayIso());

  const groupsByDate = useMemo(() => {
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
    return map;
  }, [items, events]);

  const calendarCells = useMemo(() => buildCalendarCells(viewDate), [viewDate]);
  const selectedGroup: DateGroup = groupsByDate.get(selectedDate) ?? {
    date: selectedDate,
    isToday: selectedDate === todayIso(),
    eventNames: [],
    items: [],
  };

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

  function goToPrevMonth() {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }
  function goToNextMonth() {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }
  function goToToday() {
    const d = new Date();
    d.setDate(1);
    setViewDate(d);
    setSelectedDate(todayIso());
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

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goToPrevMonth}
              aria-label="เดือนก่อนหน้า"
              className="rounded-full border border-border p-2 text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[11ch] text-center text-sm font-bold">
              {MONTH_FULL_LABELS[viewDate.getMonth()]} {viewDate.getFullYear() + 543}
            </span>
            <button
              type="button"
              onClick={goToNextMonth}
              aria-label="เดือนถัดไป"
              className="rounded-full border border-border p-2 text-muted-foreground hover:text-foreground"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={goToToday}
              className="ml-1 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              วันนี้
            </button>
          </div>
          <Link
            to="/create"
            className="btn-gold inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm"
          >
            <CalendarPlus className="h-4 w-4" /> วางแผนโพสต์ใหม่
          </Link>
        </div>

        <div className="glass-card rounded-2xl p-4">
          <div className="grid grid-cols-7 gap-1 pb-2 text-center text-xs font-semibold text-muted-foreground">
            {WEEKDAY_LABELS.map((w) => (
              <div key={w}>{w}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {calendarCells.map((cell) => {
              const group = groupsByDate.get(cell.iso);
              const hasContent = cell.inMonth && !!group?.items.length;
              const hasEvent = cell.inMonth && !!group?.eventNames.length;
              const isToday = cell.iso === todayIso();
              const isSelected = cell.iso === selectedDate;
              return (
                <button
                  key={cell.iso}
                  type="button"
                  disabled={!cell.inMonth}
                  onClick={() => setSelectedDate(cell.iso)}
                  aria-current={isToday ? "date" : undefined}
                  aria-pressed={isSelected}
                  className={
                    "flex aspect-square flex-col items-center justify-center gap-1 rounded-xl text-sm transition " +
                    (!cell.inMonth
                      ? "text-muted-foreground/25"
                      : isSelected
                        ? "bg-teal font-bold text-teal-foreground"
                        : isToday
                          ? "font-semibold text-teal ring-1 ring-teal hover:bg-white/5"
                          : "text-foreground hover:bg-white/5")
                  }
                >
                  <span>{cell.day}</span>
                  <span className="flex h-1.5 items-center gap-1">
                    {hasEvent && <span className="h-1.5 w-1.5 rounded-full bg-gold" />}
                    {hasContent && (
                      <span
                        className={
                          "h-1.5 w-1.5 rounded-full " + (isSelected ? "bg-teal-foreground" : "bg-teal")
                        }
                      />
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="glass-card mt-4 rounded-2xl p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="font-bold">{formatThaiDate(selectedGroup.date)}</span>
            {selectedGroup.isToday && (
              <span className="rounded-full bg-teal/15 px-2.5 py-0.5 text-[11px] font-semibold text-teal">
                วันนี้!
              </span>
            )}
            {selectedGroup.eventNames.map((name) => (
              <span
                key={name}
                className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2.5 py-0.5 text-[11px] text-gold"
              >
                <PartyPopper className="h-3 w-3" /> {name}
              </span>
            ))}
          </div>

          {selectedGroup.items.length === 0 ? (
            <Link
              to="/create"
              search={{ date: selectedGroup.date }}
              className="inline-flex items-center gap-1.5 text-xs text-teal hover:underline"
            >
              <CalendarPlus className="h-3.5 w-3.5" /> วางแผนโพสต์สำหรับ{" "}
              {selectedGroup.isToday ? "วันนี้" : formatThaiDate(selectedGroup.date)}
            </Link>
          ) : (
            <div className="grid gap-2">
              {selectedGroup.items.map((it) => (
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
      </div>
    </AppShell>
  );
}
