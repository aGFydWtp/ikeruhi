import { useMemo, useState } from 'react';
import type { Mark } from '../core/aggregate.ts';
import { type DateStr, WEEKDAY_LABELS, addDays, diffDays, formatShort, todayJst } from '../core/dates.ts';
import { api, closeOr } from './api.ts';
import { PeriodCalendar, RangeCalendar } from './Calendar.tsx';
import { type NgState, activeDates, ngOf, setDateNg, toggleWeekday } from './ngState.ts';

export interface EventView {
  today: DateStr;
  event: {
    id: string;
    name: string;
    startDate: DateStr;
    endDate: DateStr;
    answerDeadline: string | null;
    status: 'collecting' | 'candidates' | 'tentative' | 'decided';
    tentativeDate: DateStr | null;
    tentativeUntil: string | null;
    decidedDate: DateStr | null;
  };
  round: { dates: DateStr[]; deadline: string; createdAt: string } | null;
  me: { weekdayNg: number[]; marks: Record<DateStr, Mark>; wish: string; updatedAt: string | null } | null;
}

function Header(props: { title: string; sub?: string }) {
  return (
    <header className="head">
      <div className="head-text">
        <h1 className="head-title">{props.title}</h1>
        {props.sub && <div className="head-sub">{props.sub}</div>}
      </div>
    </header>
  );
}

function SubmitBar(props: { label: string; disabled?: boolean; busy?: boolean; error?: string | null; onClick: () => void }) {
  return (
    <div className="bottom">
      <button type="button" className="primary" disabled={props.disabled || props.busy} onClick={props.onClick}>
        {props.busy ? '送信中…' : props.label}
      </button>
      {props.error && <div className="error">{props.error}</div>}
    </div>
  );
}

export function Done(props: { text: string }) {
  return <div className="center">{props.text}</div>;
}

function periodSub(start: DateStr, end: DateStr) {
  return `${formatShort(start)}〜${formatShort(end)}`;
}

// ---- 締切のチップ ----

type DeadlineKind = 'none' | '1d' | '3d' | '7d' | 'date';

function DeadlineChips(props: { kind: DeadlineKind; date: DateStr | null; min: DateStr; max: DateStr; onChange: (k: DeadlineKind, d: DateStr | null) => void }) {
  const opts: Array<[DeadlineKind, string]> = [
    ['none', 'なし'],
    ['1d', '明日まで'],
    ['3d', '3日以内'],
    ['7d', '1週間以内'],
  ];
  return (
    <div className="chips">
      {opts.map(([k, label]) => (
        <button key={k} type="button" className="chip" aria-pressed={props.kind === k} onClick={() => props.onChange(k, null)}>
          {label}
        </button>
      ))}
      <label className="chip" aria-pressed={props.kind === 'date'} style={{ position: 'relative' }}>
        {props.kind === 'date' && props.date ? `${formatShort(props.date)}まで` : '日付を指定'}
        <input
          className="date-input"
          type="date"
          min={props.min}
          max={props.max}
          value={props.date ?? ''}
          onChange={(e) => e.target.value && props.onChange('date', e.target.value)}
          onClick={(e) => (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.()}
        />
      </label>
    </div>
  );
}

function deadlineBody(kind: DeadlineKind, date: DateStr | null) {
  return kind === 'date' ? { kind, date } : { kind };
}

// ---- ② イベント作成 ----

export function CreateView(props: { token: string; initialName: string }) {
  const today = todayJst();
  const tomorrow = addDays(today, 1);
  const [name, setName] = useState(props.initialName);
  const [month, setMonth] = useState(tomorrow.slice(0, 8) + '01');
  const [start, setStart] = useState<DateStr | null>(null);
  const [end, setEnd] = useState<DateStr | null>(null);
  const [dk, setDk] = useState<DeadlineKind>('3d');
  const [dd, setDd] = useState<DateStr | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const pick = (d: DateStr) => {
    if (!start || end || d < start) {
      setStart(d);
      setEnd(null);
    } else if (diffDays(start, d) + 1 > 62) {
      setStart(d);
      setEnd(null);
    } else {
      setEnd(d);
    }
  };
  const ready = name.trim() && start && (dk !== 'date' || dd);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api('/api/events', {
        method: 'POST',
        body: JSON.stringify({ token: props.token, name: name.trim(), startDate: start, endDate: end ?? start, deadline: deadlineBody(dk, dd) }),
      });
      closeOr(() => setDone(true));
    } catch (e) {
      setError((e as Error).message === 'token_expired' ? 'このカードは期限切れです。もう一度 @いけるひ を呼んでください' : '送れませんでした');
    } finally {
      setBusy(false);
    }
  };

  if (done) return <Done text="グループに送りました" />;
  return (
    <main className="page">
      <div className="section-title">イベント名</div>
      <input className="input" value={name} maxLength={40} placeholder="忘年会" onChange={(e) => setName(e.target.value)} />
      <div className="section-title">いつ頃やる？{start && <span style={{ fontWeight: 500 }}>　{periodSub(start, end ?? start)}</span>}</div>
      <RangeCalendar month={month} onMonth={setMonth} min={tomorrow} start={start} end={end} onPick={pick} />
      <div className="section-title">締め切り</div>
      <DeadlineChips kind={dk} date={dd} min={tomorrow} max={end ?? start ?? addDays(tomorrow, 62)} onChange={(k, d) => { setDk(k); setDd(d); }} />
      <SubmitBar label="グループに送る" disabled={!ready} busy={busy} error={error} onClick={submit} />
    </main>
  );
}

// ---- 期間を延ばす・締切を決める（②を使い回す） ----

export function PeriodView(props: { data: EventView }) {
  const ev = props.data.event;
  const today = props.data.today;
  const [month, setMonth] = useState(ev.endDate.slice(0, 8) + '01');
  const [start, setStart] = useState<DateStr | null>(ev.startDate);
  const [end, setEnd] = useState<DateStr | null>(ev.endDate);
  const [dk, setDk] = useState<DeadlineKind | null>(null);
  const [dd, setDd] = useState<DateStr | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const minStart = ev.startDate < today ? ev.startDate : addDays(today, 1);

  const pick = (d: DateStr) => {
    if (!start || end || d < start) {
      setStart(d);
      setEnd(null);
    } else if (diffDays(start, d) + 1 <= 62) setEnd(d);
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/events/${ev.id}/period`, {
        method: 'PUT',
        body: JSON.stringify({
          startDate: start,
          endDate: end ?? start,
          ...(dk ? { deadline: deadlineBody(dk, dd) } : {}),
        }),
      });
      closeOr(() => setDone(true));
    } catch {
      setError('変えられませんでした');
    } finally {
      setBusy(false);
    }
  };

  if (done) return <Done text="変更しました" />;
  return (
    <main className="page">
      <Header title={ev.name} sub={start ? periodSub(start, end ?? start) : undefined} />
      <div className="section-title">いつ頃やる？</div>
      <RangeCalendar month={month} onMonth={setMonth} min={minStart} start={start} end={end} onPick={pick} />
      {ev.status === 'collecting' && (
        <>
          <div className="section-title">締め切り</div>
          <DeadlineChips
            kind={dk ?? (ev.answerDeadline ? 'date' : 'none')}
            date={dk ? dd : ev.answerDeadline ? todayJst(new Date(ev.answerDeadline)) : null}
            min={addDays(today, 1)}
            max={end ?? start ?? ev.endDate}
            onChange={(k, d) => { setDk(k); setDd(d); }}
          />
        </>
      )}
      <SubmitBar label="変更する" disabled={!start || (dk === 'date' && !dd)} busy={busy} error={error} onClick={submit} />
    </main>
  );
}

// ---- ③④ 共通：空いてない日を選ぶ ----

function NgPicker(props: { ev: EventView['event']; today: DateStr; state: NgState; onChange: (s: NgState) => void; wish: string; onWish: (w: string) => void; dates: DateStr[] }) {
  const { ev, today, state } = props;
  return (
    <>
      <div className="weekdays">
        {WEEKDAY_LABELS.map((w, i) => (
          <button key={w} type="button" className="wd" aria-pressed={state.weekdayNg.includes(i)} onClick={() => props.onChange(toggleWeekday(state, i, props.dates))}>
            {w}
          </button>
        ))}
      </div>
      <PeriodCalendar
        start={ev.startDate}
        end={ev.endDate}
        today={today}
        isNg={(d) => ngOf(state, d)}
        onToggle={(d) => props.onChange(setDateNg(state, d, !ngOf(state, d), props.dates))}
      />
      <textarea className="textarea" placeholder="土曜日だと嬉しい" maxLength={200} value={props.wish} onChange={(e) => props.onWish(e.target.value)} />
    </>
  );
}

function useSubmitAnswer(evId: string, state: NgState, wish: string) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/events/${evId}/answer`, {
        method: 'PUT',
        body: JSON.stringify({ weekdayNg: state.weekdayNg, marks: state.marks, wish: wish.trim() || null }),
      });
      closeOr(() => setDone(true));
    } catch {
      setError('送れませんでした');
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, done, submit };
}

// ---- ③ ざっくり回答 ----

export function RoughView(props: { data: EventView }) {
  const { event: ev, today, me } = props.data;
  const dates = useMemo(() => activeDates(ev.startDate, ev.endDate, today), [ev.startDate, ev.endDate, today]);
  const [state, setState] = useState<NgState>({ weekdayNg: me?.weekdayNg ?? [], marks: me?.marks ?? {} });
  const [wish, setWish] = useState(me?.wish ?? '');
  const s = useSubmitAnswer(ev.id, state, wish);
  if (s.done) return <Done text="送信しました" />;
  return (
    <main className="page">
      <Header title={ev.name} sub={periodSub(ev.startDate, ev.endDate)} />
      <div className="acc-body">
        <NgPicker ev={ev} today={today} state={state} onChange={setState} wish={wish} onWish={setWish} dates={dates} />
      </div>
      <SubmitBar label="送信する" busy={s.busy} error={s.error} onClick={s.submit} />
    </main>
  );
}

// ---- ④ 候補に答える ----

function leftLabel(deadlineIso: string, now = new Date()): string | null {
  const ms = new Date(deadlineIso).getTime() - now.getTime();
  if (ms <= 0) return null;
  const days = Math.floor(ms / (24 * 3600 * 1000));
  if (days >= 1) return `締切まで ${days}日`;
  const hours = Math.max(1, Math.floor(ms / (3600 * 1000)));
  return `締切まで ${hours}時間`;
}

export function RecheckView(props: { data: EventView }) {
  const { event: ev, today, me, round } = props.data;
  const dates = useMemo(() => activeDates(ev.startDate, ev.endDate, today), [ev.startDate, ev.endDate, today]);
  const targets: DateStr[] =
    ev.status === 'tentative' && ev.tentativeDate
      ? [ev.tentativeDate]
      : ev.status === 'decided' && ev.decidedDate
        ? [ev.decidedDate]
        : (round?.dates ?? []);
  const saved: NgState = { weekdayNg: me?.weekdayNg ?? [], marks: me?.marks ?? {} };
  const roundStart = ev.status === 'candidates' ? round?.createdAt : null;
  const answeredInRound = (d: DateStr) => {
    const m = saved.marks[d];
    if (m === 'ok' || m === 'unknown') return true;
    return m === 'ng' && !!me?.updatedAt && !!roundStart && me.updatedAt >= roundStart;
  };
  const [state, setState] = useState<NgState>(saved);
  const [touched, setTouched] = useState<Set<DateStr>>(() => new Set(targets.filter(answeredInRound)));
  const [wish, setWish] = useState(me?.wish ?? '');
  const [open, setOpen] = useState(false);
  const s = useSubmitAnswer(ev.id, state, wish);

  const choose = (d: DateStr, m: Mark) => {
    setTouched(new Set(touched).add(d));
    setState(m === 'ng' ? setDateNg(state, d, true, dates) : setDateNg(state, d, false, dates, m));
  };
  const onCalendar = (next: NgState) => {
    // カレンダーで候補の日を触ったら、行の答えにも反映する
    const t = new Set(touched);
    for (const d of targets) if (ngOf(next, d) !== ngOf(state, d)) t.add(d);
    setTouched(t);
    setState(next);
  };
  const selected = (d: DateStr): Mark | null => {
    if (!touched.has(d)) return null;
    const m = state.marks[d];
    if (m === 'ok' || m === 'unknown') return m;
    return ngOf(state, d) ? 'ng' : 'ok';
  };
  const deadline = ev.status === 'tentative' ? ev.tentativeUntil : ev.status === 'candidates' ? round?.deadline : null;
  const left = deadline ? leftLabel(deadline) : null;

  if (s.done) return <Done text="送信しました" />;
  return (
    <main className="page">
      <Header title={ev.name} sub={ev.status === 'tentative' ? '仮決定' : ev.status === 'decided' ? '決定' : periodSub(ev.startDate, ev.endDate)} />
      <div className="section-title">この日は空いてる？</div>
      <div className="rows">
        {targets.map((d) => {
          const sel = selected(d);
          const prevNg = !answeredInRound(d) && ngOf(saved, d);
          return (
            <div key={d} className={`row${sel ? ' answered' : ''}`}>
              <div className="row-date">
                {formatShort(d)}
                {prevNg && <div className="row-prev">前に空いてないと答えた日</div>}
              </div>
              <div className="marks">
                {(['ok', 'ng', 'unknown'] as Mark[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`mark${sel === m ? ` sel-${m}` : ''}`}
                    aria-pressed={sel === m}
                    aria-label={m === 'ok' ? '空いてる' : m === 'ng' ? '空いてない' : '分からない'}
                    onClick={() => choose(d, m)}
                  >
                    {m === 'ok' ? '○' : m === 'ng' ? '✕' : '?'}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {left && <div className="left">{left}</div>}
      <div className="acc">
        <button type="button" className="acc-btn" aria-expanded={open} onClick={() => setOpen(!open)}>
          空いてない日を見直す <span>{open ? '▴' : '▾'}</span>
        </button>
        {open && (
          <div className="acc-body">
            <NgPicker ev={ev} today={today} state={state} onChange={onCalendar} wish={wish} onWish={setWish} dates={dates} />
          </div>
        )}
      </div>
      <SubmitBar label="送信する" busy={s.busy} error={s.error} onClick={s.submit} />
    </main>
  );
}

