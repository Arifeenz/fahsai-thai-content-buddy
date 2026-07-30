import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api, platformLabel } from "@/lib/api";
import { AppShell, PageHeader } from "@/components/app-shell";
import { useRequireAdmin } from "@/lib/admin-guard";
import { StatusBadge } from "./dashboard";

export const Route = createFileRoute("/admin/content")({
  head: () => ({
    meta: [
      { title: "คอนเทนต์ทั้งหมด — แอดมิน FAHSAI" },
      { name: "description", content: "คอนเทนต์ที่ผู้ใช้ทุกคนสร้างในระบบ" },
    ],
  }),
  component: AdminContentPage,
});

function AdminContentPage() {
  const { ready } = useRequireAdmin();
  const { data: items = [] } = useQuery({
    queryKey: ["admin", "content"],
    queryFn: () => api.adminListContent(),
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
        <PageHeader title="คอนเทนต์ทั้งหมด" subtitle={`คอนเทนต์ทั้งหมด (${items.length})`} />
        <div className="grid gap-3">
          {items.map((it) => (
            <div
              key={it.id}
              className="glass-card grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-2xl p-4"
            >
              <div className="min-w-0">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[11px] text-muted-foreground">
                    {platformLabel[it.platform]}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {it.owner_name} • {it.owner_email}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{it.createdAt}</span>
                </div>
                <div className="line-clamp-2 text-sm leading-relaxed">{it.preview}</div>
              </div>
              <StatusBadge status={it.status} />
            </div>
          ))}
          {items.length === 0 && (
            <div className="glass-card rounded-2xl p-10 text-center text-sm text-muted-foreground">
              ยังไม่มีคอนเทนต์ที่ผู้ใช้สร้างค่ะ
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
