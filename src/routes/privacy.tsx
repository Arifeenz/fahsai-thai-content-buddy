import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import logo from "@/assets/fahsai-logo.png";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "นโยบายความเป็นส่วนตัว — FAHSAI" },
      {
        name: "description",
        content: "นโยบายความเป็นส่วนตัวของ FAHSAI: เราเก็บ ใช้ และดูแลข้อมูลของคุณอย่างไร",
      },
    ],
  }),
  component: PrivacyPage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function PrivacyPage() {
  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-12">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/4 top-1/3 h-96 w-96 -translate-x-1/2 rounded-full bg-gold/10 blur-3xl" />
        <div className="absolute right-1/4 bottom-1/3 h-96 w-96 rounded-full bg-teal/15 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-3xl">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> กลับหน้าแรก
        </Link>

        <div className="glass-card mt-6 rounded-[2rem] p-8 sm:p-12">
          <div className="flex items-center gap-3">
            <img src={logo} alt="FAHSAI" className="h-10 w-10" />
            <span className="text-lg font-extrabold tracking-[0.15em]">FAHSAI</span>
          </div>

          <h1 className="mt-6 text-2xl font-bold text-foreground">นโยบายความเป็นส่วนตัว</h1>
          <p className="mt-2 text-xs text-muted-foreground">ปรับปรุงล่าสุด: 30 สิงหาคม 2569</p>

          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            FAHSAI ("เรา") เป็นผู้ช่วย AI สร้างคอนเทนต์การตลาดสำหรับร้าน SME นโยบายนี้อธิบายว่าเราเก็บ
            ใช้ และดูแลข้อมูลส่วนบุคคลของคุณอย่างไร ตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562
            (PDPA)
          </p>

          <Section title="ข้อมูลที่เราเก็บ">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>ข้อมูลบัญชี: อีเมล ชื่อ รหัสผ่าน (เข้ารหัสแล้ว) หรือข้อมูลจาก Google เมื่อล็อกอินด้วย Google</li>
              <li>ข้อมูลร้าน (Brand DNA): ประวัติร้าน เมนู/สินค้า จุดขาย บุคลิกแบรนด์ กลุ่มลูกค้าเป้าหมาย</li>
              <li>ตัวอย่างโพสต์และรูปภาพที่คุณอัปโหลด</li>
              <li>คอนเทนต์ที่สร้างผ่านระบบ (แคปชั่น สคริปวิดีโอ) และประวัติการใช้งาน</li>
              <li>ข้อมูลทีม: อีเมลที่เชิญเข้าทีม สิทธิ์การเข้าถึงที่กำหนด</li>
              <li>ข้อมูลที่จำเป็นต่อความปลอดภัย เช่น log การล็อกอิน เหตุการณ์ต้องสงสัย</li>
              <li>ข้อความที่คุณส่งผ่านระบบแจ้งปัญหา (support ticket)</li>
            </ul>
          </Section>

          <Section title="เราใช้ข้อมูลไปทำอะไร">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>ให้บริการหลักของระบบ: ยืนยันตัวตน สร้างคอนเทนต์ที่ตรงกับตัวตนร้านคุณ จัดการทีม/ปฏิทินโพสต์</li>
              <li>ดูแลความปลอดภัยของระบบและป้องกันการใช้งานผิดวัตถุประสงค์</li>
              <li>ติดต่อสื่อสารที่จำเป็น เช่น อีเมลยืนยันตัวตน รีเซ็ตรหัสผ่าน คำเชิญเข้าทีม</li>
              <li>ปรับปรุงคุณภาพบริการ</li>
            </ul>
          </Section>

          <Section title="เราแชร์ข้อมูลกับใครบ้าง">
            <p>
              เราไม่ขายข้อมูลของคุณให้ใคร แต่ใช้บริการภายนอกต่อไปนี้เพื่อให้ระบบทำงานได้
              (ในฐานะผู้ประมวลผลข้อมูลแทนเรา):
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <span className="font-medium text-foreground">OpenAI</span> — ประมวลผลข้อมูลร้านและคำสั่งของคุณ
                เพื่อสร้างแคปชั่น/สคริปต์
              </li>
              <li>
                <span className="font-medium text-foreground">Supabase</span> —
                เก็บฐานข้อมูลและไฟล์รูปภาพที่คุณอัปโหลด
              </li>
              <li>
                <span className="font-medium text-foreground">Google</span> —
                ใช้สำหรับยืนยันตัวตนแบบ OAuth
              </li>
              <li>
                <span className="font-medium text-foreground">Resend</span> —
                ใช้ส่งอีเมลแจ้งเตือน/ยืนยันตัวตน/คำเชิญทีม
              </li>
            </ul>
          </Section>

          <Section title="ระยะเวลาเก็บข้อมูล">
            <p>
              เราเก็บข้อมูลไว้ตราบเท่าที่บัญชีคุณยังใช้งานอยู่ หากคุณขอลบบัญชี เราจะลบหรือทำให้ไม่สามารถ
              ระบุตัวตนได้ภายใน 30 วัน ยกเว้นข้อมูลที่กฎหมายกำหนดให้ต้องเก็บไว้นานกว่านั้น
            </p>
          </Section>

          <Section title="สิทธิของคุณ">
            <p>
              คุณมีสิทธิ: ขอเข้าถึง/ขอสำเนาข้อมูล ขอแก้ไขให้ถูกต้อง ขอลบ ขอถอนความยินยอม และคัดค้านการ
              ประมวลผลบางกรณี — ติดต่อได้ที่{" "}
              <a href="mailto:privacy@fahsai.online" className="text-teal underline hover:text-teal/80">
                privacy@fahsai.online
              </a>{" "}
              หรือผ่านหน้าตั้งค่าในระบบ
            </p>
          </Section>

          <Section title="ความปลอดภัย">
            <p>
              รหัสผ่านถูกเข้ารหัสก่อนจัดเก็บ ระบบมีการจำกัดสิทธิ์การเข้าถึงตามบทบาท
              (เจ้าของร้าน/สมาชิกทีม/แอดมิน) และมีการตรวจจับความผิดปกติของการเข้าใช้งาน
            </p>
          </Section>

          <Section title="การเปลี่ยนแปลงนโยบาย">
            <p>หากมีการเปลี่ยนแปลงสาระสำคัญ เราจะแจ้งให้ทราบผ่านอีเมลหรือประกาศในระบบ</p>
          </Section>

          <Section title="ติดต่อเรา">
            <p>
              <a href="mailto:privacy@fahsai.online" className="text-teal underline hover:text-teal/80">
                privacy@fahsai.online
              </a>
            </p>
          </Section>

          <div className="mt-10 border-t border-border pt-4 text-xs text-muted-foreground">
            ดูเพิ่มเติม:{" "}
            <Link to="/terms" className="text-teal underline hover:text-teal/80">
              ข้อกำหนดการใช้งาน
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
