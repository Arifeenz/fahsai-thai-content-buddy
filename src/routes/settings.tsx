import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AppShell, PageHeader, useCurrentUser } from "@/components/app-shell";
import { useRequireAuth } from "@/lib/auth-guard";
import { api, type TeamPage } from "@/lib/api";
import { LogOut, User, Bell, Globe, Lock, LifeBuoy, Users, X, Mail } from "lucide-react";

const TEAM_PAGE_LABELS: Record<TeamPage, string> = {
  create: "สร้างคอนเทนต์",
  examples: "ตัวอย่างโพสต์",
  schedule: "ตารางโพสต์",
  library: "คลังคอนเทนต์",
  "brand-dna": "อัตลักษณ์แบรนด์",
};
const TEAM_PAGES = Object.keys(TEAM_PAGE_LABELS) as TeamPage[];
const MAX_TEAM_SIZE = 3;

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

function TeamMemberBadge({ teamOwnerName }: { teamOwnerName: string }) {
  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-white/5 text-teal">
          <Users className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="font-bold">ทีมงาน</div>
          <div className="text-sm text-muted-foreground">
            คุณเป็นทีมงานของร้าน "{teamOwnerName}" —
            ให้เจ้าของร้านจัดการสิทธิ์ทีมงานได้จากบัญชีของเขา
          </div>
        </div>
      </div>
    </div>
  );
}

function InviteForm({ disabled }: { disabled: boolean }) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [pages, setPages] = useState<Set<TeamPage>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  function togglePage(page: TeamPage) {
    setPages((prev) => {
      const next = new Set(prev);
      if (next.has(page)) next.delete(page);
      else next.add(page);
      return next;
    });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("กรอกอีเมลก่อนนะคะ");
      return;
    }
    setSubmitting(true);
    try {
      await api.inviteTeamMember(email.trim(), [...pages]);
      toast.success("ส่งคำเชิญแล้วค่ะ รอทีมงานกดยืนยันทางอีเมล");
      setEmail("");
      setPages(new Set());
      queryClient.invalidateQueries({ queryKey: ["team"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "เชิญไม่สำเร็จ ลองอีกครั้งนะคะ");
    } finally {
      setSubmitting(false);
    }
  }

  if (disabled) {
    return (
      <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
        ทีมเต็มแล้วค่ะ (สูงสุด {MAX_TEAM_SIZE} คนรวมเจ้าของร้าน)
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-3 border-t border-border pt-4">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="อีเมลของทีมงานที่จะเชิญ"
        className="rounded-xl border border-border bg-input px-4 py-2.5 text-sm outline-none focus:border-teal"
        required
      />
      <div>
        <div className="mb-1.5 text-xs text-muted-foreground">ให้เห็นเมนูไหนได้บ้าง</div>
        <div className="flex flex-wrap gap-2">
          {TEAM_PAGES.map((page) => (
            <button
              type="button"
              key={page}
              onClick={() => togglePage(page)}
              className={
                "rounded-full border px-3 py-1.5 text-xs " +
                (pages.has(page)
                  ? "border-teal bg-teal/15 text-teal"
                  : "border-border text-muted-foreground hover:text-foreground")
              }
            >
              {TEAM_PAGE_LABELS[page]}
            </button>
          ))}
        </div>
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="justify-self-start rounded-full bg-gradient-to-r from-teal to-gold px-5 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60"
      >
        {submitting ? "กำลังส่งคำเชิญ..." : "ส่งคำเชิญ"}
      </button>
    </form>
  );
}

function TeamManagementCard() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["team"],
    queryFn: () => api.getTeam(),
    enabled: open,
  });
  const members = data?.members ?? [];
  const invites = data?.invites ?? [];
  const teamFull = members.length + 1 >= MAX_TEAM_SIZE;

  async function revoke(id: number) {
    await api.revokeTeamInvite(id);
    toast.success("ยกเลิกคำเชิญแล้วค่ะ");
    queryClient.invalidateQueries({ queryKey: ["team"] });
  }

  return (
    <div className="glass-card rounded-2xl p-5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 text-left"
      >
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-white/5 text-teal">
          <Users className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="font-bold">จัดการทีม</div>
          <div className="text-sm text-muted-foreground">
            เชิญทีมงานมาช่วยดูแลร้าน สูงสุด {MAX_TEAM_SIZE} คนรวมคุณ
          </div>
        </div>
        <span className="shrink-0 rounded-full border border-border px-4 py-1.5 text-xs text-muted-foreground">
          {open ? "ปิด" : "จัดการ"}
        </span>
      </button>

      {open && (
        <div className="mt-4 grid gap-4 border-t border-border pt-4">
          {members.length > 0 && (
            <div className="grid gap-2">
              <div className="text-xs font-semibold text-muted-foreground">
                ทีมงานในร้าน ({members.length + 1}/{MAX_TEAM_SIZE})
              </div>
              {members.map((m) => (
                <div
                  key={m.id}
                  className="rounded-xl border border-border bg-input/30 px-3.5 py-2.5 text-sm"
                >
                  <div className="font-medium">
                    {m.member_name}{" "}
                    <span className="text-muted-foreground">• {m.member_email}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {m.allowed_pages.length === 0 ? (
                      <span className="text-xs text-muted-foreground">ยังไม่ได้เลือกเมนู</span>
                    ) : (
                      m.allowed_pages.map((p) => (
                        <span
                          key={p}
                          className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-muted-foreground"
                        >
                          {TEAM_PAGE_LABELS[p]}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {invites.length > 0 && (
            <div className="grid gap-2">
              <div className="text-xs font-semibold text-muted-foreground">คำเชิญที่รอตอบรับ</div>
              {invites.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center gap-3 rounded-xl border border-dashed border-border px-3.5 py-2.5 text-sm"
                >
                  <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{inv.invited_email}</span>
                  <button
                    type="button"
                    onClick={() => revoke(inv.id)}
                    className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                    aria-label="ยกเลิกคำเชิญ"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <InviteForm disabled={teamFull} />
        </div>
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
          {user &&
            (user.allowed_pages !== null ? (
              <TeamMemberBadge teamOwnerName={user.team_owner_name ?? ""} />
            ) : (
              <TeamManagementCard />
            ))}
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
