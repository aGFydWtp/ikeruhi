// ③④ の「空いてない日」の状態。曜日の✕と日の印（ng/ok/unknown）を持つ。
// 画面の操作ルールは仕様書の③のとおり。
import { type DateStr, eachDate, weekdayOf } from '../core/dates.ts';
import type { Mark } from '../core/aggregate.ts';

export interface NgState {
  weekdayNg: number[];
  marks: Record<DateStr, Mark>;
}

export function ngOf(s: NgState, d: DateStr): boolean {
  const m = s.marks[d];
  if (m) return m === 'ng';
  return s.weekdayNg.includes(weekdayOf(d));
}

/** 期間内でまだ選べる日（今日以降） */
export function activeDates(start: DateStr, end: DateStr, today: DateStr): DateStr[] {
  return eachDate(start, end).filter((d) => d >= today);
}

/** 曜日トグルを押す */
export function toggleWeekday(s: NgState, w: number, dates: DateStr[]): NgState {
  const on = s.weekdayNg.includes(w);
  const marks = { ...s.marks };
  // その曜日の日ごとの ng/ok は曜日に任せる（? は残す）
  for (const d of dates) if (weekdayOf(d) === w && marks[d] !== 'unknown') delete marks[d];
  return {
    weekdayNg: on ? s.weekdayNg.filter((x) => x !== w) : [...s.weekdayNg, w].sort(),
    marks,
  };
}

/** 日を✕にする／外す */
export function setDateNg(s: NgState, d: DateStr, ng: boolean, dates: DateStr[], offMark?: Mark): NgState {
  const w = weekdayOf(d);
  let weekdayNg = s.weekdayNg;
  const marks = { ...s.marks };
  if (!ng && weekdayNg.includes(w)) {
    // 曜日で✕になった日を戻す：曜日トグルは外れ、残りの同じ曜日は個別の✕になる
    weekdayNg = weekdayNg.filter((x) => x !== w);
    for (const x of dates) if (weekdayOf(x) === w && x !== d && !marks[x]) marks[x] = 'ng';
  }
  if (ng) marks[d] = 'ng';
  else if (offMark) marks[d] = offMark;
  else delete marks[d];

  // 同じ曜日を個別に全部✕にすると、曜日トグルが点く
  const same = dates.filter((x) => weekdayOf(x) === w);
  if (ng && !weekdayNg.includes(w) && same.length > 1 && same.every((x) => marks[x] === 'ng')) {
    weekdayNg = [...weekdayNg, w].sort();
    for (const x of same) delete marks[x];
  }
  return { weekdayNg, marks };
}
