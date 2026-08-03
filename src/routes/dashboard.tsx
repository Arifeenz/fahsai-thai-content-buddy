import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  api,
  platformLabel,
  statusLabel,
  type ContentFeedback,
  type ContentItem,
  type DnaDocType,
  type Platform,
} from "@/lib/api";
import { AppShell, PageHeader, useCurrentUser } from "@/components/app-shell";
import { useRequireAuth } from "@/lib/auth-guard";
import {
  TrendingUp,
  Clock,
  CalendarClock,
  Sparkles,
  ArrowRight,
  Dna,
  PartyPopper,
  CalendarDays,
  Trash2,
  Plus,
  ThumbsUp,
  ThumbsDown,
  Meh,
  Users,
  type LucideIcon,
} from "lucide-react";

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

function EventsCalendarCard() {
  const queryClient = useQueryClient();
  const user = useCurrentUser();
  const { data: events = [] } = useQuery({ queryKey: ["events"], queryFn: () => api.listEvents() });
  const [name, setName] = useState("");
  const [month, setMonth] = useState(1);
  const [day, setDay] = useState(1);

  async function addEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await api.createEvent({ name: name.trim(), month, day });
      setName("");
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast.success("เพิ่มวันสำคัญแล้วค่ะ");
    } catch {
      toast.error("เพิ่มไม่สำเร็จ ลองอีกครั้งนะคะ");
    }
  }

  async function removeEvent(id: number) {
    await api.deleteEvent(id);
    queryClient.invalidateQueries({ queryKey: ["events"] });
  }

  async function toggleHideGlobal() {
    if (!user) return;
    await api.setHideGlobalEvents(!user.hide_global_events);
    queryClient.invalidateQueries({ queryKey: ["me"] });
    queryClient.invalidateQueries({ queryKey: ["events"] });
  }

  return (
    <div className="glass-card mt-4 rounded-2xl p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-teal" />
          <h2 className="text-sm font-bold">ปฏิทินร้าน</h2>
        </div>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          ซ่อนวันของระบบ
          <input
            type="checkbox"
            checked={user?.hide_global_events ?? false}
            onChange={toggleHideGlobal}
            className="h-4 w-4 accent-teal"
          />
        </label>
      </div>
      <ul className="divide-y divide-white/5">
        {events.slice(0, 5).map((ev) => (
          <li key={ev.id} className="flex items-center justify-between gap-3 py-2">
            <div className="min-w-0 flex-1 truncate text-sm">{ev.name}</div>
            <div className="shrink-0 text-xs text-muted-foreground">
              {ev.days_until === 0 ? "วันนี้!" : `อีก ${ev.days_until} วัน`}
            </div>
            {ev.is_personal && (
              <button
                onClick={() => removeEvent(ev.id)}
                title="ลบ"
                className="shrink-0 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </li>
        ))}
        {events.length === 0 && (
          <li className="py-4 text-center text-sm text-muted-foreground">ยังไม่มีวันสำคัญค่ะ</li>
        )}
      </ul>
      <form onSubmit={addEvent} className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="เพิ่มวันสำคัญของร้าน เช่น ครบรอบร้าน"
          className="min-w-0 flex-1 rounded-full border border-border bg-input px-3 py-1.5 text-xs outline-none placeholder:text-muted-foreground focus:border-teal"
        />
        <select
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          className="rounded-full border border-border bg-input px-2 py-1.5 text-xs"
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
          value={day}
          onChange={(e) => setDay(Number(e.target.value))}
          className="w-14 rounded-full border border-border bg-input px-2 py-1.5 text-xs"
        />
        <button type="submit" className="rounded-full bg-teal/15 p-1.5 text-teal hover:bg-teal/25">
          <Plus className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}

const NUDGE_DUE_DAYS = 7;
const followerPlatforms: Platform[] = ["facebook", "line", "instagram"];

function FollowerNudgeCard() {
  const queryClient = useQueryClient();
  const { data: snapshots = [] } = useQuery({
    queryKey: ["follower-snapshots"],
    queryFn: () => api.listFollowerSnapshots(),
  });
  const [platform, setPlatform] = useState<Platform>("facebook");
  const [count, setCount] = useState("");
  const [showForm, setShowForm] = useState(false);

  const latest = snapshots[snapshots.length - 1] as (typeof snapshots)[number] | undefined;
  const daysSinceLast = latest
    ? Math.floor((Date.now() - new Date(latest.recorded_at).getTime()) / 86_400_000)
    : null;
  const isDue = daysSinceLast === null || daysSinceLast >= NUDGE_DUE_DAYS;

  const mutation = useMutation({
    mutationFn: () => api.createFollowerSnapshot(platform, Number(count)),
    onSuccess: () => {
      toast.success("บันทึกยอดผู้ติดตามแล้วค่ะ ขอบคุณที่ช่วยให้เราเห็นการเติบโตของร้านคุณ ✨");
      setCount("");
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ["follower-snapshots"] });
    },
    onError: () => toast.error("บันทึกไม่สำเร็จ ลองอีกครั้งนะคะ"),
  });

  if (latest && !isDue && !showForm) {
    return (
      <div className="glass-card mt-4 flex items-center justify-between gap-3 rounded-2xl p-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/5 text-teal">
            <Users className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold">
              {platformLabel[latest.platform]} มีผู้ติดตาม {latest.follower_count.toLocaleString()}{" "}
              คน
            </div>
            <div className="text-xs text-muted-foreground">
              อัพเดทล่าสุด {daysSinceLast} วันที่แล้ว
            </div>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="shrink-0 text-xs text-teal hover:underline"
        >
          อัพเดทตอนนี้
        </button>
      </div>
    );
  }

  return (
    <div className="glass-card mt-4 rounded-2xl p-4">
      <div className="mb-3 flex items-center gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-gold/30 to-teal/30 text-gold">
          <Users className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold">ตอนนี้มีผู้ติดตามกี่คนแล้วคะ?</div>
          <div className="text-xs text-muted-foreground">
            ช่วยให้เราเห็นว่าร้านคุณโตขึ้นจริงไหมหลังใช้ FAHSAI (ยอดที่คุณแจ้งเอง ไม่บังคับค่ะ)
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value as Platform)}
          className="rounded-full border border-border bg-input px-3 py-2 text-sm"
        >
          {followerPlatforms.map((p) => (
            <option key={p} value={p}>
              {platformLabel[p]}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={0}
          value={count}
          onChange={(e) => setCount(e.target.value)}
          placeholder="จำนวนผู้ติดตาม"
          className="w-36 rounded-full border border-border bg-input px-4 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-teal"
        />
        <button
          onClick={() => mutation.mutate()}
          disabled={!count.trim() || mutation.isPending}
          className="btn-gold rounded-full px-5 py-2 text-sm disabled:opacity-60"
        >
          บันทึก
        </button>
        {latest && (
          <button
            onClick={() => setShowForm(false)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            ปิด
          </button>
        )}
      </div>
    </div>
  );
}

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "แดชบอร์ด — FAHSAI" },
      { name: "description", content: "ภาพรวมคอนเทนต์และสุขภาพระบบของร้านคุณ" },
      { property: "og:title", content: "แดชบอร์ด — FAHSAI" },
      { property: "og:description", content: "ภาพรวมคอนเทนต์และสุขภาพระบบของร้านคุณ" },
    ],
  }),
  component: Dashboard,
});

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  accent,
  to,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  accent: "gold" | "teal" | "success";
  to?: string;
}) {
  const ring =
    accent === "gold"
      ? "from-gold/30 to-transparent"
      : accent === "teal"
        ? "from-teal/30 to-transparent"
        : "from-success/30 to-transparent";
  const iconColor =
    accent === "gold" ? "text-gold" : accent === "teal" ? "text-teal" : "text-success";
  const className = `glass-card relative block overflow-hidden rounded-2xl p-5 bg-gradient-to-br ${ring} ${to ? "transition hover:brightness-110" : ""}`;
  const content = (
    <div className="flex items-start justify-between">
      <div>
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        <div className="mt-2 text-3xl font-extrabold tracking-tight">{value}</div>
        {hint ? <div className="mt-1 text-xs text-success">{hint}</div> : null}
      </div>
      <div className={`grid h-11 w-11 place-items-center rounded-xl bg-white/5 ${iconColor}`}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  );
  return to ? (
    <Link to={to} className={className}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}

const DNA_KEYS: DnaDocType[] = ["history", "menu", "usp", "tone"];

function Dashboard() {
  const { ready } = useRequireAuth();
  const user = useCurrentUser();
  const { data: stats } = useQuery({ queryKey: ["stats"], queryFn: () => api.stats() });
  const { data: items = [] } = useQuery({
    queryKey: ["content"],
    queryFn: () => api.listContent(),
  });
  const { data: dna } = useQuery({ queryKey: ["dna"], queryFn: () => api.getDna() });
  const { data: upcomingEvent } = useQuery({
    queryKey: ["upcoming-event"],
    queryFn: () => api.getUpcomingEvent(),
  });

  const dnaFilledCount = dna ? DNA_KEYS.filter((k) => dna[k]?.trim()).length : null;

  const feedbackStats = useMemo(() => {
    const rated = items.filter((it) => it.feedback);
    const good = rated.filter((it) => it.feedback === "good").length;
    return { ratedCount: rated.length, goodRate: rated.length ? good / rated.length : 0 };
  }, [items]);

  const daysSinceLastPostText =
    stats?.daysSinceLastPost == null
      ? "ยังไม่เคยโพสต์เลยค่ะ"
      : stats.daysSinceLastPost === 0
        ? "โพสต์วันนี้ค่ะ ✨"
        : "วันที่แล้ว";

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
          title={`สวัสดีค่ะ ${user?.name ?? "คุณผู้ใช้"} 👋`}
          subtitle={
            user?.email ? `ภาพรวมคอนเทนต์ของวันนี้ • ${user.email}` : "ภาพรวมคอนเทนต์ของวันนี้"
          }
        />

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="โพสต์ใหม่สัปดาห์นี้"
            value={String(stats?.newPosts ?? "—")}
            icon={TrendingUp}
            accent="teal"
          />
          <StatCard
            label="รอตรวจสอบ"
            value={String(stats?.pendingReview ?? "—")}
            hint={
              stats
                ? (stats.pendingReview ?? 0) > 0
                  ? "ไปตรวจสอบเลย →"
                  : "ไม่มีค้างค่ะ ✓"
                : undefined
            }
            icon={Clock}
            accent="gold"
            to="/library"
          />
          <StatCard
            label="ห่างจากโพสต์ล่าสุด"
            value={stats?.daysSinceLastPost == null ? "—" : String(stats.daysSinceLastPost)}
            hint={stats ? daysSinceLastPostText : undefined}
            icon={CalendarClock}
            accent="success"
          />
          <StatCard
            label="ผลตอบรับดี"
            value={
              feedbackStats.ratedCount === 0 ? "—" : `${Math.round(feedbackStats.goodRate * 100)}%`
            }
            hint={
              feedbackStats.ratedCount === 0
                ? "ให้ฟีดแบ็คโพสต์ที่โพสต์แล้ว เพื่อดูภาพรวมตรงนี้ค่ะ"
                : `จาก ${feedbackStats.ratedCount} โพสต์ที่ให้ฟีดแบ็ค`
            }
            icon={ThumbsUp}
            accent="success"
          />
        </div>

        {dnaFilledCount !== null && dnaFilledCount < DNA_KEYS.length && (
          <Link
            to="/brand-dna"
            className="glass-card mt-4 flex items-center gap-4 rounded-2xl p-4 transition hover:brightness-110"
          >
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-gold/30 to-teal/30 text-gold">
              <Dna className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold">
                อัตลักษณ์แบรนด์กรอกแล้ว {dnaFilledCount}/{DNA_KEYS.length} หัวข้อ
              </div>
              <div className="text-xs text-muted-foreground">
                กรอกให้ครบเพื่อให้ AI เขียนโพสต์ได้ตรงใจร้านคุณมากขึ้น
              </div>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
        )}

        <FollowerNudgeCard />

        <EventsCalendarCard />

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="glass-card rounded-2xl p-6 lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">คอนเทนต์ล่าสุด</h2>
              <Link to="/library" className="text-sm text-teal hover:underline">
                ดูทั้งหมด →
              </Link>
            </div>
            <ul className="divide-y divide-white/5">
              {items.slice(0, 5).map((it) => (
                <li
                  key={it.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-muted-foreground">
                        {platformLabel[it.platform]}
                      </span>
                      <span className="text-[11px] text-muted-foreground">{it.createdAt}</span>
                    </div>
                    <div className="truncate text-sm">{it.preview}</div>
                    <div className="mt-1.5">
                      <ContentFeedbackControl item={it} />
                    </div>
                  </div>
                  <StatusBadge status={it.status} />
                </li>
              ))}
              {items.length === 0 && (
                <li className="py-6 text-center text-sm text-muted-foreground">
                  ยังไม่มีคอนเทนต์ค่ะ
                </li>
              )}
            </ul>
          </div>

          <div className="glass-card rounded-2xl p-6">
            {upcomingEvent ? (
              <>
                <div className="flex items-center gap-2 text-gold">
                  <PartyPopper className="h-4 w-4" />
                  <span className="text-xs font-semibold">
                    ใกล้ถึง{upcomingEvent.name}แล้ว (อีก {upcomingEvent.days_until} วัน)
                  </span>
                </div>
                <h3 className="mt-2 text-lg font-bold">มีไอเดียโพสต์ไหมคะ?</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {upcomingEvent.suggestion_text}
                </p>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 text-gold">
                  <Sparkles className="h-4 w-4" />
                  <span className="text-xs font-semibold">เริ่มต้นเร็ว</span>
                </div>
                <h3 className="mt-2 text-lg font-bold">อยากได้โพสต์ใหม่วันนี้?</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  บอก FAHSAI สั้นๆ ว่าอยากได้โพสต์แบบไหน เดี๋ยวเราช่วยเขียนให้ค่ะ
                </p>
              </>
            )}
            <Link
              to="/create"
              className="btn-gold mt-5 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm"
            >
              สร้างคอนเทนต์ <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export function StatusBadge({ status }: { status: "draft" | "approved" | "posted" }) {
  const styles = {
    draft: "bg-white/5 text-muted-foreground",
    approved: "bg-teal/15 text-teal",
    posted: "bg-success/15 text-success",
  } as const;
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${styles[status]}`}>
      {statusLabel[status]}
    </span>
  );
}

export const feedbackOptions: { key: ContentFeedback; icon: LucideIcon; activeClass: string }[] = [
  { key: "good", icon: ThumbsUp, activeClass: "text-success" },
  { key: "neutral", icon: Meh, activeClass: "text-gold" },
  { key: "bad", icon: ThumbsDown, activeClass: "text-destructive" },
];

export function ContentFeedbackControl({ item }: { item: ContentItem }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (feedback: ContentFeedback) => api.setContentFeedback(item.id, feedback),
    onSuccess: () => {
      if (!item.feedback) {
        toast.success(
          "บันทึกฟีดแบ็คแล้วค่ะ ขอบคุณค่ะ ข้อมูลนี้ช่วยให้เห็นภาพรวมผลงานร้านคุณได้ ✨",
        );
      }
      queryClient.invalidateQueries({ queryKey: ["content"] });
    },
  });

  if (item.status !== "posted") return null;

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] text-muted-foreground">ผลตอบรับ:</span>
      {feedbackOptions.map(({ key, icon: Icon, activeClass }) => (
        <button
          key={key}
          onClick={() => mutation.mutate(key)}
          className={
            "rounded-full p-1.5 transition " +
            (item.feedback === key
              ? `bg-white/5 ${activeClass}`
              : "text-muted-foreground hover:text-foreground")
          }
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  );
}
