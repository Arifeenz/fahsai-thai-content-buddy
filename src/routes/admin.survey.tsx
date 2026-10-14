import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import {
  api,
  categoryDisplayLabel,
  type LikertStats,
  type SurveySummary,
  type SurveyTimeBlock,
  type SurveyVersionSummary,
} from "@/lib/api";
import { AppShell, PageHeader } from "@/components/app-shell";
import { useRequireAdmin } from "@/lib/admin-guard";
import { SURVEY_SECTIONS, SURVEY_V2_SECTIONS } from "@/lib/survey";

export const Route = createFileRoute("/admin/survey")({
  head: () => ({
    meta: [
      { title: "ผลแบบประเมิน — แอดมิน FAHSAI" },
      { name: "description", content: "สรุปผลแบบประเมินความพึงพอใจของผู้ใช้งาน" },
    ],
  }),
  component: AdminSurveyPage,
});

// Item number -> question text, per version ("1".."10" for v1, "1.1".."5.5" for v2).
const ITEM_TEXT: Record<1 | 2, Record<string, string>> = {
  1: Object.fromEntries(
    SURVEY_SECTIONS.flatMap((s) => s.items).map((text, i) => [String(i + 1), text]),
  ),
  2: Object.fromEntries(
    SURVEY_V2_SECTIONS.flatMap((s, d) => s.items.map((text, i) => [`${d + 1}.${i + 1}`, text])),
  ),
};

function AdminSurveyPage() {
  const { ready } = useRequireAdmin();
  const [tab, setTab] = useState<1 | 2>(2);
  const { data } = useQuery({
    queryKey: ["admin", "survey"],
    queryFn: () => api.adminGetSurveySummary(),
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
          subtitle="x̄ และ S.D. (แบบตัวอย่าง n − 1) แปลผลตามเกณฑ์ 5 ระดับ • ไม่รวมบัญชีทดลอง • ไม่แสดงตัวตนผู้ตอบ"
        />

        <div className="mb-6 flex justify-end">
          <button
            type="button"
            disabled={!data || data.responses.length === 0}
            onClick={() => data && downloadCsv(data)}
            className="flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium hover:border-teal disabled:opacity-40"
          >
            <Download className="h-4 w-4" />
            Export CSV (v1 + v2)
          </button>
        </div>

        {!data ? (
          <div className="text-sm text-muted-foreground">กำลังโหลด...</div>
        ) : (
          // minmax(0,1fr): grid items default to min-width:auto and would grow to the
          // tables' 560px, widening the whole page instead of scrolling the table
          <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
            <TimeSection time={data.time} />

            <div
              role="tablist"
              className="grid w-full max-w-sm grid-cols-2 gap-1 rounded-xl border border-border bg-input/40 p-1"
            >
              {([2, 1] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="tab"
                  aria-selected={tab === v}
                  onClick={() => setTab(v)}
                  className={
                    "rounded-lg py-2 text-sm transition " +
                    (tab === v
                      ? "bg-teal/20 font-semibold"
                      : "text-muted-foreground hover:text-foreground")
                  }
                >
                  {v === 2 ? "ฉบับที่ 2 (25 ข้อ)" : "ฉบับที่ 1 (10 ข้อ)"} ·{" "}
                  {v === 2 ? data.v2.total : data.v1.total} คน
                </button>
              ))}
            </div>

            <VersionSection
              summary={tab === 2 ? data.v2 : data.v1}
              version={tab}
              comments={data.responses.filter((r) => r.survey_version === tab && r.comment)}
            />
          </div>
        )}
      </div>
    </AppShell>
  );
}

function TimeSection({ time }: { time: SurveySummary["time"] }) {
  const categories = Object.entries(time.by_category);
  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="mb-1 text-sm font-bold">เวลาที่ใช้เขียนโพสต์ 1 โพสต์ (รวมทั้งสองฉบับ)</div>
      <div className="mb-4 text-xs text-muted-foreground">
        นับคนละ 1 คำตอบ ถ้าตอบทั้งสองฉบับใช้คำตอบฉบับที่ 2 • n = {time.n} (จากฉบับที่ 1{" "}
        {time.from_v1} คน, ฉบับที่ 2 {time.from_v2} คน) • เคยใช้ AI มาก่อน{" "}
        {time.used_ai_before_count} คน
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="p-3 font-medium">กลุ่ม</th>
              <th className="p-3 text-center font-medium">n</th>
              <th className="p-3 text-center font-medium">ก่อนใช้ x̄ (S.D.)</th>
              <th className="p-3 text-center font-medium">หลังใช้ x̄ (S.D.)</th>
              <th className="p-3 text-center font-medium">ลดลง (%)</th>
            </tr>
          </thead>
          <tbody>
            <TimeRow label="รวมทุกประเภท" block={time} bold />
            {categories.map(([category, block]) => (
              <TimeRow
                key={category}
                label={category === "other" ? "อื่น ๆ" : categoryDisplayLabel(category)}
                block={block}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TimeRow({
  label,
  block,
  bold,
}: {
  label: string;
  block: SurveyTimeBlock;
  bold?: boolean;
}) {
  return (
    <tr className={"border-b border-border/50 " + (bold ? "font-semibold" : "")}>
      <td className="p-3">{label}</td>
      <td className="p-3 text-center">{block.n}</td>
      <td className="p-3 text-center">{minutes(block.minutes_before)}</td>
      <td className="p-3 text-center">{minutes(block.minutes_after)}</td>
      <td className="p-3 text-center">
        {block.reduction_percent === null ? "—" : block.reduction_percent.toFixed(1)}
      </td>
    </tr>
  );
}

function VersionSection({
  summary,
  version,
  comments,
}: {
  summary: SurveyVersionSummary;
  version: 1 | 2;
  comments: SurveySummary["responses"];
}) {
  if (summary.total === 0) {
    return (
      <div className="glass-card rounded-2xl p-8 text-center text-sm text-muted-foreground">
        ยังไม่มีผู้ตอบแบบประเมินฉบับนี้
      </div>
    );
  }
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="จำนวนผู้ตอบ" value={`${summary.total} คน`} />
        <Stat
          label="ความพึงพอใจภาพรวม"
          value={fmt(summary.overall.mean)}
          hint={`S.D. ${fmt(summary.overall.sd)} • ระดับ${summary.overall.level}`}
        />
        <Stat
          label="เคยใช้ AI มาก่อน"
          value={`${summary.used_ai_before_count} คน`}
          hint={Object.entries(summary.by_category)
            .map(([c, n]) => `${c === "other" ? "อื่น ๆ" : categoryDisplayLabel(c)} ${n}`)
            .join(" • ")}
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
            {summary.dimensions.map((dim) => (
              <DimensionRows key={dim.key} dim={dim} summary={summary} version={version} />
            ))}
            <tr className="border-t-2 border-border font-bold">
              <td className="p-4">รวมทุกด้าน</td>
              <StatCells stats={summary.overall} />
            </tr>
          </tbody>
        </table>
      </div>

      <div className="glass-card rounded-2xl p-5">
        <div className="mb-3 text-sm font-bold">ข้อเสนอแนะ</div>
        <div className="grid gap-3">
          {comments.length === 0 && (
            <div className="text-sm text-muted-foreground">ยังไม่มีข้อเสนอแนะ</div>
          )}
          {comments.map((r) => (
            <div key={r.id} className="rounded-xl bg-white/5 p-3 text-sm">
              <div className="whitespace-pre-wrap">{r.comment}</div>
              <div className="mt-1.5 text-[11px] text-muted-foreground">
                {r.business_category === "other"
                  ? r.business_category_other
                  : categoryDisplayLabel(r.business_category)}{" "}
                • {new Date(r.created_at).toLocaleDateString("th-TH")}
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
  summary,
  version,
}: {
  dim: SurveyVersionSummary["dimensions"][number];
  summary: SurveyVersionSummary;
  version: 1 | 2;
}) {
  return (
    <>
      <tr className="border-b border-border bg-white/5 font-semibold">
        <td className="p-4">{dim.label}</td>
        <StatCells stats={dim} />
      </tr>
      {dim.items.length > 1 &&
        dim.items.map((item) => (
          <tr key={item} className="border-b border-border/50">
            <td className="p-4 pl-8 text-muted-foreground">
              {item} {ITEM_TEXT[version][item]}
            </td>
            <StatCells stats={summary.items.find((i) => i.item === item)!} />
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

function minutes(s: { mean: number | null; sd: number | null }) {
  return s.mean === null ? "—" : `${s.mean.toFixed(1)} (${(s.sd ?? 0).toFixed(1)})`;
}

const V1_COLUMNS = Array.from({ length: 10 }, (_, i) => `q${i + 1}`);
const V2_COLUMNS = Array.from({ length: 25 }, (_, k) => `a${Math.floor(k / 5) + 1}_${(k % 5) + 1}`);

// One row per response from both rounds (demo accounts excluded), one column
// per questionnaire item, so the file goes straight into Excel/SPSS.
function downloadCsv(data: SurveySummary) {
  const header = [
    "id",
    "survey_version",
    "created_at",
    "business_category",
    "business_category_other",
    "used_ai_before",
    "minutes_before",
    "minutes_after",
    ...V1_COLUMNS,
    ...V2_COLUMNS,
    "comment",
  ];
  const rows = data.responses.map((r) => {
    const v1 = r.survey_version === 1 ? r.scores : V1_COLUMNS.map(() => "");
    const v2 = r.survey_version === 2 ? r.scores : V2_COLUMNS.map(() => "");
    return [
      r.id,
      r.survey_version,
      r.created_at,
      r.business_category,
      r.business_category_other ?? "",
      r.used_ai_before,
      r.minutes_before,
      r.minutes_after,
      ...v1,
      ...v2,
      r.comment ?? "",
    ];
  });
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
