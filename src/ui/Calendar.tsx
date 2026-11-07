import { useState } from 'react';
import { type DateStr, addDays, weekdayOf } from '../core/dates.ts';

/** 週は月曜はじまり。表示の並びと曜日番号（0=日）の対応 */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
export const WEEK_LABELS = ['月', '火', '水', '木', '金', '土', '日'] as const;

/** 月曜を0とした列番号 */
const colOf = (d: DateStr) => (weekdayOf(d) + 6) % 7;

export function XIcon(props: { size?: number }) {
  const size = props.size ?? 16;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={size > 16 ? 2.2 : 3} strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function Chevron(props: { dir: 'left' | 'right' | 'up' | 'down' }) {
  const d = { left: 'm15 6-6 6 6 6', right: 'm9 6 6 6-6 6', up: 'm6 15 6-6 6 6', down: 'm6 9 6 6 6-6' }[props.dir];
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

/** 曜日トグル（③④共通） */
export function WeekdayToggles(props: { ng: number[]; onToggle: (w: number) => void }) {
  return (
    <div className="wds">
      {WEEK_ORDER.map((w, i) => {
        const on = props.ng.includes(w);
        return (
          <button
            key={w}
            type="button"
            className="wd"
            aria-pressed={on}
            aria-label={`${WEEK_LABELS[i]}曜日${on ? ' 空いてない' : ''}`}
            onClick={() => props.onToggle(w)}
          >
            {WEEK_LABELS[i]}
          </button>
        );
      })}
    </div>
  );
}

/** 期間の日だけを月ごとに並べたカレンダー（③④共通）。月の名前は最初の日の列に置く */
export function PeriodCalendar(props: {
  start: DateStr;
  end: DateStr;
  today: DateStr;
  isNg: (d: DateStr) => boolean;
  onToggle: (d: DateStr) => void;
}) {
  return (
    <div className="pcal">
      {splitMonths(props.start, props.end).map(({ first, last }) => {
        const m = Number(first.slice(5, 7));
        return (
          <div key={first} className="pcal-month">
            <div className="grid7">
              {Array.from({ length: 7 }, (_, i) => (
                <span key={i} className="pcal-label">{i === colOf(first) ? `${m}月` : ''}</span>
              ))}
            </div>
            <div className="grid7 pcal-days">
              {weekCells(first, last).map((d, i) => {
                if (!d) return <span key={i} className="pcal-cell" />;
                const day = Number(d.slice(8));
                if (d < props.today) {
                  return (
                    <span key={d} className="pcal-cell">
                      <span className="pcal-num is-past">{day}</span>
                    </span>
                  );
                }
                const ng = props.isNg(d);
                return (
                  <button
                    key={d}
                    type="button"
                    className="pcal-cell"
                    aria-pressed={ng}
                    aria-label={`${m}月${day}日${ng ? ' 空いてない' : ''}`}
                    onClick={() => props.onToggle(d)}
                  >
                    {ng ? (
                      <span className="pcal-num is-ng"><XIcon /></span>
                    ) : (
                      <span className="pcal-num">{day}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function splitMonths(start: DateStr, end: DateStr) {
  const out: Array<{ first: DateStr; last: DateStr }> = [];
  let first = start;
  while (first <= end) {
    const nextMonth = firstOfNextMonth(first);
    const monthEnd = addDays(nextMonth, -1);
    out.push({ first, last: monthEnd < end ? monthEnd : end });
    first = nextMonth;
  }
  return out;
}

function firstOfNextMonth(d: DateStr): DateStr {
  const [y, m] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
}

function firstOfPrevMonth(d: DateStr): DateStr {
  const [y, m] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 10);
}

/** first〜last を月曜はじまりの週に並べ、範囲外は null で埋める */
function weekCells(first: DateStr, last: DateStr): Array<DateStr | null> {
  const cells: Array<DateStr | null> = Array.from({ length: colOf(first) }, () => null);
  for (let d = first; d <= last; d = addDays(d, 1)) cells.push(d);
  while (cells.length % 7) cells.push(null);
  return cells;
}

function MonthNav(props: { month: DateStr; canPrev: boolean; canNext: boolean; onMonth: (m: DateStr) => void }) {
  const [y, m] = props.month.split('-').map(Number);
  return (
    <div className="mnav">
      <button type="button" className="mnav-btn" disabled={!props.canPrev} onClick={() => props.onMonth(firstOfPrevMonth(props.month))} aria-label="前の月">
        <Chevron dir="left" />
      </button>
      <span className="mnav-title">{y}年 {m}月</span>
      <button type="button" className="mnav-btn" disabled={!props.canNext} onClick={() => props.onMonth(firstOfNextMonth(props.month))} aria-label="次の月">
        <Chevron dir="right" />
      </button>
    </div>
  );
}

function WeekHead() {
  return (
    <div className="grid7 whead">
      {WEEK_LABELS.map((w) => (
        <span key={w}>{w}</span>
      ))}
    </div>
  );
}

/** ②の範囲選択。選んだ範囲は帯でつなぐ */
export function RangeCalendar(props: {
  month: DateStr; // その月の1日
  onMonth: (m: DateStr) => void;
  min: DateStr;
  start: DateStr | null;
  end: DateStr | null;
  onPick: (d: DateStr) => void;
}) {
  const last = addDays(firstOfNextMonth(props.month), -1);
  const s = props.start;
  const e = props.end ?? props.start;
  return (
    <div className="card cal">
      <MonthNav month={props.month} canPrev={props.min < props.month} canNext onMonth={props.onMonth} />
      <WeekHead />
      <div className="grid7 rcal-days">
        {weekCells(props.month, last).map((d, i) => {
          if (!d) return <span key={i} className="rcal-cell" />;
          const day = Number(d.slice(8));
          if (d < props.min) {
            return (
              <span key={d} className="rcal-cell">
                <span className="rcal-band"><span className="rcal-num is-past">{day}</span></span>
              </span>
            );
          }
          const inSel = s != null && e != null && d >= s && d <= e;
          const kind = !inSel ? '' : s === e ? 'single' : d === s ? 'start' : d === e ? 'end' : 'mid';
          return (
            <button key={d} type="button" className={`rcal-cell${kind ? ` is-${kind}` : ''}`} aria-pressed={inSel} onClick={() => props.onPick(d)}>
              <span className="rcal-band"><span className="rcal-num">{day}</span></span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** 締切の日付を1日だけ選ぶ小さなカレンダー */
export function DayPicker(props: { min: DateStr; max: DateStr; value: DateStr | null; onPick: (d: DateStr) => void }) {
  const init = (props.value ?? props.min).slice(0, 8) + '01';
  return <DayPickerInner key={init} init={init} {...props} />;
}


function DayPickerInner(props: { init: DateStr; min: DateStr; max: DateStr; value: DateStr | null; onPick: (d: DateStr) => void }) {
  const [month, setMonth] = useState(props.init);
  const last = addDays(firstOfNextMonth(month), -1);
  return (
    <div className="card dpick">
      <MonthNav month={month} canPrev={props.min < month} canNext={last < props.max} onMonth={setMonth} />
      <WeekHead />
      <div className="grid7 dpick-days">
        {weekCells(month, last).map((d, i) => {
          if (!d) return <span key={i} className="dpick-cell" />;
          const day = Number(d.slice(8));
          if (d < props.min || d > props.max) return <span key={d} className="dpick-cell is-past">{day}</span>;
          return (
            <button key={d} type="button" className="dpick-cell" aria-pressed={d === props.value} onClick={() => props.onPick(d)}>
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export interface DayTally {
  ok: number;
  ng: number;
  unknown: number;
}

/** ⑤ みんなの予定。日付の下に、空いてる・空いてない・分からないの人数を1本の棒で出す */
export function TallyCalendar(props: {
  start: DateStr;
  end: DateStr;
  today: DateStr;
  tally: (d: DateStr) => DayTally;
  selected: DateStr | null;
  onSelect: (d: DateStr) => void;
}) {
  return (
    <div className="card tcal">
      <div className="grid7 whead tcal-head">
        {WEEK_LABELS.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
      {splitMonths(props.start, props.end).map(({ first, last }) => {
        const m = Number(first.slice(5, 7));
        return (
          <div key={first} className="tcal-month">
            <div className="grid7">
              {Array.from({ length: 7 }, (_, i) => (
                <span key={i} className="pcal-label">{i === colOf(first) ? `${m}月` : ''}</span>
              ))}
            </div>
            <div className="grid7 pcal-days">
              {weekCells(first, last).map((d, i) => {
                if (!d) return <span key={i} className="tcal-cell" />;
                const day = Number(d.slice(8));
                const t = props.tally(d);
                const total = t.ok + t.ng + t.unknown;
                const past = d < props.today;
                const sel = d === props.selected;
                return (
                  <button
                    key={d}
                    type="button"
                    className={`tcal-cell${past ? ' is-past' : ''}`}
                    disabled={past}
                    aria-pressed={sel}
                    aria-label={`${m}月${day}日 空いてる${t.ok}人 空いてない${t.ng}人 分からない${t.unknown}人`}
                    onClick={() => props.onSelect(d)}
                  >
                    <span className={`pcal-num${sel ? ' is-sel' : ''}`}>{day}</span>
                    <span className="tbar">
                      {total > 0 && !past && (
                        <>
                          <span style={{ flex: t.ok, background: 'var(--theme)' }} />
                          <span style={{ flex: t.ng, background: 'var(--ng)' }} />
                          <span style={{ flex: t.unknown, background: 'var(--unknown)' }} />
                        </>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
