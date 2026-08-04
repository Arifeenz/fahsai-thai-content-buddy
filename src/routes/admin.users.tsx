import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api, businessCategoryLabel } from "@/lib/api";
import { AppShell, PageHeader } from "@/components/app-shell";
import { useRequireAdmin } from "@/lib/admin-guard";
import { Pagination } from "@/components/pagination";

export const Route = createFileRoute("/admin/users")({
  head: () => ({
    meta: [
      { title: "ผู้ใช้งาน — แอดมิน FAHSAI" },
      { name: "description", content: "รายชื่อผู้ใช้งานทั้งหมดในระบบ" },
    ],
  }),
  component: AdminUsersPage,
});

const PAGE_SIZE = 20;

function AdminUsersPage() {
  const { ready } = useRequireAdmin();
  const [page, setPage] = useState(1);
  const { data } = useQuery({
    queryKey: ["admin", "users", page],
    queryFn: () => api.adminListUsers(page, PAGE_SIZE),
    placeholderData: keepPreviousData,
  });
  const users = data?.items ?? [];
  const total = data?.total ?? 0;

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
        <PageHeader title="ผู้ใช้งาน" subtitle={`ผู้ใช้งานทั้งหมด (${total})`} />
        <div className="glass-card overflow-x-auto rounded-2xl">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="p-4 font-medium">ชื่อ</th>
                <th className="p-4 font-medium">อีเมล</th>
                <th className="p-4 font-medium">สิทธิ์</th>
                <th className="p-4 font-medium">ประเภทธุรกิจ</th>
                <th className="p-4 font-medium">เข้าสู่ระบบล่าสุด</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-border/50 last:border-0">
                  <td className="p-4">{u.name}</td>
                  <td className="p-4 text-muted-foreground">{u.email}</td>
                  <td className="p-4">
                    <span
                      className={
                        "rounded-full px-2.5 py-1 text-[11px] font-medium " +
                        (u.role === "admin"
                          ? "bg-gold/15 text-gold"
                          : "bg-white/5 text-muted-foreground")
                      }
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="p-4 text-muted-foreground">
                    {u.business_category ? businessCategoryLabel[u.business_category] : "—"}
                  </td>
                  <td className="p-4 text-muted-foreground">
                    {u.last_login_at
                      ? new Date(u.last_login_at).toLocaleString("th-TH", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })
                      : "—"}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-muted-foreground">
                    ยังไม่มีผู้ใช้ในระบบ
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
      </div>
    </AppShell>
  );
}
