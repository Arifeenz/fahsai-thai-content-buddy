import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, platformLabel, type ContentStatus, type Platform } from "@/lib/api";
import { AppShell, PageHeader } from "@/components/app-shell";
import { StatusBadge } from "./dashboard";
import { Search } from "lucide-react";

export const Route = createFileRoute("/library")({
  head: () => ({
    meta: [
      { title: "คลังคอนเทนต์ — FAHSAI" },
      { name: "description", content: "โพสต์ทั้งหมดของร้านคุณ ค้นหา กรอง และจัดการได้ในที่เดียว" },
      { property: "og:title", content: "คลังคอนเทนต์ — FAHSAI" },
      { property: "og:description", content: "โพสต์ทั้งหมดของร้านคุณ ค้นหา กรอง และจัดการได้ในที่เดียว" },
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

function Library() {
  const { data: items = [] } = useQuery({ queryKey: ["content"], queryFn: () => api.listContent() });
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | ContentStatus>("all");
  const [platform, setPlatform] = useState<"all" | Platform>("all");

  const filtered = useMemo(() =>
    items.filter((it) =>
      (status === "all" || it.status === status) &&
      (platform === "all" || it.platform === platform) &&
      (q.trim() === "" || it.preview.toLowerCase().includes(q.toLowerCase()))
    ), [items, status, platform, q]);

  return (
    <AppShell>
      <div className="p-6 md:p-8">
        <PageHeader title="คลังคอนเทนต์" subtitle="โพสต์ทั้งหมดของร้านคุณ" />

        <div className="glass-card mb-4 flex flex-wrap items-center gap-3 rounded-2xl p-4">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q} onChange={(e)=>setQ(e.target.value)} placeholder="ค้นหาในโพสต์..."
              className="w-full rounded-full border border-border bg-input py-2.5 pl-9 pr-4 text-sm outline-none placeholder:text-muted-foreground focus:border-teal"
            />
          </div>
          <select value={platform} onChange={(e)=>setPlatform(e.target.value as any)} className="rounded-full border border-border bg-input px-4 py-2.5 text-sm outline-none">
            {platformFilters.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {statusFilters.map((f) => (
            <button
              key={f.key} onClick={() => setStatus(f.key)}
              className={
                "rounded-full border px-4 py-1.5 text-sm " +
                (status === f.key ? "border-teal bg-teal/15 text-teal" : "border-border text-muted-foreground hover:text-foreground")
              }
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="grid gap-3">
          {filtered.map((it) => (
            <div key={it.id} className="glass-card grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-2xl p-4 md:p-5">
              <div className="min-w-0">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[11px] text-muted-foreground">{platformLabel[it.platform]}</span>
                  <span className="text-[11px] text-muted-foreground">{it.createdAt}</span>
                </div>
                <div className="line-clamp-2 text-sm leading-relaxed">{it.preview}</div>
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
