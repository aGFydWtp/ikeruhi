import { defineHandler } from 'void';
import { currentUser } from '../../../../src/server/auth.ts';
import { loadEvent, saveAnswer } from '../../../../src/server/engine.ts';
import { answerSchema } from '../../../../src/server/schemas.ts';

// ③④ の送信。保存したらすぐ集計し直す
export const PUT = defineHandler(async (c) => {
  const user = await currentUser(c);
  if (!user) return c.json({ error: 'unauthorized' }, 401);
  const ev = await loadEvent(c.req.param('id')!);
  if (!ev) return c.json({ error: 'not_found' }, 404);
  const parsed = answerSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: 'invalid', issues: parsed.error.issues }, 400);
  await saveAnswer(ev, user, parsed.data);
  return { ok: true };
});
