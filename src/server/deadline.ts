import { type DateStr, addDays, jstAt, todayJst } from '../core/dates.ts';

export type DeadlineInput =
  | { kind: 'none' }
  | { kind: '1d' | '3d' | '7d' }
  | { kind: 'date'; date: DateStr };

/** 締切の時刻はその日の21:00 */
export function resolveDeadline(input: DeadlineInput, now = new Date()): string | null {
  const today = todayJst(now);
  switch (input.kind) {
    case 'none':
      return null;
    case '1d':
      return jstAt(addDays(today, 1), 21).toISOString();
    case '3d':
      return jstAt(addDays(today, 3), 21).toISOString();
    case '7d':
      return jstAt(addDays(today, 7), 21).toISOString();
    case 'date':
      return jstAt(input.date, 21).toISOString();
  }
}
