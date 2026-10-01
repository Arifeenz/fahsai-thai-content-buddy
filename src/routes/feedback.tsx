import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { CheckCircle2, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { AppShell, PageHeader, useCurrentUser } from "@/components/app-shell";
import { useRequireAuth } from "@/lib/auth-guard";
import { markSurveySubmitted, useSurveyStatus } from "@/components/survey-prompt";
import { api, businessCategoryLabel, type SurveyBusinessCategory } from "@/lib/api";
import { SURVEY_SECTIONS } from "@/lib/survey";

export const Route = createFileRoute("/feedback")({
  head: () => ({
    meta: [
      { title: "ประเมินความพึงพอใจ — FAHSAI" },
      { name: "description", content: "แบบประเมินความพึงพอใจของผู้ใช้งานระบบ FAHSAI" },
    ],
  }),
  component: FeedbackPage,
});

const SCALE = [
  { value: 5, label: "มากที่สุด" },
  { value: 4, label: "มาก" },
  { value: 3, label: "ปานกลาง" },
  { value: 2, label: "น้อย" },
  { value: 1, label: "น้อยที่สุด" },
] as const;

const CATEGORY_OPTIONS: { value: SurveyBusinessCategory; label: string }[] = [
  ...(Object.entries(businessCategoryLabel) as [SurveyBusinessCategory, string][]).map(
    ([value, label]) => ({ value, label }),
  ),
  { value: "other", label: "อื่น ๆ" },
];

const STEPS = ["ข้อมูลทั่วไป", "ความพึงพอใจ", "ข้อเสนอแนะ"] as const;
const inputClass =
  "w-full rounded-xl border border-border bg-input px-4 py-2.5 text-sm outline-none focus:border-teal";

function FeedbackPage() {
  const { ready } = useRequireAuth();
  const user = useCurrentUser();
  const queryClient = useQueryClient();
  const { visible, loaded } = useSurveyStatus(user);
  const isAdmin = user?.role === "admin";

  const [step, setStep] = useState(0);
  const [category, setCategory] = useState<SurveyBusinessCategory | null>(
    user?.business_category ?? null,
  );
  const [categoryOther, setCategoryOther] = useState("");
  const [usedAiBefore, setUsedAiBefore] = useState<boolean | null>(null);
  const [minutesBefore, setMinutesBefore] = useState("");
  const [minutesAfter, setMinutesAfter] = useState("");
  const [scores, setScores] = useState<(number | null)[]>(Array(10).fill(null));
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // business_category arrives with the "me" query, possibly after first render.
  const effectiveCategory = category ?? user?.business_category ?? null;

  const step1Valid =
    effectiveCategory !== null &&
    (effectiveCategory !== "other" || categoryOther.trim() !== "") &&
    usedAiBefore !== null &&
    isMinutes(minutesBefore) &&
    isMinutes(minutesAfter);
  const answeredCount = scores.filter((s) => s !== null).length;
  const step2Valid = answeredCount === 10;

  async function submit() {
    if (!user || !step1Valid || !step2Valid || submitting) return;
    setSubmitting(true);
    try {
      await api.submitSurvey({
        business_category: effectiveCategory!,
        business_category_other: effectiveCategory === "other" ? categoryOther.trim() : null,
        used_ai_before: usedAiBefore!,
        minutes_before: Number(minutesBefore),
        minutes_after: Number(minutesAfter),
        scores: scores as number[],
        comment: comment.trim() || null,
      });
      markSurveySubmitted(user.email);
      queryClient.invalidateQueries({ queryKey: ["survey", "me"] });
      setDone(true);
      window.scrollTo({ top: 0 });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ส่งไม่สำเร็จ ลองใหม่อีกครั้งนะคะ");
    } finally {
      setSubmitting(false);
    }
  }

  function goTo(next: number) {
    setStep(next);
    window.scrollTo({ top: 0 });
  }

  if (!ready || !loaded) {
    return (
      <AppShell>
        <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
          กำลังโหลด...
        </div>
      </AppShell>
    );
  }

  if (done || (!visible && !isAdmin)) {
    return (
      <AppShell>
        <div className="mx-auto max-w-xl p-6 md:p-8">
          <div className="glass-card rounded-2xl p-8 text-center">
            <CheckCircle2 className="mx-auto mb-4 h-14 w-14 text-teal" />
            <h1 className="mb-2 text-xl font-extrabold">ขอบคุณที่ตอบแบบประเมินค่ะ 💛</h1>
            <p className="mb-6 text-sm text-muted-foreground">
              ความเห็นของคุณจะช่วยให้ FAHSAI พัฒนาให้ดียิ่งขึ้น
            </p>
            <Link
              to="/dashboard"
              className="inline-block rounded-xl bg-gradient-to-r from-gold to-teal px-5 py-2.5 text-sm font-bold text-primary-foreground"
            >
              กลับไปหน้าแดชบอร์ด
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl p-6 md:p-8">
        <PageHeader
          title="แบบประเมินความพึงพอใจ"
          subtitle="ใช้เวลาประมาณ 2–3 นาที ข้อมูลนำเสนอในภาพรวม ไม่เปิดเผยชื่อผู้ตอบหรือร้าน"
        />

        <ol className="mb-6 grid grid-cols-3 gap-2">
          {STEPS.map((label, i) => (
            <li key={label}>
              <div
                className={"mb-1.5 h-1.5 rounded-full " + (i <= step ? "bg-teal" : "bg-white/10")}
              />
              <div
                className={
                  "text-xs " +
                  (i === step ? "font-semibold text-foreground" : "text-muted-foreground")
                }
              >
                {i + 1}. {label}
              </div>
            </li>
          ))}
        </ol>

        {step === 0 && (
          <div className="glass-card grid gap-6 rounded-2xl p-5 md:p-6">
            <Field label="1. ประเภทธุรกิจ">
              <div className="grid gap-2 sm:grid-cols-2">
                {CATEGORY_OPTIONS.map((opt) => (
                  <Choice
                    key={opt.value}
                    selected={effectiveCategory === opt.value}
                    onClick={() => setCategory(opt.value)}
                  >
                    {opt.label}
                  </Choice>
                ))}
              </div>
              {effectiveCategory === "other" && (
                <input
                  value={categoryOther}
                  onChange={(e) => setCategoryOther(e.target.value)}
                  maxLength={100}
                  placeholder="ระบุประเภทธุรกิจ"
                  className={inputClass + " mt-2"}
                />
              )}
            </Field>

            <Field label="2. เคยใช้ AI (เช่น ChatGPT) ช่วยเขียนคอนเทนต์หรือไม่">
              <div className="grid grid-cols-2 gap-2">
                <Choice selected={usedAiBefore === true} onClick={() => setUsedAiBefore(true)}>
                  เคย
                </Choice>
                <Choice selected={usedAiBefore === false} onClick={() => setUsedAiBefore(false)}>
                  ไม่เคย
                </Choice>
              </div>
            </Field>

            <Field label="3. ก่อนใช้ระบบ ท่านใช้เวลาเขียนโพสต์ 1 โพสต์ ประมาณกี่นาที">
              <MinutesInput value={minutesBefore} onChange={setMinutesBefore} />
            </Field>

            <Field label="4. หลังใช้ระบบ ท่านใช้เวลาสร้างโพสต์ 1 โพสต์ ประมาณกี่นาที">
              <MinutesInput value={minutesAfter} onChange={setMinutesAfter} />
            </Field>
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-5">
            <p className="text-sm text-muted-foreground">
              แตะตัวเลขที่ตรงกับความคิดเห็นของท่าน • 5 = มากที่สุด … 1 = น้อยที่สุด
            </p>
            {SURVEY_SECTIONS.map((section, sectionIndex) => {
              const offset = SURVEY_SECTIONS.slice(0, sectionIndex).reduce(
                (n, s) => n + s.items.length,
                0,
              );
              return (
                <div key={section.label} className="glass-card rounded-2xl p-5 md:p-6">
                  <div className="mb-4 text-sm font-bold text-teal">{section.label}</div>
                  <div className="grid gap-5">
                    {section.items.map((text, i) => {
                      const index = offset + i;
                      return (
                        <div key={index}>
                          <div className="mb-2 text-sm">
                            {index + 1}. {text}
                          </div>
                          <div className="grid grid-cols-5 gap-1.5">
                            {SCALE.map((s) => {
                              const selected = scores[index] === s.value;
                              return (
                                <button
                                  key={s.value}
                                  type="button"
                                  onClick={() =>
                                    setScores((prev) =>
                                      prev.map((v, j) => (j === index ? s.value : v)),
                                    )
                                  }
                                  className={
                                    "flex flex-col items-center rounded-xl border py-2 transition " +
                                    (selected
                                      ? "border-teal bg-teal/20 text-foreground"
                                      : "border-border text-muted-foreground hover:border-teal/50")
                                  }
                                >
                                  <span className="text-base font-bold">{s.value}</span>
                                  <span className="text-[10px] leading-tight">{s.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {step === 2 && (
          <div className="glass-card rounded-2xl p-5 md:p-6">
            <Field label="ข้อเสนอแนะ (สิ่งที่ท่านชอบ หรือสิ่งที่อยากให้ปรับปรุง) — ไม่บังคับ">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={5}
                maxLength={2000}
                placeholder="เช่น ชอบที่แคปชันเป็นภาษาไทยธรรมชาติ อยากให้มี..."
                className={inputClass}
              />
            </Field>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between gap-3">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => goTo(step - 1)}
              className="flex items-center gap-1 rounded-xl px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
              ย้อนกลับ
            </button>
          ) : (
            <span />
          )}
          {step < 2 ? (
            <button
              type="button"
              disabled={step === 0 ? !step1Valid : !step2Valid}
              onClick={() => goTo(step + 1)}
              className="flex items-center gap-1 rounded-xl bg-gradient-to-r from-gold to-teal px-5 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-40"
            >
              {step === 1 && !step2Valid ? `ตอบแล้ว ${answeredCount}/10` : "ถัดไป"}
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : isAdmin ? (
            <span className="text-sm text-muted-foreground">
              บัญชีแอดมินดูตัวอย่างได้ แต่ส่งแบบประเมินไม่ได้
            </span>
          ) : (
            <button
              type="button"
              disabled={submitting}
              onClick={submit}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-gold to-teal px-5 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              ส่งแบบประเมิน
            </button>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function isMinutes(value: string) {
  if (value.trim() === "") return false;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 1440;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-sm font-semibold">{label}</div>
      {children}
    </div>
  );
}

function Choice({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-xl border px-4 py-2.5 text-left text-sm transition " +
        (selected
          ? "border-teal bg-teal/20 font-semibold text-foreground"
          : "border-border text-muted-foreground hover:border-teal/50")
      }
    >
      {children}
    </button>
  );
}

function MinutesInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={1440}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="เช่น 30"
        className={inputClass + " max-w-32"}
      />
      <span className="text-sm text-muted-foreground">นาที</span>
    </div>
  );
}
