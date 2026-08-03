import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Fragment, useState } from "react";
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
  const [expandedId, setExpandedId] = useState<number | null>(null);

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
                <th className="p-4 font-medium">Input เต็ม</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const isExpanded = expandedId === log.id;
                return (
                  <Fragment key={log.id}>
                    <tr className="border-b border-border/50 last:border-0 align-top">
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
                      <td className="p-4">
                        {log.system_prompt ? (
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : log.id)}
                            className="text-teal underline underline-offset-4 hover:text-teal/80"
                          >
                            {isExpanded ? "ซ่อน" : "ดู input เต็ม"}
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            ไม่มีข้อมูล (สร้างก่อนอัปเดตนี้)
                          </span>
                        )}
                      </td>
                    </tr>
                    {isExpanded && log.system_prompt && (
                      <tr className="border-b border-border/50 last:border-0 bg-white/5">
                        <td colSpan={7} className="p-4">
                          <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words text-xs text-muted-foreground">
                            {log.system_prompt}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-muted-foreground">
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
