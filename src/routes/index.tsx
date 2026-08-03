import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Sparkles,
  ImagePlus,
  Dna,
  Facebook,
  Instagram,
  MessageCircle,
  Coffee,
  ShoppingBag,
  Moon,
  Gamepad2,
  type LucideIcon,
} from "lucide-react";
import logo from "@/assets/fahsai-logo.png";
import { platformLabel, businessCategoryLabel, type Platform } from "@/lib/api";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FAHSAI — ผู้ช่วยสร้างคอนเทนต์สำหรับร้านของคุณ" },
      {
        name: "description",
        content:
          "ให้ FAHSAI ช่วยเขียนโพสต์ Facebook, LINE OA และ Instagram ให้ร้านคุณ ด้วย AI ตรงสไตล์แบรนด์ทุกครั้ง",
      },
      { property: "og:title", content: "FAHSAI — ผู้ช่วยสร้างคอนเทนต์สำหรับร้านของคุณ" },
      { property: "og:description", content: "AI ช่วยปั้นแบรนด์ของคุณให้โดดเด่น เริ่มใช้งานฟรี" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: LandingPage,
});

const platformIcon: Record<Platform, LucideIcon> = {
  facebook: Facebook,
  line: MessageCircle,
  instagram: Instagram,
};

const mockPosts: { platform: Platform; caption: string }[] = [
  {
    platform: "facebook",
    caption:
      "ร้อนนี้แวะมาชิลกันได้เลยค่ะ ☕️ กาแฟส้มแก้วโปรด เปรี้ยวหวานกำลังดี พร้อมเสิร์ฟทุกวัน 9 โมงเช้า - 6 โมงเย็น มาชิมกันน้าา 🧡",
  },
  {
    platform: "instagram",
    caption: "เมนูใหม่มาแล้ว! 🍰 เค้กมะพร้าวโฮมเมด หอมมะพร้าวคั่วสดทุกคำ #ร้านกาแฟยะลา #เค้กโฮมเมด",
  },
  {
    platform: "line",
    caption:
      "โปรโมชั่นบ่ายนี้ค่ะ 🎉 ลาเต้เย็นลด 20% เฉพาะ 14.00-16.00 น. วันนี้เท่านั้น อย่าลืมมาอุดหนุนกันนะคะ",
  },
];

const features: { icon: LucideIcon; title: string; desc: string }[] = [
  {
    icon: Sparkles,
    title: "เขียนจากไอเดีย",
    desc: "พิมพ์ไอเดียสั้นๆ ได้แคปชั่นพร้อมโพสต์ พร้อม prompt สำหรับสร้างรูปประกอบให้ด้วย",
  },
  {
    icon: ImagePlus,
    title: "เขียนจากรูปภาพ",
    desc: "อัปโหลดรูปสินค้าที่ถ่ายไว้ ให้ AI ดูรูปแล้วแต่งแคปชั่นให้เลย",
  },
  {
    icon: Dna,
    title: "Brand DNA",
    desc: "เล่าตัวตนร้านให้ AI รู้จักครั้งเดียว แล้วเขียนได้ตรงสไตล์ร้านคุณทุกโพสต์ต่อจากนี้",
  },
];

const segments: { icon: LucideIcon; label: string }[] = [
  { icon: Coffee, label: businessCategoryLabel.food_beverage },
  { icon: ShoppingBag, label: businessCategoryLabel.online_shop },
  { icon: Moon, label: businessCategoryLabel.fortune_telling },
  { icon: Gamepad2, label: businessCategoryLabel.streamer },
];

const steps: { n: number; title: string; desc: string }[] = [
  {
    n: 1,
    title: "ตั้ง Brand DNA",
    desc: "เล่าเรื่องร้าน เมนูเด่น จุดขาย และบุคลิกแบรนด์ให้ AI รู้จักครั้งเดียว",
  },
  {
    n: 2,
    title: "สร้างคอนเทนต์",
    desc: "พิมพ์ไอเดียหรือแนบรูป ให้ AI เขียนโพสต์ให้ในไม่กี่วินาที",
  },
  {
    n: 3,
    title: "เก็บเข้าคลัง ให้ feedback",
    desc: "อนุมัติ คัดลอกไปโพสต์ แล้วบอก AI ว่าโพสต์ไหนดี ครั้งหน้าเขียนแม่นขึ้นเรื่อยๆ",
  },
];

const faqs: { q: string; a: string }[] = [
  {
    q: "ต้องเก่งเทคโนโลยีไหม?",
    a: "ไม่ต้องเลยค่ะ พิมพ์ไอเดียสั้นๆ หรือแนบรูปสินค้า ที่เหลือให้ FAHSAI จัดการให้",
  },
  {
    q: "ใช้ได้กับแพลตฟอร์มไหนบ้าง?",
    a: "Facebook, LINE OA และ Instagram ค่ะ เลือกแพลตฟอร์มตอนสร้างคอนเทนต์ได้เลย",
  },
  {
    q: "ราคาเท่าไหร่?",
    a: "ตอนนี้เปิดให้ทดลองใช้งานฟรีค่ะ ถ้าสนใจใช้งานจริงจังหรืออยากคุยรายละเอียดเพิ่มเติม ทักมาคุยกันได้เลยที่ Facebook ด้านล่างค่ะ",
  },
  {
    q: "ข้อมูลร้านปลอดภัยไหม?",
    a: "ข้อมูลร้านของคุณถูกเก็บไว้เพื่อใช้ปรับแต่งการเขียนให้ตรงสไตล์ร้านเท่านั้น ไม่แชร์ให้บุคคลที่สาม",
  },
];

function LandingPage() {
  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-10 border-b border-border/50 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <img src={logo} alt="FAHSAI" className="h-8 w-8" />
            <span className="text-lg font-extrabold tracking-wide">FAHSAI</span>
          </div>
          <Link to="/login" className="btn-gold rounded-full px-5 py-2 text-sm">
            เข้าสู่ระบบ
          </Link>
        </div>
      </nav>

      <section className="relative overflow-hidden px-4 py-20 text-center">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/4 top-1/3 h-96 w-96 -translate-x-1/2 rounded-full bg-gold/10 blur-3xl" />
          <div className="absolute right-1/4 bottom-1/3 h-96 w-96 rounded-full bg-teal/15 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/5 px-4 py-1.5 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-gold" /> ผู้ช่วยสร้างคอนเทนต์ด้วย AI
          </div>
          <h1 className="mt-6 text-3xl font-extrabold leading-tight md:text-5xl">
            ไม่มีเวลาคิดแคปชั่น?
            <br />
            ให้ <span className="text-gold">FAHSAI</span> ช่วยปั้นแบรนด์ร้านคุณให้โดดเด่น
          </h1>
          <p className="mt-4 text-base text-muted-foreground md:text-lg">
            พิมพ์ไอเดียสั้นๆ หรือแนบรูปสินค้า ให้ AI เขียนโพสต์ให้เสร็จในไม่กี่วินาที
            ตรงสไตล์ร้านคุณทุกครั้ง
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/login" className="btn-gold rounded-full px-8 py-3.5 text-base">
              เริ่มใช้งานฟรี
            </Link>
          </div>
        </div>
      </section>

      <section className="px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <h2 className="text-2xl font-extrabold md:text-3xl">AI เขียนให้ได้ขนาดนี้</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              ตัวอย่างผลลัพธ์ (mockup) — หน้าตาจริงตอนใช้งานจะเป็นโพสต์ของร้านคุณเอง
            </p>
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {mockPosts.map((post) => {
              const Icon = platformIcon[post.platform];
              return (
                <div key={post.platform} className="glass-card overflow-hidden rounded-2xl">
                  <div className="flex h-32 items-center justify-center bg-gradient-to-br from-teal/20 to-gold/20 text-muted-foreground">
                    <ImagePlus className="h-8 w-8" />
                  </div>
                  <div className="p-4">
                    <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-muted-foreground">
                      <Icon className="h-3 w-3" /> {platformLabel[post.platform]}
                    </div>
                    <p className="text-sm leading-relaxed">{post.caption}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <h2 className="text-2xl font-extrabold md:text-3xl">3 ตัวช่วยหลัก</h2>
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="glass-card rounded-2xl p-6">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-gold/30 to-teal/30 text-gold">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 font-bold">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <h2 className="text-2xl font-extrabold md:text-3xl">คุณคือร้านแบบไหน</h2>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {segments.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="glass-card flex flex-col items-center gap-3 rounded-2xl p-6 text-center"
              >
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-white/5 text-teal">
                  <Icon className="h-6 w-6" />
                </div>
                <div className="font-bold">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-16">
        <div className="mx-auto max-w-4xl">
          <div className="text-center">
            <h2 className="text-2xl font-extrabold md:text-3xl">ใช้งานง่ายใน 3 ขั้นตอน</h2>
          </div>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {steps.map(({ n, title, desc }) => (
              <div key={n} className="glass-card rounded-2xl p-6 text-center">
                <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-gold/15 font-bold text-gold">
                  {n}
                </div>
                <h3 className="mt-4 font-bold">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-16">
        <div className="mx-auto max-w-3xl">
          <div className="text-center">
            <h2 className="text-2xl font-extrabold md:text-3xl">คำถามที่พบบ่อย</h2>
          </div>
          <Accordion type="single" collapsible className="glass-card mt-8 rounded-2xl px-6">
            {faqs.map(({ q, a }) => (
              <AccordionItem key={q} value={q} className="border-border/50">
                <AccordionTrigger>{q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      <section className="px-4 py-16 text-center">
        <div className="glass-card mx-auto max-w-2xl rounded-3xl p-10">
          <h2 className="text-2xl font-extrabold md:text-3xl">
            พร้อมให้ FAHSAI ช่วยร้านคุณหรือยัง?
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">เริ่มใช้งานฟรี ไม่ต้องใช้บัตรเครดิต</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link to="/login" className="btn-gold rounded-full px-8 py-3.5 text-base">
              เริ่มใช้งานฟรี
            </Link>
            <a
              href="https://www.facebook.com/arifeen.charawae"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-3.5 text-base hover:bg-white/5"
            >
              <Facebook className="h-4 w-4" /> คุยกับเราที่ Facebook
            </a>
          </div>
          <div className="mt-8 flex justify-center gap-6 text-xs text-muted-foreground">
            <a href="#" className="underline underline-offset-4">
              นโยบายความเป็นส่วนตัว
            </a>
            <a href="#" className="underline underline-offset-4">
              ข้อกำหนดการใช้งาน
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
