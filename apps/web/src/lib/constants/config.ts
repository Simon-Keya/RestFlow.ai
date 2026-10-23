export const APP_NAME = "RestFlow";

/** Nest (or primary) API — default for almost all features */
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

/**
 * Optional POS-only base URL (Go strangler).
 * When unset, POS uses API_URL (Nest).
 * Set NEXT_PUBLIC_POS_API_URL to the Go Render URL after Phase B parity.
 */
export const POS_API_URL =
  process.env.NEXT_PUBLIC_POS_API_URL?.trim() || API_URL;

/**
 * Explicit flag: route POS feature calls to POS_API_URL.
 * Rollback: set to false or remove POS_API_URL so POS_API_URL === API_URL.
 */
export const USE_GO_POS =
  process.env.NEXT_PUBLIC_USE_GO_POS === "true" &&
  Boolean(process.env.NEXT_PUBLIC_POS_API_URL?.trim());

export const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? API_URL;
export const APP_ENV = process.env.NEXT_PUBLIC_APP_ENV ?? "development";

export const DEFAULT_PAGE_SIZE = 25;
export const LOW_STOCK_RATIO = 0.25;
export const NEAR_EXPIRY_DAYS = 7;
