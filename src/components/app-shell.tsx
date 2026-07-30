import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Sparkles,
  FolderOpen,
  Dna,
  Settings,
  LogOut,
  Users,
  FileText,
  MessageSquareText,
  CalendarDays,
  ShieldAlert,
  MailWarning,
} from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/fahsai-logo.png";
import { api } from "@/lib/api";
import { useState, type ReactNode } from "react";

export function useCurrentUserQuery() {
  return useQuery({ queryKey: ["me"], queryFn: () => api.getMe(), retry: false });
}

export function useCurrentUser() {
  return useCurrentUserQuery().data?.user;
}

const userNavItems = [
  { to: "/dashboard", label: "แดชบอร์ด", icon: LayoutDashboard },
  { to: "/brand-dna", label: "อัตลักษณ์แบรนด์", icon: Dna },
  { to: "/create", label: "สร้างคอนเทนต์", icon: Sparkles },
  { to: "/library", label: "คลังคอนเทนต์", icon: FolderOpen },
  { to: "/settings", label: "ตั้งค่า", icon: Settings },
] as const;

const adminNavItems = [
  { to: "/admin", label: "ภาพรวมระบบ", icon: LayoutDashboard },
  { to: "/admin/users", label: "ผู้ใช้งาน", icon: Users },
  { to: "/admin/content", label: "คอนเทนต์ทั้งหมด", icon: FileText },
  { to: "/admin/templates", label: "Prompt Templates", icon: MessageSquareText },
  { to: "/admin/events", label: "วันสำคัญ", icon: CalendarDays },
  { to: "/admin/security", label: "ความปลอดภัย", icon: ShieldAlert },
  { to: "/settings", label: "ตั้งค่า", icon: Settings },
] as const;

const exactMatchOnly = new Set(["/dashboard", "/admin"]);

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const user = useCurrentUser();
  const items = user?.role === "admin" ? adminNavItems : userNavItems;
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [resending, setResending] = useState(false);

  async function resendVerification() {
    setResending(true);
    try {
      await api.resendVerification();
      toast.success("ส่งลิงก์ยืนยันอีเมลอีกครั้งแล้วค่ะ");
    } catch {
      toast.error("ส่งลิงก์ไม่สำเร็จ ลองใหม่อีกครั้งนะคะ");
    } finally {
      setResending(false);
    }
  }

  function isActive(to: string) {
    return pathname === to || (!exactMatchOnly.has(to) && pathname.startsWith(to));
  }

  async function logout() {
    await api.logout();
    navigate({ to: "/" });
  }

  return (
    <div className="min-h-screen md:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar/80 backdrop-blur md:flex">
        <div className="flex items-center gap-3 px-6 py-6">
          <img src={logo} alt="FAHSAI" className="h-10 w-10" />
          <div>
            <div className="text-lg font-extrabold tracking-wide text-sidebar-foreground">
              FAHSAI
            </div>
            <div className="text-[11px] text-muted-foreground">ผู้ช่วย AI ของร้านคุณ</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {items.map(({ to, label, icon: Icon }) => {
            const active = isActive(to);
            return (
              <Link
                key={to}
                to={to}
                className={
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition " +
                  (active
                    ? "bg-gradient-to-r from-teal/25 to-gold/15 text-foreground shadow-[inset_0_0_0_1px_oklch(1_0_0_/_10%)]"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-foreground")
                }
              >
                <Icon className={"h-5 w-5 " + (active ? "text-teal" : "")} />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-4">
          <div className="glass-card flex items-center gap-3 rounded-2xl p-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-gold to-teal font-bold text-primary-foreground">
              {(user?.name ?? user?.email ?? "?").slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">
                {user?.name ?? "ยังไม่ได้เข้าสู่ระบบ"}
              </div>
              <div className="truncate text-xs text-muted-foreground">{user?.email ?? ""}</div>
            </div>
            <button
              onClick={logout}
              title="ออกจากระบบ"
              className="text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-sidebar-border bg-sidebar/90 px-4 py-3 backdrop-blur md:hidden">
        <img src={logo} alt="FAHSAI" className="h-8 w-8" />
        <span className="font-extrabold tracking-wide">FAHSAI</span>
      </header>

      <main className="min-w-0 flex-1 pb-24 md:pb-8">
        {user && !user.email_verified && !bannerDismissed && (
          <div className="flex flex-wrap items-center gap-3 border-b border-border bg-gold/10 px-4 py-2.5 text-sm md:px-8">
            <MailWarning className="h-4 w-4 shrink-0 text-gold" />
            <span className="flex-1">ยืนยันอีเมลของคุณเพื่อความปลอดภัยของบัญชีนะคะ</span>
            <button
              onClick={resendVerification}
              disabled={resending}
              className="font-semibold text-teal underline underline-offset-4 disabled:opacity-60"
            >
              ส่งอีกครั้ง
            </button>
            <button
              onClick={() => setBannerDismissed(true)}
              className="text-muted-foreground hover:text-foreground"
              title="ปิด"
            >
              ✕
            </button>
          </div>
        )}
        {children}
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-sidebar-border bg-sidebar/95 backdrop-blur md:hidden">
        <div
          className={
            "mx-auto grid max-w-md " +
            (items.length > 6 ? "grid-cols-7" : items.length > 5 ? "grid-cols-6" : "grid-cols-5")
          }
        >
          {items.map(({ to, label, icon: Icon }) => {
            const active = isActive(to);
            return (
              <Link
                key={to}
                to={to}
                className={
                  "flex flex-col items-center gap-1 py-2.5 text-[11px] " +
                  (active ? "text-teal" : "text-muted-foreground")
                }
              >
                <Icon className="h-5 w-5" />
                <span className="truncate">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">{title}</h1>
      {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
    </div>
  );
}
