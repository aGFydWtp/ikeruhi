// 日付は 'YYYY-MM-DD'（日本時間の暦日）の文字列で扱う。
// 時刻は UTC の ISO 文字列で保存し、締切などは日本時間で決める。

export type DateStr = string;

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
export const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'] as const;

/** 現在時刻の日本時間での暦日 */
export function todayJst(now: Date = new Date()): DateStr {
  return new Date(now.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10);
}

function toUtcMidnight(d: DateStr): number {
  const [y, m, day] = d.split('-').map(Number);
  return Date.UTC(y, m - 1, day);
}

export function addDays(d: DateStr, n: number): DateStr {
  return new Date(toUtcMidnight(d) + n * DAY_MS).toISOString().slice(0, 10);
}

export function diffDays(from: DateStr, to: DateStr): number {
  return Math.round((toUtcMidnight(to) - toUtcMidnight(from)) / DAY_MS);
}

/** 0=日曜 … 6=土曜 */
export function weekdayOf(d: DateStr): number {
  return new Date(toUtcMidnight(d)).getUTCDay();
}

export function eachDate(start: DateStr, end: DateStr): DateStr[] {
  const out: DateStr[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}

/** 日本時間のその日の hh:mm を UTC の Date にする */
export function jstAt(d: DateStr, hour: number, minute = 0): Date {
  return new Date(toUtcMidnight(d) + (hour * 60 + minute) * 60 * 1000 - JST_OFFSET_MS);
}

/** 12/29(火) */
export function formatShort(d: DateStr): string {
  const [, m, day] = d.split('-').map(Number);
  return `${m}/${day}(${WEEKDAY_LABELS[weekdayOf(d)]})`;
}

/** 締切などの時刻表示：11/13(金) 21:00 */
export function formatDeadline(at: Date): string {
  const jst = new Date(at.getTime() + JST_OFFSET_MS);
  const d = jst.toISOString().slice(0, 10);
  const hh = String(jst.getUTCHours()).padStart(2, '0');
  const mm = String(jst.getUTCMinutes()).padStart(2, '0');
  return `${formatShort(d)} ${hh}:${mm}`;
}

/** 日本時間の何時か */
export function jstHour(at: Date): number {
  return new Date(at.getTime() + JST_OFFSET_MS).getUTCHours();
}

/** 夜22:00〜朝8:00 に当たる時刻を、次の朝8:00 に送る */
export function shiftOutOfNight(at: Date): Date {
  const h = jstHour(at);
  if (h >= 8 && h < 22) return at;
  const day = todayJst(at);
  return h >= 22 ? jstAt(addDays(day, 1), 8) : jstAt(day, 8);
}
