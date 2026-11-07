// イベントの状態を進める処理。Webhook、LIFF の API、Cron から呼ぶ。
// 集計はいつもイベント単位で頭から計算し直す（src/core/aggregate.ts）。
import { candidateRounds, createTokens, dateMarks, events, logs, participants, weekdayNg } from '@schema';
import { and, db, desc, eq, isNotNull, ne, or } from 'void/db';
import { env } from 'void/env';
import { compareDays, dayStats, decide, isNg, type Mark, type ParticipantAnswer } from '../core/aggregate.ts';
import { type DateStr, addDays, formatShort, jstAt, shiftOutOfNight, todayJst } from '../core/dates.ts';
import { groupMemberCount, mentionText, push, type LineMessage } from '../line/api.ts';
import {
  candidatesCard,
  decidedCard,
  googleCalendarUrl,
  readjustCard,
  recruitCard,
  setDeadlineCard,
  tentativeCard,
} from '../line/flex.ts';

export type EventRow = typeof events.$inferSelect;
export type Status = 'collecting' | 'candidates' | 'tentative' | 'decided';

const BATCH_MS = 5 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export function newId(len = 12): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

function liffId(): string {
  const id = env.LIFF_ID;
  if (!id) throw new Error('LIFF_ID is not set');
  return id;
}

export async function log(eventId: string | null, userId: string | null, action: string, detail?: unknown) {
  await db.insert(logs).values({ eventId, userId, action, detail: detail === undefined ? null : JSON.stringify(detail) });
}

// ---- 作成用トークン ----

export async function issueCreateToken(groupId: string, name: string | null): Promise<string> {
  const token = newId(16);
  const expiresAt = new Date(Date.now() + 30 * 24 * HOUR_MS).toISOString();
  await db.insert(createTokens).values({ token, groupId, name, expiresAt });
  return token;
}

export async function readCreateToken(token: string) {
  const [row] = await db.select().from(createTokens).where(eq(createTokens.token, token));
  if (!row || row.expiresAt < new Date().toISOString()) return null;
  return row;
}

// ---- 読み込み ----

export async function loadEvent(id: string): Promise<EventRow | null> {
  const [ev] = await db.select().from(events).where(eq(events.id, id));
  return ev ?? null;
}

export interface Answers {
  answers: ParticipantAnswer[];
  names: Map<string, string>;
  rows: (typeof participants.$inferSelect)[];
}

export async function loadAnswers(eventId: string): Promise<Answers> {
  const [ps, wds, marks] = await Promise.all([
    db.select().from(participants).where(eq(participants.eventId, eventId)),
    db.select().from(weekdayNg).where(eq(weekdayNg.eventId, eventId)),
    db.select().from(dateMarks).where(eq(dateMarks.eventId, eventId)),
  ]);
  const answers = ps.map<ParticipantAnswer>((p) => ({
    userId: p.userId,
    weekdayNg: wds.filter((w) => w.userId === p.userId).map((w) => w.weekday),
    marks: Object.fromEntries(marks.filter((m) => m.userId === p.userId).map((m) => [m.date, m.mark as Mark])),
    wish: p.wishText,
  }));
  return { answers, names: new Map(ps.map((p) => [p.userId, p.displayName])), rows: ps };
}

export async function latestRound(eventId: string) {
  const [r] = await db
    .select()
    .from(candidateRounds)
    .where(eq(candidateRounds.eventId, eventId))
    .orderBy(desc(candidateRounds.id))
    .limit(1);
  return r ? { ...r, dates: JSON.parse(r.dates) as DateStr[] } : null;
}

async function update(id: string, patch: Partial<EventRow>) {
  await db.update(events).set(patch).where(eq(events.id, id));
}

// ---- 期限の計算 ----

/** 仮決定の期限：翌日21:00。仮決定の日がそれより前なら前日12:00 */
export function tentativeUntil(now: Date, date: DateStr): Date {
  const base = jstAt(addDays(todayJst(now), 1), 21);
  if (jstAt(date, 0) < base) return jstAt(addDays(date, -1), 12);
  return base;
}

/** 候補の締切：2日後の21:00 */
export function roundDeadline(now: Date): Date {
  return jstAt(addDays(todayJst(now), 2), 21);
}

function announceAt(now: Date, delayMs: number): string {
  return shiftOutOfNight(new Date(now.getTime() + delayMs)).toISOString();
}

function joinNote(a: string | null | undefined, b: string | null | undefined): string | null {
  return [a, b].filter(Boolean).join('\n') || null;
}

// ---- 状態を進める ----

/**
 * 集計して、仮決定か候補の状態にする。告知は announceAfter に予約する。
 */
async function advance(ev: EventRow, now: Date, opts: { note?: string; delayMs?: number; forceCandidates?: boolean } = {}) {
  const { answers } = await loadAnswers(ev.id);
  const outcome = decide(ev.startDate, ev.endDate, todayJst(now), answers);
  const patch: Partial<EventRow> = {
    announceAfter: announceAt(now, opts.delayMs ?? 0),
    pendingNote: joinNote(ev.pendingNote, opts.note),
    decidedDate: null,
  };
  if (outcome.kind === 'tentative') {
    patch.status = 'tentative';
    patch.tentativeDate = outcome.date;
    patch.tentativeUntil = tentativeUntil(now, outcome.date).toISOString();
  } else if (outcome.kind === 'candidates') {
    patch.status = 'candidates';
    patch.tentativeDate = null;
    patch.tentativeUntil = null;
    const dates = outcome.days.map((d) => d.date);
    const prev = await latestRound(ev.id);
    const same = prev && ev.status === 'candidates' && sameSet(prev.dates, dates);
    if (!same) {
      await db.insert(candidateRounds).values({
        eventId: ev.id,
        dates: JSON.stringify(dates),
        deadline: roundDeadline(now).toISOString(),
      });
    }
  } else {
    // 期間がすべて過ぎた
    patch.pendingNote = joinNote(patch.pendingNote, '期間がすべて過ぎました。期間を延ばしてください。');
    patch.announcedKey = null;
  }
  await update(ev.id, patch);
  await log(ev.id, null, 'advance', { kind: outcome.kind, status: patch.status });
}

function sameSet(a: string[], b: string[]): boolean {
  return a.length === b.length && [...a].sort().join() === [...b].sort().join();
}

async function refreshGroupSize(ev: EventRow): Promise<number | null> {
  const n = await groupMemberCount(ev.groupId);
  if (n != null && n !== ev.groupSize) await update(ev.id, { groupSize: n });
  return n ?? ev.groupSize;
}

/** 回答が保存されたあとに呼ぶ */
export async function afterAnswer(eventId: string, userId: string, userName: string, before: ParticipantAnswer | null, now = new Date()) {
  const ev = await loadEvent(eventId);
  if (!ev) return;
  const { answers } = await loadAnswers(eventId);
  const me = answers.find((a) => a.userId === userId)!;

  switch (ev.status as Status) {
    case 'collecting': {
      const size = await refreshGroupSize(ev);
      if (size != null && answers.length >= size) {
        await advance(ev, now);
      }
      return;
    }
    case 'candidates': {
      const round = await latestRound(ev.id);
      const outcome = decide(ev.startDate, ev.endDate, todayJst(now), answers);
      let note: string | undefined;
      if (outcome.kind === 'tentative' && before && isNg(before, outcome.date) && !isNg(me, outcome.date)) {
        note = `${userName}が ${formatShort(outcome.date)} を空けました。`;
      }
      if (outcome.kind === 'tentative' || (outcome.kind === 'candidates' && !sameSet(round?.dates ?? [], outcome.days.map((d) => d.date)))) {
        await advance(ev, now, { note, delayMs: BATCH_MS });
      }
      return;
    }
    case 'tentative': {
      const date = ev.tentativeDate!;
      if (answers.some((a) => isNg(a, date))) {
        const note = isNg(me, date) ? `${userName}が ${formatShort(date)} に都合が悪くなりました。` : undefined;
        await advance(ev, now, { note, delayMs: BATCH_MS });
      }
      return;
    }
    case 'decided': {
      const date = ev.decidedDate!;
      if (isNg(me, date) && !(before && isNg(before, date))) {
        await update(ev.id, {
          pendingNote: joinNote(ev.pendingNote, `${userName}が ${formatShort(date)} に都合が悪くなりました。`),
          announceAfter: announceAt(now, BATCH_MS),
        });
      }
      return;
    }
  }
}

/** ［もう一度調整する］ */
export async function readjust(eventId: string, now = new Date()) {
  const ev = await loadEvent(eventId);
  if (!ev || ev.status !== 'decided') return;
  await advance({ ...ev, status: 'candidates' }, now, {});
  await log(ev.id, null, 'readjust');
}

/** 期間や締切を変えた */
export async function changePeriod(
  ev: EventRow,
  patch: { startDate?: DateStr; endDate?: DateStr; answerDeadline?: string | null },
  byName: string,
  now = new Date(),
) {
  const next = { ...ev, ...patch };
  await update(ev.id, patch);
  const notes: string[] = [];
  if (patch.endDate && patch.endDate !== ev.endDate) {
    const [, m, d] = patch.endDate.split('-').map(Number);
    notes.push(`${byName}が期間を ${m}/${d} まで${patch.endDate > ev.endDate ? '延ばしました' : 'にしました'}。`);
  }
  if (patch.startDate && patch.startDate !== ev.startDate) {
    notes.push(`${byName}が期間の始まりを ${formatShort(patch.startDate)} にしました。`);
  }
  if ('answerDeadline' in patch && patch.answerDeadline !== ev.answerDeadline) {
    notes.push(patch.answerDeadline ? `${byName}が締切を決めました。` : `${byName}が締切をなしにしました。`);
  }
  if (!notes.length) return;
  if (ev.status === 'collecting') {
    // 募集カードを出し直す
    await update(ev.id, { announcedKey: null, pendingNote: joinNote(ev.pendingNote, notes.join('\n')), announceAfter: now.toISOString() });
  } else {
    await advance({ ...next, announcedKey: null } as EventRow, now, { note: notes.join('\n') });
    await update(ev.id, { announcedKey: null });
  }
  await log(ev.id, null, 'change_period', patch);
}

// ---- 告知 ----

async function currentKey(ev: EventRow, answers: ParticipantAnswer[]): Promise<string> {
  switch (ev.status as Status) {
    case 'collecting':
      return 'collecting';
    case 'tentative':
      return `tentative:${ev.tentativeDate}`;
    case 'candidates': {
      const r = await latestRound(ev.id);
      return `candidates:${r?.id}`;
    }
    case 'decided': {
      const broken = answers.some((a) => isNg(a, ev.decidedDate!));
      return `${broken ? 'broken' : 'decided'}:${ev.decidedDate}`;
    }
  }
}

/** 予約された告知を、状態が前回と変わっていればグループに出す */
export async function announce(ev: EventRow) {
  const { answers, names } = await loadAnswers(ev.id);
  const key = await currentKey(ev, answers);
  const clear = { announceAfter: null, pendingNote: null } as Partial<EventRow>;
  if (key === ev.announcedKey) {
    await update(ev.id, clear);
    return;
  }
  const lid = liffId();
  const msgs: LineMessage[] = [];
  const note = ev.pendingNote;
  const nameOf = (u: string) => names.get(u) ?? '？';

  switch (ev.status as Status) {
    case 'collecting':
      msgs.push(recruitCard(lid, ev, note ?? undefined));
      break;
    case 'tentative': {
      if (note) msgs.push({ type: 'text', text: note });
      const date = ev.tentativeDate!;
      msgs.push(tentativeCard(lid, ev, date, new Date(ev.tentativeUntil!)));
      const ng = answers.filter((a) => isNg(a, date)).map((a) => a.userId);
      if (ng.length) msgs.push(mentionText(`{mentions} ${formatShort(date)} は空いてないと答えています`, ng));
      break;
    }
    case 'candidates': {
      if (note) msgs.push({ type: 'text', text: note });
      const r = (await latestRound(ev.id))!;
      const rows = r.dates.map((date) => ({
        date,
        ngNames: answers.filter((a) => isNg(a, date)).map((a) => nameOf(a.userId)),
      }));
      msgs.push(candidatesCard(lid, ev, rows, new Date(r.deadline)));
      const ng = [...new Set(r.dates.flatMap((date) => answers.filter((a) => isNg(a, date)).map((a) => a.userId)))];
      if (ng.length) msgs.push(mentionText('{mentions} 候補の日を見直してみてください', ng));
      break;
    }
    case 'decided': {
      const date = ev.decidedDate!;
      if (key.startsWith('broken')) {
        msgs.push(readjustCard(ev, note ?? `${formatShort(date)} に都合が悪い人が出ました。`));
      } else {
        if (note) msgs.push({ type: 'text', text: note });
        msgs.push(decidedCard(ev, date, googleCalendarUrl(ev.name, date, addDays(date, 1))));
      }
      break;
    }
  }
  await push(ev.groupId, msgs);
  await update(ev.id, { ...clear, announcedKey: key });
  await log(ev.id, null, 'announce', { key, count: msgs.length });
}

// ---- Cron ----

export async function tick(now = new Date()) {
  const iso = now.toISOString();
  console.log('tick', iso);
  const open = await db
    .select()
    .from(events)
    .where(or(ne(events.status, 'decided'), isNotNull(events.announceAfter)));

  for (const ev of open) {
    try {
      await tickEvent(ev, now, iso);
    } catch (e) {
      console.error('tick failed', ev.id, e);
    }
  }
}

async function tickEvent(ev: EventRow, now: Date, iso: string) {
  switch (ev.status as Status) {
    case 'collecting': {
      if (ev.answerDeadline && ev.answerDeadline <= iso) {
        const { answers } = await loadAnswers(ev.id);
        if (answers.length === 0) {
          // 誰も答えていない：締切を外して作った人に知らせる
          await update(ev.id, { answerDeadline: null, deadlineNudgedAt: null });
          await push(ev.groupId, [mentionText('{mentions} 締切までに回答がありませんでした', [ev.createdBy]), setDeadlineCard(liffId(), ev)]);
          return;
        }
        await advance(ev, now);
        ev = (await loadEvent(ev.id))!;
        break;
      }
      // 締切の前日（締切の24時間前）に「明日までです」
      if (
        ev.answerDeadline &&
        !ev.reminderSentAt &&
        new Date(ev.answerDeadline).getTime() - now.getTime() <= 24 * HOUR_MS &&
        new Date(ev.answerDeadline).getTime() - new Date(ev.createdAt).getTime() > 36 * HOUR_MS
      ) {
        await update(ev.id, { reminderSentAt: iso });
        await push(ev.groupId, [recruitCard(liffId(), ev, '明日までです')]);
        return;
      }
      // 締切なしで3日たっても揃わない
      if (!ev.answerDeadline && !ev.deadlineNudgedAt && now.getTime() - new Date(ev.createdAt).getTime() >= 72 * HOUR_MS) {
        const h = Number(new Date(now.getTime() + 9 * HOUR_MS).toISOString().slice(11, 13));
        if (h < 8 || h >= 22) return;
        await update(ev.id, { deadlineNudgedAt: iso });
        await push(ev.groupId, [mentionText('{mentions} まだ全員そろっていません。締切を決めませんか', [ev.createdBy]), setDeadlineCard(liffId(), ev)]);
        return;
      }
      break;
    }
    case 'candidates': {
      const r = await latestRound(ev.id);
      if (r && r.deadline <= iso) {
        // 空いてない人が一番少ない日を仮決定にする（今の回答で並べ直す）
        const { answers } = await loadAnswers(ev.id);
        const today = todayJst(now);
        const live = dayStats(r.dates.filter((d) => d >= today), answers).sort(compareDays);
        if (!live.length) {
          await advance(ev, now);
          ev = (await loadEvent(ev.id))!;
          break;
        }
        const date = live[0].date;
        await update(ev.id, {
          status: 'tentative',
          tentativeDate: date,
          tentativeUntil: tentativeUntil(now, date).toISOString(),
          announceAfter: iso,
        });
        await log(ev.id, null, 'round_deadline', { date });
        ev = (await loadEvent(ev.id))!;
      }
      break;
    }
    case 'tentative': {
      if (ev.tentativeUntil && ev.tentativeUntil <= iso) {
        await update(ev.id, { status: 'decided', decidedDate: ev.tentativeDate, announceAfter: iso });
        await log(ev.id, null, 'decided', { date: ev.tentativeDate });
        ev = (await loadEvent(ev.id))!;
      }
      break;
    }
  }
  if (ev.announceAfter && ev.announceAfter <= iso) {
    await announce(ev);
  }
}

// ---- 回答の保存 ----

export interface AnswerInput {
  weekdayNg: number[];
  marks: Record<DateStr, Mark>;
  wish?: string | null;
}

export async function saveAnswer(ev: EventRow, user: { userId: string; name: string }, input: AnswerInput, now = new Date()) {
  const { answers } = await loadAnswers(ev.id);
  const before = answers.find((a) => a.userId === user.userId) ?? null;
  const iso = now.toISOString();
  const marks = Object.entries(input.marks).filter(([d, m]) => /^\d{4}-\d{2}-\d{2}$/.test(d) && ['ng', 'ok', 'unknown'].includes(m));
  const weekdays = [...new Set(input.weekdayNg.filter((w) => Number.isInteger(w) && w >= 0 && w <= 6))];

  const stmts = [
    db
      .insert(participants)
      .values({ eventId: ev.id, userId: user.userId, displayName: user.name, wishText: input.wish ?? null, firstAnsweredAt: iso, updatedAt: iso })
      .onConflictDoUpdate({
        target: [participants.eventId, participants.userId],
        set: { displayName: user.name, ...(input.wish !== undefined ? { wishText: input.wish } : {}), updatedAt: iso },
      }),
    db.delete(weekdayNg).where(and(eq(weekdayNg.eventId, ev.id), eq(weekdayNg.userId, user.userId))),
    db.delete(dateMarks).where(and(eq(dateMarks.eventId, ev.id), eq(dateMarks.userId, user.userId))),
    ...(weekdays.length
      ? [db.insert(weekdayNg).values(weekdays.map((weekday) => ({ eventId: ev.id, userId: user.userId, weekday })))]
      : []),
    ...chunk(marks, 20).map((part) =>
      db.insert(dateMarks).values(part.map(([date, mark]) => ({ eventId: ev.id, userId: user.userId, date, mark }))),
    ),
  ];
  await db.batch(stmts as unknown as Parameters<typeof db.batch>[0]);
  await log(ev.id, user.userId, before ? 'answer_update' : 'answer_first', { weekdays, marks: marks.length });
  await afterAnswer(ev.id, user.userId, user.name, before, now);
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

