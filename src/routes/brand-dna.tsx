import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, type DnaDocType } from "@/lib/api";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Dna, BookOpen, Coffee, Sparkles, MessageCircle, Save } from "lucide-react";

export const Route = createFileRoute("/brand-dna")({
  head: () => ({
    meta: [
      { title: "Brand DNA — FAHSAI" },
      { name: "description", content: "กำหนดตัวตนของแบรนด์ให้ AI เข้าใจร้านคุณ" },
      { property: "og:title", content: "Brand DNA — FAHSAI" },
      { property: "og:description", content: "กำหนดตัวตนของแบรนด์ให้ AI เข้าใจร้านคุณ" },
    ],
  }),
  component: BrandDna,
});

const sections: { key: DnaDocType; title: string; hint: string; icon: any; placeholder: string }[] = [
  { key: "history", title: "เรื่องราวของร้าน", hint: "ประวัติสั้นๆ ที่มาที่ไป", icon: BookOpen,
    placeholder: "เล่าให้ FAHSAI ฟังหน่อยค่ะ ร้านเปิดเมื่อไหร่ ใครเป็นเจ้าของ อยู่ที่ไหน..." },
  { key: "menu", title: "เมนู / สินค้าเด่น", hint: "รายการที่อยากให้ AI พูดถึงบ่อยๆ", icon: Coffee,
    placeholder: "เช่น กาแฟดริป ลาเต้ ชาชักใต้ เค้กมะพร้าว..." },
  { key: "usp", title: "จุดขายที่ไม่เหมือนใคร (USP)", hint: "อะไรที่ทำให้ร้านคุณต่างจากคนอื่น", icon: Sparkles,
    placeholder: "เช่น เมล็ดคั่วสดใหม่ทุกวัน บรรยากาศชายแดนใต้..." },
  { key: "tone", title: "น้ำเสียงของแบรนด์ (Tone)", hint: "อยากให้ AI พูดกับลูกค้าแบบไหน", icon: MessageCircle,
    placeholder: "เช่น อบอุ่น เป็นกันเอง ใช้คำว่า ค่ะ/ครับ ไม่เป็นทางการ..." },
];

function BrandDna() {
  const [values, setValues] = useState<Record<DnaDocType, string>>({ history: "", menu: "", usp: "", tone: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getDna().then(setValues);
  }, []);

  async function save() {
    setSaving(true);
    const t = toast.loading("กำลังบันทึก Brand DNA ให้อยู่ค่ะ...");
    try {
      await api.saveDna(values);
      toast.success("บันทึก Brand DNA เรียบร้อยแล้วค่ะ ✨", { id: t });
    } catch {
      toast.error("บันทึกไม่สำเร็จ ลองใหม่อีกครั้งนะคะ", { id: t, action: { label: "ลองใหม่", onClick: save } });
    } finally { setSaving(false); }
  }

  return (
    <AppShell>
      <div className="p-6 md:p-8">
        <PageHeader title="Brand DNA" subtitle="ตัวตนของแบรนด์คุณ วิเคราะห์และปรุงแต่งโดย AI" />

        <div className="glass-card mb-6 flex items-center gap-4 rounded-2xl p-5">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-gold/30 to-teal/30 text-gold">
            <Dna className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <div className="font-bold">ยิ่งเล่าละเอียด AI ยิ่งเขียนได้ตรงใจค่ะ</div>
            <div className="text-sm text-muted-foreground">FAHSAI ใช้ข้อมูลเหล่านี้เพื่อเขียนโพสต์ที่เป็นตัวตนของร้านคุณจริงๆ</div>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {sections.map(({ key, title, hint, icon: Icon, placeholder }) => (
            <div key={key} className="glass-card rounded-2xl p-5">
              <div className="mb-3 flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-white/5 text-teal">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-bold">{title}</div>
                  <div className="text-xs text-muted-foreground">{hint}</div>
                </div>
              </div>
              <textarea
                value={values[key]}
                onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                placeholder={placeholder}
                rows={5}
                className="w-full resize-none rounded-xl border border-border bg-input p-3 text-base outline-none placeholder:text-muted-foreground focus:border-teal"
              />
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end">
          <button onClick={save} disabled={saving} className="btn-gold inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm disabled:opacity-60">
            <Save className="h-4 w-4" />
            {saving ? "กำลังบันทึก..." : "บันทึก Brand DNA"}
          </button>
        </div>
      </div>
    </AppShell>
  );
}
