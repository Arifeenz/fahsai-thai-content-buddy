import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AppShell, PageHeader, useCurrentUser } from "@/components/app-shell";
import { useRequireAuth } from "@/lib/auth-guard";
import { api } from "@/lib/api";
import { LogOut, User, Bell, Globe, Lock, LifeBuoy } from "lucide-react";

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

function ChangePasswordRow({ hasPassword }: { hasPassword: boolean }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error("รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("รหัสผ่านใหม่และการยืนยันไม่ตรงกัน");
      return;
    }
    setSubmitting(true);
    try {
      await api.changePassword(hasPassword ? currentPassword : null, newPassword);
      toast.success(hasPassword ? "เปลี่ยนรหัสผ่านสำเร็จแล้วค่ะ" : "ตั้งรหัสผ่านสำเร็จแล้วค่ะ");
      queryClient.invalidateQueries({ queryKey: ["me"] });
      reset();
      setOpen(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "เปลี่ยนรหัสผ่านไม่สำเร็จ ลองใหม่อีกครั้งนะคะ",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="glass-card rounded-2xl p-5">
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          reset();
        }}
        className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 text-left"
      >
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-white/5 text-teal">
          <Lock className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="font-bold">รหัสผ่าน</div>
          <div className="text-sm text-muted-foreground">
            {hasPassword
              ? "เปลี่ยนรหัสผ่านสำหรับเข้าสู่ระบบ"
              : "ตั้งรหัสผ่านสำหรับบัญชีนี้ (ปัจจุบันเข้าผ่าน Google)"}
          </div>
        </div>
        <span className="shrink-0 rounded-full border border-border px-4 py-1.5 text-xs text-muted-foreground">
          {open ? "ปิด" : hasPassword ? "เปลี่ยน" : "ตั้งรหัสผ่าน"}
        </span>
      </button>
      {open && (
        <form onSubmit={submit} className="mt-4 grid gap-3 border-t border-border pt-4">
          {hasPassword && (
            <input
              type="password"
              autoComplete="current-password"
              placeholder="รหัสผ่านปัจจุบัน"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="rounded-xl border border-border bg-input px-4 py-2.5 text-sm"
              required
            />
          )}
          <input
            type="password"
            autoComplete="new-password"
            placeholder="รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="rounded-xl border border-border bg-input px-4 py-2.5 text-sm"
            required
            minLength={8}
          />
          <input
            type="password"
            autoComplete="new-password"
            placeholder="ยืนยันรหัสผ่านใหม่"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="rounded-xl border border-border bg-input px-4 py-2.5 text-sm"
            required
            minLength={8}
          />
          <button
            type="submit"
            disabled={submitting}
            className="justify-self-start rounded-full bg-gradient-to-r from-teal to-gold px-5 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {submitting ? "กำลังบันทึก..." : hasPassword ? "บันทึกรหัสผ่านใหม่" : "ตั้งรหัสผ่าน"}
          </button>
        </form>
      )}
    </div>
  );
}

function ReportIssueRow() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!message.trim()) {
      toast.error("อธิบายปัญหาที่เจอหน่อยนะคะ");
      return;
    }
    setSubmitting(true);
    try {
      await api.createSupportTicket(message.trim());
      toast.success("ส่งเรื่องแล้วค่ะ ทีมงานจะรีบดูให้เร็วที่สุด");
      setMessage("");
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ส่งเรื่องไม่สำเร็จ ลองใหม่อีกครั้งนะคะ");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="glass-card rounded-2xl p-5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 text-left"
      >
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-white/5 text-teal">
          <LifeBuoy className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="font-bold">แจ้งปัญหา</div>
          <div className="text-sm text-muted-foreground">เจอปัญหาการใช้งาน แจ้งทีมงานได้ที่นี่</div>
        </div>
        <span className="shrink-0 rounded-full border border-border px-4 py-1.5 text-xs text-muted-foreground">
          {open ? "ปิด" : "แจ้งปัญหา"}
        </span>
      </button>
      {open && (
        <form onSubmit={submit} className="mt-4 grid gap-3 border-t border-border pt-4">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            placeholder="เล่าปัญหาที่เจอให้ฟังหน่อยค่ะ เช่น กดปุ่มนี้แล้วไม่มีอะไรเกิดขึ้น..."
            className="rounded-xl border border-border bg-input px-4 py-2.5 text-sm outline-none focus:border-teal"
            required
          />
          <button
            type="submit"
            disabled={submitting}
            className="justify-self-start rounded-full bg-gradient-to-r from-teal to-gold px-5 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {submitting ? "กำลังส่ง..." : "ส่งเรื่อง"}
          </button>
        </form>
      )}
    </div>
  );
}

function SettingsPage() {
  const { ready } = useRequireAuth();
  const user = useCurrentUser();
  const navigate = useNavigate();

  async function logout() {
    await api.logout();
    navigate({ to: "/login" });
  }

  const profileDesc = user
    ? `${user.name} • ${user.email}${
        user.last_login_at
          ? ` • เข้าสู่ระบบล่าสุด ${new Date(user.last_login_at).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })}`
          : ""
      }`
    : "ยังไม่ได้เข้าสู่ระบบ";

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
        <PageHeader title="ตั้งค่า" subtitle="ปรับแต่งบัญชีของคุณ" />
        <div className="grid gap-3 max-w-2xl">
          <Row icon={User} title="โปรไฟล์" desc={profileDesc}>
            <span className="rounded-full border border-border px-4 py-1.5 text-xs text-muted-foreground">
              ซิงค์จาก Google
            </span>
          </Row>
          <ChangePasswordRow hasPassword={user?.has_password ?? false} />
          <ReportIssueRow />
          <Row icon={Bell} title="การแจ้งเตือน" desc="รับข่าวสาร โปรโมชั่น และเคล็ดลับจาก FAHSAI">
            <input
              type="checkbox"
              defaultChecked
              className="h-5 w-5 accent-[oklch(0.82_0.13_85)]"
            />
          </Row>
          <Row icon={Globe} title="ภาษา" desc="ภาษาไทย (Thai)">
            <select className="rounded-full border border-border bg-input px-3 py-1.5 text-sm">
              <option>ไทย</option>
              <option>English</option>
            </select>
          </Row>
          <button
            onClick={logout}
            className="glass-card mt-2 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4 rounded-2xl p-5 text-left text-destructive hover:bg-white/5"
          >
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-destructive/15">
              <LogOut className="h-5 w-5" />
            </div>
            <div>
              <div className="font-bold">ออกจากระบบ</div>
              <div className="text-sm text-muted-foreground">กลับไปหน้าเข้าสู่ระบบ</div>
            </div>
          </button>
        </div>
      </div>
    </AppShell>
  );
}
