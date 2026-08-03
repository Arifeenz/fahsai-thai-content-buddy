import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AppShell, PageHeader } from "@/components/app-shell";
import { useRequireAdmin } from "@/lib/admin-guard";
import {
  Users,
  FileText,
  MessageSquareText,
  CalendarDays,
  TrendingUp,
  ShieldAlert,
  History,
  DollarSign,
  LineChart,
  type LucideIcon,
} from "lucide-react";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "ภาพรวมระบบ — แอดมิน FAHSAI" },
      { name: "description", content: "ภาพรวมผู้ใช้และคอนเทนต์ทั้งหมดในระบบ" },
    ],
  }),
  component: AdminOverviewPage,
});

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
}) {
  return (
    <div className="glass-card relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal/30 to-transparent p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-medium text-muted-foreground">{label}</div>
          <div className="mt-2 text-3xl font-extrabold tracking-tight">{value}</div>
          {hint ? <div className="mt-1 text-xs text-success">{hint}</div> : null}
        </div>
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/5 text-teal">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

const quickLinks = [
  { to: "/admin/users", label: "ผู้ใช้งาน", icon: Users },
  { to: "/admin/content", label: "คอนเทนต์ทั้งหมด", icon: FileText },
  { to: "/admin/templates", label: "Prompt Templates", icon: MessageSquareText },
  { to: "/admin/generations", label: "ประวัติการสร้าง", icon: History },
  { to: "/admin/kpi", label: "KPI", icon: LineChart },
  { to: "/admin/events", label: "วันสำคัญ", icon: CalendarDays },
  { to: "/admin/security", label: "ความปลอดภัย", icon: ShieldAlert },
] as const;

function AdminOverviewPage() {
  const { ready } = useRequireAdmin();
  const { data: stats } = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: () => api.adminGetStats(),
  });

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
        <PageHeader title="ภาพรวมระบบ" subtitle="สรุปผู้ใช้และคอนเทนต์ทั้งหมดในระบบ" />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="ผู้ใช้งานทั้งหมด"
            value={String(stats?.total_users ?? "—")}
            icon={Users}
          />
          <StatCard
            label="ผู้ใช้ใหม่สัปดาห์นี้"
            value={String(stats?.new_users_week ?? "—")}
            icon={TrendingUp}
          />
          <StatCard
            label="คอนเทนต์ทั้งหมด"
            value={String(stats?.total_content ?? "—")}
            icon={FileText}
          />
          <StatCard
            label="คอนเทนต์ใหม่สัปดาห์นี้"
            value={String(stats?.new_content_week ?? "—")}
            icon={TrendingUp}
          />
          <StatCard
            label="เหตุการณ์น่าสงสัย (7 วัน)"
            value={String(stats?.security_events_week ?? "—")}
            icon={ShieldAlert}
          />
          <StatCard
            label="ค่าใช้จ่าย OpenAI เดือนนี้ (ประมาณ)"
            value={
              stats
                ? `$${stats.openai_spend_this_month.toFixed(2)} / $${stats.openai_monthly_budget_usd}`
                : "—"
            }
            icon={DollarSign}
          />
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {quickLinks.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="glass-card flex items-center gap-4 rounded-2xl p-5 transition hover:brightness-110"
            >
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/5 text-teal">
                <Icon className="h-5 w-5" />
              </div>
              <div className="font-bold">{label}</div>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
