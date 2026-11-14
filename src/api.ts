const base =
  (import.meta as unknown as { env: Record<string, string> }).env
    .VITE_API_BASE || "";
export function getToken() {
  return sessionStorage.getItem("numa-session");
}
export function setToken(value: string | null) {
  value
    ? sessionStorage.setItem("numa-session", value)
    : sessionStorage.removeItem("numa-session");
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (getToken()) headers.set("Authorization", `Bearer ${getToken()}`);
  if (options.body && !(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  const response = await fetch(base + "/api" + path, {
    ...options,
    headers,
    signal: options.signal || AbortSignal.timeout(90000),
  });
  if (!response.ok) {
    let message = "The request could not be completed.";
    try {
      const body = await response.json();
      message = typeof body.detail === "string" ? body.detail : message;
    } catch {
      message = `Server unavailable (${response.status}).`;
    }
    if (response.status === 401 && !path.includes("/auth/login")) {
      setToken(null);
      window.dispatchEvent(new Event("numa:expired"));
    }
    throw new Error(message);
  }
  return response.status === 204
    ? (undefined as T)
    : ((await response.json()) as T);
}
export const json = (value: unknown) => JSON.stringify(value);
export const dateLabel = (date: string) =>
  new Date(date).toLocaleDateString("en-GB", {
    month: "short",
    day: "numeric",
  });
