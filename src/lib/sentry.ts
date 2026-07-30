import * as Sentry from "@sentry/react";

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;

export function initSentry() {
  if (typeof window === "undefined" || !SENTRY_DSN) return;
  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: 0,
    environment: import.meta.env.PROD ? "production" : "development",
  });
}

export function captureError(error: unknown) {
  if (!SENTRY_DSN) return;
  Sentry.captureException(error);
}
