import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { api, categoryDisplayLabel, type LikertStats, type SurveySummary } from "@/lib/api";
import { AppShell, PageHeader } from "@/components/app-shell";
import { useRequireAdmin } from "@/lib/admin-guard";
import { SURVEY_SECTIONS } from "@/lib/survey";

export const Route = createFileRoute("/admin/survey")({
  head: () => ({
    meta: [
      { title: "ผลแบบประเมิน — แอดมิน FAHSAI" },
      { name: "description", content: "สรุปผลแบบประเมินความพึงพอใจของผู้ใช้งาน" },
    ],
  }),
  component: AdminSurveyPage,
});

const ITEM_TEXTS = SURVEY_SECTIONS.flatMap((s) => s.items);

function AdminSurveyPage() {
  const { ready } = useRequireAdmin();
  const [includeDemo, setIncludeDemo] = useState(true);
  const { data } = useQuery({
    queryKey: ["admin", "survey", includeDemo],
    queryFn: () => api.adminGetSurveySummary(includeDemo),
    placeholderData: keepPreviousData,
    enabled: ready,
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
          title="ผลแบบประเมินความพึงพอใจ"
          subtitle="ค่าเฉลี่ย (x̄) และส่วนเบี่ยงเบนมาตรฐาน (S.D.) แปลผลตามเกณฑ์ 5 ระดับ • ไม่แสดงตัวตนผู้ตอบ"
        />

        <div className="mb-6 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeDemo}
              onChange={(e) => setIncludeDemo(e.target.checked)}
            />
            รวมคำตอบจากบัญชีทดลอง (demo)
          </label>
          <button
            type="button"
            disabled={!data || data.total === 0}
            onClick={() => data && downloadCsv(data)}
            className="ml-auto flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium hover:border-teal disabled:opacity-40"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>

        {!data ? (
          <div className="text-sm text-muted-foreground">กำลังโหลด...</div>
        ) : data.total === 0 ? (
          <div className="glass-card rounded-2xl p-8 text-center text-sm text-muted-foreground">
            ยังไม่มีผู้ตอบแบบประเมิน
          </div>
        ) : (
          <SummaryView data={data} />
        )}
      </div>
    </AppShell>
  );
}

function SummaryView({ data }: { data: SurveySummary }) {
  const { time } = data;
  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="จำนวนผู้ตอบ"
          value={`${data.total} คน`}
          hint={data.demo_count > 0 ? `บัญชีทดลอง ${data.demo_count} คน` : undefined}
        />
        <Stat
          label="ความพึงพอใจภาพรวม"
          value={fmt(data.overall.mean)}
          hint={`S.D. ${fmt(data.overall.sd)} • ระดับ${data.overall.level}`}
        />
        <Stat
          label="เวลาเขียนโพสต์ ก่อน → หลัง"
          value={`${time.mean_minutes_before ?? "—"} → ${time.mean_minutes_after ?? "—"} นาที`}
          hint={
            time.reduction_percent !== null
              ? `ลดลง ${time.reduction_percent}%`
              : "ไม่มีข้อมูลเวลาก่อนใช้"
          }
        />
        <Stat
          label="เคยใช้ AI มาก่อน"
          value={`${data.used_ai_before_count} คน`}
          hint={`${Math.round((data.used_ai_before_count / data.total) * 100)}% ของผู้ตอบ`}
        />
      </div>

      <div className="glass-card overflow-x-auto rounded-2xl">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="p-4 font-medium">รายการประเมิน</th>
              <th className="p-4 text-center font-medium">x̄</th>
              <th className="p-4 text-center font-medium">S.D.</th>
              <th className="p-4 text-center font-medium">ระดับ</th>
            </tr>
          </thead>
          <tbody>
            {data.dimensions.map((dim) => (
              <DimensionRows key={dim.key} dim={dim} items={data.items} />
            ))}
            <tr className="border-t-2 border-border font-bold">
              <td className="p-4">รวมทุกด้าน</td>
              <StatCells stats={data.overall} />
            </tr>
          </tbody>
        </table>
      </div>

      <div className="glass-card rounded-2xl p-5">
        <div className="mb-3 text-sm font-bold">ประเภทธุรกิจของผู้ตอบ</div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(data.by_category).map(([category, count]) => (
            <span key={category} className="rounded-full bg-white/5 px-3 py-1 text-xs">
              {category === "other" ? "อื่น ๆ" : categoryDisplayLabel(category)} • {count} คน
            </span>
          ))}
        </div>
      </div>

      <div className="glass-card rounded-2xl p-5">
        <div className="mb-3 text-sm font-bold">ข้อเสนอแนะ</div>
        <div className="grid gap-3">
          {data.responses.filter((r) => r.comment).length === 0 && (
            <div className="text-sm text-muted-foreground">ยังไม่มีข้อเสนอแนะ</div>
          )}
          {data.responses
            .filter((r) => r.comment)
            .map((r) => (
              <div key={r.id} className="rounded-xl bg-white/5 p-3 text-sm">
                <div className="whitespace-pre-wrap">{r.comment}</div>
                <div className="mt-1.5 text-[11px] text-muted-foreground">
                  {r.business_category === "other"
                    ? r.business_category_other
                    : categoryDisplayLabel(r.business_category)}
                  {r.is_demo ? " • บัญชีทดลอง" : ""} •{" "}
                  {new Date(r.created_at).toLocaleDateString("th-TH")}
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

function DimensionRows({
  dim,
  items,
}: {
  dim: SurveySummary["dimensions"][number];
  items: SurveySummary["items"];
}) {
  return (
    <>
      <tr className="border-b border-border bg-white/5 font-semibold">
        <td className="p-4">{dim.label}</td>
        <StatCells stats={dim} />
      </tr>
      {dim.items.length > 1 &&
        dim.items.map((n) => (
          <tr key={n} className="border-b border-border/50">
            <td className="p-4 pl-8 text-muted-foreground">
              {n}. {ITEM_TEXTS[n - 1]}
            </td>
            <StatCells stats={items[n - 1]} />
          </tr>
        ))}
    </>
  );
}

function StatCells({ stats }: { stats: LikertStats }) {
  return (
    <>
      <td className="p-4 text-center">{fmt(stats.mean)}</td>
      <td className="p-4 text-center">{fmt(stats.sd)}</td>
      <td className="p-4 text-center">{stats.level ?? "—"}</td>
    </>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-extrabold">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function fmt(n: number | null) {
  return n === null ? "—" : n.toFixed(2);
}

// One row per response, columns matching the paper questionnaire, so the
// file can go straight into Excel/SPSS for the report's chapter 4.
function downloadCsv(data: SurveySummary) {
  const header = [
    "id",
    "created_at",
    "is_demo",
    "business_category",
    "business_category_other",
    "used_ai_before",
    "minutes_before",
    "minutes_after",
    ...Array.from({ length: 10 }, (_, i) => `q${i + 1}`),
    "comment",
  ];
  const rows = data.responses.map((r) => [
    r.id,
    r.created_at,
    r.is_demo,
    r.business_category,
    r.business_category_other ?? "",
    r.used_ai_before,
    r.minutes_before,
    r.minutes_after,
    ...r.scores,
    r.comment ?? "",
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
  // BOM so Excel opens the Thai text as UTF-8 instead of mojibake.
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `fahsai-survey-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
