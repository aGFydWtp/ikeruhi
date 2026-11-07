import { defineHandler } from 'void';
import { diffDays } from '../../../../src/core/dates.ts';
import { currentUser } from '../../../../src/server/auth.ts';
import { resolveDeadline } from '../../../../src/server/deadline.ts';
import { changePeriod, loadEvent } from '../../../../src/server/engine.ts';
import { periodSchema } from '../../../../src/server/schemas.ts';

// 期間を延ばす・締切を決める。誰でも変えられ、変えたら bot が告知する
export const PUT = defineHandler(async (c) => {
  const user = await currentUser(c);
  if (!user) return c.json({ error: 'unauthorized' }, 401);
  const ev = await loadEvent(c.req.param('id')!);
  if (!ev) return c.json({ error: 'not_found' }, 404);
  if (ev.status === 'decided') return c.json({ error: 'decided' }, 409);
  const parsed = periodSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: 'invalid', issues: parsed.error.issues }, 400);
  const body = parsed.data;
  const start = body.startDate ?? ev.startDate;
  const end = body.endDate ?? ev.endDate;
  const len = diffDays(start, end) + 1;
  if (len < 1 || len > 62) return c.json({ error: 'bad_period' }, 400);
  await changePeriod(
    ev,
    {
      ...(body.startDate ? { startDate: body.startDate } : {}),
      ...(body.endDate ? { endDate: body.endDate } : {}),
      ...(body.deadline ? { answerDeadline: resolveDeadline(body.deadline) } : {}),
    },
    user.name,
  );
  return { ok: true };
});
