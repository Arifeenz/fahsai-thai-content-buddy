import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api, businessCategoryLabel } from "@/lib/api";
import { AppShell, PageHeader } from "@/components/app-shell";
import { useRequireAdmin } from "@/lib/admin-guard";
import { Pagination } from "@/components/pagination";
import { Search } from "lucide-react";

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
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce so every keystroke doesn't fire a request; reset to page 1
  // whenever the effective search term changes so the user doesn't land on
  // an out-of-range page for the new result set.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const { data } = useQuery({
    queryKey: ["admin", "users", page, debouncedSearch],
    queryFn: () => api.adminListUsers(page, PAGE_SIZE, debouncedSearch),
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
        <div className="glass-card mb-4 flex items-center gap-3 rounded-2xl p-4">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาชื่อหรืออีเมล..."
              className="w-full rounded-full border border-border bg-input py-2.5 pl-9 pr-4 text-sm outline-none placeholder:text-muted-foreground focus:border-teal"
            />
          </div>
        </div>
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
                    {debouncedSearch ? "ไม่พบผู้ใช้ที่ตรงกับคำค้นหาค่ะ" : "ยังไม่มีผู้ใช้ในระบบ"}
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
