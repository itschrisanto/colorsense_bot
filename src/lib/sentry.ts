import * as Sentry from "@sentry/node";
import { SENTRY_DSN } from "../config.js";

let enabled = false;

/** No-op if SENTRY_DSN isn't set — Sentry is optional, never required for local dev. */
export function initSentry(): void {
  if (!SENTRY_DSN) {
    console.log("SENTRY_DSN not set — error alerting disabled.");
    return;
  }
  Sentry.init({ dsn: SENTRY_DSN });
  enabled = true;
}

export function captureError(err: unknown): void {
  if (!enabled) return;
  Sentry.captureException(err);
}
