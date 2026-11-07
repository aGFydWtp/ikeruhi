import { defineHandler } from 'void';
import { env } from 'void/env';
import { verifyLineSignature } from '../../../src/line/signature';

// LINE Webhook。署名は「受け取ったままの本文」で確かめる必要があるので、
// JSON にパースする前に arrayBuffer で生のバイト列を取る。
export const POST = defineHandler(async (c) => {
  const secret = env.LINE_CHANNEL_SECRET;
  if (!secret) {
    return c.text('LINE_CHANNEL_SECRET is not set', 503);
  }
  const raw = await c.req.arrayBuffer();
  const ok = await verifyLineSignature(
    secret,
    raw,
    c.req.header('x-line-signature'),
  );
  if (!ok) {
    return c.text('invalid signature', 401);
  }

  const body = JSON.parse(new TextDecoder().decode(raw)) as {
    destination: string;
    events: Array<{ type: string; replyToken?: string; source?: { type: string; groupId?: string; userId?: string } }>;
  };

  // TODO: join（招待）→自己紹介カード、message（メンション）→作成カード
  console.log('line webhook', JSON.stringify(body.events.map((e) => ({ type: e.type, source: e.source?.type }))));

  // LINE は 200 を期待する。検証用の空 events もここで 200 を返す。
  return c.json({ ok: true, events: body.events.length });
});
