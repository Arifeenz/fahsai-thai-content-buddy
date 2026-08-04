import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api, platformLabel } from "@/lib/api";
import { AppShell, PageHeader } from "@/components/app-shell";
import { useRequireAdmin } from "@/lib/admin-guard";
import { Pagination } from "@/components/pagination";
import { feedbackOptions, StatusBadge } from "./dashboard";

export const Route = createFileRoute("/admin/content")({
  head: () => ({
    meta: [
      { title: "คอนเทนต์ทั้งหมด — แอดมิน FAHSAI" },
      { name: "description", content: "คอนเทนต์ที่ผู้ใช้ทุกคนสร้างในระบบ" },
    ],
  }),
  component: AdminContentPage,
});

const PAGE_SIZE = 20;

function AdminContentPage() {
  const { ready } = useRequireAdmin();
  const [page, setPage] = useState(1);
  const { data } = useQuery({
    queryKey: ["admin", "content", page],
    queryFn: () => api.adminListContent(page, PAGE_SIZE),
    placeholderData: keepPreviousData,
  });
  const items = data?.items ?? [];
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
        <PageHeader title="คอนเทนต์ทั้งหมด" subtitle={`คอนเทนต์ทั้งหมด (${total})`} />
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
              <div className="flex shrink-0 items-center gap-2">
                {it.feedback &&
                  (() => {
                    const opt = feedbackOptions.find((o) => o.key === it.feedback);
                    if (!opt) return null;
                    const Icon = opt.icon;
                    return <Icon className={`h-3.5 w-3.5 ${opt.activeClass}`} />;
                  })()}
                <StatusBadge status={it.status} />
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <div className="glass-card rounded-2xl p-10 text-center text-sm text-muted-foreground">
              ยังไม่มีคอนเทนต์ที่ผู้ใช้สร้างค่ะ
            </div>
          )}
        </div>
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
      </div>
    </AppShell>
  );
}
