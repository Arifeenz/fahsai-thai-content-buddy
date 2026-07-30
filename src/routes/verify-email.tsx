import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { api } from "@/lib/api";
import logo from "@/assets/fahsai-logo.png";

export const Route = createFileRoute("/verify-email")({
  validateSearch: z.object({ token: z.string().optional() }),
  head: () => ({
    meta: [{ title: "ยืนยันอีเมล — FAHSAI" }],
  }),
  component: VerifyEmailPage,
});

type Status = "loading" | "success" | "error";

function VerifyEmailPage() {
  const { token } = Route.useSearch();
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      return;
    }
    api
      .verifyEmail(token)
      .then(() => setStatus("success"))
      .catch(() => setStatus("error"));
  }, [token]);

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

        {status === "loading" && (
          <p className="mt-8 text-sm text-muted-foreground">กำลังยืนยันอีเมล...</p>
        )}

        {status === "success" && (
          <>
            <h1 className="mt-8 text-xl font-semibold">ยืนยันอีเมลสำเร็จแล้วค่ะ ✨</h1>
            <Link
              to="/dashboard"
              className="btn-gold mt-8 inline-block w-full rounded-full px-6 py-3.5 text-base"
            >
              ไปที่แดชบอร์ด
            </Link>
          </>
        )}

        {status === "error" && (
          <>
            <h1 className="mt-8 text-xl font-semibold">ลิงก์ยืนยันไม่ถูกต้องหรือหมดอายุแล้วค่ะ</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              เข้าสู่ระบบแล้วขอส่งลิงก์ใหม่อีกครั้งได้นะคะ
            </p>
            <Link
              to="/"
              className="btn-gold mt-8 inline-block w-full rounded-full px-6 py-3.5 text-base"
            >
              กลับไปเข้าสู่ระบบ
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
