import { defineHandler } from 'void';
import { env } from 'void/env';
import { reply } from '../../../src/line/api.ts';
import { createCard, introCard } from '../../../src/line/flex.ts';
import { verifyLineSignature } from '../../../src/line/signature.ts';
import { issueCreateToken, log, readjust } from '../../../src/server/engine.ts';

interface LineEvent {
  type: string;
  replyToken?: string;
  source?: { type: 'user' | 'group' | 'room'; groupId?: string; roomId?: string; userId?: string };
  message?: {
    type: string;
    text?: string;
    mention?: { mentionees: Array<{ index: number; length: number; type?: string; isSelf?: boolean }> };
  };
  postback?: { data: string };
}

// LINE Webhook。署名は「受け取ったままの本文」で確かめる必要があるので、
// JSON にパースする前に arrayBuffer で生のバイト列を取る。
export const POST = defineHandler(async (c) => {
  const secret = env.LINE_CHANNEL_SECRET;
  if (!secret) {
    return c.text('LINE_CHANNEL_SECRET is not set', 503);
  }
  const raw = await c.req.arrayBuffer();
  const ok = await verifyLineSignature(secret, raw, c.req.header('x-line-signature'));
  if (!ok) {
    return c.text('invalid signature', 401);
  }

  const body = JSON.parse(new TextDecoder().decode(raw)) as { events: LineEvent[] };
  // 返事は待たずに 200 を返し、処理は waitUntil で続ける
  c.executionCtx.waitUntil(
    Promise.all(
      body.events.map((e) =>
        handle(e).catch((err) => console.error('webhook handler failed', e.type, err)),
      ),
    ),
  );
  return c.json({ ok: true });
});

function groupIdOf(e: LineEvent): string | null {
  return e.source?.groupId ?? e.source?.roomId ?? null;
}

async function handle(e: LineEvent) {
  const groupId = groupIdOf(e);
  const liffId = env.LIFF_ID;

  if (e.type === 'join' && groupId && e.replyToken) {
    if (!liffId) return reply(e.replyToken, [{ type: 'text', text: 'アケナ（準備中）' }]);
    const token = await issueCreateToken(groupId, null);
    await log(null, null, 'join', { groupId });
    return reply(e.replyToken, [introCard(liffId, token)]);
  }

  if (e.type === 'message' && e.message?.type === 'text' && e.replyToken) {
    const mentionees = e.message.mention?.mentionees ?? [];
    const self = mentionees.find((m) => m.isSelf);
    if (!self) return;
    if (!groupId) {
      return reply(e.replyToken, [{ type: 'text', text: 'グループに招待して使ってください' }]);
    }
    const text = e.message.text ?? '';
    const name = (text.slice(0, self.index) + text.slice(self.index + self.length)).trim().slice(0, 40);
    if (!liffId) return reply(e.replyToken, [{ type: 'text', text: 'アケナ（準備中）' }]);
    const token = await issueCreateToken(groupId, name || null);
    await log(null, e.source?.userId ?? null, 'mention', { groupId, name });
    return reply(e.replyToken, [name ? createCard(liffId, token, name) : introCard(liffId, token)]);
  }

  if (e.type === 'postback' && e.postback?.data.startsWith('readjust=')) {
    await readjust(e.postback.data.slice('readjust='.length));
  }
}
