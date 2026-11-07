import { type ReactNode, useMemo, useState } from 'react';
import type { Mark } from '../core/aggregate.ts';
import { type DateStr, WEEKDAY_LABELS, addDays, diffDays, formatShort, todayJst, weekdayOf } from '../core/dates.ts';
import { api, closeOr } from './api.ts';
import { Chevron, DayPicker, PeriodCalendar, RangeCalendar, TallyCalendar, WeekdayToggles, XIcon } from './Calendar.tsx';
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
  everyone: { names: string[]; days: Record<DateStr, { ng: number[]; unknown: number[] }> };
}

function Header(props: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <header className="head">
      <div className="head-text">
        <h1 className="head-title">{props.title}</h1>
        {props.sub && <div className="head-sub">{props.sub}</div>}
      </div>
      {props.action}
    </header>
  );
}

function PeopleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="8.5" r="3" />
      <circle cx="16.5" cy="9.5" r="2.5" />
      <path d="M3.5 19.5c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5M15 14.5c2.8 0 5.5 1.8 5.5 5" />
    </svg>
  );
}

function EveryoneButton(props: { onClick: () => void }) {
  return (
    <button type="button" className="head-btn" aria-label="みんなの予定" onClick={props.onClick}>
      <PeopleIcon />
    </button>
  );
}

// ---- ⑤ みんなの予定 ----

export function EveryoneView(props: { data: EventView; onClose: () => void }) {
  const { event: ev, today, everyone } = props.data;
  const first = ev.startDate < today ? (today <= ev.endDate ? today : ev.endDate) : ev.startDate;
  const [sel, setSel] = useState<DateStr>(first);
  const all = everyone.names.map((_, i) => i);
  const dayOf = (d: DateStr) => everyone.days[d] ?? { ng: [], unknown: [] };
  const tally = (d: DateStr) => {
    const x = dayOf(d);
    const unknown = x.unknown.filter((i) => !x.ng.includes(i)).length;
    return { ng: x.ng.length, unknown, ok: all.length - x.ng.length - unknown };
  };
  const x = dayOf(sel);
  const ngNames = x.ng.map((i) => everyone.names[i]);
  const unknownNames = x.unknown.filter((i) => !x.ng.includes(i)).map((i) => everyone.names[i]);
  const okNames = all.filter((i) => !x.ng.includes(i) && !x.unknown.includes(i)).map((i) => everyone.names[i]);
  const groups: Array<[string, string, string[]]> = [
    ['空いてない', 'var(--ng)', ngNames],
    ['分からない', 'var(--unknown)', unknownNames],
    ['空いてる', 'var(--theme)', okNames],
  ];
  return (
    <main className="page">
      <Header
        title={ev.name}
        sub="みんなの予定"
        action={
          <button type="button" className="head-btn" aria-label="閉じる" onClick={props.onClose}>
            <XIcon size={22} />
          </button>
        }
      />
      <div className="body everyone">
        <TallyCalendar start={ev.startDate} end={ev.endDate} today={today} tally={tally} selected={sel} onSelect={setSel} />
        <span className="label rows-label">
          {Number(sel.slice(5, 7))}/{Number(sel.slice(8))}({WEEKDAY_LABELS[weekdayOf(sel)]})
        </span>
        <div className="card who">
          {groups
            .filter(([, , names]) => names.length > 0)
            .map(([label, color, names]) => (
              <div key={label} className="who-group">
                <span className="who-label">
                  <span className="who-dot" style={{ background: color }} />
                  {label}
                </span>
                <div className="who-names">
                  {names.map((n, i) => (
                    <span key={i}>{n}</span>
                  ))}
                </div>
              </div>
            ))}
          {all.length === 0 && <span className="who-label">まだ誰も答えていません</span>}
        </div>
      </div>
    </main>
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

// ---- 締切のチップ ----

type DeadlineKind = 'none' | '1d' | '3d' | '7d' | 'date';

function DeadlineChips(props: { kind: DeadlineKind; date: DateStr | null; min: DateStr; max: DateStr; onChange: (k: DeadlineKind, d: DateStr | null) => void }) {
  const [picker, setPicker] = useState(false);
  const opts: Array<[DeadlineKind, string]> = [
    ['none', 'なし'],
    ['1d', '明日まで'],
    ['3d', '3日以内'],
    ['7d', '1週間以内'],
  ];
  return (
    <>
      <div className="chips">
        {opts.map(([k, label]) => (
          <button key={k} type="button" className="chip" aria-pressed={props.kind === k} onClick={() => { setPicker(false); props.onChange(k, null); }}>
            {label}
          </button>
        ))}
        <button type="button" className="chip" aria-pressed={props.kind === 'date' && !!props.date} aria-expanded={picker} onClick={() => setPicker(!picker)}>
          {props.kind === 'date' && props.date ? `${formatShort(props.date)}まで` : '日付を指定'}
        </button>
      </div>
      {picker && (
        <DayPicker
          min={props.min}
          max={props.max}
          value={props.kind === 'date' ? props.date : null}
          onPick={(d) => { setPicker(false); props.onChange('date', d); }}
        />
      )}
    </>
  );
}

function deadlineBody(kind: DeadlineKind, date: DateStr | null) {
  return kind === 'date' ? { kind, date } : { kind };
}

/** 範囲の選び方：最初は1日、外側を押すとそちらへ広げ、内側を押すと近いほうの端を動かす */
function nextRange(start: DateStr | null, end: DateStr | null, d: DateStr): [DateStr, DateStr] {
  if (!start || !end) return [d, d];
  let s = start;
  let e = end;
  if (d < s) s = d;
  else if (d > e) e = d;
  else if (s === e) return [d, d];
  else if (diffDays(s, d) < diffDays(d, e)) s = d;
  else e = d;
  if (diffDays(s, e) + 1 > 62) return [d, d];
  return [s, e];
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
    const [s, e] = nextRange(start, end, d);
    setStart(s);
    setEnd(e);
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
      <div className="name-block">
        <label htmlFor="evName" className="label">イベント名</label>
        <input id="evName" className="name-input" value={name} maxLength={40} placeholder="忘年会" onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="body">
        <span className="label cal-label">いつ頃やる？</span>
        <RangeCalendar month={month} onMonth={setMonth} min={tomorrow} start={start} end={end} onPick={pick} />
        <div className="field">
          <span className="label">締め切り</span>
          <DeadlineChips kind={dk} date={dd} min={tomorrow} max={end ?? start ?? addDays(tomorrow, 62)} onChange={(k, d) => { setDk(k); setDd(d); }} />
        </div>
      </div>
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
    const [s, e] = nextRange(start, end, d);
    setStart(s);
    setEnd(e);
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
      <Header title={ev.name} />
      <div className="body">
      <span className="label cal-label">いつ頃やる？</span>
      <RangeCalendar month={month} onMonth={setMonth} min={minStart} start={start} end={end} onPick={pick} />
      {ev.status === 'collecting' && (
        <div className="field">
          <span className="label">締め切り</span>
          <DeadlineChips
            kind={dk ?? (ev.answerDeadline ? 'date' : 'none')}
            date={dk ? dd : ev.answerDeadline ? todayJst(new Date(ev.answerDeadline)) : null}
            min={addDays(today, 1)}
            max={end ?? start ?? ev.endDate}
            onChange={(k, d) => { setDk(k); setDd(d); }}
          />
        </div>
      )}
      </div>
      <SubmitBar label="変更する" disabled={!start || (dk === 'date' && !dd)} busy={busy} error={error} onClick={submit} />
    </main>
  );
}

// ---- ③④ 共通：空いてない日を選ぶ ----

function NgPicker(props: { ev: EventView['event']; today: DateStr; state: NgState; onChange: (s: NgState) => void; dates: DateStr[] }) {
  const { ev, today, state } = props;
  return (
    <>
      <WeekdayToggles ng={state.weekdayNg} onToggle={(w) => props.onChange(toggleWeekday(state, w, props.dates))} />
      <PeriodCalendar
        start={ev.startDate}
        end={ev.endDate}
        today={today}
        isNg={(d) => ngOf(state, d)}
        onToggle={(d) => props.onChange(setDateNg(state, d, !ngOf(state, d), props.dates))}
      />
    </>
  );
}

function WishField(props: { value: string; onChange: (w: string) => void; inCard?: boolean }) {
  return (
    <div className={`field wish${props.inCard ? ' in-card' : ''}`}>
      <label htmlFor="wish" className="label">要望</label>
      <textarea id="wish" className="textarea" placeholder="土曜日だと嬉しい" maxLength={200} value={props.value} onChange={(e) => props.onChange(e.target.value)} />
    </div>
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
  const [showAll, setShowAll] = useState(false);
  if (s.done) return <Done text="送信しました" />;
  if (showAll) return <EveryoneView data={props.data} onClose={() => setShowAll(false)} />;
  return (
    <main className="page">
      <Header
        title={ev.name}
        sub={ev.answerDeadline ? leftLabel(ev.answerDeadline) ?? undefined : undefined}
        action={<EveryoneButton onClick={() => setShowAll(true)} />}
      />
      <div className="body">
        <div className="card ng-card">
          <span className="label">空いてない日を選ぶ</span>
          <NgPicker ev={ev} today={today} state={state} onChange={setState} dates={dates} />
        </div>
        <WishField value={wish} onChange={setWish} />
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
  const [showAll, setShowAll] = useState(false);
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

  const allAnswered = targets.every((d) => selected(d) != null);
  const sub = left ?? (ev.status === 'tentative' ? '仮決定' : ev.status === 'decided' ? '決定' : undefined);

  if (s.done) return <Done text="送信しました" />;
  if (showAll) return <EveryoneView data={props.data} onClose={() => setShowAll(false)} />;
  return (
    <main className="page">
      <Header title={ev.name} sub={sub} action={<EveryoneButton onClick={() => setShowAll(true)} />} />
      <div className="body">
        <span className="label rows-label">この日は空いてる？</span>
        <div className="card rows">
          {targets.map((d) => {
            const sel = selected(d);
            const prevNg = !answeredInRound(d) && ngOf(saved, d);
            return (
              <div key={d} className={`row${sel ? ' answered' : ''}`}>
                <div className="row-main">
                  <span className="row-date">
                    {Number(d.slice(5, 7))}/{Number(d.slice(8))}
                    <span className="row-wd">({WEEKDAY_LABELS[weekdayOf(d)]})</span>
                  </span>
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
                {prevNg && <span className="row-prev">前に空いてないと答えた日</span>}
              </div>
            );
          })}
        </div>
        {open ? (
          <div className="card acc">
            <button type="button" className="acc-btn" aria-expanded onClick={() => setOpen(false)}>
              空いてない日を見直す
              <Chevron dir="up" />
            </button>
            <NgPicker ev={ev} today={today} state={state} onChange={onCalendar} dates={dates} />
            <WishField value={wish} onChange={setWish} inCard />
          </div>
        ) : (
          <button type="button" className="acc-pill" aria-expanded={false} onClick={() => setOpen(true)}>
            空いてない日を見直す
            <Chevron dir="down" />
          </button>
        )}
      </div>
      <SubmitBar label="送信する" disabled={!allAnswered} busy={s.busy} error={s.error} onClick={s.submit} />
    </main>
  );
}
