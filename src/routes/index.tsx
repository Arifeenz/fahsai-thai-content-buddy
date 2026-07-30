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
      renderButton: (parent: HTMLElement, options: Record<string, string | number>) => void;
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
  const googleButtonRef = useRef<HTMLDivElement>(null);

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

    // Render Google's real button directly and visibly — earlier this
    // rendered into a hidden container and forwarded a synthetic click to
    // it, but Google's button lives in a cross-origin iframe (a synthetic
    // .click() can never reach inside it), and `prompt()`/One Tap has its
    // own exponential backoff that silently stops showing after a few
    // tries. Rendering the real button is the only fully reliable option.
    function renderButton() {
      const container = googleButtonRef.current;
      if (!container) return;
      container.innerHTML = "";
      window.google!.accounts.id.renderButton(container, {
        type: "standard",
        theme: "outline",
        size: "large",
        shape: "pill",
        text: "signin_with",
        width: container.offsetWidth || 300,
      });
    }

    function init() {
      window.google!.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID!,
        callback: handleCredentialResponse,
      });
      renderButton();
    }

    if (window.google?.accounts?.id) {
      init();
    } else {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = init;
      document.head.appendChild(script);
    }

    window.addEventListener("resize", renderButton);
    return () => window.removeEventListener("resize", renderButton);
  }, [navigate]);

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

        {mode === "google" && (
          <>
            <div className="mt-8 flex w-full justify-center" ref={googleButtonRef} />
            {loading && (
              <p className="mt-3 text-sm text-muted-foreground">กำลังเข้าสู่ระบบให้อยู่ค่ะ...</p>
            )}
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
