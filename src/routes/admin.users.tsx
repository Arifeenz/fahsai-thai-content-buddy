import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  api,
  businessCategoryLabel,
  platformLabel,
  type AdminUserDetail,
  type BusinessCategory,
  type Role,
} from "@/lib/api";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AppShell, PageHeader, useCurrentUser } from "@/components/app-shell";
import { useRequireAdmin } from "@/lib/admin-guard";
import { Pagination } from "@/components/pagination";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { StatusBadge } from "./dashboard";
import { Search, Ban, CircleCheck, ShieldCheck, ShieldOff, RotateCcw } from "lucide-react";

export const Route = createFileRoute("/admin/users")({
  head: () => ({
    meta: [
      { title: "ผู้ใช้งาน — แอดมิน FAHSAI" },
      { name: "description", content: "รายชื่อผู้ใช้งานทั้งหมดในระบบ" },
    ],
  }),
  component: AdminUsersPage,
});

const PAGE_SIZE = 20;

function formatDateTime(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
}

function AdminUsersPage() {
  const { ready } = useRequireAdmin();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  // Debounce so every keystroke doesn't fire a request; reset to page 1
  // whenever the effective search term changes so the user doesn't land on
  // an out-of-range page for the new result set.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const { data } = useQuery({
    queryKey: ["admin", "users", page, debouncedSearch],
    queryFn: () => api.adminListUsers(page, PAGE_SIZE, debouncedSearch),
    placeholderData: keepPreviousData,
  });
  const users = data?.items ?? [];
  const total = data?.total ?? 0;

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
        <PageHeader title="ผู้ใช้งาน" subtitle={`ผู้ใช้งานทั้งหมด (${total})`} />
        <DemoAccountsCard />
        <div className="glass-card mb-4 flex items-center gap-3 rounded-2xl p-4">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาชื่อหรืออีเมล..."
              className="w-full rounded-full border border-border bg-input py-2.5 pl-9 pr-4 text-sm outline-none placeholder:text-muted-foreground focus:border-teal"
            />
          </div>
        </div>
        <div className="glass-card overflow-x-auto rounded-2xl">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="p-4 font-medium">ชื่อ</th>
                <th className="p-4 font-medium">อีเมล</th>
                <th className="p-4 font-medium">สิทธิ์</th>
                <th className="p-4 font-medium">สถานะ</th>
                <th className="p-4 font-medium">ประเภทธุรกิจ</th>
                <th className="p-4 font-medium">เข้าสู่ระบบล่าสุด</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.id}
                  onClick={() => setSelectedUserId(u.id)}
                  className="cursor-pointer border-b border-border/50 last:border-0 hover:bg-white/5"
                >
                  <td className="p-4">{u.name}</td>
                  <td className="p-4 text-muted-foreground">{u.email}</td>
                  <td className="p-4">
                    <span
                      className={
                        "rounded-full px-2.5 py-1 text-[11px] font-medium " +
                        (u.role === "admin"
                          ? "bg-gold/15 text-gold"
                          : "bg-white/5 text-muted-foreground")
                      }
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="p-4">
                    <span
                      className={
                        "rounded-full px-2.5 py-1 text-[11px] font-medium " +
                        (u.is_active
                          ? "bg-success/15 text-success"
                          : "bg-destructive/15 text-destructive")
                      }
                    >
                      {u.is_active ? "ใช้งานได้" : "ถูกระงับ"}
                    </span>
                  </td>
                  <td className="p-4 text-muted-foreground">
                    {u.business_category ? businessCategoryLabel[u.business_category] : "—"}
                  </td>
                  <td className="p-4 text-muted-foreground">{formatDateTime(u.last_login_at)}</td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted-foreground">
                    {debouncedSearch ? "ไม่พบผู้ใช้ที่ตรงกับคำค้นหาค่ะ" : "ยังไม่มีผู้ใช้ในระบบ"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
      </div>

      <UserDetailDialog userId={selectedUserId} onClose={() => setSelectedUserId(null)} />
    </AppShell>
  );
}

function UserDetailDialog({ userId, onClose }: { userId: number | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const currentUser = useCurrentUser();

  const { data } = useQuery({
    queryKey: ["admin", "user", userId],
    queryFn: () => api.adminGetUser(userId as number),
    enabled: userId !== null,
  });

  function applyUpdatedUser(updated: AdminUserDetail["user"]) {
    queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    queryClient.setQueryData<AdminUserDetail | undefined>(["admin", "user", userId], (prev) =>
      prev ? { ...prev, user: updated } : prev,
    );
  }

  const roleMutation = useMutation({
    mutationFn: (role: Role) => api.adminUpdateUserRole(userId as number, role),
    onSuccess: ({ user }) => {
      applyUpdatedUser(user);
      toast.success("เปลี่ยนสิทธิ์แล้วค่ะ");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "เปลี่ยนสิทธิ์ไม่สำเร็จ"),
  });

  const activeMutation = useMutation({
    mutationFn: (isActive: boolean) => api.adminSetUserActive(userId as number, isActive),
    onSuccess: ({ user }) => {
      applyUpdatedUser(user);
      toast.success(user.is_active ? "ยกเลิกการระงับแล้วค่ะ" : "ระงับบัญชีแล้วค่ะ");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "อัปเดตไม่สำเร็จ"),
  });

  const user = data?.user;
  // AuthUser has no id field, so email is the only reliable way to tell
  // whether the row being viewed is the admin's own account.
  const isSelf = !!currentUser && !!user && currentUser.email === user.email;

  return (
    <Dialog open={userId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        {!user || !data ? (
          <div className="py-8 text-center text-sm text-muted-foreground">กำลังโหลด...</div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{user.name}</DialogTitle>
              <DialogDescription>{user.email}</DialogDescription>
            </DialogHeader>

            <div className="flex flex-wrap gap-2">
              <span
                className={
                  "rounded-full px-2.5 py-1 text-[11px] font-medium " +
                  (user.role === "admin"
                    ? "bg-gold/15 text-gold"
                    : "bg-white/5 text-muted-foreground")
                }
              >
                {user.role === "admin" ? "แอดมิน" : "ผู้ใช้ทั่วไป"}
              </span>
              <span
                className={
                  "rounded-full px-2.5 py-1 text-[11px] font-medium " +
                  (user.is_active
                    ? "bg-success/15 text-success"
                    : "bg-destructive/15 text-destructive")
                }
              >
                {user.is_active ? "ใช้งานได้" : "ถูกระงับ"}
              </span>
              {user.is_demo && (
                <span className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                  บัญชีทดลอง
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">ประเภทธุรกิจ</div>
                <div>
                  {user.business_category ? businessCategoryLabel[user.business_category] : "—"}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">สมัครเมื่อ</div>
                <div>{formatDateTime(user.created_at)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">เข้าสู่ระบบล่าสุด</div>
                <div>{formatDateTime(user.last_login_at)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">วิธีเข้าสู่ระบบ</div>
                <div>
                  {user.is_demo ? "บัญชีทดลอง" : user.has_password ? "อีเมล/รหัสผ่าน" : "Google"}
                </div>
              </div>
            </div>

            <div className="text-sm">
              สร้างคอนเทนต์ไปแล้ว <span className="font-semibold">{data.content_count}</span> รายการ
            </div>
            {data.recent_content.length > 0 && (
              <div className="max-h-48 overflow-y-auto rounded-xl border border-border">
                {data.recent_content.map((item) => (
                  <div key={item.id} className="border-b border-border/50 p-3 last:border-0">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground">
                        {platformLabel[item.platform]}
                      </span>
                      <StatusBadge status={item.status} />
                    </div>
                    <div className="line-clamp-1 text-xs text-muted-foreground">{item.preview}</div>
                  </div>
                ))}
              </div>
            )}

            {isSelf ? (
              <p className="text-xs text-muted-foreground">
                นี่คือบัญชีของคุณเอง จึงเปลี่ยนสิทธิ์หรือระงับบัญชีตัวเองไม่ได้ค่ะ
              </p>
            ) : (
              <DialogFooter className="gap-2">
                <button
                  onClick={() => roleMutation.mutate(user.role === "admin" ? "user" : "admin")}
                  disabled={roleMutation.isPending}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs hover:bg-white/5 disabled:opacity-60"
                >
                  {user.role === "admin" ? (
                    <>
                      <ShieldOff className="h-3.5 w-3.5" /> ถอดสิทธิ์แอดมิน
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-3.5 w-3.5" /> ตั้งเป็นแอดมิน
                    </>
                  )}
                </button>
                <button
                  onClick={() => activeMutation.mutate(!user.is_active)}
                  disabled={activeMutation.isPending}
                  className={
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs hover:bg-white/5 disabled:opacity-60 " +
                    (user.is_active
                      ? "border-destructive/40 text-destructive"
                      : "border-success/40 text-success")
                  }
                >
                  {user.is_active ? (
                    <>
                      <Ban className="h-3.5 w-3.5" /> ระงับบัญชี
                    </>
                  ) : (
                    <>
                      <CircleCheck className="h-3.5 w-3.5" /> ยกเลิกการระงับ
                    </>
                  )}
                </button>
              </DialogFooter>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

const DEMO_CATEGORIES = Object.keys(businessCategoryLabel) as BusinessCategory[];

// Shared demo accounts drift as visitors edit their Brand DNA; resetting puts
// the DNA and category back to the built-in defaults without deleting any
// content, history or survey answers made on them.
function DemoAccountsCard() {
  const [target, setTarget] = useState<BusinessCategory | "all" | null>(null);
  const resetMutation = useMutation({
    mutationFn: async (which: BusinessCategory | "all") => {
      const categories = which === "all" ? DEMO_CATEGORIES : [which];
      for (const category of categories) await api.adminResetDemoAccount(category);
      return categories.length;
    },
    onSuccess: (count) => toast.success(`รีเซ็ตบัญชีทดลองแล้ว ${count} บัญชี`),
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "รีเซ็ตไม่สำเร็จ ลองใหม่อีกครั้งนะคะ"),
  });

  const targetLabel =
    target === "all" ? "บัญชีทดลองทั้ง 4 บัญชี" : target ? businessCategoryLabel[target] : "";

  return (
    <div className="glass-card mb-4 rounded-2xl p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-bold">บัญชีทดลอง</div>
          <div className="text-xs text-muted-foreground">
            คืนข้อมูลร้าน (Brand DNA) และประเภทธุรกิจเป็นค่าเริ่มต้น คอนเทนต์และประวัติไม่ถูกลบ
          </div>
        </div>
        <button
          type="button"
          onClick={() => setTarget("all")}
          disabled={resetMutation.isPending}
          className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs hover:border-teal disabled:opacity-50"
        >
          <RotateCcw className="h-3.5 w-3.5" /> รีเซ็ตทั้งหมด
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {DEMO_CATEGORIES.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => setTarget(category)}
            disabled={resetMutation.isPending}
            className="rounded-full border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-teal hover:text-teal disabled:opacity-50"
          >
            รีเซ็ต {businessCategoryLabel[category]}
          </button>
        ))}
      </div>

      <AlertDialog open={target !== null} onOpenChange={(open) => !open && setTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>รีเซ็ต{targetLabel}?</AlertDialogTitle>
            <AlertDialogDescription>
              ข้อมูลร้าน (Brand DNA) ที่ผู้ทดลองแก้ไว้จะกลับเป็นค่าเริ่มต้น ส่วนคอนเทนต์
              ประวัติการสร้าง ตัวอย่างโพสต์ และแบบประเมินยังอยู่ครบ
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (target) resetMutation.mutate(target);
                setTarget(null);
              }}
            >
              รีเซ็ต
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
