import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, type DnaDocType } from "@/lib/api";
import { AppShell, PageHeader } from "@/components/app-shell";
import { useRequireAuth } from "@/lib/auth-guard";
import { Dna, BookOpen, Coffee, Sparkles, MessageCircle, Wand2, Check } from "lucide-react";

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

function BrandDna() {
  const { ready } = useRequireAuth();
  const [values, setValues] = useState<Record<DnaDocType, string>>(emptyValues);
  const [savedFields, setSavedFields] = useState<Record<DnaDocType, boolean>>({
    history: false,
    menu: false,
    usp: false,
    tone: false,
  });
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
      </div>
    </AppShell>
  );
}
