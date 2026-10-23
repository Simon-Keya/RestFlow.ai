import axios from "axios";
import { API_URL, POS_API_URL, USE_GO_POS } from "@/lib/constants/config";
import { attachInterceptors } from "./interceptors";

/**
 * Default API client → Nest (system of record).
 * Timeout elevated so Render cold starts don't look like hard failures.
 */
export const apiClient = attachInterceptors(
  axios.create({
    baseURL: API_URL,
    timeout: 45_000,
    headers: { "Content-Type": "application/json" },
  }),
);

/**
 * POS feature client — Nest by default; Go when USE_GO_POS + POS_API_URL set.
 * One writer: only this client should call charge/availability when flag is on.
 */
export const posApiClient = attachInterceptors(
  axios.create({
    baseURL: USE_GO_POS ? POS_API_URL : API_URL,
    timeout: 45_000,
    headers: { "Content-Type": "application/json" },
  }),
);

/** Explicit longer timeout for heavy POS mutations */
export const POS_MUTATION_TIMEOUT_MS = 60_000;
