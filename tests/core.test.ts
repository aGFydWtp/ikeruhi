import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, formatShort, jstAt, shiftOutOfNight, todayJst, weekdayOf, formatDeadline } from '../src/core/dates.ts';
import { decide, isNg, type ParticipantAnswer } from '../src/core/aggregate.ts';
import { preferredWeekdays } from '../src/core/wish.ts';

test('dates', () => {
  assert.equal(weekdayOf('2026-12-29'), 2); // 火
  assert.equal(formatShort('2026-12-29'), '12/29(火)');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(todayJst(new Date('2026-11-07T15:30:00Z')), '2026-11-08');
  assert.equal(jstAt('2026-11-13', 21).toISOString(), '2026-11-13T12:00:00.000Z');
  assert.equal(formatDeadline(jstAt('2026-11-13', 21)), '11/13(金) 21:00');
});

test('night shift', () => {
  assert.equal(shiftOutOfNight(jstAt('2026-11-13', 23)).toISOString(), jstAt('2026-11-14', 8).toISOString());
  assert.equal(shiftOutOfNight(jstAt('2026-11-13', 3)).toISOString(), jstAt('2026-11-13', 8).toISOString());
  assert.equal(shiftOutOfNight(jstAt('2026-11-13', 12)).toISOString(), jstAt('2026-11-13', 12).toISOString());
});

test('wish', () => {
  assert.deepEqual([...preferredWeekdays('土曜日だと嬉しい')], [6]);
  assert.deepEqual([...preferredWeekdays('週末がいい')].sort(), [0, 6]);
  assert.deepEqual([...preferredWeekdays('月曜だと嬉しい')], [1]);
  assert.equal(preferredWeekdays('12月の後半').size, 0);
  assert.equal(preferredWeekdays('').size, 0);
});

const p = (userId: string, weekdayNg: number[] = [], marks: ParticipantAnswer['marks'] = {}, wish?: string): ParticipantAnswer => ({ userId, weekdayNg, marks, wish });

test('date mark overrides weekday', () => {
  const a = p('a', [2], { '2026-12-29': 'ok' });
  assert.equal(isNg(a, '2026-12-29'), false);
  assert.equal(isNg(a, '2027-01-05'), true);
});

test('tentative when someone-free day exists, prefers wish', () => {
  // 12/25(金)〜12/27(日)
  const out = decide('2026-12-25', '2026-12-27', '2026-11-07', [p('a'), p('b', [], {}, '土曜がいい')]);
  assert.equal(out.kind, 'tentative');
  assert.equal(out.kind === 'tentative' && out.date, '2026-12-26');
});

test('candidates sorted by ng count then unknown then date', () => {
  const out = decide('2026-12-21', '2026-12-25', '2026-11-07', [
    p('a', [1, 2, 3, 4, 5]),
    p('b', [], { '2026-12-22': 'ng', '2026-12-23': 'unknown' }),
  ]);
  assert.equal(out.kind, 'candidates');
  if (out.kind !== 'candidates') return;
  assert.deepEqual(out.days.map((d) => d.date), ['2026-12-21', '2026-12-24', '2026-12-25']);
  assert.deepEqual(out.days[0].ngUsers, ['a']);
});

test('past days are skipped', () => {
  const out = decide('2026-11-01', '2026-11-10', '2026-11-09', [p('a')]);
  assert.equal(out.kind === 'tentative' && out.date, '2026-11-09');
  assert.equal(decide('2026-11-01', '2026-11-05', '2026-11-09', [p('a')]).kind, 'none');
});
