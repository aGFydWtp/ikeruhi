import type { Context } from 'hono';
import { verifyIdToken, type LiffUser } from '../line/api.ts';

/**
 * LIFF の ID トークンで本人を確かめる。
 * ローカル開発（vite dev）だけは x-dev-user ヘッダーで代用できる。
 */
export async function currentUser(c: Context): Promise<LiffUser | null> {
  if (import.meta.env.DEV) {
    const dev = c.req.header('x-dev-user');
    if (dev) return { userId: dev, name: decodeURIComponent(c.req.header('x-dev-name') ?? dev) };
  }
  const auth = c.req.header('authorization') ?? '';
  const m = auth.match(/^Bearer (.+)$/);
  if (!m) return null;
  return verifyIdToken(m[1]);
}
