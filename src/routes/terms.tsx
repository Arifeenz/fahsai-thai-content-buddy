import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import logo from "@/assets/fahsai-logo.png";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "ข้อกำหนดการใช้งาน — FAHSAI" },
      {
        name: "description",
        content: "ข้อกำหนดการใช้งานของ FAHSAI สำหรับผู้ใช้บริการ",
      },
    ],
  }),
  component: TermsPage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function TermsPage() {
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

          <h1 className="mt-6 text-2xl font-bold text-foreground">ข้อกำหนดการใช้งาน</h1>
          <p className="mt-2 text-xs text-muted-foreground">ปรับปรุงล่าสุด: 30 สิงหาคม 2569</p>

          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            การใช้งาน FAHSAI ถือว่าคุณยอมรับข้อกำหนดต่อไปนี้
          </p>

          <Section title="1. คุณสมบัติผู้ใช้">
            <p>
              คุณต้องเป็นเจ้าของร้านหรือได้รับมอบหมายให้ดูแลคอนเทนต์ของร้านนั้น
              และให้ข้อมูลที่ถูกต้องตอนสมัคร
            </p>
          </Section>

          <Section title="2. บัญชีผู้ใช้">
            <p>
              คุณรับผิดชอบในการรักษาความปลอดภัยของบัญชีและรหัสผ่าน หากเชิญสมาชิกทีม
              คุณเป็นผู้กำหนดสิทธิ์การเข้าถึงและรับผิดชอบการกระทำของสมาชิกทีมภายใต้บัญชีร้านของคุณ
            </p>
          </Section>

          <Section title="3. คอนเทนต์ที่สร้างโดย AI">
            <p>
              FAHSAI ช่วยร่างแคปชั่นและสคริปต์ให้ แต่{" "}
              <span className="font-medium text-foreground">
                คุณเป็นผู้ตรวจสอบและอนุมัติก่อนนำไปโพสต์จริงทุกครั้ง
              </span>{" "}
              เนื้อหาที่ AI สร้างอาจมีความคลาดเคลื่อนได้ เราไม่รับประกันความถูกต้อง 100%
              และไม่รับผิดชอบต่อผลลัพธ์ทางธุรกิจจากคอนเทนต์ที่คุณเลือกนำไปเผยแพร่
            </p>
          </Section>

          <Section title="4. ทรัพย์สินทางปัญญา">
            <p>
              ข้อมูลร้าน รูปภาพ และคอนเทนต์ที่คุณสร้างผ่านระบบยังเป็นของคุณ คุณนำไปใช้ได้เต็มที่
              โดยมีเงื่อนไขว่าเนื้อหาต้นทาง (เช่นรูปที่อัปโหลด)
              ต้องเป็นของคุณเองหรือได้รับอนุญาตให้ใช้แล้ว
            </p>
          </Section>

          <Section title="5. ข้อห้าม">
            <p>
              ห้ามใช้ระบบสร้างเนื้อหาที่ผิดกฎหมาย ละเมิดสิทธิ์ผู้อื่น หลอกลวง หรือสแปม
              และห้ามพยายามเข้าถึงระบบนอกเหนือสิทธิ์ที่ได้รับ
            </p>
          </Section>

          <Section title="6. การใช้งานฟีเจอร์ AI">
            <p>
              ระบบมีขีดจำกัดการใช้งาน AI ต่อเดือน หากเกินขีดจำกัด
              ระบบอาจสลับไปใช้เทมเพลตสำเร็จรูปแทนการสร้างด้วย AI แบบเรียลไทม์ชั่วคราว
            </p>
          </Section>

          <Section title="7. การระงับบัญชี">
            <p>
              เราสงวนสิทธิ์ระงับหรือยกเลิกบัญชีที่ละเมิดข้อกำหนด
              หรือมีพฤติกรรมเสี่ยงต่อความปลอดภัยของระบบ
            </p>
          </Section>

          <Section title="8. ข้อจำกัดความรับผิด">
            <p>
              บริการนี้ให้ "ตามสภาพที่เป็นอยู่" เราไม่รับประกันว่าจะไม่มีข้อผิดพลาดหรือหยุดชะงัก
              และไม่รับผิดต่อความเสียหายทางธุรกิจที่เกิดจากการใช้คอนเทนต์ที่ AI สร้าง
            </p>
          </Section>

          <Section title="9. กฎหมายที่ใช้บังคับ">
            <p>ข้อกำหนดนี้อยู่ภายใต้กฎหมายไทย</p>
          </Section>

          <Section title="ติดต่อเรา">
            <p>
              <a href="mailto:support@fahsai.online" className="text-teal underline hover:text-teal/80">
                support@fahsai.online
              </a>
            </p>
          </Section>

          <div className="mt-10 border-t border-border pt-4 text-xs text-muted-foreground">
            ดูเพิ่มเติม:{" "}
            <Link to="/privacy" className="text-teal underline hover:text-teal/80">
              นโยบายความเป็นส่วนตัว
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
