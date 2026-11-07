import { defineHandler } from 'void';
import { readCreateToken } from '../../../src/server/engine.ts';

// 作成カードのトークンが使えるか（イベント名の初期値も返す）
export const GET = defineHandler(async (c) => {
  const row = await readCreateToken(c.req.param('token')!);
  if (!row) return c.json({ error: 'expired' }, 404);
  return { name: row.name ?? '' };
});
