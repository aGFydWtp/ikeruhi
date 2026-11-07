import { events } from '@schema';
import { defineHandler } from 'void';
import { db } from 'void/db';
import { env } from 'void/env';
import { diffDays, todayJst } from '../../../src/core/dates.ts';
import { groupMemberCount, push } from '../../../src/line/api.ts';
import { recruitCard } from '../../../src/line/flex.ts';
import { currentUser } from '../../../src/server/auth.ts';
import { resolveDeadline } from '../../../src/server/deadline.ts';
import { log, newId, readCreateToken } from '../../../src/server/engine.ts';
import { createEventSchema } from '../../../src/server/schemas.ts';

// ② イベント作成：イベントを作り、募集カードをグループに出す
export const POST = defineHandler(async (c) => {
  const user = await currentUser(c);
  if (!user) return c.json({ error: 'unauthorized' }, 401);
  const parsed = createEventSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: 'invalid', issues: parsed.error.issues }, 400);
  const body = parsed.data;

  const token = await readCreateToken(body.token);
  if (!token) return c.json({ error: 'token_expired' }, 410);

  const today = todayJst();
  if (body.startDate <= today) return c.json({ error: 'start_must_be_future' }, 400);
  const len = diffDays(body.startDate, body.endDate) + 1;
  if (len < 1 || len > 62) return c.json({ error: 'bad_period' }, 400);

  const ev = {
    id: newId(),
    groupId: token.groupId,
    name: body.name,
    startDate: body.startDate,
    endDate: body.endDate,
    answerDeadline: resolveDeadline(body.deadline),
    status: 'collecting',
    createdBy: user.userId,
    groupSize: await groupMemberCount(token.groupId),
    announcedKey: 'collecting',
  };
  await db.insert(events).values(ev);
  await log(ev.id, user.userId, 'create', { len, deadline: body.deadline.kind });
  await push(ev.groupId, [recruitCard(env.LIFF_ID!, ev)]);
  return { id: ev.id };
});
