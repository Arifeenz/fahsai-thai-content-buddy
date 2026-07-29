import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api, platformLabel, statusLabel } from "@/lib/api";
import { AppShell, PageHeader } from "@/components/app-shell";
import { TrendingUp, Image as ImageIcon, Gauge, Sparkles, ArrowRight } from "lucide-react";

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

function StatCard({ label, value, hint, icon: Icon, accent }: { label: string; value: string; hint?: string; icon: any; accent: "gold" | "teal" | "success" }) {
  const ring = accent === "gold" ? "from-gold/30 to-transparent" : accent === "teal" ? "from-teal/30 to-transparent" : "from-success/30 to-transparent";
  const iconColor = accent === "gold" ? "text-gold" : accent === "teal" ? "text-teal" : "text-success";
  return (
    <div className={`glass-card relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br ${ring}`}>
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
    </div>
  );
}

function Dashboard() {
  const { data: stats } = useQuery({ queryKey: ["stats"], queryFn: () => api.stats() });
  const { data: items = [] } = useQuery({ queryKey: ["content"], queryFn: () => api.listContent() });

  return (
    <AppShell>
      <div className="p-6 md:p-8">
        <PageHeader title="สวัสดีค่ะ คุณฟ้าใส 👋" subtitle="ภาพรวมคอนเทนต์ของ FAHSAI Coffee วันนี้" />

        <div className="grid gap-4 md:grid-cols-3">
          <StatCard label="โพสต์ใหม่สัปดาห์นี้" value={String(stats?.newPosts ?? "—")} hint="+15.2% จากสัปดาห์ก่อน" icon={TrendingUp} accent="teal" />
          <StatCard label="คอนเทนต์ที่อนุมัติแล้ว" value={String(stats?.approved ?? "—")} hint="+8.7%" icon={ImageIcon} accent="gold" />
          <StatCard label="อัตราความสำเร็จของ AI" value={`${stats?.successRate ?? "—"}%`} hint="สุขภาพระบบ: ยอดเยี่ยม" icon={Gauge} accent="success" />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="glass-card rounded-2xl p-6 lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">คอนเทนต์ล่าสุด</h2>
              <Link to="/library" className="text-sm text-teal hover:underline">ดูทั้งหมด →</Link>
            </div>
            <ul className="divide-y divide-white/5">
              {items.slice(0, 5).map((it) => (
                <li key={it.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-3">
                  <div className="min-w-0">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-muted-foreground">{platformLabel[it.platform]}</span>
                      <span className="text-[11px] text-muted-foreground">{it.createdAt}</span>
                    </div>
                    <div className="truncate text-sm">{it.preview}</div>
                  </div>
                  <StatusBadge status={it.status} />
                </li>
              ))}
              {items.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">ยังไม่มีคอนเทนต์ค่ะ</li>}
            </ul>
          </div>

          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center gap-2 text-gold"><Sparkles className="h-4 w-4" /><span className="text-xs font-semibold">เริ่มต้นเร็ว</span></div>
            <h3 className="mt-2 text-lg font-bold">อยากได้โพสต์ใหม่วันนี้?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              บอก FAHSAI สั้นๆ ว่าอยากได้โพสต์แบบไหน เดี๋ยวเราช่วยเขียนให้ค่ะ
            </p>
            <Link to="/create" className="btn-gold mt-5 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm">
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
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${styles[status]}`}>{statusLabel[status]}</span>;
}
