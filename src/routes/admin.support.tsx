import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AppShell, PageHeader } from "@/components/app-shell";
import { useRequireAdmin } from "@/lib/admin-guard";
import { Pagination } from "@/components/pagination";
import { Check, RotateCcw } from "lucide-react";

export const Route = createFileRoute("/admin/support")({
  head: () => ({
    meta: [
      { title: "แจ้งปัญหา — แอดมิน FAHSAI" },
      { name: "description", content: "ปัญหาที่ผู้ใช้แจ้งเข้ามาผ่านหน้าตั้งค่า" },
    ],
  }),
  component: AdminSupportPage,
});

const PAGE_SIZE = 20;

function AdminSupportPage() {
  const { ready } = useRequireAdmin();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const { data } = useQuery({
    queryKey: ["admin", "support-tickets", page],
    queryFn: () => api.adminListSupportTickets(page, PAGE_SIZE),
    placeholderData: keepPreviousData,
  });
  const tickets = data?.items ?? [];
  const total = data?.total ?? 0;
  const openCount = tickets.filter((t) => !t.resolved).length;

  const resolveMutation = useMutation({
    mutationFn: ({ id, resolved }: { id: number; resolved: boolean }) =>
      api.adminResolveSupportTicket(id, resolved),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "support-tickets"] });
    },
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
          title="แจ้งปัญหา"
          subtitle={`ปัญหาที่ผู้ใช้แจ้งเข้ามา (ทั้งหมด ${total} รายการ${openCount > 0 ? ` • ยังไม่แก้ ${openCount} รายการในหน้านี้` : ""})`}
        />
        <div className="grid gap-3">
          {tickets.map((t) => (
            <div
              key={t.id}
              className={
                "glass-card grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 rounded-2xl p-4 " +
                (t.resolved ? "opacity-60" : "")
              }
            >
              <div className="min-w-0">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <span
                    className={
                      "rounded-full px-2.5 py-0.5 text-[11px] font-medium " +
                      (t.resolved ? "bg-white/5 text-muted-foreground" : "bg-gold/15 text-gold")
                    }
                  >
                    {t.resolved ? "แก้ไขแล้ว" : "ยังไม่แก้"}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {t.user_name} • {t.user_email}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(t.created_at).toLocaleString("th-TH", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                </div>
                <div className="whitespace-pre-wrap text-sm leading-relaxed">{t.message}</div>
                {t.user_agent && (
                  <div className="mt-1.5 truncate text-[11px] text-muted-foreground">
                    {t.user_agent}
                  </div>
                )}
              </div>
              <button
                onClick={() => resolveMutation.mutate({ id: t.id, resolved: !t.resolved })}
                title={t.resolved ? "ทำเครื่องหมายว่ายังไม่แก้" : "ทำเครื่องหมายว่าแก้แล้ว"}
                className={
                  "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs hover:bg-white/5 " +
                  (t.resolved
                    ? "border-border text-muted-foreground"
                    : "border-success/40 text-success")
                }
              >
                {t.resolved ? (
                  <>
                    <RotateCcw className="h-3.5 w-3.5" /> เปิดใหม่
                  </>
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5" /> แก้แล้ว
                  </>
                )}
              </button>
            </div>
          ))}
          {tickets.length === 0 && (
            <div className="glass-card rounded-2xl p-10 text-center text-sm text-muted-foreground">
              ยังไม่มีการแจ้งปัญหาเข้ามาค่ะ
            </div>
          )}
        </div>
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
      </div>
    </AppShell>
  );
}
