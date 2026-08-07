import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, platformLabel, type ContentItem, type EventItem } from "@/lib/api";
import { AppShell, PageHeader } from "@/components/app-shell";
import { useRequireAuth } from "@/lib/auth-guard";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { StatusBadge } from "./dashboard";
import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Copy,
  Trash2,
  PartyPopper,
  Sparkles,
} from "lucide-react";

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
// lg breakpoint (Tailwind default) -- below this, a tapped day opens the
// detail sheet instead of relying on the always-visible desktop panel.
const DESKTOP_BREAKPOINT_PX = 1024;

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
  events: EventItem[];
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
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  const groupsByDate = useMemo(() => {
    const today = todayIso();
    const map = new Map<string, DateGroup>();
    const getGroup = (date: string) => {
      let group = map.get(date);
      if (!group) {
        group = { date, isToday: date === today, events: [], items: [] };
        map.set(date, group);
      }
      return group;
    };
    for (const it of items) {
      if (!it.scheduledDate) continue;
      getGroup(it.scheduledDate).items.push(it);
    }
    for (const ev of events) {
      getGroup(addDaysIso(ev.days_until)).events.push(ev);
    }
    return map;
  }, [items, events]);

  const calendarCells = useMemo(() => buildCalendarCells(viewDate), [viewDate]);
  const selectedGroup: DateGroup = groupsByDate.get(selectedDate) ?? {
    date: selectedDate,
    isToday: selectedDate === todayIso(),
    events: [],
    items: [],
  };
  const primaryEvent = selectedGroup.events[0];

  const { data: eventHeadline, isFetching: headlineLoading } = useQuery({
    queryKey: ["event-headline", primaryEvent?.id],
    queryFn: () => api.getEventHeadline(primaryEvent!.id),
    enabled: !!primaryEvent,
  });

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
  function selectDate(iso: string) {
    setSelectedDate(iso);
    // Desktop already shows the panel inline beside the calendar -- only
    // pop the sheet open on narrow screens where that panel isn't visible
    // without scrolling.
    if (typeof window !== "undefined" && window.innerWidth < DESKTOP_BREAKPOINT_PX) {
      setMobileDetailOpen(true);
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

  const eventBadges = (
    <>
      {selectedGroup.isToday && (
        <span className="rounded-full bg-teal/15 px-2.5 py-0.5 text-[11px] font-semibold text-teal">
          วันนี้!
        </span>
      )}
      {selectedGroup.events.map((ev) => (
        <span
          key={ev.id}
          className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2.5 py-0.5 text-[11px] text-gold"
        >
          <PartyPopper className="h-3 w-3" /> {ev.name}
        </span>
      ))}
    </>
  );

  const headlineBlock = primaryEvent && (
    <div className="mb-3 rounded-xl border border-dashed border-gold/40 bg-gold/5 p-3">
      {headlineLoading ? (
        <p className="text-xs text-muted-foreground">กำลังคิดไอเดียให้อยู่ค่ะ...</p>
      ) : eventHeadline ? (
        <>
          <p className="mb-2 text-sm leading-relaxed">{eventHeadline}</p>
          <Link
            to="/create"
            search={{ date: selectedGroup.date, prompt: eventHeadline }}
            className="btn-gold inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs"
          >
            <Sparkles className="h-3.5 w-3.5" /> ใช้ไอเดียนี้
          </Link>
        </>
      ) : null}
    </div>
  );

  const itemsBlock =
    selectedGroup.items.length === 0 ? (
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
                onChange={(e) => rescheduleMutation.mutate({ id: it.id, date: e.target.value })}
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
    );

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

        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr] lg:items-start">
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
                const hasEvent = cell.inMonth && !!group?.events.length;
                const isToday = cell.iso === todayIso();
                const isSelected = cell.iso === selectedDate;
                return (
                  <button
                    key={cell.iso}
                    type="button"
                    disabled={!cell.inMonth}
                    onClick={() => selectDate(cell.iso)}
                    aria-current={isToday ? "date" : undefined}
                    aria-pressed={isSelected}
                    className={
                      "flex min-h-[60px] flex-col items-start gap-1 rounded-lg p-1.5 text-left text-xs transition md:min-h-[84px] " +
                      (!cell.inMonth
                        ? "text-muted-foreground/25"
                        : isSelected
                          ? "bg-teal/10 ring-1 ring-teal"
                          : "hover:bg-white/5")
                    }
                  >
                    <span
                      className={
                        "grid h-5 w-5 shrink-0 place-items-center rounded-full " +
                        (isToday ? "bg-teal font-bold text-teal-foreground" : "")
                      }
                    >
                      {cell.day}
                    </span>
                    {cell.inMonth && (hasEvent || hasContent) && (
                      <div className="flex w-full min-w-0 flex-col gap-0.5">
                        <div className="flex gap-1 md:hidden">
                          {hasEvent && <span className="h-1.5 w-1.5 rounded-full bg-gold" />}
                          {hasContent && <span className="h-1.5 w-1.5 rounded-full bg-teal" />}
                        </div>
                        <div className="hidden md:flex md:flex-col md:gap-0.5">
                          {group?.events.slice(0, 2).map((ev) => (
                            <span
                              key={ev.id}
                              className="truncate rounded bg-gold/20 px-1 py-0.5 text-[10px] leading-tight text-gold"
                            >
                              {ev.name}
                            </span>
                          ))}
                          {hasContent && (
                            <span className="truncate rounded bg-teal/20 px-1 py-0.5 text-[10px] leading-tight text-teal">
                              มีคอนเทนต์ {group?.items.length} รายการ
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Desktop: panel sits inline beside the calendar, always visible */}
          <div className="glass-card hidden rounded-2xl p-5 lg:block">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="font-bold">{formatThaiDate(selectedGroup.date)}</span>
              {eventBadges}
            </div>
            {headlineBlock}
            {itemsBlock}
          </div>
        </div>

        {/* Mobile: same detail content, surfaced as a sheet on tap instead
            of requiring a scroll down to a panel below the calendar */}
        <Drawer open={mobileDetailOpen} onOpenChange={setMobileDetailOpen}>
          <DrawerContent className="lg:hidden">
            <div className="px-4 pb-6 pt-2">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <DrawerTitle className="text-base font-bold">
                  {formatThaiDate(selectedGroup.date)}
                </DrawerTitle>
                {eventBadges}
              </div>
              {headlineBlock}
              {itemsBlock}
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    </AppShell>
  );
}
