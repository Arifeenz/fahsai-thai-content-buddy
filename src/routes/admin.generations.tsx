import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api, platformLabel } from "@/lib/api";
import { AppShell, PageHeader } from "@/components/app-shell";
import { useRequireAdmin } from "@/lib/admin-guard";

export const Route = createFileRoute("/admin/generations")({
  head: () => ({
    meta: [
      { title: "ประวัติการสร้างคอนเทนต์ — แอดมิน FAHSAI" },
      { name: "description", content: "ทุกครั้งที่ผู้ใช้กดสร้างคอนเทนต์ในระบบ" },
    ],
  }),
  component: AdminGenerationsPage,
});

function AdminGenerationsPage() {
  const { ready } = useRequireAdmin();
  const { data: logs = [] } = useQuery({
    queryKey: ["admin", "generation-log"],
    queryFn: () => api.adminListGenerationLogs(),
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
          title="ประวัติการสร้างคอนเทนต์"
          subtitle={`ทุกครั้งที่มีการกดสร้างคอนเทนต์ในระบบ (${logs.length})`}
        />
        <div className="glass-card overflow-x-auto rounded-2xl">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="p-4 font-medium">เวลา</th>
                <th className="p-4 font-medium">ผู้ใช้</th>
                <th className="p-4 font-medium">แพลตฟอร์ม</th>
                <th className="p-4 font-medium">โทน</th>
                <th className="p-4 font-medium">พรอมป์</th>
                <th className="p-4 font-medium">ผลลัพธ์</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-border/50 last:border-0 align-top">
                  <td className="whitespace-nowrap p-4 text-muted-foreground">
                    {new Date(log.created_at).toLocaleString("th-TH", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </td>
                  <td className="p-4 text-muted-foreground">
                    {log.user_name ? `${log.user_name} • ${log.user_email}` : "—"}
                  </td>
                  <td className="p-4 text-muted-foreground">{platformLabel[log.platform]}</td>
                  <td className="p-4 text-muted-foreground">{log.tone ?? "—"}</td>
                  <td className="line-clamp-2 max-w-xs p-4">{log.prompt}</td>
                  <td className="line-clamp-2 max-w-xs p-4">{log.caption}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted-foreground">
                    ยังไม่มีการสร้างคอนเทนต์ในระบบค่ะ
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
