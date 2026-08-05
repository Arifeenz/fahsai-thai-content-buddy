import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AppShell, PageHeader } from "@/components/app-shell";
import { useRequireAdmin } from "@/lib/admin-guard";
import { Users, Repeat, Clock, type LucideIcon } from "lucide-react";

export const Route = createFileRoute("/admin/kpi")({
  head: () => ({
    meta: [
      { title: "KPI — แอดมิน FAHSAI" },
      { name: "description", content: "ตัวชี้วัดว่าการใช้ระบบให้ผลลัพธ์ที่ดีขึ้นจริงไหม" },
    ],
  }),
  component: AdminKpiPage,
});

const modeLabel: Record<string, string> = {
  idea: "เขียนจากไอเดีย",
  photo: "เขียนจากรูปภาพ",
  video_script: "สคริปวิดีโอสั้น",
};

function pct(numerator: number, denominator: number): string {
  if (denominator === 0) return "—";
  return `${((numerator / denominator) * 100).toFixed(0)}%`;
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
}) {
  return (
    <div className="glass-card relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal/30 to-transparent p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-medium text-muted-foreground">{label}</div>
          <div className="mt-2 text-3xl font-extrabold tracking-tight">{value}</div>
        </div>
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/5 text-teal">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function AdminKpiPage() {
  const { ready } = useRequireAdmin();
  const { data: kpi } = useQuery({
    queryKey: ["admin", "kpi"],
    queryFn: () => api.adminGetKpi(),
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
        <PageHeader
          title="KPI"
          subtitle="ตัวชี้วัดการใช้งานภายในระบบ — เป็น proxy จากพฤติกรรม user (อนุมัติ/ให้ feedback เอง) ยังไม่ใช่ engagement จริงจากแพลตฟอร์มโซเชียล"
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="User ที่ active (เคยอนุมัติคอนเทนต์)"
            value={String(kpi?.active_users ?? "—")}
            icon={Users}
          />
          <StatCard
            label="User ที่กลับมาใช้ซ้ำ (มากกว่า 1 สัปดาห์)"
            value={kpi ? pct(kpi.retained_users, kpi.active_users) : "—"}
            icon={Repeat}
          />
          <StatCard
            label="เวลาเฉลี่ยก่อนสร้างคอนเทนต์แรก"
            value={
              kpi?.avg_days_to_first_content != null
                ? `${kpi.avg_days_to_first_content.toFixed(1)} วัน`
                : "—"
            }
            icon={Clock}
          />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div>
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
              อัตราอนุมัติ แยกตามโหมดสร้างคอนเทนต์
            </h2>
            <div className="glass-card overflow-x-auto rounded-2xl">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="p-4 font-medium">โหมด</th>
                    <th className="p-4 font-medium">สร้างทั้งหมด</th>
                    <th className="p-4 font-medium">อนุมัติแล้ว</th>
                    <th className="p-4 font-medium">อัตรา</th>
                  </tr>
                </thead>
                <tbody>
                  {kpi?.approval_by_mode.map((row) => (
                    <tr key={row.mode} className="border-b border-border/50 last:border-0">
                      <td className="p-4">{modeLabel[row.mode] ?? row.mode}</td>
                      <td className="p-4 text-muted-foreground">{row.generations}</td>
                      <td className="p-4 text-muted-foreground">{row.approved}</td>
                      <td className="p-4 font-semibold text-teal">
                        {pct(row.approved, row.generations)}
                      </td>
                    </tr>
                  ))}
                  {kpi && kpi.approval_by_mode.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-muted-foreground">
                        ยังไม่มีข้อมูลค่ะ
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
              Feedback ที่ดี แยกตามโหมดสร้างคอนเทนต์
            </h2>
            <div className="glass-card overflow-x-auto rounded-2xl">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="p-4 font-medium">โหมด</th>
                    <th className="p-4 font-medium">ให้ feedback ดี</th>
                    <th className="p-4 font-medium">ให้ feedback ทั้งหมด</th>
                    <th className="p-4 font-medium">อัตรา</th>
                  </tr>
                </thead>
                <tbody>
                  {kpi?.feedback_by_mode.map((row) => (
                    <tr key={row.mode} className="border-b border-border/50 last:border-0">
                      <td className="p-4">{modeLabel[row.mode] ?? row.mode}</td>
                      <td className="p-4 text-muted-foreground">{row.good}</td>
                      <td className="p-4 text-muted-foreground">{row.total_rated}</td>
                      <td className="p-4 font-semibold text-teal">
                        {pct(row.good, row.total_rated)}
                      </td>
                    </tr>
                  ))}
                  {kpi && kpi.feedback_by_mode.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-muted-foreground">
                        ยังไม่มีข้อมูลค่ะ
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
            อัตราอนุมัติ เทียบความสมบูรณ์ของ Brand DNA — ทดสอบว่ากรอกครบแล้วได้ผลดีขึ้นจริงไหม
          </h2>
          <div className="glass-card overflow-x-auto rounded-2xl">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="p-4 font-medium">กรอก Brand DNA ครบ</th>
                  <th className="p-4 font-medium">จำนวน user</th>
                  <th className="p-4 font-medium">สร้างทั้งหมด</th>
                  <th className="p-4 font-medium">อนุมัติแล้ว</th>
                  <th className="p-4 font-medium">อัตรา</th>
                </tr>
              </thead>
              <tbody>
                {kpi?.dna_completeness.map((row) => (
                  <tr key={row.filled_count} className="border-b border-border/50 last:border-0">
                    <td className="p-4">{row.filled_count}/4</td>
                    <td className="p-4 text-muted-foreground">{row.user_count}</td>
                    <td className="p-4 text-muted-foreground">{row.total_generations}</td>
                    <td className="p-4 text-muted-foreground">{row.total_approved}</td>
                    <td className="p-4 font-semibold text-gold">
                      {pct(row.total_approved, row.total_generations)}
                    </td>
                  </tr>
                ))}
                {kpi && kpi.dna_completeness.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-muted-foreground">
                      ยังไม่มีข้อมูลค่ะ
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
