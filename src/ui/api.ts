// LIFF からサーバーの API を呼ぶ。ID トークンを付けて本人を示す。
declare global {
  interface Window {
    liff?: {
      init(opts: { liffId: string }): Promise<void>;
      isLoggedIn(): boolean;
      isInClient(): boolean;
      login(opts?: { redirectUri?: string }): void;
      getIDToken(): string | null;
      closeWindow(): void;
    };
  }
}

let authHeaders: Record<string, string> = {};

export function setDevUser(id: string, name: string) {
  authHeaders = { 'x-dev-user': id, 'x-dev-name': encodeURIComponent(name) };
}

export function setIdToken(token: string) {
  authHeaders = { Authorization: `Bearer ${token}` };
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...authHeaders, ...(init.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error((body as { error?: string }).error ?? `HTTP ${res.status}`), { status: res.status });
  return body as T;
}

export function closeOr(fallback: () => void) {
  if (window.liff?.isInClient()) window.liff.closeWindow();
  else fallback();
}
