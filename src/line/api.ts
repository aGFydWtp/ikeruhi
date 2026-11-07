import { env } from 'void/env';

const API = 'https://api.line.me';

export type LineMessage = Record<string, unknown>;

function token(): string {
  const t = env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!t) throw new Error('LINE_CHANNEL_ACCESS_TOKEN is not set');
  return t;
}

/** ローカル開発用：トークンが dummy なら LINE に送らずログに出す */
function isDry(): boolean {
  return env.LINE_CHANNEL_ACCESS_TOKEN === 'dummy';
}

async function call(path: string, init: RequestInit): Promise<Response> {
  if (isDry()) {
    console.log('[line dry-run]', path, init.body ?? '');
    return new Response(path.endsWith('/members/count') ? '{"count":2}' : '{}', { status: 200 });
  }
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token()}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    console.error('LINE API error', path, res.status, body);
    throw new Error(`LINE API ${path} ${res.status}`);
  }
  return res;
}

/** 応答メッセージ（無料） */
export async function reply(replyToken: string, messages: LineMessage[]): Promise<void> {
  await call('/v2/bot/message/reply', {
    method: 'POST',
    body: JSON.stringify({ replyToken, messages: messages.slice(0, 5) }),
  });
}

/** プッシュメッセージ（グループの人数分だけ無料枠を使う） */
export async function push(to: string, messages: LineMessage[]): Promise<void> {
  await call('/v2/bot/message/push', {
    method: 'POST',
    headers: { 'X-Line-Retry-Key': crypto.randomUUID() },
    body: JSON.stringify({ to, messages: messages.slice(0, 5) }),
  });
}

/** グループの人数（botは含まない） */
export async function groupMemberCount(groupId: string): Promise<number | null> {
  try {
    const res = await call(`/v2/bot/group/${encodeURIComponent(groupId)}/members/count`, { method: 'GET' });
    const body = (await res.json()) as { count: number };
    return body.count;
  } catch {
    return null;
  }
}

export interface LiffUser {
  userId: string;
  name: string;
}

/** LIFF の ID トークンを LINE で検証して、ユーザーID と表示名を得る */
export async function verifyIdToken(idToken: string): Promise<LiffUser | null> {
  const clientId = env.LINE_LOGIN_CHANNEL_ID;
  if (!clientId) throw new Error('LINE_LOGIN_CHANNEL_ID is not set');
  const res = await fetch(`${API}/oauth2/v2.1/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ id_token: idToken, client_id: clientId }),
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { sub: string; name?: string };
  return { userId: body.sub, name: body.name ?? '名無し' };
}

/** 本当に通知が飛ぶメンション付きテキスト（textV2） */
export function mentionText(template: string, userIds: string[]): LineMessage {
  // template 中の {mentions} を {u0}{u1}… に置き換える
  const keys = userIds.map((_, i) => `u${i}`);
  const text = template.replace('{mentions}', keys.map((k) => `{${k}}`).join(' '));
  const substitution: Record<string, unknown> = {};
  userIds.forEach((userId, i) => {
    substitution[keys[i]] = { type: 'mention', mentionee: { type: 'user', userId } };
  });
  return { type: 'textV2', text, substitution };
}
