import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import logo from "@/assets/fahsai-logo.png";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

interface GoogleIdentityServices {
  accounts: {
    id: {
      initialize: (config: {
        client_id: string;
        callback: (response: { credential: string }) => void;
      }) => void;
      renderButton: (parent: HTMLElement, options: Record<string, string>) => void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentityServices;
  }
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "เข้าสู่ระบบ — FAHSAI" },
      { name: "description", content: "เข้าสู่ระบบ FAHSAI ผู้ช่วยสร้างคอนเทนต์สำหรับร้านของคุณ" },
      { property: "og:title", content: "FAHSAI — ผู้ช่วยสร้างคอนเทนต์สำหรับร้านของคุณ" },
      { property: "og:description", content: "ให้ FAHSAI ช่วยปั้นแบรนด์ของคุณให้โดดเด่น" },
    ],
  }),
  component: LoginPage,
});

type Mode = "google" | "login" | "signup" | "forgot";

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("google");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotSubmitted, setForgotSubmitted] = useState(false);
  const hiddenGoogleButtonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    async function handleCredentialResponse(response: { credential: string }) {
      setLoading(true);
      const t = toast.loading("กำลังเข้าสู่ระบบให้อยู่ค่ะ...");
      try {
        await api.loginWithGoogle(response.credential);
        toast.success("ยินดีต้อนรับสู่ฟ้าใสค่ะ ✨", { id: t });
        navigate({ to: "/dashboard" });
      } catch {
        toast.error("เข้าสู่ระบบไม่สำเร็จ ลองใหม่อีกครั้งนะคะ", { id: t });
      } finally {
        setLoading(false);
      }
    }

    function init() {
      const google = window.google!;
      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID!,
        callback: handleCredentialResponse,
      });
      if (hiddenGoogleButtonRef.current) {
        google.accounts.id.renderButton(hiddenGoogleButtonRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
        });
      }
    }

    if (window.google?.accounts?.id) {
      init();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = init;
    document.head.appendChild(script);
  }, [navigate]);

  function loginGoogle() {
    if (!GOOGLE_CLIENT_ID) {
      toast.error("ยังไม่ได้ตั้งค่า Google Client ID");
      return;
    }
    // Forward the click to Google's real (hidden) button so the consent
    // popup comes from an actual user click on Google's own UI.
    const realButton = hiddenGoogleButtonRef.current?.querySelector(
      'div[role="button"]',
    ) as HTMLElement | null;
    realButton?.click();
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const t = toast.loading("กำลังเข้าสู่ระบบให้อยู่ค่ะ...");
    try {
      await api.login(email, password);
      toast.success("ยินดีต้อนรับค่ะ ✨", { id: t });
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(errorMessage(err, "เข้าสู่ระบบไม่สำเร็จ ลองใหม่อีกครั้งนะคะ"), { id: t });
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.forgotPassword(email);
    } catch {
      // Ignore — always show the generic message below, even on error,
      // so we never leak whether the email exists.
    } finally {
      setLoading(false);
      setForgotSubmitted(true);
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("รหัสผ่านไม่ตรงกัน");
      return;
    }
    setLoading(true);
    const t = toast.loading("กำลังสมัครสมาชิกให้อยู่ค่ะ...");
    try {
      await api.signup(name, email, password);
      toast.success("สมัครสมาชิกสำเร็จค่ะ ✨", { id: t });
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(errorMessage(err, "สมัครสมาชิกไม่สำเร็จ ลองใหม่อีกครั้งนะคะ"), { id: t });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      {/* ambient glows */}
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
        <div className="mt-3 text-3xl font-extrabold tracking-[0.2em] text-foreground">FAHSAI</div>

        <h1 className="mt-8 text-xl font-semibold leading-relaxed">
          ให้ <span className="text-gold">FAHSAI</span>
          <br />
          ช่วยปั้นแบรนด์ของคุณ
          <br />
          ให้โดดเด่น
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">ผู้ช่วยสร้างคอนเทนต์สำหรับร้านของคุณ</p>

        {/* Google's real button lives here, invisible; our styled button forwards its click to it */}
        <div ref={hiddenGoogleButtonRef} className="absolute h-0 w-0 overflow-hidden opacity-0" />

        {mode === "google" && (
          <>
            <button
              onClick={loginGoogle}
              disabled={loading}
              className="btn-gold mt-8 flex w-full items-center justify-center gap-3 rounded-full px-6 py-3.5 text-base disabled:opacity-60"
            >
              <span className="grid h-7 w-7 place-items-center rounded-full bg-white">
                <svg viewBox="0 0 24 24" className="h-4 w-4">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              </span>
              Login with Google
            </button>
            <button
              onClick={() => setMode("login")}
              className="mt-4 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              หรือเข้าสู่ระบบด้วยอีเมล
            </button>
          </>
        )}

        {mode === "login" && (
          <form onSubmit={handleLogin} className="mt-8 space-y-3 text-left">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="อีเมล"
              className="w-full rounded-full border border-border bg-input px-5 py-3 text-base outline-none placeholder:text-muted-foreground focus:border-teal"
            />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="รหัสผ่าน"
              className="w-full rounded-full border border-border bg-input px-5 py-3 text-base outline-none placeholder:text-muted-foreground focus:border-teal"
            />
            <button
              type="button"
              onClick={() => {
                setForgotSubmitted(false);
                setMode("forgot");
              }}
              className="w-full text-right text-xs text-muted-foreground underline underline-offset-4"
            >
              ลืมรหัสผ่าน?
            </button>
            <button
              disabled={loading}
              className="btn-gold w-full rounded-full px-6 py-3.5 text-base disabled:opacity-60"
            >
              เข้าสู่ระบบ
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className="w-full text-center text-sm text-muted-foreground underline underline-offset-4"
            >
              ยังไม่มีบัญชี? สมัครสมาชิก
            </button>
            <button
              type="button"
              onClick={() => setMode("google")}
              className="w-full text-center text-sm text-muted-foreground underline underline-offset-4"
            >
              กลับไปเข้าสู่ระบบด้วย Google
            </button>
          </form>
        )}

        {mode === "signup" && (
          <form onSubmit={handleSignup} className="mt-8 space-y-3 text-left">
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ชื่อร้าน / ชื่อคุณ"
              className="w-full rounded-full border border-border bg-input px-5 py-3 text-base outline-none placeholder:text-muted-foreground focus:border-teal"
            />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="อีเมล"
              className="w-full rounded-full border border-border bg-input px-5 py-3 text-base outline-none placeholder:text-muted-foreground focus:border-teal"
            />
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="รหัสผ่าน (อย่างน้อย 8 ตัวอักษร)"
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
            <button
              disabled={loading}
              className="btn-gold w-full rounded-full px-6 py-3.5 text-base disabled:opacity-60"
            >
              สมัครสมาชิก
            </button>
            <button
              type="button"
              onClick={() => setMode("login")}
              className="w-full text-center text-sm text-muted-foreground underline underline-offset-4"
            >
              มีบัญชีแล้ว? เข้าสู่ระบบ
            </button>
            <button
              type="button"
              onClick={() => setMode("google")}
              className="w-full text-center text-sm text-muted-foreground underline underline-offset-4"
            >
              กลับไปเข้าสู่ระบบด้วย Google
            </button>
          </form>
        )}

        {mode === "forgot" && (
          <div className="mt-8 text-left">
            {forgotSubmitted ? (
              <p className="rounded-2xl bg-white/5 p-4 text-center text-sm text-muted-foreground">
                ถ้ามีบัญชีนี้ในระบบ เราส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปให้แล้วค่ะ
              </p>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-3">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="อีเมล"
                  className="w-full rounded-full border border-border bg-input px-5 py-3 text-base outline-none placeholder:text-muted-foreground focus:border-teal"
                />
                <button
                  disabled={loading}
                  className="btn-gold w-full rounded-full px-6 py-3.5 text-base disabled:opacity-60"
                >
                  ส่งลิงก์ตั้งรหัสผ่านใหม่
                </button>
              </form>
            )}
            <button
              type="button"
              onClick={() => setMode("login")}
              className="mt-3 w-full text-center text-sm text-muted-foreground underline underline-offset-4"
            >
              กลับไปเข้าสู่ระบบ
            </button>
          </div>
        )}

        {mode === "google" && (
          <p className="mt-6 text-sm text-muted-foreground">
            ยังไม่มีบัญชี?{" "}
            <button
              onClick={() => setMode("signup")}
              className="text-gold underline underline-offset-4"
            >
              สมัครสมาชิก
            </button>
          </p>
        )}

        <div className="mt-10 flex justify-center gap-6 text-xs text-muted-foreground">
          <a href="#" className="underline underline-offset-4">
            นโยบายความเป็นส่วนตัว
          </a>
          <a href="#" className="underline underline-offset-4">
            ข้อกำหนดการใช้งาน
          </a>
        </div>
      </div>
    </div>
  );
}
