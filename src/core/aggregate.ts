import { type DateStr, eachDate, weekdayOf } from './dates.ts';
import { preferredWeekdays } from './wish.ts';

export type Mark = 'ng' | 'ok' | 'unknown';

export interface ParticipantAnswer {
  userId: string;
  weekdayNg: number[];
  /** date -> mark。曜日より優先 */
  marks: Record<DateStr, Mark>;
  wish?: string | null;
}

export interface DayStat {
  date: DateStr;
  ngUsers: string[];
  unknownUsers: string[];
  wishScore: number;
}

export function isNg(p: ParticipantAnswer, date: DateStr): boolean {
  const m = p.marks[date];
  if (m) return m === 'ng';
  return p.weekdayNg.includes(weekdayOf(date));
}

export function dayStats(
  dates: DateStr[],
  participants: ParticipantAnswer[],
): DayStat[] {
  const wishes = participants.map((p) => preferredWeekdays(p.wish));
  return dates.map((date) => {
    const wd = weekdayOf(date);
    return {
      date,
      ngUsers: participants.filter((p) => isNg(p, date)).map((p) => p.userId),
      unknownUsers: participants.filter((p) => p.marks[date] === 'unknown').map((p) => p.userId),
      wishScore: wishes.filter((w) => w.has(wd)).length,
    };
  });
}

/** 空いてない人が少ない → ?が少ない → 要望に合う → 早い */
export function compareDays(a: DayStat, b: DayStat): number {
  return (
    a.ngUsers.length - b.ngUsers.length ||
    a.unknownUsers.length - b.unknownUsers.length ||
    b.wishScore - a.wishScore ||
    (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)
  );
}

export type Outcome =
  | { kind: 'tentative'; date: DateStr; stats: DayStat[] }
  | { kind: 'candidates'; days: DayStat[]; stats: DayStat[] }
  | { kind: 'none'; stats: DayStat[] };

/**
 * 期間のうち today 以降の日から、仮決定の1日か候補3日を選ぶ。
 */
export function decide(
  start: DateStr,
  end: DateStr,
  today: DateStr,
  participants: ParticipantAnswer[],
): Outcome {
  const from = start > today ? start : today;
  if (from > end) return { kind: 'none', stats: [] };
  const stats = dayStats(eachDate(from, end), participants);
  const sorted = [...stats].sort(compareDays);
  if (sorted[0].ngUsers.length === 0) {
    return { kind: 'tentative', date: sorted[0].date, stats };
  }
  return { kind: 'candidates', days: sorted.slice(0, 3), stats };
}
