import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { LogOut, User, Bell, Globe } from "lucide-react";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "ตั้งค่า — FAHSAI" },
      { name: "description", content: "จัดการโปรไฟล์ การแจ้งเตือน และภาษาของบัญชี FAHSAI" },
      { property: "og:title", content: "ตั้งค่า — FAHSAI" },
      { property: "og:description", content: "จัดการโปรไฟล์ การแจ้งเตือน และภาษาของบัญชี FAHSAI" },
    ],
  }),
  component: SettingsPage,
});

function Row({ icon: Icon, title, desc, children }: any) {
  return (
    <div className="glass-card grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-2xl p-5">
      <div className="grid h-10 w-10 place-items-center rounded-lg bg-white/5 text-teal">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="font-bold">{title}</div>
        <div className="text-sm text-muted-foreground">{desc}</div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function SettingsPage() {
  return (
    <AppShell>
      <div className="p-6 md:p-8">
        <PageHeader title="ตั้งค่า" subtitle="ปรับแต่งบัญชีของคุณ" />
        <div className="grid gap-3 max-w-2xl">
          <Row icon={User} title="โปรไฟล์" desc="คุณฟ้าใส • FAHSAI Coffee — ยะลา">
            <button className="rounded-full border border-border px-4 py-1.5 text-sm hover:bg-white/5">แก้ไข</button>
          </Row>
          <Row icon={Bell} title="การแจ้งเตือน" desc="รับข่าวสาร โปรโมชั่น และเคล็ดลับจาก FAHSAI">
            <input type="checkbox" defaultChecked className="h-5 w-5 accent-[oklch(0.82_0.13_85)]" />
          </Row>
          <Row icon={Globe} title="ภาษา" desc="ภาษาไทย (Thai)">
            <select className="rounded-full border border-border bg-input px-3 py-1.5 text-sm">
              <option>ไทย</option>
              <option>English</option>
            </select>
          </Row>
          <Link to="/" className="glass-card mt-2 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4 rounded-2xl p-5 text-destructive hover:bg-white/5">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-destructive/15">
              <LogOut className="h-5 w-5" />
            </div>
            <div>
              <div className="font-bold">ออกจากระบบ</div>
              <div className="text-sm text-muted-foreground">กลับไปหน้าเข้าสู่ระบบ</div>
            </div>
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
