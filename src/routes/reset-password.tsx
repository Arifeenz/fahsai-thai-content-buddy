import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { api } from "@/lib/api";
import logo from "@/assets/fahsai-logo.png";

export const Route = createFileRoute("/reset-password")({
  validateSearch: z.object({ token: z.string().optional() }),
  head: () => ({
    meta: [{ title: "ตั้งรหัสผ่านใหม่ — FAHSAI" }],
  }),
  component: ResetPasswordPage,
});

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

function ResetPasswordPage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    if (password.length < 8) {
      toast.error("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("รหัสผ่านไม่ตรงกัน");
      return;
    }
    setLoading(true);
    try {
      await api.resetPassword(token, password);
      setDone(true);
      toast.success("ตั้งรหัสผ่านใหม่สำเร็จแล้วค่ะ ✨");
      setTimeout(() => navigate({ to: "/login" }), 1500);
    } catch (err) {
      toast.error(errorMessage(err, "ตั้งรหัสผ่านใหม่ไม่สำเร็จ ลองใหม่อีกครั้งนะคะ"));
    } finally {
      setLoading(false);
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
        <h1 className="mt-8 text-xl font-semibold">ตั้งรหัสผ่านใหม่</h1>

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

        {token && done && (
          <p className="mt-4 text-sm text-muted-foreground">
            สำเร็จแล้วค่ะ กำลังพาไปหน้าเข้าสู่ระบบ...
          </p>
        )}

        {token && !done && (
          <form onSubmit={handleSubmit} className="mt-8 space-y-3 text-left">
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)"
              className="w-full rounded-full border border-border bg-input px-5 py-3 text-base outline-none placeholder:text-muted-foreground focus:border-teal"
            />
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="ยืนยันรหัสผ่านใหม่"
              className="w-full rounded-full border border-border bg-input px-5 py-3 text-base outline-none placeholder:text-muted-foreground focus:border-teal"
            />
            <button
              disabled={loading}
              className="btn-gold w-full rounded-full px-6 py-3.5 text-base disabled:opacity-60"
            >
              ตั้งรหัสผ่านใหม่
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
