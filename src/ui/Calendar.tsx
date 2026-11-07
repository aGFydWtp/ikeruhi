import { type DateStr, WEEKDAY_LABELS, addDays, weekdayOf } from '../core/dates.ts';

/** 期間にかかる週だけを、月ごとに縦に並べたカレンダー（③④共通） */
export function PeriodCalendar(props: {
  start: DateStr;
  end: DateStr;
  today: DateStr;
  isNg: (d: DateStr) => boolean;
  onToggle: (d: DateStr) => void;
}) {
  const months = splitMonths(props.start, props.end);
  return (
    <div className="cal">
      <div className="cal-row cal-head">
        {WEEKDAY_LABELS.map((w) => (
          <div key={w} className="cal-wd">{w}</div>
        ))}
      </div>
      {months.map(({ first, last }) => (
        <div key={first} className="cal-month">
          {weeksOf(first, last).map((week) => (
            <div key={week[0]} className="cal-row">
              {week.map((d) => {
                const inRange = d >= first && d <= last;
                if (!inRange) return <div key={d} className="cal-cell" />;
                const past = d < props.today;
                const ng = props.isNg(d);
                const isFirstOfMonth = d === first;
                const [, m, day] = d.split('-').map(Number);
                return (
                  <button
                    key={d}
                    type="button"
                    className={`cal-cell cal-day${ng ? ' is-ng' : ''}${past ? ' is-past' : ''}`}
                    disabled={past}
                    aria-pressed={ng}
                    aria-label={`${m}月${day}日${ng ? ' 空いてない' : ''}`}
                    onClick={() => props.onToggle(d)}
                  >
                    {isFirstOfMonth && <span className="cal-month-label">{m}月</span>}
                    {ng ? <span className="cal-x">✕</span> : <span className="cal-num">{day}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function splitMonths(start: DateStr, end: DateStr) {
  const out: Array<{ first: DateStr; last: DateStr }> = [];
  let first = start;
  while (first <= end) {
    const [y, m] = first.split('-').map(Number);
    const nextMonth = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
    const last = addDays(nextMonth, -1) < end ? addDays(nextMonth, -1) : end;
    out.push({ first, last });
    first = nextMonth;
  }
  return out;
}

function weeksOf(first: DateStr, last: DateStr): DateStr[][] {
  const weeks: DateStr[][] = [];
  let d = addDays(first, -weekdayOf(first));
  while (d <= last) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(d, i)));
    d = addDays(d, 7);
  }
  return weeks;
}

/** ②の範囲選択用の月カレンダー。始まりと終わりを押して選ぶ */
export function RangeCalendar(props: {
  month: DateStr; // その月の1日
  onMonth: (m: DateStr) => void;
  min: DateStr;
  max?: DateStr;
  start: DateStr | null;
  end: DateStr | null;
  onPick: (d: DateStr) => void;
}) {
  const [y, m] = props.month.split('-').map(Number);
  const next = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  const prev = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 10);
  const last = addDays(next, -1);
  const canPrev = props.min < props.month;
  return (
    <div className="cal">
      <div className="cal-nav">
        <button type="button" className="icon-btn" disabled={!canPrev} onClick={() => props.onMonth(prev)} aria-label="前の月">‹</button>
        <div className="cal-nav-title">{y === Number(props.min.slice(0, 4)) ? '' : `${y}年`}{m}月</div>
        <button type="button" className="icon-btn" onClick={() => props.onMonth(next)} aria-label="次の月">›</button>
      </div>
      <div className="cal-row cal-head">
        {WEEKDAY_LABELS.map((w) => (
          <div key={w} className="cal-wd">{w}</div>
        ))}
      </div>
      {weeksOf(props.month, last).map((week) => (
        <div key={week[0]} className="cal-row">
          {week.map((d) => {
            if (d < props.month || d > last) return <div key={d} className="cal-cell" />;
            const disabled = d < props.min || (props.max != null && d > props.max);
            const s = props.start;
            const e = props.end ?? props.start;
            const inSel = s != null && e != null && d >= s && d <= e;
            const edge = d === s || d === e;
            return (
              <button
                key={d}
                type="button"
                className={`cal-cell cal-day${inSel ? ' in-range' : ''}${edge ? ' is-edge' : ''}`}
                disabled={disabled}
                onClick={() => props.onPick(d)}
              >
                <span className="cal-num">{Number(d.slice(8))}</span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
