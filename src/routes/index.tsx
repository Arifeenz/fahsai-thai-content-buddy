import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import logo from "@/assets/fahsai-logo.png";

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

function LoginPage() {
  const navigate = useNavigate();
  const [emailMode, setEmailMode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function loginGoogle() {
    setLoading(true);
    const t = toast.loading("กำลังเข้าสู่ระบบให้อยู่ค่ะ...");
    try {
      await api.loginWithGoogle();
      toast.success("ยินดีต้อนรับสู่ฟ้าใสค่ะ ✨", { id: t });
      navigate({ to: "/dashboard" });
    } catch {
      toast.error("เข้าสู่ระบบไม่สำเร็จ ลองใหม่อีกครั้งนะคะ", { id: t });
    } finally { setLoading(false); }
  }

  async function loginEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const t = toast.loading("กำลังเข้าสู่ระบบให้อยู่ค่ะ...");
    try {
      await api.login(email, password);
      toast.success("ยินดีต้อนรับค่ะ ✨", { id: t });
      navigate({ to: "/dashboard" });
    } catch {
      toast.error("เข้าสู่ระบบไม่สำเร็จ ลองใหม่อีกครั้งนะคะ", { id: t });
    } finally { setLoading(false); }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      {/* ambient glows */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/4 top-1/3 h-96 w-96 -translate-x-1/2 rounded-full bg-gold/10 blur-3xl" />
        <div className="absolute right-1/4 bottom-1/3 h-96 w-96 rounded-full bg-teal/15 blur-3xl" />
      </div>

      <div className="glass-card relative w-full max-w-md rounded-[2rem] px-8 py-12 text-center shadow-[0_20px_80px_oklch(0_0_0_/_50%)]">
        <img src={logo} alt="FAHSAI" className="mx-auto h-20 w-20 drop-shadow-[0_0_25px_oklch(0.82_0.13_85/40%)]" />
        <div className="mt-3 text-3xl font-extrabold tracking-[0.2em] text-foreground">FAHSAI</div>

        <h1 className="mt-8 text-xl font-semibold leading-relaxed">
          ให้ <span className="text-gold">FAHSAI</span><br />
          ช่วยปั้นแบรนด์ของคุณ<br />ให้โดดเด่น
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          ผู้ช่วยสร้างคอนเทนต์สำหรับร้านของคุณ
        </p>

        {!emailMode ? (
          <>
            <button
              onClick={loginGoogle}
              disabled={loading}
              className="btn-gold mt-8 flex w-full items-center justify-center gap-3 rounded-full px-6 py-3.5 text-base disabled:opacity-60"
            >
              <span className="grid h-7 w-7 place-items-center rounded-full bg-white">
                <svg viewBox="0 0 24 24" className="h-4 w-4"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              </span>
              Login with Google
            </button>
            <button
              onClick={() => setEmailMode(true)}
              className="mt-4 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              หรือเข้าสู่ระบบด้วยอีเมล
            </button>
          </>
        ) : (
          <form onSubmit={loginEmail} className="mt-8 space-y-3 text-left">
            <input
              type="email" required value={email} onChange={(e)=>setEmail(e.target.value)}
              placeholder="อีเมล"
              className="w-full rounded-full border border-border bg-input px-5 py-3 text-base outline-none placeholder:text-muted-foreground focus:border-teal"
            />
            <input
              type="password" required value={password} onChange={(e)=>setPassword(e.target.value)}
              placeholder="รหัสผ่าน"
              className="w-full rounded-full border border-border bg-input px-5 py-3 text-base outline-none placeholder:text-muted-foreground focus:border-teal"
            />
            <button disabled={loading} className="btn-gold w-full rounded-full px-6 py-3.5 text-base disabled:opacity-60">
              เข้าสู่ระบบ
            </button>
            <button type="button" onClick={()=>setEmailMode(false)} className="w-full text-center text-sm text-muted-foreground underline underline-offset-4">
              กลับไปเข้าสู่ระบบด้วย Google
            </button>
          </form>
        )}

        <p className="mt-6 text-sm text-muted-foreground">
          ยังไม่มีบัญชี? <button onClick={loginGoogle} className="text-gold underline underline-offset-4">สมัครสมาชิก</button>
        </p>

        <div className="mt-10 flex justify-center gap-6 text-xs text-muted-foreground">
          <a href="#" className="underline underline-offset-4">นโยบายความเป็นส่วนตัว</a>
          <a href="#" className="underline underline-offset-4">ข้อกำหนดการใช้งาน</a>
        </div>
      </div>
    </div>
  );
}
