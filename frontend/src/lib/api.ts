/**
 * Minimal JSON client for the backend. Paths are relative to /api (e.g. api("/course") -> GET /api/course);
 * in development Vite proxies /api to the FastAPI server, in production nginx does.
 *
 *   api<T>(path)                                  GET, resolves with the parsed JSON body
 *   api<T>(path, { method: "POST", json: body })  sends `json` as an application/json body
 *
 * Failed requests reject with an ApiError whose message is the server's `detail`, ready to show to the learner.
 */

const API_BASE = "/api";
const TOKEN_KEY = "dbacademy.token";

/** Dispatched on window when the server rejects the current session token (expired or revoked). */
export const UNAUTHORIZED_EVENT = "dbacademy:unauthorized";

function readStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null; // storage unavailable (private mode, blocked cookies): the session lasts until reload
  }
}

let token: string | null = readStoredToken();

export function getToken(): string | null {
  return token;
}

export function setToken(value: string | null) {
  token = value;
  try {
    if (value) localStorage.setItem(TOKEN_KEY, value);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable: keep the in-memory token */
  }
}

export class ApiError extends Error {
  status: number;
  detail: unknown;

  constructor(message: string, status: number, detail?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

export interface ApiOptions extends Omit<RequestInit, "body"> {
  /** Serialized as the JSON request body. */
  json?: unknown;
  body?: BodyInit | null;
}

/** FastAPI validation errors arrive as a list of {loc, msg}; everything else as a string detail. */
function errorMessage(detail: unknown, status: number): string {
  if (typeof detail === "string" && detail) return detail;
  if (Array.isArray(detail) && detail.length) {
    return detail
      .map((d) => {
        if (d && typeof d === "object" && "msg" in d) {
          const loc = Array.isArray((d as { loc?: unknown }).loc)
            ? ((d as { loc: unknown[] }).loc).filter((p) => p !== "body").join(".")
            : "";
          const msg = String((d as { msg: unknown }).msg).replace(/^Value error, /, "");
          return loc ? `${loc}: ${msg}` : msg;
        }
        return String(d);
      })
      .join("; ");
  }
  if (status === 429) return "Too many requests. Please slow down and try again.";
  if (status === 502 || status === 503 || status === 504) return `The server is temporarily unavailable (${status}). Please try again shortly.`;
  return `Request failed (HTTP ${status}).`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function api<T = any>(path: string, opts: ApiOptions = {}): Promise<T> {
  const { json, headers, body, ...init } = opts;
  const h = new Headers(headers);
  h.set("Accept", "application/json");
  const sentToken = token;
  if (sentToken) h.set("Authorization", `Bearer ${sentToken}`);
  let payload: BodyInit | null | undefined = body;
  if (json !== undefined) {
    h.set("Content-Type", "application/json");
    payload = JSON.stringify(json);
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...init, headers: h, body: payload });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiError("Cannot reach the server. Check your connection and try again.", 0);
  }

  const text = await res.text();
  let data: unknown = undefined;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text; // e.g. an HTML error page from a proxy
    }
  }

  if (!res.ok) {
    // Only the token this request carried is invalid: never discard a newer one from a login in the meantime.
    if (res.status === 401 && sentToken && token === sentToken) {
      setToken(null);
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    const detail = data && typeof data === "object" && "detail" in data ? (data as { detail: unknown }).detail : undefined;
    throw new ApiError(errorMessage(detail, res.status), res.status, detail);
  }
  return data as T;
}
