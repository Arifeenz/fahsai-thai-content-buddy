import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Sparkles, FolderOpen, Dna, Settings, LogOut } from "lucide-react";
import logo from "@/assets/fahsai-logo.png";
import type { ReactNode } from "react";

const navItems = [
  { to: "/dashboard", label: "แดชบอร์ด", icon: LayoutDashboard },
  { to: "/create", label: "สร้างคอนเทนต์", icon: Sparkles },
  { to: "/library", label: "คลังคอนเทนต์", icon: FolderOpen },
  { to: "/brand-dna", label: "Brand DNA", icon: Dna },
  { to: "/settings", label: "ตั้งค่า", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen md:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar/80 backdrop-blur md:flex">
        <div className="flex items-center gap-3 px-6 py-6">
          <img src={logo} alt="FAHSAI" className="h-10 w-10" />
          <div>
            <div className="text-lg font-extrabold tracking-wide text-sidebar-foreground">FAHSAI</div>
            <div className="text-[11px] text-muted-foreground">ผู้ช่วย AI ของร้านคุณ</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {navItems.map(({ to, label, icon: Icon }) => {
            const active = pathname === to || (to !== "/dashboard" && pathname.startsWith(to));
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
              ฟ
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">คุณฟ้าใส</div>
              <div className="truncate text-xs text-muted-foreground">FAHSAI Coffee — ยะลา</div>
            </div>
            <Link to="/" title="ออกจากระบบ" className="text-muted-foreground hover:text-foreground">
              <LogOut className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-sidebar-border bg-sidebar/90 px-4 py-3 backdrop-blur md:hidden">
        <img src={logo} alt="FAHSAI" className="h-8 w-8" />
        <span className="font-extrabold tracking-wide">FAHSAI</span>
      </header>

      <main className="min-w-0 flex-1 pb-24 md:pb-8">{children}</main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-sidebar-border bg-sidebar/95 backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5">
          {navItems.map(({ to, label, icon: Icon }) => {
            const active = pathname === to || (to !== "/dashboard" && pathname.startsWith(to));
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
