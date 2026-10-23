import { AxiosError } from "axios";

/** Shape returned by the API's global HttpExceptionFilter. */
export interface ApiErrorBody {
  statusCode: number;
  error: string;
  message: string | string[];
  timestamp?: string;
  path?: string;
}

export class ApiError extends Error {
  readonly statusCode: number;
  readonly errorCode: string;
  readonly details: string[];

  constructor(body: ApiErrorBody, statusCode = 500) {
    const message = Array.isArray(body.message) ? body.message.join(", ") : body.message;
    super(message || "Something went wrong");
    this.name = "ApiError";
    this.statusCode = body.statusCode ?? statusCode;
    this.errorCode = body.error ?? "UnknownError";
    this.details = Array.isArray(body.message) ? body.message : [message];
  }

  get isAuthError() {
    return this.statusCode === 401;
  }

  get isForbidden() {
    return this.statusCode === 403;
  }

  get isNotFound() {
    return this.statusCode === 404;
  }

  get isConflict() {
    return this.statusCode === 409;
  }

  get isValidationError() {
    return this.statusCode === 400;
  }
}

/** Normalize anything thrown by axios (or elsewhere) into an ApiError with a readable message. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (error instanceof AxiosError) {
    if (error.response?.data) {
      return new ApiError(error.response.data as ApiErrorBody, error.response.status);
    }
    if (error.code === "ECONNABORTED") {
      return new ApiError({
        statusCode: 408,
        error: "Timeout",
        message:
          "The server took too long to respond. Your connection may be fine — wait a few seconds and check Orders before re-submitting (avoid double-charging).",
      });
    }
    if (!error.response) {
      return new ApiError({ statusCode: 0, error: "NetworkError", message: "Can't reach the server. Check your connection and try again." });
    }
  }

  const message = error instanceof Error ? error.message : "Something went wrong";
  return new ApiError({ statusCode: 500, error: "UnknownError", message });
}
