import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AppShell, PageHeader } from "@/components/app-shell";
import { useRequireAdmin } from "@/lib/admin-guard";

export const Route = createFileRoute("/admin/security")({
  head: () => ({
    meta: [
      { title: "ความปลอดภัย — แอดมิน FAHSAI" },
      { name: "description", content: "เหตุการณ์ที่โดนจำกัดการใช้งานถี่เกินไปในระบบ" },
    ],
  }),
  component: AdminSecurityPage,
});

function AdminSecurityPage() {
  const { ready } = useRequireAdmin();
  const { data: events = [] } = useQuery({
    queryKey: ["admin", "security-events"],
    queryFn: () => api.adminListSecurityEvents(),
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
          title="ความปลอดภัย"
          subtitle={`เหตุการณ์ที่ถูกจำกัดการใช้งาน (${events.length})`}
        />
        <div className="glass-card overflow-x-auto rounded-2xl">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="p-4 font-medium">เวลา</th>
                <th className="p-4 font-medium">ประเภท</th>
                <th className="p-4 font-medium">ผู้ใช้ / IP</th>
                <th className="p-4 font-medium">Endpoint</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr key={ev.id} className="border-b border-border/50 last:border-0">
                  <td className="p-4 text-muted-foreground">
                    {new Date(ev.created_at).toLocaleString("th-TH", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </td>
                  <td className="p-4">
                    <span className="rounded-full bg-destructive/15 px-2.5 py-1 text-[11px] font-medium text-destructive">
                      {ev.event_type}
                    </span>
                  </td>
                  <td className="p-4 text-muted-foreground">
                    {ev.user_name ? `${ev.user_name} • ${ev.user_email}` : ev.identifier}
                  </td>
                  <td className="p-4 text-muted-foreground">{ev.endpoint}</td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-muted-foreground">
                    ยังไม่มีเหตุการณ์น่าสงสัยค่ะ
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
