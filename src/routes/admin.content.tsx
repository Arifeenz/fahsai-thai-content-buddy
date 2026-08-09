import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  api,
  platformLabel,
  businessCategoryLabel,
  type AdminContentItem,
  type BusinessCategory,
  type ContentStatus,
  type Platform,
  type TopGrowthUser,
} from "@/lib/api";
import { AppShell, PageHeader } from "@/components/app-shell";
import { useRequireAdmin } from "@/lib/admin-guard";
import { Pagination } from "@/components/pagination";
import { feedbackOptions, StatusBadge } from "./dashboard";
import {
  Trophy,
  TrendingUp,
  ExternalLink,
  ShieldCheck,
  Search,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

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

function TopSummaryPanels() {
  const { data: topContent = [] } = useQuery({
    queryKey: ["admin", "content", "top-by-category"],
    queryFn: () => api.adminGetTopContentByCategory(),
  });
  const { data: topGrowth = [] } = useQuery({
    queryKey: ["admin", "users", "top-growth-by-category"],
    queryFn: () => api.adminGetTopGrowthByCategory(),
  });

  if (topContent.length === 0 && topGrowth.length === 0) return null;

  const contentByCategory = new Map<BusinessCategory, AdminContentItem[]>();
  for (const it of topContent) {
    if (!it.owner_category) continue;
    if (!contentByCategory.has(it.owner_category)) contentByCategory.set(it.owner_category, []);
    contentByCategory.get(it.owner_category)!.push(it);
  }
  return (
    <div className="mb-4 grid gap-4 lg:grid-cols-2">
      {contentByCategory.size > 0 && (
        <div className="glass-card rounded-2xl p-5">
          <div className="mb-3 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-gold" />
            <h2 className="text-sm font-bold">คอนเทนต์ยอดนิยม ต่อหมวดหมู่</h2>
          </div>
          <div className="space-y-4">
            {[...contentByCategory.entries()].map(([category, items]) => (
              <div key={category}>
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {businessCategoryLabel[category]}
                </div>
                <div className="space-y-1.5">
                  {items.map((it, i) => (
                    <div
                      key={it.id}
                      className="flex items-center gap-2 rounded-lg bg-input/30 px-2.5 py-1.5 text-xs"
                    >
                      <span className="shrink-0 font-bold text-gold">#{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate">{it.preview}</span>
                      <span className="shrink-0 text-muted-foreground">{it.owner_name}</span>
                      <span className="shrink-0 font-semibold text-success">
                        {it.verifiedLikeCount?.toLocaleString("th-TH")} ไลค์
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {topGrowth.length > 0 && <TopGrowthPanel items={topGrowth} />}
    </div>
  );
}

function TopGrowthPanel({ items }: { items: TopGrowthUser[] }) {
  const byCategory = new Map<BusinessCategory, TopGrowthUser[]>();
  for (const u of items) {
    if (!byCategory.has(u.business_category)) byCategory.set(u.business_category, []);
    byCategory.get(u.business_category)!.push(u);
  }
  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="mb-3 flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-teal" />
        <h2 className="text-sm font-bold">ผู้ติดตามโตเร็วสุด ต่อหมวดหมู่</h2>
      </div>
      <div className="space-y-4">
        {[...byCategory.entries()].map(([category, users]) => (
          <div key={category}>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {businessCategoryLabel[category]}
            </div>
            <div className="space-y-1.5">
              {users.map((u, i) => (
                <div
                  key={u.id}
                  className="flex items-center gap-2 rounded-lg bg-input/30 px-2.5 py-1.5 text-xs"
                >
                  <span className="shrink-0 font-bold text-teal">#{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate">{u.name}</span>
                  <span className="shrink-0 font-semibold text-success">
                    +{u.total_growth.toLocaleString("th-TH")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function VerifyLikesField({ item }: { item: AdminContentItem }) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState(item.verifiedLikeCount?.toString() ?? "");
  const mutation = useMutation({
    mutationFn: (likeCount: number) => api.adminVerifyContentLikes(item.id, likeCount),
    onSuccess: () => {
      toast.success("บันทึกยอดไลค์แล้วค่ะ");
      queryClient.invalidateQueries({ queryKey: ["admin", "content"] });
    },
    onError: () => toast.error("บันทึกไม่สำเร็จ ลองอีกครั้งนะคะ"),
  });

  if (!item.postUrl) return null;

  return (
    <div className="flex items-center gap-1.5">
      <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          const n = Number(value);
          if (value !== "" && !Number.isNaN(n) && n !== item.verifiedLikeCount) mutation.mutate(n);
        }}
        placeholder="ยอดไลค์"
        className="w-20 rounded-full border border-border bg-input px-2.5 py-1 text-xs outline-none focus:border-teal"
      />
    </div>
  );
}

function AdminContentCard({ item }: { item: AdminContentItem }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="glass-card grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 rounded-2xl p-4">
      <div className="min-w-0">
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[11px] text-muted-foreground">
            {platformLabel[item.platform]}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {item.owner_name} • {item.owner_email}
          </span>
          {item.owner_category && (
            <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[11px] text-muted-foreground">
              {businessCategoryLabel[item.owner_category]}
            </span>
          )}
          <span className="text-[11px] text-muted-foreground">{item.createdAt}</span>
        </div>
        <div className={"text-sm leading-relaxed " + (expanded ? "" : "line-clamp-2")}>
          {item.preview}
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 flex items-center gap-0.5 text-[11px] text-teal hover:underline"
        >
          {expanded ? (
            <>
              ย่อ <ChevronUp className="h-3 w-3" />
            </>
          ) : (
            <>
              ดูเพิ่มเติม <ChevronDown className="h-3 w-3" />
            </>
          )}
        </button>
        {item.status === "posted" && (
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {item.postUrl ? (
              <a
                href={item.postUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-teal hover:underline"
              >
                <ExternalLink className="h-3 w-3" /> เปิดโพสต์จริง
              </a>
            ) : (
              <span className="text-xs text-muted-foreground">ยังไม่มีลิงก์โพสต์จริงจาก user</span>
            )}
            <VerifyLikesField item={item} />
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {item.feedback &&
          (() => {
            const opt = feedbackOptions.find((o) => o.key === item.feedback);
            if (!opt) return null;
            const Icon = opt.icon;
            return <Icon className={`h-3.5 w-3.5 ${opt.activeClass}`} />;
          })()}
        <StatusBadge status={item.status} />
      </div>
    </div>
  );
}

function AdminContentPage() {
  const { ready } = useRequireAdmin();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<"all" | ContentStatus>("all");
  const [platform, setPlatform] = useState<"all" | Platform>("all");

  // Debounce so every keystroke doesn't fire a request; reset to page 1
  // whenever a filter changes so the user doesn't land on an out-of-range
  // page for the new result set.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status, platform]);

  const { data } = useQuery({
    queryKey: ["admin", "content", page, debouncedSearch, status, platform],
    queryFn: () =>
      api.adminListContent(page, PAGE_SIZE, {
        search: debouncedSearch || undefined,
        status: status === "all" ? undefined : status,
        platform: platform === "all" ? undefined : platform,
      }),
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
        <TopSummaryPanels />

        <div className="glass-card mb-4 flex flex-wrap items-center gap-3 rounded-2xl p-4">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาข้อความ, ชื่อร้าน, หรืออีเมล..."
              className="w-full rounded-full border border-border bg-input py-2.5 pl-9 pr-4 text-sm outline-none placeholder:text-muted-foreground focus:border-teal"
            />
          </div>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value as "all" | Platform)}
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
          {items.map((it) => (
            <AdminContentCard key={it.id} item={it} />
          ))}
          {items.length === 0 && (
            <div className="glass-card rounded-2xl p-10 text-center text-sm text-muted-foreground">
              {debouncedSearch || status !== "all" || platform !== "all"
                ? "ไม่พบคอนเทนต์ที่ตรงกับตัวกรองค่ะ"
                : "ยังไม่มีคอนเทนต์ที่ผู้ใช้สร้างค่ะ"}
            </div>
          )}
        </div>
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
      </div>
    </AppShell>
  );
}
