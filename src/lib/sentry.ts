import * as Sentry from "@sentry/react";

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;

export function initSentry() {
  if (typeof window === "undefined" || !SENTRY_DSN) return;
  Sentry.init({ dsn: SENTRY_DSN, tracesSampleRate: 0 });
}

export function captureError(error: unknown) {
  if (!SENTRY_DSN) return;
  Sentry.captureException(error);
}
