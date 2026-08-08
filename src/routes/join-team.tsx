import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { api } from "@/lib/api";
import logo from "@/assets/fahsai-logo.png";

export const Route = createFileRoute("/join-team")({
  validateSearch: z.object({ token: z.string().optional() }),
  head: () => ({
    meta: [{ title: "เข้าร่วมทีม — FAHSAI" }],
  }),
  component: JoinTeamPage,
});

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

function JoinTeamPage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const {
    data: info,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["team-invite-info", token],
    queryFn: () => api.getTeamInviteInfo(token as string),
    enabled: !!token,
    retry: false,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !info) return;
    if (info.needs_signup) {
      if (!name.trim()) {
        toast.error("กรอกชื่อก่อนนะคะ");
        return;
      }
      if (password.length < 8) {
        toast.error("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
        return;
      }
      if (password !== confirmPassword) {
        toast.error("รหัสผ่านไม่ตรงกัน");
        return;
      }
    }
    setSubmitting(true);
    try {
      const res = await api.acceptTeamInvite(
        token,
        info.needs_signup ? name.trim() : undefined,
        info.needs_signup ? password : undefined,
      );
      toast.success(`เข้าร่วมทีมของร้าน "${res.owner_name}" แล้วค่ะ ✨`);
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(errorMessage(err, "เข้าร่วมทีมไม่สำเร็จ ลองใหม่อีกครั้งนะคะ"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/4 top-1/3 h-96 w-96 -translate-x-1/2 rounded-full bg-gold/10 blur-3xl" />
        <div className="absolute right-1/4 bottom-1/3 h-96 w-96 rounded-full bg-teal/15 blur-3xl" />
      </div>

      <div className="glass-card relative w-full max-w-md rounded-[2rem] px-8 py-12 text-center shadow-[0_20px_80px_oklch(0_0_0_/_50%)]">
        <img
          src={logo}
          alt="FAHSAI"
          className="mx-auto h-20 w-20 drop-shadow-[0_0_25px_oklch(0.82_0.13_85/40%)]"
        />
        <h1 className="mt-8 text-xl font-semibold">เข้าร่วมทีม</h1>

        {!token && (
          <>
            <p className="mt-4 text-sm text-muted-foreground">ลิงก์ไม่ถูกต้องนะคะ</p>
            <Link
              to="/login"
              className="btn-gold mt-8 inline-block w-full rounded-full px-6 py-3.5 text-base"
            >
              กลับไปเข้าสู่ระบบ
            </Link>
          </>
        )}

        {token && isLoading && (
          <p className="mt-4 text-sm text-muted-foreground">กำลังตรวจสอบคำเชิญ...</p>
        )}

        {token && isError && (
          <>
            <p className="mt-4 text-sm text-muted-foreground">
              ลิงก์เชิญไม่ถูกต้องหรือหมดอายุแล้วนะคะ ลองขอให้เจ้าของร้านเชิญใหม่อีกครั้ง
            </p>
            <Link
              to="/login"
              className="btn-gold mt-8 inline-block w-full rounded-full px-6 py-3.5 text-base"
            >
              กลับไปเข้าสู่ระบบ
            </Link>
          </>
        )}

        {token && info && (
          <>
            <p className="mt-4 text-sm text-muted-foreground">
              "{info.owner_name}" เชิญให้คุณเข้าร่วมทีมด้วยอีเมล
              <br />
              <span className="font-medium text-foreground">{info.invited_email}</span>
            </p>
            <form onSubmit={handleSubmit} className="mt-8 space-y-3 text-left">
              {info.needs_signup && (
                <>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="ชื่อของคุณ"
                    className="w-full rounded-full border border-border bg-input px-5 py-3 text-base outline-none placeholder:text-muted-foreground focus:border-teal"
                  />
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="ตั้งรหัสผ่าน (อย่างน้อย 8 ตัวอักษร)"
                    className="w-full rounded-full border border-border bg-input px-5 py-3 text-base outline-none placeholder:text-muted-foreground focus:border-teal"
                  />
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="ยืนยันรหัสผ่าน"
                    className="w-full rounded-full border border-border bg-input px-5 py-3 text-base outline-none placeholder:text-muted-foreground focus:border-teal"
                  />
                </>
              )}
              <button
                disabled={submitting}
                className="btn-gold w-full rounded-full px-6 py-3.5 text-base disabled:opacity-60"
              >
                {submitting ? "กำลังเข้าร่วม..." : "เข้าร่วมทีม"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
