import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, platformLabel, type ContentItem, type ContentStatus, type Platform } from "@/lib/api";
import { AppShell, PageHeader } from "@/components/app-shell";
import { useRequireAuth } from "@/lib/auth-guard";
import { ContentFeedbackControl, StatusBadge } from "./dashboard";
import { Search, Trophy, Link2 } from "lucide-react";

export const Route = createFileRoute("/library")({
  head: () => ({
    meta: [
      { title: "คลังคอนเทนต์ — FAHSAI" },
      { name: "description", content: "โพสต์ทั้งหมดของร้านคุณ ค้นหา กรอง และจัดการได้ในที่เดียว" },
      { property: "og:title", content: "คลังคอนเทนต์ — FAHSAI" },
      {
        property: "og:description",
        content: "โพสต์ทั้งหมดของร้านคุณ ค้นหา กรอง และจัดการได้ในที่เดียว",
      },
    ],
  }),
  component: Library,
});

const statusFilters: { key: "all" | ContentStatus; label: string }[] = [
  { key: "all", label: "ทั้งหมด" },
  { key: "draft", label: "ร่าง" },
  { key: "approved", label: "อนุมัติแล้ว" },
  { key: "posted", label: "โพสต์แล้ว" },
];
const platformFilters: { key: "all" | Platform; label: string }[] = [
  { key: "all", label: "ทุกช่อง" },
  { key: "facebook", label: "Facebook" },
  { key: "line", label: "LINE OA" },
  { key: "instagram", label: "Instagram" },
];

function TopContentSection() {
  const { data: topItems = [] } = useQuery({
    queryKey: ["content", "top"],
    queryFn: () => api.getMyTopContent(),
  });

  if (topItems.length === 0) return null;

  return (
    <div className="glass-card mb-4 rounded-2xl p-5">
      <div className="mb-3 flex items-center gap-2">
        <Trophy className="h-4 w-4 text-gold" />
        <h2 className="text-sm font-bold">คอนเทนต์ยอดนิยมของคุณ</h2>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {topItems.map((it, i) => (
          <div key={it.id} className="rounded-xl border border-border bg-input/30 p-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] font-bold text-gold">#{i + 1}</span>
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-muted-foreground">
                {platformLabel[it.platform]}
              </span>
            </div>
            <div className="line-clamp-2 text-xs leading-relaxed">{it.preview}</div>
            <div className="mt-1.5 text-[11px] font-semibold text-success">
              {it.verifiedLikeCount?.toLocaleString("th-TH")} ไลค์
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PostUrlField({ item }: { item: ContentItem }) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState(item.postUrl ?? "");
  const mutation = useMutation({
    mutationFn: (postUrl: string) => api.updateContentPostUrl(item.id, postUrl.trim() || null),
    onSuccess: () => {
      toast.success("บันทึกลิงก์แล้วค่ะ");
      queryClient.invalidateQueries({ queryKey: ["content"] });
    },
    onError: () => toast.error("บันทึกลิงก์ไม่สำเร็จ ลองอีกครั้งนะคะ"),
  });

  if (item.status !== "posted") return null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          if (value.trim() !== (item.postUrl ?? "")) mutation.mutate(value);
        }}
        placeholder="วางลิงก์โพสต์จริง (ถ้ามี) ให้ทีมงานช่วยตรวจยอดไลค์ให้"
        className="min-w-0 flex-1 rounded-full border border-border bg-input px-3 py-1 text-xs outline-none placeholder:text-muted-foreground focus:border-teal"
      />
      {item.verifiedLikeCount != null && (
        <span className="shrink-0 rounded-full bg-success/15 px-2 py-0.5 text-[11px] text-success">
          {item.verifiedLikeCount.toLocaleString("th-TH")} ไลค์ (ยืนยันแล้ว)
        </span>
      )}
    </div>
  );
}

function Library() {
  const { ready } = useRequireAuth();
  const { data: items = [] } = useQuery({
    queryKey: ["content"],
    queryFn: () => api.listContent(),
  });
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | ContentStatus>("all");
  const [platform, setPlatform] = useState<"all" | Platform>("all");

  const filtered = useMemo(
    () =>
      items.filter(
        (it) =>
          (status === "all" || it.status === status) &&
          (platform === "all" || it.platform === platform) &&
          (q.trim() === "" || it.preview.toLowerCase().includes(q.toLowerCase())),
      ),
    [items, status, platform, q],
  );

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
        <PageHeader title="คลังคอนเทนต์" subtitle="โพสต์ทั้งหมดของร้านคุณ" />

        <TopContentSection />

        <div className="glass-card mb-4 flex flex-wrap items-center gap-3 rounded-2xl p-4">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ค้นหาในโพสต์..."
              className="w-full rounded-full border border-border bg-input py-2.5 pl-9 pr-4 text-sm outline-none placeholder:text-muted-foreground focus:border-teal"
            />
          </div>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value as any)}
            className="rounded-full border border-border bg-input px-4 py-2.5 text-sm outline-none"
          >
            {platformFilters.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {statusFilters.map((f) => (
            <button
              key={f.key}
              onClick={() => setStatus(f.key)}
              className={
                "rounded-full border px-4 py-1.5 text-sm " +
                (status === f.key
                  ? "border-teal bg-teal/15 text-teal"
                  : "border-border text-muted-foreground hover:text-foreground")
              }
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="grid gap-3">
          {filtered.map((it) => (
            <div
              key={it.id}
              className="glass-card grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-2xl p-4 md:p-5"
            >
              <div className="min-w-0">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[11px] text-muted-foreground">
                    {platformLabel[it.platform]}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{it.createdAt}</span>
                </div>
                <div className="line-clamp-2 text-sm leading-relaxed">{it.preview}</div>
                <div className="mt-2">
                  <ContentFeedbackControl item={it} />
                </div>
                <PostUrlField item={it} />
              </div>
              <StatusBadge status={it.status} />
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="glass-card rounded-2xl p-10 text-center text-sm text-muted-foreground">
              ยังไม่พบโพสต์ที่ตรงกับตัวกรองค่ะ
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
