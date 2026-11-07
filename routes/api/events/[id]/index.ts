import { defineHandler } from 'void';
import { dayStats } from '../../../../src/core/aggregate.ts';
import { eachDate, todayJst } from '../../../../src/core/dates.ts';
import { currentUser } from '../../../../src/server/auth.ts';
import { latestRound, loadAnswers, loadEvent } from '../../../../src/server/engine.ts';

// ③④ を開いたときのデータ。イベントの状態と、自分の前の回答
export const GET = defineHandler(async (c) => {
  const user = await currentUser(c);
  if (!user) return c.json({ error: 'unauthorized' }, 401);
  const ev = await loadEvent(c.req.param('id')!);
  if (!ev) return c.json({ error: 'not_found' }, 404);
  const [{ answers, rows, names }, round] = await Promise.all([loadAnswers(ev.id), latestRound(ev.id)]);
  const mine = answers.find((a) => a.userId === user.userId);
  const myRow = rows.find((r) => r.userId === user.userId);
  // みんなの予定：答えた人の名前と、日ごとの空いてない人・分からない人（名前の添字）
  const order = answers.map((a) => a.userId);
  const idx = (ids: string[]) => ids.map((id) => order.indexOf(id));
  const everyone = {
    names: order.map((id) => names.get(id) ?? ''),
    days: Object.fromEntries(
      dayStats(eachDate(ev.startDate, ev.endDate), answers).map((d) => [d.date, { ng: idx(d.ngUsers), unknown: idx(d.unknownUsers) }]),
    ),
  };
  return {
    everyone,
    today: todayJst(),
    event: {
      id: ev.id,
      name: ev.name,
      startDate: ev.startDate,
      endDate: ev.endDate,
      answerDeadline: ev.answerDeadline,
      status: ev.status,
      tentativeDate: ev.tentativeDate,
      tentativeUntil: ev.tentativeUntil,
      decidedDate: ev.decidedDate,
    },
    round: round ? { dates: round.dates, deadline: round.deadline, createdAt: round.createdAt } : null,
    me: mine
      ? { weekdayNg: mine.weekdayNg, marks: mine.marks, wish: mine.wish ?? '', updatedAt: myRow?.updatedAt ?? null }
      : null,
  };
});
