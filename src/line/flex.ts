// bot が出す Flex カード。Flex はフォント指定・影・点線・回転ができないので、
// 若竹パレットの色と配置だけで雰囲気を出す。
import { type DateStr, WEEKDAY_LABELS, formatDeadline, formatShort, weekdayOf } from '../core/dates.ts';
import type { LineMessage } from './api.ts';

export const C = {
  theme: '#1F7A68',
  themeDark: '#165C4F',
  themeLight: '#DFF1EC',
  ng: '#D0503E',
  ngLight: '#FCE9E5',
  unknown: '#C6D0CD',
  ground: '#EFF4F2',
  text: '#1F2D2B',
  sub: '#56635F',
  line: '#E2EAE7',
};

type Box = Record<string, unknown>;

function text(t: string, opts: Box = {}): Box {
  return { type: 'text', text: t, color: C.text, size: 'md', wrap: true, ...opts };
}

function uriButton(label: string, uri: string, primary = true): Box {
  return {
    type: 'button',
    style: primary ? 'primary' : 'secondary',
    color: primary ? C.theme : C.themeLight,
    height: 'sm',
    action: { type: 'uri', label, uri },
  };
}

function postbackButton(label: string, data: string): Box {
  return {
    type: 'button',
    style: 'primary',
    color: C.theme,
    height: 'sm',
    action: { type: 'postback', label, data, displayText: label },
  };
}

function bubble(body: Box[], footer: Box[] = [], opts: { bodyBg?: string } = {}): Box {
  return {
    type: 'bubble',
    size: 'kilo',
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'md',
      paddingAll: '20px',
      backgroundColor: opts.bodyBg ?? '#FFFFFF',
      contents: body,
    },
    ...(footer.length
      ? {
          footer: {
            type: 'box',
            layout: 'vertical',
            spacing: 'sm',
            paddingAll: '16px',
            paddingTop: '0px',
            contents: footer,
          },
        }
      : {}),
  };
}

function flex(altText: string, contents: Box): LineMessage {
  return { type: 'flex', altText, contents };
}

function header(eventName: string, sub?: string): Box {
  return {
    type: 'box',
    layout: 'vertical',
    contents: [
      text(eventName, { weight: 'bold', size: 'lg' }),
      ...(sub ? [text(sub, { size: 'sm', color: C.sub })] : []),
    ],
  };
}

/** 月・日・曜日の日付ブロック */
function dateBlock(d: DateStr, dark = false): Box {
  const [, m, day] = d.split('-').map(Number);
  const bg = dark ? C.themeDark : C.themeLight;
  const fg = dark ? '#FFFFFF' : C.themeDark;
  return {
    type: 'box',
    layout: 'vertical',
    backgroundColor: bg,
    cornerRadius: '12px',
    paddingAll: '12px',
    width: '84px',
    contents: [
      text(`${m}月`, { size: 'sm', color: fg, align: 'center' }),
      text(String(day), { size: '3xl', weight: 'bold', color: fg, align: 'center' }),
      text(`${WEEKDAY_LABELS[weekdayOf(d)]}曜日`, { size: 'sm', color: fg, align: 'center' }),
    ],
  };
}

export function liffUrl(liffId: string, params: Record<string, string>): string {
  return `https://liff.line.me/${liffId}?${new URLSearchParams(params)}`;
}

function periodLabel(start: DateStr, end: DateStr): string {
  return `${formatShort(start)}〜${formatShort(end)}`;
}

// ---- カード ----

export function introCard(liffId: string, token: string): LineMessage {
  return flex(
    'いけるひ',
    bubble(
      [text('いけるひ', { weight: 'bold', size: 'xl', color: C.themeDark })],
      [uriButton('イベントを作る', liffUrl(liffId, { c: token }))],
    ),
  );
}

export function createCard(liffId: string, token: string, name: string): LineMessage {
  return flex(
    `${name}を作る`,
    bubble([text(name, { weight: 'bold', size: 'lg' })], [uriButton('イベントを作る', liffUrl(liffId, { c: token }))]),
  );
}

export interface EventLike {
  id: string;
  name: string;
  startDate: DateStr;
  endDate: DateStr;
  answerDeadline: string | null;
}

export function recruitCard(liffId: string, ev: EventLike, lead?: string): LineMessage {
  const rows: Box[] = [header(ev.name)];
  if (lead) rows.unshift(text(lead, { size: 'sm', color: C.ng, weight: 'bold' }));
  rows.push(
    {
      type: 'box',
      layout: 'vertical',
      spacing: 'xs',
      contents: [
        labelRow('期間', periodLabel(ev.startDate, ev.endDate)),
        labelRow('締切', ev.answerDeadline ? `${formatDeadline(new Date(ev.answerDeadline))}まで` : 'なし'),
      ],
    },
  );
  return flex(`${ev.name}の日程を聞いています`, bubble(rows, [uriButton('回答する', liffUrl(liffId, { e: ev.id }))]));
}

function labelRow(label: string, value: string): Box {
  return {
    type: 'box',
    layout: 'horizontal',
    contents: [
      text(label, { size: 'sm', color: C.sub, flex: 0, wrap: false }),
      text(value, { size: 'sm', margin: 'md' }),
    ],
  };
}

export function tentativeCard(liffId: string, ev: EventLike, date: DateStr, until: Date): LineMessage {
  return flex(
    `${ev.name}は ${formatShort(date)} で仮決定`,
    bubble(
      [
        header(ev.name),
        {
          type: 'box',
          layout: 'horizontal',
          spacing: 'lg',
          contents: [
            dateBlock(date),
            {
              type: 'box',
              layout: 'vertical',
              justifyContent: 'center',
              contents: [
                text('仮決定', { weight: 'bold', size: 'lg', color: C.themeDark }),
                text(`都合が悪い人は ${formatDeadline(until)} まで`, { size: 'sm', color: C.sub }),
              ],
            },
          ],
        },
      ],
      [
        uriButton('都合が悪い', liffUrl(liffId, { e: ev.id })),
        uriButton('期間を延ばす', liffUrl(liffId, { e: ev.id, v: 'period' }), false),
      ],
    ),
  );
}

export interface CandidateRow {
  date: DateStr;
  ngNames: string[];
}

export function candidatesCard(liffId: string, ev: EventLike, rows: CandidateRow[], deadline: Date): LineMessage {
  const list: Box[] = rows.map((r) => ({
    type: 'box',
    layout: 'horizontal',
    paddingTop: '8px',
    paddingBottom: '8px',
    borderWidth: '1px',
    borderColor: '#FFFFFF',
    contents: [
      text(formatShort(r.date), { weight: 'bold', flex: 0, wrap: false }),
      {
        type: 'box',
        layout: 'vertical',
        margin: 'lg',
        contents: [
          text('空いてない人', { size: 'xs', color: C.sub }),
          text(r.ngNames.map((n) => `＠${n}`).join(' ') || '—', { size: 'sm', color: C.ng }),
        ],
      },
    ],
  }));
  return flex(
    `${ev.name}：全員空いている日がありません`,
    bubble(
      [
        header(ev.name, `締切 ${formatDeadline(deadline)}`),
        text('全員空いている日がありません', { weight: 'bold' }),
        { type: 'separator', color: C.line },
        { type: 'box', layout: 'vertical', contents: list },
      ],
      [
        uriButton('予定を見直す', liffUrl(liffId, { e: ev.id })),
        uriButton('期間を延ばす', liffUrl(liffId, { e: ev.id, v: 'period' }), false),
      ],
    ),
  );
}

export function decidedCard(ev: EventLike, date: DateStr, calendarUrl: string): LineMessage {
  return flex(
    `${ev.name}は ${formatShort(date)} に決まりました`,
    bubble(
      [
        header(ev.name),
        {
          type: 'box',
          layout: 'horizontal',
          spacing: 'lg',
          contents: [
            dateBlock(date, true),
            {
              type: 'box',
              layout: 'vertical',
              justifyContent: 'center',
              contents: [text('決まりました', { weight: 'bold', size: 'lg', color: C.themeDark })],
            },
          ],
        },
      ],
      [uriButton('カレンダーに追加', calendarUrl)],
    ),
  );
}

export function readjustCard(ev: EventLike, note: string): LineMessage {
  return flex(
    note,
    bubble([header(ev.name), text(note)], [postbackButton('もう一度調整する', `readjust=${ev.id}`)]),
  );
}

export function setDeadlineCard(liffId: string, ev: EventLike): LineMessage {
  return flex(
    `${ev.name}の締切を決めませんか`,
    bubble([header(ev.name, '締切 なし')], [uriButton('締切を決める', liffUrl(liffId, { e: ev.id, v: 'period' }))]),
  );
}

/** Google カレンダーの予定作成リンク（終日） */
export function googleCalendarUrl(title: string, date: DateStr, nextDate: DateStr): string {
  const d = (s: string) => s.replaceAll('-', '');
  return `https://calendar.google.com/calendar/render?${new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${d(date)}/${d(nextDate)}`,
  })}`;
}
