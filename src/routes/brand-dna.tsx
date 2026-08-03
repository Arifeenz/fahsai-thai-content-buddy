import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { api, type DnaDocType } from "@/lib/api";
import { AppShell, PageHeader } from "@/components/app-shell";
import { useRequireAuth } from "@/lib/auth-guard";
import {
  Dna,
  BookOpen,
  Coffee,
  Sparkles,
  MessageCircle,
  Wand2,
  Check,
  Loader2,
  AlertTriangle,
} from "lucide-react";

export const Route = createFileRoute("/brand-dna")({
  head: () => ({
    meta: [
      { title: "อัตลักษณ์แบรนด์ — FAHSAI" },
      { name: "description", content: "กำหนดตัวตนของแบรนด์ให้ AI เข้าใจร้านคุณ" },
      { property: "og:title", content: "อัตลักษณ์แบรนด์ — FAHSAI" },
      { property: "og:description", content: "กำหนดตัวตนของแบรนด์ให้ AI เข้าใจร้านคุณ" },
    ],
  }),
  component: BrandDna,
});

const sections: {
  key: DnaDocType;
  title: string;
  hint: string;
  icon: any;
  placeholder: string;
  example: string;
}[] = [
  {
    key: "history",
    title: "เรื่องราวของร้าน",
    hint: "ประวัติสั้นๆ ที่มาที่ไป",
    icon: BookOpen,
    placeholder: "เล่าให้ FAHSAI ฟังหน่อยค่ะ ร้านเปิดเมื่อไหร่ ใครเป็นเจ้าของ อยู่ที่ไหน...",
    example: "ร้านเปิดที่ยะลาปี 2565 เริ่มจากคั่วเมล็ดในบ้านเล็กๆ ก่อนขยายเป็นคาเฟ่ริมถนน",
  },
  {
    key: "menu",
    title: "เมนู / สินค้าเด่น",
    hint: "รายการที่อยากให้ AI พูดถึงบ่อยๆ",
    icon: Coffee,
    placeholder: "เช่น กาแฟดริป ลาเต้ ชาชักใต้ เค้กมะพร้าว...",
    example: "กาแฟดริป ลาเต้ อเมริกาโน่ กาแฟส้ม เค้กมะพร้าว ชาชักใต้",
  },
  {
    key: "usp",
    title: "จุดขายที่ไม่เหมือนใคร (USP)",
    hint: "อะไรที่ทำให้ร้านคุณต่างจากคนอื่น",
    icon: Sparkles,
    placeholder: "เช่น เมล็ดคั่วสดใหม่ทุกวัน บรรยากาศชายแดนใต้...",
    example: "เมล็ดคั่วสดใหม่ทุกวัน บรรยากาศอบอุ่นแบบชายแดนใต้ พนักงานพูดได้สามภาษา",
  },
  {
    key: "tone",
    title: "บุคลิกแบรนด์",
    hint: "เลือกบุคลิกที่ใกล้เคียงร้านคุณที่สุด",
    icon: MessageCircle,
    placeholder: "เลือกบุคลิกด้านล่าง หรือพิมพ์เองก็ได้ค่ะ...",
    example: "อบอุ่น เป็นกันเอง ใช้คำว่า 'ค่ะ/ครับ' พูดเหมือนเพื่อนบ้านทักทาย ไม่เป็นทางการ",
  },
];

const personalityOptions = [
  {
    label: "อบอุ่น เป็นกันเอง",
    sentence: "อบอุ่น เป็นกันเอง ใช้คำว่า 'ค่ะ/ครับ' พูดเหมือนเพื่อนบ้านทักทาย ไม่เป็นทางการ",
  },
  {
    label: "มืออาชีพ น่าเชื่อถือ",
    sentence: "สุภาพ น่าเชื่อถือ ให้ข้อมูลชัดเจนตรงประเด็น ใช้ภาษาทางการแต่ยังเป็นมิตร",
  },
  {
    label: "สนุกสนาน มีชีวิตชีวา",
    sentence: "สนุกสนาน มีชีวิตชีวา ใช้มุกตลกและอีโมจิได้ พูดคุยกันเองสุดๆ เหมือนเพื่อนซี้",
  },
  {
    label: "หรูหรา พรีเมียม",
    sentence: "หรูหรา ประณีต ใช้ภาษาที่ดูมีระดับ เน้นคุณภาพและความพิเศษเฉพาะตัว",
  },
];

const emptyValues: Record<DnaDocType, string> = { history: "", menu: "", usp: "", tone: "" };
const AUTOSAVE_DELAY = 800;
const MIN_FREE_TEXT_LENGTH = 20;

type EntryMode = "fields" | "single";

function BrandDna() {
  const { ready } = useRequireAuth();
  const [values, setValues] = useState<Record<DnaDocType, string>>(emptyValues);
  const [savedFields, setSavedFields] = useState<Record<DnaDocType, boolean>>({
    history: false,
    menu: false,
    usp: false,
    tone: false,
  });
  const [entryMode, setEntryMode] = useState<EntryMode>("fields");
  const [freeText, setFreeText] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [missingFields, setMissingFields] = useState<DnaDocType[] | null>(null);
  const [pendingDraft, setPendingDraft] = useState<Record<DnaDocType, string> | null>(null);
  const valuesRef = useRef(values);
  const timers = useRef<Partial<Record<DnaDocType, ReturnType<typeof setTimeout>>>>({});

  useEffect(() => {
    api.getDna().then((loaded) => {
      setValues(loaded);
      valuesRef.current = loaded;
      setSavedFields({
        history: !!loaded.history,
        menu: !!loaded.menu,
        usp: !!loaded.usp,
        tone: !!loaded.tone,
      });
    });
  }, []);

  useEffect(() => {
    const timersAtMount = timers.current;
    return () => {
      Object.values(timersAtMount).forEach((t) => t && clearTimeout(t));
    };
  }, []);

  const filledCount = useMemo(
    () => sections.filter((s) => values[s.key].trim() !== "").length,
    [values],
  );

  function updateField(key: DnaDocType, value: string) {
    const next = { ...valuesRef.current, [key]: value };
    valuesRef.current = next;
    setValues(next);
    setSavedFields((s) => ({ ...s, [key]: false }));

    const existingTimer = timers.current[key];
    if (existingTimer) clearTimeout(existingTimer);
    timers.current[key] = setTimeout(async () => {
      await api.saveDna(valuesRef.current);
      setSavedFields((s) => ({ ...s, [key]: true }));
    }, AUTOSAVE_DELAY);
  }

  function selectPersonality(sentence: string) {
    updateField("tone", sentence);
  }

  async function applyDraft(draft: Record<DnaDocType, string>) {
    const merged = { ...valuesRef.current };
    (Object.keys(draft) as DnaDocType[]).forEach((key) => {
      if (draft[key]) merged[key] = draft[key];
    });
    valuesRef.current = merged;
    setValues(merged);
    await api.saveDna(merged);
    setSavedFields({
      history: !!merged.history,
      menu: !!merged.menu,
      usp: !!merged.usp,
      tone: !!merged.tone,
    });
    setEntryMode("fields");
    setMissingFields(null);
    setPendingDraft(null);
    setFreeText("");
  }

  async function handleDraft() {
    if (freeText.trim().length < MIN_FREE_TEXT_LENGTH || drafting) return;
    setDrafting(true);
    setMissingFields(null);
    setPendingDraft(null);
    try {
      const { missing_fields, ...draft } = await api.draftDna(freeText);
      if (missing_fields.length === 0) {
        await applyDraft(draft);
        toast.success("จัดข้อมูลครบ 4 หมวดแล้วค่ะ ลองตรวจสอบอีกครั้งได้เลย");
      } else {
        setMissingFields(missing_fields);
        setPendingDraft(draft);
      }
    } catch (err) {
      toast.error(
        err instanceof Error && err.message
          ? err.message
          : "จัดข้อมูลไม่สำเร็จ ลองใหม่อีกครั้งนะคะ",
      );
    } finally {
      setDrafting(false);
    }
  }

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
          title="อัตลักษณ์แบรนด์"
          subtitle="ตัวตนของแบรนด์คุณ วิเคราะห์และปรุงแต่งโดย AI"
        />

        <div className="glass-card mb-6 rounded-2xl p-5">
          <div className="flex items-center gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-gold/30 to-teal/30 text-gold">
              <Dna className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <div className="font-bold">ยิ่งเล่าละเอียด AI ยิ่งเขียนได้ตรงใจค่ะ</div>
                <div className="shrink-0 text-xs font-semibold text-teal">
                  กรอกแล้ว {filledCount}/{sections.length} หัวข้อ
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                FAHSAI ใช้ข้อมูลเหล่านี้เพื่อเขียนโพสต์ที่เป็นตัวตนของร้านคุณจริงๆ
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-teal to-gold transition-all"
                  style={{ width: `${(filledCount / sections.length) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6 flex gap-2">
          <button
            type="button"
            onClick={() => setEntryMode("fields")}
            className={
              "rounded-full border px-4 py-1.5 text-sm transition " +
              (entryMode === "fields"
                ? "border-teal bg-teal/15 text-teal"
                : "border-border text-muted-foreground hover:text-foreground")
            }
          >
            กรอกทีละช่อง
          </button>
          <button
            type="button"
            onClick={() => setEntryMode("single")}
            className={
              "rounded-full border px-4 py-1.5 text-sm transition " +
              (entryMode === "single"
                ? "border-teal bg-teal/15 text-teal"
                : "border-border text-muted-foreground hover:text-foreground")
            }
          >
            เล่าให้ฟังช่องเดียว
          </button>
        </div>

        {entryMode === "single" && (
          <div className="glass-card mb-6 rounded-2xl p-5">
            <div className="mb-2 font-bold">เล่าเรื่องร้านให้ FAHSAI ฟังหน่อยค่ะ</div>
            <div className="mb-3 text-sm text-muted-foreground">
              พิมพ์คร่าวๆ ก็ได้ค่ะ ที่มาร้าน เมนู/สินค้าเด่น จุดขาย และบุคลิกร้านเป็นยังไง แล้ว
              FAHSAI จะช่วยแยกใส่ 4 หัวข้อให้เอง
            </div>
            <textarea
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              rows={6}
              placeholder="เช่น ร้านกาแฟเปิดที่ยะลามา 3 ปี เน้นเมล็ดกาแฟจากไร่ภาคใต้ เมนูเด่นคือกาแฟส้มกับลาเต้เย็น อยากให้เขียนโพสต์แบบเป็นกันเองอบอุ่นเหมือนคุยกับเพื่อน..."
              className="w-full resize-none rounded-xl border border-border bg-input p-3 text-base outline-none placeholder:text-muted-foreground focus:border-teal"
            />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleDraft}
                disabled={freeText.trim().length < MIN_FREE_TEXT_LENGTH || drafting}
                className="btn-gold inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm disabled:opacity-60"
              >
                {drafting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Wand2 className="h-4 w-4" />
                )}
                {drafting ? "กำลังจัดข้อมูลให้อยู่ค่ะ..." : "ให้ AI ช่วยจัดให้ครบ 4 หมวด"}
              </button>
              {freeText.trim().length > 0 && freeText.trim().length < MIN_FREE_TEXT_LENGTH && (
                <span className="text-xs text-muted-foreground">
                  เล่าเพิ่มอีกนิดนะคะ (อย่างน้อย {MIN_FREE_TEXT_LENGTH} ตัวอักษร)
                </span>
              )}
            </div>

            {missingFields && missingFields.length > 0 && (
              <div className="mt-4 rounded-xl border border-dashed border-gold/50 bg-gold/10 p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                  <div className="text-sm">
                    <div className="font-semibold text-gold">
                      AI ยังไม่มั่นใจเรื่อง:{" "}
                      {missingFields
                        .map((key) => sections.find((s) => s.key === key)?.title ?? key)
                        .join(", ")}
                    </div>
                    <div className="mt-1 text-muted-foreground">
                      ลองเล่าเพิ่มอีกนิดในช่องด้านบนแล้วกดอีกครั้ง
                      หรือใช้เท่าที่มีไปก่อนแล้วไปเติมทีละช่องทีหลังก็ได้ค่ะ
                    </div>
                    <button
                      type="button"
                      onClick={() => pendingDraft && applyDraft(pendingDraft)}
                      className="mt-2 text-sm text-teal underline underline-offset-4 hover:text-teal/80"
                    >
                      ใช้เท่าที่มีไปก่อน
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {entryMode === "fields" && (
          <div className="grid gap-5 md:grid-cols-2">
            {sections.map(({ key, title, hint, icon: Icon, placeholder, example }) => (
              <div key={key} className="glass-card rounded-2xl p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-lg bg-white/5 text-teal">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-bold">{title}</div>
                      <div className="text-xs text-muted-foreground">{hint}</div>
                    </div>
                  </div>
                  {savedFields[key] && values[key] && (
                    <span className="flex shrink-0 items-center gap-1 text-xs text-success">
                      <Check className="h-3.5 w-3.5" /> บันทึกแล้ว
                    </span>
                  )}
                </div>

                {key === "tone" && (
                  <div className="mb-3 grid grid-cols-2 gap-1.5">
                    {personalityOptions.map((opt) => {
                      const active = values.tone === opt.sentence;
                      return (
                        <button
                          key={opt.label}
                          type="button"
                          onClick={() => selectPersonality(opt.sentence)}
                          className={
                            "rounded-xl border px-3 py-2 text-left text-xs font-medium transition " +
                            (active
                              ? "border-teal bg-teal/15 text-teal"
                              : "border-border text-muted-foreground hover:border-teal hover:text-teal")
                          }
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                )}

                <textarea
                  value={values[key]}
                  onChange={(e) => updateField(key, e.target.value)}
                  placeholder={placeholder}
                  rows={5}
                  className="w-full resize-none rounded-xl border border-border bg-input p-3 text-base outline-none placeholder:text-muted-foreground focus:border-teal"
                />

                {key !== "tone" && !values[key] && (
                  <button
                    type="button"
                    onClick={() => updateField(key, example)}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs text-teal hover:underline"
                  >
                    <Wand2 className="h-3.5 w-3.5" /> ลองตัวอย่าง
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
