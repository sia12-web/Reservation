export class ApiError extends Error {
  status?: number;
  details?: unknown;
  isNetworkError: boolean;

  constructor(message: string, options: { status?: number; details?: unknown; isNetworkError?: boolean } = {}) {
    super(message);
    this.status = options.status;
    this.details = options.details;
    this.isNetworkError = Boolean(options.isNetworkError);
  }
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.PROD ? "/api" : "http://localhost:3000/api");
const DEFAULT_TIMEOUT_MS = 10000;

export async function httpPost<TResponse>(
  path: string,
  body: unknown,
  options: { timeoutMs?: number; headers?: Record<string, string> } = {}
): Promise<TResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const requestUrl = `${API_BASE_URL}${path}`;

  try {
    const response = await fetch(requestUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...options.headers
      },
      body: JSON.stringify(body),
      signal: controller.signal,
      credentials: "include",
    });

    const text = await response.text();
    const contentType = response.headers.get("content-type") ?? "";
    const expectsJson = contentType.includes("application/json");

    let data: unknown = undefined;
    if (text && expectsJson) {
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        throw new ApiError("Invalid server response", {
          status: response.status,
          details: { contentType, textHead: text.slice(0, 120) },
        });
      }
    }

    if (!response.ok) {
      const message =
        expectsJson && typeof data === "object" && data !== null && "error" in data
          ? String((data as { error?: unknown }).error ?? "Request failed")
          : text || "Request failed";

      const details =
        expectsJson && typeof data === "object" && data !== null && "details" in data
          ? (data as { details?: unknown }).details
          : { contentType, textHead: text.slice(0, 120) };

      throw new ApiError(message, {
        status: response.status,
        details,
      });
    }

    return data as TResponse;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    const isAbort = error instanceof DOMException && error.name === "AbortError";
    throw new ApiError("Network error", { isNetworkError: true, status: isAbort ? 0 : undefined });
  } finally {
    clearTimeout(timeout);
  }
}

export async function httpGet<TResponse>(
  path: string,
  options: { timeoutMs?: number; headers?: Record<string, string> } = {}
): Promise<TResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...options.headers
      },
      signal: controller.signal,
      credentials: "include",
    });

    const text = await response.text();
    const contentType = response.headers.get("content-type") ?? "";
    const expectsJson = contentType.includes("application/json");

    let data: any = undefined;
    if (text && expectsJson) {
      try {
        data = JSON.parse(text);
      } catch (e) {
        // Fallback or ignore
      }
    }

    if (!response.ok) {
      throw new ApiError(data?.error || text || "Request failed", {
        status: response.status,
        details: data?.details,
      });
    }

    return data as TResponse;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    const isAbort = error instanceof DOMException && error.name === "AbortError";
    throw new ApiError("Network error", { isNetworkError: true, status: isAbort ? 0 : undefined });
  } finally {
    clearTimeout(timeout);
  }
}

export async function httpDelete<TResponse>(
  path: string,
  options: { timeoutMs?: number; headers?: Record<string, string> } = {}
): Promise<TResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        ...options.headers
      },
      signal: controller.signal,
      credentials: "include",
    });

    const text = await response.text();
    const contentType = response.headers.get("content-type") ?? "";
    const expectsJson = contentType.includes("application/json");

    let data: any = undefined;
    if (text && expectsJson) {
      try {
        data = JSON.parse(text);
      } catch (e) {
        // ...
      }
    }

    if (!response.ok) {
      throw new ApiError(data?.error || text || "Request failed", {
        status: response.status,
        details: data?.details,
      });
    }

    return data as TResponse;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    const isAbort = error instanceof DOMException && error.name === "AbortError";
    throw new ApiError("Network error", { isNetworkError: true, status: isAbort ? 0 : undefined });
  } finally {
    clearTimeout(timeout);
  }
}
