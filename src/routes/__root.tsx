import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { captureError, initSentry } from "../lib/sentry";
import { Toaster } from "sonner";

initSentry();

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="glass-card max-w-md rounded-2xl p-10 text-center">
        <h1 className="text-6xl font-bold text-gold">404</h1>
        <h2 className="mt-4 text-lg font-semibold">ไม่พบหน้าที่คุณกำลังหา</h2>
        <p className="mt-2 text-sm text-muted-foreground">ลองกลับหน้าหลักดูนะคะ</p>
        <Link to="/" className="btn-gold mt-6 inline-flex rounded-full px-6 py-2 text-sm">
          กลับหน้าหลัก
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
    captureError(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="glass-card max-w-md rounded-2xl p-8 text-center">
        <h1 className="text-xl font-semibold">โหลดหน้านี้ไม่สำเร็จ</h1>
        <p className="mt-2 text-sm text-muted-foreground">ลองใหม่อีกครั้งได้เลยนะคะ</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="btn-gold mt-6 rounded-full px-6 py-2 text-sm"
        >
          ลองอีกครั้ง
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "FAHSAI — ผู้ช่วยสร้างคอนเทนต์สำหรับร้านของคุณ" },
      { name: "description", content: "FAHSAI ช่วย SME ชายแดนใต้สร้างคอนเทนต์ Facebook, LINE OA และ Instagram ด้วย AI" },
      { property: "og:title", content: "FAHSAI — ผู้ช่วยสร้างคอนเทนต์สำหรับร้านของคุณ" },
      { property: "og:description", content: "AI ช่วยปั้นแบรนด์ของคุณให้โดดเด่น" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700;800&display=swap" },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="th">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster theme="dark" position="top-center" richColors />
    </QueryClientProvider>
  );
}
